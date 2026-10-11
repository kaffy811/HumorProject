begin;

-- Draft candidates remain private until the author explicitly publishes one.
create table public.humor_drafts (
 image_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 foreign key(image_id,user_id) references public.humor_images(id,user_id) on delete cascade,
 image_path text not null check(image_path like user_id::text||'/%'),
 image_mime text not null check(image_mime in ('image/jpeg','image/png','image/webp','image/gif')),
 byte_count integer not null check(byte_count between 1 and 10000000),
 upload_status text not null default 'pending' check(upload_status in ('pending','ready')),
 ai_path text check(ai_path is null or ai_path like user_id::text||'/%'),
 image_sha256 text check(image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
 caption_id uuid unique references public.humor_captions(id),
 publish_key uuid unique,
 created_at timestamptz not null default now(),
 published_at timestamptz,
 check(upload_status<>'ready' or (ai_path is not null and image_sha256 is not null))
);
alter table public.humor_drafts enable row level security;
revoke all on public.humor_drafts from anon,authenticated;
grant select on public.humor_drafts to authenticated;
grant all on public.humor_drafts to service_role;
create policy "Read own Google drafts" on public.humor_drafts for select to authenticated
 using(user_id=(select auth.uid()) and (select public.humor_google_session()));

alter table public.humor_generations drop constraint humor_generations_image_id_key;
alter table public.humor_generations drop constraint humor_generations_provider_check;
alter table public.humor_generations add constraint humor_generations_provider_check check(provider in ('google','mock'));
alter table public.humor_generations add column request_key uuid;
create unique index humor_generation_request on public.humor_generations(user_id,request_key) where request_key is not null;
alter table public.humor_generations add column caption_candidates jsonb check(caption_candidates is null or (jsonb_typeof(caption_candidates)='array' and jsonb_array_length(caption_candidates)=4));
alter table public.humor_generations add column scene text;
alter table public.humor_generations add column joke_style text;
alter table public.humor_generations add column extra_context text check(extra_context is null or char_length(extra_context)<=120);

-- Original bytes go directly to Storage, not through a Vercel request body.
update storage.buckets set file_size_limit=10000000,allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'] where id='humor-images';

create function public.create_humor_draft(owner uuid,mime text,byte_count integer,extension text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if mime not in ('image/jpeg','image/png','image/webp','image/gif') or byte_count not between 1 and 10000000
  or extension is distinct from split_part(mime,'/',2) then raise exception 'Invalid image'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text,1));
 if (select count(*) from public.humor_drafts d where d.user_id=owner and d.created_at>now()-interval '1 hour')>=30 then raise exception 'Upload limit'; end if;
 insert into public.humor_images(user_id) values(owner) returning id into result;
 insert into public.humor_drafts(image_id,user_id,image_path,image_mime,byte_count)
 values(result,owner,owner::text||'/'||result::text||'.'||extension,mime,byte_count);
 return result;
end $$;
revoke all on function public.create_humor_draft(uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.create_humor_draft(uuid,text,integer,text) to service_role;

create function public.reserve_humor_generation(image_id uuid,owner uuid,request_key uuid,provider_name text,model_name text,system_text text,user_text text,settings jsonb,joke_style text,extra_context text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; draft public.humor_drafts;
begin
 perform pg_advisory_xact_lock(6909261009);
 select g.id into result from public.humor_generations g where g.user_id=owner and g.request_key=reserve_humor_generation.request_key and g.image_id=reserve_humor_generation.image_id;
 if found then return result; end if;
 select * into draft from public.humor_drafts d where d.image_id=reserve_humor_generation.image_id and d.user_id=owner and d.upload_status='ready' and d.caption_id is null;
 if not found then raise exception 'Missing ready draft'; end if;
 if provider_name='google' and (
  exists(select 1 from public.humor_generations g where g.user_id=owner and g.provider='google' and g.created_at>now()-interval '1 minute')
  or (select count(*) from public.humor_generations g where g.user_id=owner and g.provider='google' and g.created_at>now()-interval '1 day')>=10
  or (select count(*) from public.humor_generations g where g.provider='google' and g.created_at>now()-interval '1 day')>=100)
 then raise exception 'Generation limit'; end if;
 insert into public.humor_generations(image_id,user_id,provider,model,system_prompt,user_prompt,generation_config,image_path,image_mime,image_sha256,prompt_version,request_key,joke_style,extra_context)
 values(draft.image_id,owner,provider_name,model_name,system_text,user_text,settings,draft.ai_path,'image/png',draft.image_sha256,'creation-v2',reserve_humor_generation.request_key,reserve_humor_generation.joke_style,reserve_humor_generation.extra_context)
 returning id into result;
 return result;
end $$;
revoke all on function public.reserve_humor_generation(uuid,uuid,uuid,text,text,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.reserve_humor_generation(uuid,uuid,uuid,text,text,text,text,jsonb,text,text) to service_role;

create function public.publish_humor_draft(image_id uuid,owner uuid,generation_id uuid,candidate_id uuid,final_text text,publication_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare draft public.humor_drafts; generation public.humor_generations; result uuid;
begin
 select * into draft from public.humor_drafts d where d.image_id=publish_humor_draft.image_id and d.user_id=owner for update;
 if not found then raise exception 'Missing draft'; end if;
 if draft.caption_id is not null then return draft.caption_id; end if;
 if draft.upload_status<>'ready' or char_length(trim(final_text)) not between 1 and 200 then raise exception 'Invalid publication'; end if;
 select * into generation from public.humor_generations g where g.id=generation_id and g.image_id=draft.image_id and g.user_id=owner and g.status='completed' and g.provider='google';
 if not found or not exists(select 1 from jsonb_array_elements(generation.caption_candidates) c where c->>'id'=candidate_id::text) then raise exception 'Invalid candidate'; end if;
 insert into public.humor_captions(image_id,content) values(draft.image_id,trim(final_text)) returning id into result;
 update public.humor_images i set status='ready',storage_path=draft.image_path,description=generation.scene where i.id=draft.image_id and i.user_id=owner;
 update public.humor_drafts d set caption_id=result,publish_key=publication_key,published_at=now() where d.image_id=draft.image_id;
 return result;
end $$;
revoke all on function public.publish_humor_draft(uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.publish_humor_draft(uuid,uuid,uuid,uuid,text,uuid) to service_role;

-- Retire the old automatic four-caption publication path.
revoke execute on function public.complete_humor_image(uuid,uuid,text,text,text[],jsonb) from service_role;
comment on table public.humor_drafts is 'Creation flow migration 202610110001: private drafts and explicit publication';
commit;
