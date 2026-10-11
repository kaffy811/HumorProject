begin;
alter table public.humor_images add column image_width integer check(image_width>0), add column image_height integer check(image_height>0);
alter table public.humor_captions add column style text not null default 'Deadpan', add column deleted_at timestamptz;
update public.humor_captions c set style=g.joke_style from public.humor_drafts d,public.humor_generations g where d.caption_id=c.id and g.image_id=d.image_id and g.status='completed' and g.joke_style is not null;
create index humor_active_posts on public.humor_captions(created_at desc,id desc) where deleted_at is null;
create table public.humor_comments(id uuid primary key default gen_random_uuid(),caption_id uuid not null references public.humor_captions(id),user_id uuid not null references auth.users(id),content text not null check(char_length(trim(content)) between 1 and 1000),created_at timestamptz not null default now(),deleted_at timestamptz);
create index on public.humor_comments(caption_id) where deleted_at is null;
create table public.humor_reports(id uuid primary key default gen_random_uuid(),caption_id uuid not null references public.humor_captions(id),user_id uuid not null references auth.users(id),reason text not null check(reason in ('Spam','Harassment','Inappropriate content','Other')),created_at timestamptz not null default now(),unique(caption_id,user_id));
create table public.humor_feed_snapshots(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,sort text not null check(sort in ('hot','new')),post_ids uuid[] not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '20 minutes');
create index on public.humor_feed_snapshots(expires_at);
create table public.humor_ha_requests(user_id uuid not null references auth.users(id) on delete cascade,request_key uuid not null,caption_id uuid not null references public.humor_captions(id),has_ha boolean not null,created_at timestamptz not null default now(),primary key(user_id,request_key));
alter table public.humor_comments enable row level security;
alter table public.humor_reports enable row level security;
alter table public.humor_feed_snapshots enable row level security;
alter table public.humor_ha_requests enable row level security;
revoke all on public.humor_comments,public.humor_reports,public.humor_feed_snapshots,public.humor_ha_requests from anon,authenticated;
grant all on public.humor_comments,public.humor_reports,public.humor_feed_snapshots,public.humor_ha_requests to service_role;
grant select on public.humor_reports to authenticated;
create policy "Read own Google reports" on public.humor_reports for select to authenticated using(user_id=(select auth.uid()) and (select public.humor_google_session()));
drop policy "Read published captions" on public.humor_captions;
create policy "Read published captions" on public.humor_captions for select to authenticated using(deleted_at is null and exists(select 1 from public.humor_images i where i.id=image_id and i.status='ready'));
drop policy "Insert own vote on published caption" on public.humor_votes;
create policy "Insert own vote on published caption" on public.humor_votes for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=caption_id and c.deleted_at is null and i.status='ready'));
drop policy "Read published humor photos or own files" on storage.objects;
create policy "Read published humor photos or own files" on storage.objects for select to authenticated using(bucket_id='humor-images' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.humor_images i join public.humor_captions c on c.image_id=i.id where i.storage_path=name and i.status='ready' and c.deleted_at is null)));
create function public.humor_feed_page(owner uuid,ordering text,snapshot_id uuid default null,page_offset integer default 0,page_limit integer default 12) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snap public.humor_feed_snapshots; ids uuid[]; rows jsonb;
begin
 if ordering not in ('hot','new') or page_limit not between 1 and 12 or page_offset<0 then raise exception 'Invalid pagination'; end if;
 if snapshot_id is null then
  delete from public.humor_feed_snapshots where expires_at<now();
  select coalesce(array_agg(q.id order by q.score desc,q.created_at desc,q.id desc),'{}'::uuid[]) into ids from (
   select c.id,c.created_at,case when ordering='hot' then (select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1)::double precision / power(greatest(0,extract(epoch from (now()-c.created_at))/3600)+2,1.5) else 0 end as score
   from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.deleted_at is null and i.status='ready'
  ) q;
  insert into public.humor_feed_snapshots(user_id,sort,post_ids) values(owner,ordering,ids) returning * into snap;
 else
  select * into snap from public.humor_feed_snapshots s where s.id=snapshot_id and s.user_id=owner and s.sort=ordering and s.expires_at>now();
  if not found then raise exception 'Feed snapshot expired'; end if;
 end if;
 select coalesce(jsonb_agg(q.body order by q.pos),'[]'::jsonb) into rows from (
  select selected.pos,jsonb_build_object('id',c.id,'caption',c.content,'style',c.style,'createdAt',c.created_at,'imageId',i.id,'imagePath',i.storage_path,'imageWidth',i.image_width,'imageHeight',i.image_height,'authorId',i.user_id,'authorName',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarPath',p.avatar_path,'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=owner and v.value=1),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) body
  from unnest(snap.post_ids) with ordinality selected(id,pos) join public.humor_captions c on c.id=selected.id join public.humor_images i on i.id=c.image_id left join public.profiles p on p.id=i.user_id
  where selected.pos>page_offset and selected.pos<=page_offset+page_limit and c.deleted_at is null and i.status='ready'
 ) q;
 return jsonb_build_object('posts',rows,'snapshotId',snap.id,'cutoff',snap.created_at,'nextOffset',case when page_offset+page_limit<cardinality(snap.post_ids) then page_offset+page_limit else null end);
end $$;
revoke all on function public.humor_feed_page(uuid,text,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.humor_feed_page(uuid,text,uuid,integer,integer) to service_role;
create function public.toggle_humor_ha(post_id uuid,owner uuid,request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.humor_ha_requests; liked boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text||post_id::text,4));
 if not exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready') then raise exception 'Post not found'; end if;
 select * into previous from public.humor_ha_requests r where r.user_id=owner and r.request_key=toggle_humor_ha.request_key;
 if found then
  if previous.caption_id<>post_id then raise exception 'Invalid request'; end if;
  liked:=previous.has_ha;
 else
  select exists(select 1 from public.humor_votes v where v.caption_id=post_id and v.user_id=owner and v.value=1) into liked;
  liked:=not liked;
  if liked then insert into public.humor_votes(user_id,caption_id,value) values(owner,post_id,1) on conflict(user_id,caption_id) do update set value=1;
  else delete from public.humor_votes where user_id=owner and caption_id=post_id; end if;
  insert into public.humor_ha_requests(user_id,request_key,caption_id,has_ha) values(owner,toggle_humor_ha.request_key,post_id,liked);
 end if;
 return jsonb_build_object('viewerHasHa',liked,'haCount',(select count(*) from public.humor_votes v where v.caption_id=post_id and v.value=1));
end $$;
revoke all on function public.toggle_humor_ha(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.toggle_humor_ha(uuid,uuid,uuid) to service_role;
create or replace function public.publish_humor_draft(image_id uuid,owner uuid,generation_id uuid,candidate_id uuid,final_text text,publication_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare draft public.humor_drafts; generation public.humor_generations; result uuid;
begin
 select * into draft from public.humor_drafts d where d.image_id=publish_humor_draft.image_id and d.user_id=owner for update;
 if not found then raise exception 'Missing draft'; end if;
 if draft.caption_id is not null then return draft.caption_id; end if;
 if draft.upload_status<>'ready' or char_length(trim(final_text)) not between 1 and 200 then raise exception 'Invalid publication'; end if;
 select * into generation from public.humor_generations g where g.id=generation_id and g.image_id=draft.image_id and g.user_id=owner and g.status='completed' and g.provider='google';
 if not found or not exists(select 1 from jsonb_array_elements(generation.caption_candidates) c where c->>'id'=candidate_id::text) then raise exception 'Invalid candidate'; end if;
 insert into public.humor_captions(image_id,content,style) values(draft.image_id,trim(final_text),coalesce(generation.joke_style,'Deadpan')) returning id into result;
 update public.humor_images i set status='ready',storage_path=draft.image_path,description=generation.scene where i.id=draft.image_id and i.user_id=owner;
 update public.humor_drafts d set caption_id=result,publish_key=publication_key,published_at=now() where d.image_id=draft.image_id;
 return result;
end $$;
revoke all on function public.publish_humor_draft(uuid,uuid,uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.publish_humor_draft(uuid,uuid,uuid,uuid,text,uuid) to service_role;


commit;
