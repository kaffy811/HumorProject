begin;

-- Nullable names allow a new account to finish onboarding after authentication.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text check(first_name is null or length(trim(first_name)) between 1 and 80),
  last_name text check(last_name is null or length(trim(last_name)) between 1 and 80),
  avatar_path text check(avatar_path is null or avatar_path like id::text || '/%'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(first_name,last_name,avatar_path) on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy "Read own profile" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "Update own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));

create function public.humor_create_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id) values(new.id) on conflict(id) do nothing;
  return new;
end $$;
revoke all on function public.humor_create_profile() from public,anon,authenticated;
create trigger humor_user_created after insert on auth.users for each row execute function public.humor_create_profile();
-- Existing accounts must also have a profile; never overwrite their names.
insert into public.profiles(id) select id from auth.users on conflict(id) do nothing;

create function public.humor_profile_updated() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
revoke all on function public.humor_profile_updated() from public,anon,authenticated;
create trigger humor_profile_updated before update on public.profiles for each row execute function public.humor_profile_updated();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('humor-avatars','humor-avatars',false,2000000,array['image/jpeg','image/png','image/webp']);
create policy "Read own humor avatar" on storage.objects for select to authenticated
using(bucket_id='humor-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Upload own humor avatar" on storage.objects for insert to authenticated
with check(bucket_id='humor-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Delete unused own humor avatar" on storage.objects for delete to authenticated
using(bucket_id='humor-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
and not exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.avatar_path=name));

-- Text prompts and a reproducible image reference, never relational binary image data.
alter table public.humor_images add constraint humor_images_id_owner_unique unique(id,user_id);
create table public.humor_generations (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  foreign key(image_id,user_id) references public.humor_images(id,user_id) on delete cascade,
  provider text not null check(provider='google'),
  model text not null check(length(model) between 1 and 120),
  system_prompt text not null check(length(trim(system_prompt))>0),
  user_prompt text not null check(length(trim(user_prompt))>0),
  generation_config jsonb not null check(jsonb_typeof(generation_config)='object'),
  image_path text not null check(image_path like user_id::text || '/%'),
  image_mime text not null check(image_mime in ('image/jpeg','image/png','image/webp')),
  image_sha256 text not null check(image_sha256 ~ '^[0-9a-f]{64}$'),
  prompt_version text not null default 'campus-nyc-v1',
  status text not null default 'processing' check(status in ('processing','completed','failed')),
  usage_metadata jsonb check(usage_metadata is null or jsonb_typeof(usage_metadata)='object'),
  failure_stage text,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index on public.humor_generations(user_id,created_at);
alter table public.humor_generations enable row level security;
revoke all on public.humor_generations from anon,authenticated;
grant select on public.humor_generations to authenticated;
grant all on public.humor_generations to service_role;
create policy "Read own generation records" on public.humor_generations for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.reserve_humor_image() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.profiles where id=uid and length(trim(first_name))>0 and length(trim(last_name))>0) then raise exception 'Complete your profile'; end if;
  -- Serialize all reservations to enforce both per-user and global capacity.
  perform pg_advisory_xact_lock(6909261009);
  if exists(select 1 from public.humor_images where user_id=uid and created_at>now()-interval '1 minute')
  or (select count(*) from public.humor_images where user_id=uid and created_at>now()-interval '1 day')>=10
  or (select count(*) from public.humor_images where created_at>now()-interval '1 day')>=100 then raise exception 'Upload limit'; end if;
  insert into public.humor_images(user_id) values(uid) returning id into result; return result;
end $$;
revoke all on function public.reserve_humor_image() from public,anon;
grant execute on function public.reserve_humor_image() to authenticated;

-- Require a stored generation record before atomic publication of the four captions.
create or replace function public.complete_humor_image(image_id uuid,owner uuid,object_path text,scene text,lines text[]) returns void
language plpgsql security definer set search_path='' as $$
begin raise exception 'Use the audited Gemini publication function'; end $$;
revoke all on function public.complete_humor_image(uuid,uuid,text,text,text[]) from public,anon,authenticated,service_role;
create function public.complete_humor_image(image_id uuid,owner uuid,object_path text,scene text,lines text[],usage jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
  if array_length(lines,1) is distinct from 4 or
  (select count(distinct trim(line)) from unnest(lines) line)<>4 or
  exists(select 1 from unnest(lines) line where line is null or length(trim(line)) not between 1 and 240)
  then raise exception 'Four distinct captions required'; end if;
  if scene is null or length(trim(scene)) not between 1 and 2000 then raise exception 'Invalid scene'; end if;
  update public.humor_generations g set status='completed',usage_metadata=usage,completed_at=now()
  where g.image_id=complete_humor_image.image_id and g.user_id=owner and g.image_path=object_path and g.status='processing';
  if not found then raise exception 'Missing generation record'; end if;
  update public.humor_images i set storage_path=object_path,description=scene,status='ready'
  where i.id=complete_humor_image.image_id and i.user_id=owner and i.status='processing';
  if not found then raise exception 'Invalid reservation'; end if;
  insert into public.humor_captions(image_id,content) select complete_humor_image.image_id,trim(unnest(lines));
end $$;
revoke all on function public.complete_humor_image(uuid,uuid,text,text,text[],jsonb) from public,anon,authenticated;
grant execute on function public.complete_humor_image(uuid,uuid,text,text,text[],jsonb) to service_role;

commit;
