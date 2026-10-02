begin;
create table public.humor_images (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text unique, description text, status text not null default 'processing' check(status in ('processing','ready','failed')),
 created_at timestamptz not null default now(), check(storage_path is null or storage_path like user_id::text || '/%')
);
create table public.humor_captions (
 id uuid primary key default gen_random_uuid(), image_id uuid not null references public.humor_images(id) on delete cascade,
 content text not null check(length(trim(content)) between 1 and 240), created_at timestamptz not null default now()
);
create table public.humor_votes (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 caption_id uuid not null references public.humor_captions(id) on delete cascade,
 value smallint not null check(value in (-1,1)), created_at timestamptz not null default now(), unique(user_id,caption_id)
);
create index on public.humor_images(user_id,created_at);
create index on public.humor_captions(image_id);
create index on public.humor_votes(caption_id);
alter table public.humor_images enable row level security;
alter table public.humor_captions enable row level security;
alter table public.humor_votes enable row level security;
revoke all on public.humor_images,public.humor_captions,public.humor_votes from anon,authenticated;
grant select on public.humor_images,public.humor_captions,public.humor_votes to authenticated;
grant insert(user_id,caption_id,value) on public.humor_votes to authenticated;
create policy "Read ready images or own uploads" on public.humor_images for select to authenticated using(status='ready' or user_id=(select auth.uid()));
create policy "Read published captions" on public.humor_captions for select to authenticated using(exists(select 1 from public.humor_images i where i.id=image_id and i.status='ready'));
create policy "Read own votes" on public.humor_votes for select to authenticated using(user_id=(select auth.uid()));
create policy "Insert own vote on published caption" on public.humor_votes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=caption_id and i.status='ready'));
-- Only this narrow function can reserve an upload. No direct client image/caption writes.
create function public.reserve_humor_image() returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); result uuid;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if exists(select 1 from public.humor_images where user_id=uid and created_at>now()-interval '1 minute') or
 (select count(*) from public.humor_images where user_id=uid and created_at>now()-interval '1 day')>=10 then raise exception 'Upload limit'; end if;
 insert into public.humor_images(user_id) values(uid) returning id into result; return result;
end $$;
revoke all on function public.reserve_humor_image() from public,anon;
grant execute on function public.reserve_humor_image() to authenticated;
-- Atomic publication: an image never appears without its four captions.
create function public.complete_humor_image(image_id uuid,owner uuid,object_path text,scene text,lines text[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if array_length(lines,1) is distinct from 4 then raise exception 'Four captions required'; end if;
 update public.humor_images set storage_path=object_path,description=scene,status='ready' where id=image_id and user_id=owner and status='processing';
 if not found then raise exception 'Invalid reservation'; end if;
 insert into public.humor_captions(image_id,content) select image_id,unnest(lines);
end $$;
revoke all on function public.complete_humor_image(uuid,uuid,text,text,text[]) from public,anon,authenticated;
grant execute on function public.complete_humor_image(uuid,uuid,text,text,text[]) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('humor-images','humor-images',false,3000000,array['image/jpeg','image/png','image/webp']);
create policy "Read published humor photos or own files" on storage.objects for select to authenticated using(bucket_id='humor-images' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.humor_images i where i.storage_path=name and i.status='ready')));
create policy "Upload reserved humor photo" on storage.objects for insert to authenticated with check(bucket_id='humor-images' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.humor_images i where i.user_id=(select auth.uid()) and i.status='processing' and name in (i.user_id::text||'/'||i.id::text||'.jpeg',i.user_id::text||'/'||i.id::text||'.png',i.user_id::text||'/'||i.id::text||'.webp')));
create policy "Clean failed own humor upload" on storage.objects for delete to authenticated using(bucket_id='humor-images' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.humor_images i where i.storage_path=name and i.status='ready'));
commit;
