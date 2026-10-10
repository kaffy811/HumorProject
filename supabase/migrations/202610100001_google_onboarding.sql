begin;

-- Signup trigger continues to create nullable fields; onboarding fills them later.
alter table public.profiles add column username text
  check (username is null or username ~ '^[a-z0-9_]{3,24}$');
alter table public.profiles add constraint profiles_username_unique unique(username);
grant update(username) on public.profiles to authenticated;

-- Server-issued claims only. User-editable user_metadata is never a login proof.
create function public.humor_google_session() returns boolean
language sql stable security invoker set search_path='' as $$
  with methods as (
    select item->>'method' as method, (item->>'timestamp')::bigint as timestamp
    from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) item
    where item->>'method' not in ('token_refresh','totp','email_change')
  )
  select coalesce(
    auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false
    and (auth.jwt()->'app_metadata'->'providers') @> '["google"]'::jsonb
    and exists(select 1 from methods where method='oauth' and timestamp=(select max(timestamp) from methods))
    and not exists(select 1 from methods where method<>'oauth' and timestamp=(select max(timestamp) from methods)),
    false
  );
$$;
revoke all on function public.humor_google_session() from public,anon;
grant execute on function public.humor_google_session() to authenticated,service_role;

-- Restrictive policies intersect with existing ownership/publication policies.
create policy "Google session required" on public.profiles as restrictive for all to authenticated
  using((select public.humor_google_session())) with check((select public.humor_google_session()));
create policy "Google session required" on public.humor_images as restrictive for all to authenticated
  using((select public.humor_google_session())) with check((select public.humor_google_session()));
create policy "Google session required" on public.humor_captions as restrictive for all to authenticated
  using((select public.humor_google_session())) with check((select public.humor_google_session()));
create policy "Google session required" on public.humor_votes as restrictive for all to authenticated
  using((select public.humor_google_session())) with check((select public.humor_google_session()));
create policy "Google session required" on public.humor_generations as restrictive for all to authenticated
  using((select public.humor_google_session())) with check((select public.humor_google_session()));
create policy "Google session required for humor storage" on storage.objects as restrictive for all to authenticated
  using(bucket_id not in ('humor-images','humor-avatars') or (select public.humor_google_session()))
  with check(bucket_id not in ('humor-images','humor-avatars') or (select public.humor_google_session()));

create policy "Completed profile required to vote" on public.humor_votes as restrictive for insert to authenticated
  with check(exists(select 1 from public.profiles p where p.id=(select auth.uid())
    and length(trim(p.first_name))>0 and length(trim(p.last_name))>0
    and p.username is not null and p.avatar_path is not null));

-- A forged object name must not count as a completed avatar upload.
create function public.humor_validate_avatar() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path
    and not exists(select 1 from storage.objects where bucket_id='humor-avatars' and name=new.avatar_path
      and (storage.foldername(name))[1]=new.id::text)
  then raise exception 'Upload a profile photo first'; end if;
  return new;
end $$;
revoke all on function public.humor_validate_avatar() from public,anon,authenticated;
create trigger humor_validate_avatar before update of avatar_path on public.profiles
  for each row execute function public.humor_validate_avatar();

create or replace function public.reserve_humor_image() returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result uuid;
begin
  if not public.humor_google_session() then raise exception 'Google sign-in required'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid
    and length(trim(first_name))>0 and length(trim(last_name))>0 and username is not null
    and exists(select 1 from storage.objects o where o.bucket_id='humor-avatars' and o.name=p.avatar_path))
  then raise exception 'Complete your profile'; end if;
  perform pg_advisory_xact_lock(6909261009);
  if exists(select 1 from public.humor_images where user_id=uid and created_at>now()-interval '1 minute')
    or (select count(*) from public.humor_images where user_id=uid and created_at>now()-interval '1 day')>=10
    or (select count(*) from public.humor_images where created_at>now()-interval '1 day')>=100
  then raise exception 'Upload limit'; end if;
  insert into public.humor_images(user_id) values(uid) returning id into result; return result;
end $$;

commit;
