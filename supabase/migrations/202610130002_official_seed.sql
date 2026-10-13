begin;
alter table public.humor_captions add column source text not null default 'ai' check(source in ('ai','seed'));
-- One explicit, non-login system account. It has no email, password or OAuth identity.
do $$ declare uid uuid;begin
 select id into uid from public.profiles where username='little_mao';
 if uid is not null and not exists(select 1 from public.profiles where id=uid and is_official) then raise exception 'little_mao is already a member username';end if;
 if uid is null then
  uid:=gen_random_uuid();
  insert into auth.users(id,aud,role,banned_until,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(uid,'authenticated','authenticated','infinity'::timestamptz,'{"provider":"system","providers":[],"humor_system":true}'::jsonb,'{"name":"Little Mao"}'::jsonb,now(),now());
  update public.profiles set first_name='Little',last_name='Mao',username='little_mao',display_name='Little Mao',is_official=true,onboarded_at=now() where id=uid;
 end if;
end $$;
create unique index humor_one_host on public.profiles(is_official) where is_official;
create table public.humor_seed_imports (
 id uuid primary key default gen_random_uuid(),image_file text not null unique,image_id uuid references public.humor_images(id) on delete set null,
 caption_id uuid references public.humor_captions(id) on delete set null,status text not null default 'uploading' check(status in ('uploading','published')),
 is_placeholder boolean not null default false,environment text not null check(environment in ('production','development')),created_at timestamptz not null default now(),
 check(environment<>'production' or not is_placeholder)
);
alter table public.humor_seed_imports enable row level security;
revoke all on public.humor_seed_imports from anon,authenticated;
grant all on public.humor_seed_imports to service_role;
create function public.humor_reserve_seed(image_file text,environment text,is_placeholder boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare row public.humor_seed_imports;uid uuid;image uuid;
begin
 if environment not in ('production','development') or (environment='production' and is_placeholder) or length(image_file)>240 or image_file~'(^/|\.\.|\\)' then raise exception 'Invalid seed input';end if;
 select id into uid from public.profiles where username='little_mao' and is_official;
 if uid is null then raise exception 'Official profile missing';end if;
 insert into public.humor_seed_imports(image_file,environment,is_placeholder) values(image_file,environment,is_placeholder) on conflict on constraint humor_seed_imports_image_file_key do update set image_file=excluded.image_file returning * into row;
 if row.status='published' then return jsonb_build_object('status','published','postId',row.caption_id);end if;
 if row.image_id is null then
  insert into public.humor_images(user_id,status) values(uid,'processing') returning id into image;
  update public.humor_seed_imports s set image_id=image where s.id=row.id;row.image_id:=image;
 end if;
 return jsonb_build_object('id',row.id,'imageId',row.image_id,'authorId',uid,'status','uploading','imagePath',uid::text||'/'||row.image_id::text||'.webp');
end $$;
create function public.humor_publish_seed(import_id uuid,body text,joke_style text,posted_at timestamptz,width int,height int,object_path text) returns uuid language plpgsql security definer set search_path='' as $$
declare row public.humor_seed_imports;post uuid;uid uuid;
begin
 select * into row from public.humor_seed_imports s where s.id=import_id for update;
 if not found then raise exception 'Seed reservation missing';end if;
 if row.status='published' then return row.caption_id;end if;
 select id into uid from public.profiles where username='little_mao' and is_official;
 if length(trim(body)) not between 1 and 200 or joke_style not in ('Deadpan','Roast','Pun','Dad joke','Absurd','Wholesome') or posted_at>now() or posted_at<now()-interval '14 days' or width<1 or height<1 or object_path<>uid::text||'/'||row.image_id::text||'.webp' then raise exception 'Invalid seed publication';end if;
 if not exists(select 1 from storage.objects where bucket_id='humor-images' and name=object_path) or not exists(select 1 from public.humor_images where id=row.image_id and user_id=uid and locked_thumbnail_path is not null) then raise exception 'Seed media is not ready';end if;
 insert into public.humor_captions(image_id,content,style,created_at,source) values(row.image_id,trim(body),joke_style,posted_at,'seed') returning id into post;
 update public.humor_images set status='ready',storage_path=object_path,image_width=width,image_height=height,created_at=posted_at where id=row.image_id and user_id=uid;
 update public.humor_seed_imports set caption_id=post,status='published' where id=import_id;
 return post;
end $$;
revoke all on function public.humor_reserve_seed(text,text,boolean),public.humor_publish_seed(uuid,text,text,timestamptz,int,int,text) from public,anon,authenticated;
grant execute on function public.humor_reserve_seed(text,text,boolean),public.humor_publish_seed(uuid,text,text,timestamptz,int,int,text) to service_role;
commit;
