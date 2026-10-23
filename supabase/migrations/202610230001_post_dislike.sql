begin;
-- Existing votes already allow -1 and enforce one vote per member and post.
-- Reuse the private request ledger; old keys continue to mean Like.
alter table public.humor_ha_requests add column reaction smallint not null default 1 check(reaction in (-1,1));
create function public.toggle_humor_reaction(post_id uuid,owner uuid,request_key uuid,reaction smallint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.humor_ha_requests; current_value smallint;
begin
 if owner is null or request_key is null or reaction is null or reaction not in (-1,1) then raise exception 'Invalid rating request'; end if;
 -- Serialize both conflicting retries and opposite reactions on the same post.
 perform pg_advisory_xact_lock(hashtextextended(owner::text||request_key::text,423));
 perform pg_advisory_xact_lock(hashtextextended(owner::text||post_id::text,4));
 if not exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready') then raise exception 'Post not found'; end if;
 select * into previous from public.humor_ha_requests r where r.user_id=owner and r.request_key=toggle_humor_reaction.request_key;
 if found then
  if previous.caption_id<>post_id or previous.reaction<>toggle_humor_reaction.reaction then raise exception 'Invalid request'; end if;
 else
  select v.value into current_value from public.humor_votes v where v.caption_id=post_id and v.user_id=owner;
  if current_value=reaction then
   delete from public.humor_votes where user_id=owner and caption_id=post_id;
  else
   insert into public.humor_votes(user_id,caption_id,value) values(owner,post_id,reaction) on conflict(user_id,caption_id) do update set value=excluded.value;
  end if;
  insert into public.humor_ha_requests(user_id,request_key,caption_id,has_ha,reaction)
  values(owner,toggle_humor_reaction.request_key,post_id,exists(select 1 from public.humor_votes v where v.caption_id=post_id and v.user_id=owner and v.value=1),reaction);
 end if;
 -- Retry responses reflect the latest state without toggling a second time.
 return jsonb_build_object('viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=post_id and v.user_id=owner and v.value=1),'viewerHasDisliked',exists(select 1 from public.humor_votes v where v.caption_id=post_id and v.user_id=owner and v.value=-1),'haCount',(select count(*) from public.humor_votes v where v.caption_id=post_id and v.value=1));
end $$;
revoke all on function public.toggle_humor_reaction(uuid,uuid,uuid,smallint) from public,anon,authenticated;
grant execute on function public.toggle_humor_reaction(uuid,uuid,uuid,smallint) to service_role;
-- Preserve compatibility with the existing Like endpoint and cached clients.
create or replace function public.toggle_humor_ha(post_id uuid,owner uuid,request_key uuid) returns jsonb
language sql security definer set search_path='' as $$
 select public.toggle_humor_reaction(post_id,owner,request_key,1::smallint)
$$;
CREATE OR REPLACE FUNCTION public.humor_post(post_id uuid, viewer uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('firstPostPending',exists(select 1 from public.profiles p where p.id=viewer and p.first_post_notice_id=c.id and p.first_post_notice_seen_at is null),'id',c.id,'imageUrl','/api/posts/'||c.id::text||'/media','imageWidth',coalesce(i.image_width,800),'imageHeight',coalesce(i.image_height,800),'caption',c.content,'style',c.style,'createdAt',c.created_at,'author',public.humor_author(i.user_id),'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=viewer and v.value=1),'viewerHasDisliked',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=viewer and v.value=-1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=viewer),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready'
$function$
;
CREATE OR REPLACE FUNCTION public.humor_feed_page(owner uuid, ordering text, snapshot_id uuid DEFAULT NULL::uuid, page_offset integer DEFAULT 0, page_limit integer DEFAULT 12)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare snap public.humor_feed_snapshots; ids uuid[]; rows jsonb;
begin
 if ordering not in ('hot','new','mine','saved') or page_limit not between 1 and 12 or page_offset<0 then raise exception 'Invalid pagination'; end if;
 if snapshot_id is null then
  delete from public.humor_feed_snapshots where expires_at<now();
  select coalesce(array_agg(q.id order by q.score desc,q.sort_time desc,q.id desc),'{}'::uuid[]) into ids from (
   select c.id,case when ordering='saved' then (select s.created_at from public.humor_saves s where s.user_id=owner and s.caption_id=c.id) else c.created_at end as sort_time,case when ordering='hot' then (select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1)::double precision else 0 end as score
   from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.deleted_at is null and i.status='ready' and (ordering<>'mine' or i.user_id=owner) and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.user_id=owner and s.caption_id=c.id))
  ) q;
  insert into public.humor_feed_snapshots(user_id,sort,post_ids) values(owner,ordering,ids) returning * into snap;
 else
  select * into snap from public.humor_feed_snapshots s where s.id=snapshot_id and s.user_id=owner and s.sort=ordering and s.expires_at>now();
  if not found then raise exception 'Feed snapshot expired'; end if;
 end if;
 select coalesce(jsonb_agg(q.body order by q.pos),'[]'::jsonb) into rows from (
  select selected.pos,jsonb_build_object('id',c.id,'caption',c.content,'style',c.style,'createdAt',c.created_at,'imageId',i.id,'imagePath',i.storage_path,'imageWidth',i.image_width,'imageHeight',i.image_height,'author',public.humor_author(i.user_id),'authorId',i.user_id,'authorName','@'||coalesce(p.username,'member_'||left(p.id::text,8)),'avatarPath',p.avatar_path,'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=owner and v.value=1),'viewerHasDisliked',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=owner and v.value=-1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) body
  from unnest(snap.post_ids) with ordinality selected(id,pos) join public.humor_captions c on c.id=selected.id join public.humor_images i on i.id=c.image_id left join public.profiles p on p.id=i.user_id
  where selected.pos>page_offset and selected.pos<=page_offset+page_limit and c.deleted_at is null and i.status='ready' and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner))
 ) q;
 return jsonb_build_object('posts',rows,'snapshotId',snap.id,'cutoff',snap.created_at,'nextOffset',case when page_offset+page_limit<cardinality(snap.post_ids) then page_offset+page_limit else null end);
end $function$
;
notify pgrst,'reload schema';
commit;
