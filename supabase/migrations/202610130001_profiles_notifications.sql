begin;
alter table public.profiles add column display_name text check(display_name is null or (display_name=trim(display_name) and char_length(display_name) between 2 and 30));
alter table public.profiles add column onboarded_at timestamptz;
alter table public.profiles add column first_post_notice_id uuid references public.humor_captions(id) on delete set null;
alter table public.profiles add column first_post_notice_seen_at timestamptz;
alter table public.profiles add column is_official boolean not null default false;
-- Existing completed members keep their current navigation.
update public.profiles set onboarded_at=now() where first_name is not null and length(trim(first_name))>0 and last_name is not null and length(trim(last_name))>0 and username is not null and avatar_path is not null;
grant update(display_name) on public.profiles to authenticated;
create table public.humor_avatar_uploads(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,storage_path text not null,expires_at timestamptz not null default now()+interval '24 hours',check(storage_path like user_id::text||'/%'));
alter table public.humor_avatar_uploads enable row level security;
revoke all on public.humor_avatar_uploads from anon,authenticated;
grant all on public.humor_avatar_uploads to service_role;
create table public.notifications (
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,type text not null check(type in ('ha','comment','reply')),
 post_id uuid not null references public.humor_captions(id) on delete cascade,comment_id uuid references public.humor_comments(id) on delete cascade,
 reply_to_comment_id uuid references public.humor_comments(id) on delete cascade,
 batch_id uuid not null default gen_random_uuid(),created_at timestamptz not null default clock_timestamp(),read_at timestamptz,
 check(recipient_id<>actor_id),check((type='ha' and comment_id is null) or (type<>'ha' and comment_id is not null))
);
create index notifications_inbox on public.notifications(recipient_id,created_at desc);
create index notifications_batches on public.notifications(recipient_id,batch_id);
create unique index notifications_unread_ha_once on public.notifications(recipient_id,actor_id,post_id) where type='ha' and read_at is null;
create unique index notifications_comment_once on public.notifications(recipient_id,type,comment_id) where type<>'ha';
alter table public.notifications enable row level security;
revoke all on public.notifications from anon,authenticated;
grant all on public.notifications to service_role;
grant select on public.notifications to authenticated;
create policy "Read own recent Google notifications" on public.notifications for select to authenticated using(recipient_id=(select auth.uid()) and (select public.humor_google_session()) and created_at>now()-interval '90 days');
create function public.humor_author(author_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',coalesce(p.display_name,nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarUrl',case when p.is_official then '/baby/bust/smirk.png' when p.avatar_path is not null then '/api/profiles/'||p.id::text||'/avatar?v='||extract(epoch from p.updated_at)::text else null end,'isOfficial',p.is_official) from public.profiles p where p.id=author_id
$$;
-- Notification locks serialize writes and reads for one recipient, not the whole site.
create function public.humor_notify(recipient uuid,actor uuid,kind text,post uuid,comment uuid default null,parent uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare group_id uuid;
begin
 if recipient is null or recipient=actor then return; end if;
 perform pg_advisory_xact_lock(hashtextextended(recipient::text,113));
 delete from public.notifications where recipient_id=recipient and created_at<clock_timestamp()-interval '90 days';
 if kind='ha' then
  select batch_id into group_id from public.notifications where recipient_id=recipient and post_id=post and type='ha' and read_at is null order by created_at desc limit 1;
 end if;
 insert into public.notifications(recipient_id,actor_id,type,post_id,comment_id,reply_to_comment_id,batch_id) values(recipient,actor,kind,post,comment,parent,coalesce(group_id,gen_random_uuid())) on conflict do nothing;
end $$;
create function public.humor_vote_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; post uuid; actor uuid; liked boolean;
begin
 if tg_op='DELETE' then post:=old.caption_id;actor:=old.user_id;liked:=false;
 else post:=new.caption_id;actor:=new.user_id;liked:=new.value=1;end if;
 if tg_op='UPDATE' then if old.value=new.value then return null;end if;end if;
 select i.user_id into recipient from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post and c.deleted_at is null and i.status='ready';
 if recipient is null or recipient=actor then return null; end if;
 perform pg_advisory_xact_lock(hashtextextended(recipient::text,113));
 if liked then perform public.humor_notify(recipient,actor,'ha',post);
 else delete from public.notifications where recipient_id=recipient and actor_id=actor and post_id=post and type='ha' and read_at is null; end if;
 return null;
end $$;
create trigger humor_vote_notification after insert or update of value or delete on public.humor_votes for each row execute function public.humor_vote_notification();
create function public.humor_comment_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare post_owner uuid; reply_owner uuid; recipient uuid;
begin
 if tg_op='UPDATE' then
  if new.deleted_at is not null and old.deleted_at is null then delete from public.notifications where comment_id=new.id or reply_to_comment_id=new.id; end if;
  return null;
 end if;
 if new.deleted_at is not null then return null; end if;
 select i.user_id into post_owner from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=new.caption_id and c.deleted_at is null and i.status='ready';
 if post_owner is null then return null; end if;
 if new.reply_to_id is not null then select c.user_id into reply_owner from public.humor_comments c where c.id=new.reply_to_id and c.deleted_at is null; end if;
 -- Lock multiple recipients in a deterministic order to avoid reply deadlocks.
 for recipient in select distinct x from unnest(array[post_owner,reply_owner]) x where x is not null and x<>new.user_id order by x loop perform pg_advisory_xact_lock(hashtextextended(recipient::text,113)); end loop;
 if post_owner is distinct from reply_owner then perform public.humor_notify(post_owner,new.user_id,'comment',new.caption_id,new.id); end if;
 perform public.humor_notify(reply_owner,new.user_id,'reply',new.caption_id,new.id,new.reply_to_id);
 return null;
end $$;
create trigger humor_comment_notification after insert or update of deleted_at on public.humor_comments for each row execute function public.humor_comment_notification();
create function public.humor_deleted_post_notifications() returns trigger language plpgsql security definer set search_path='' as $$
begin if new.deleted_at is not null then delete from public.notifications where post_id=new.id; end if;return null;end $$;
create trigger humor_deleted_post_notifications after update of deleted_at on public.humor_captions for each row execute function public.humor_deleted_post_notifications();
create function public.humor_notification_summary(viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('unreadCount',count(distinct batch_id),'latestAt',max(created_at)) from public.notifications where recipient_id=viewer and read_at is null and created_at>now()-interval '90 days'
$$;
create function public.humor_notifications_page(viewer uuid,opening boolean default false,before_time timestamptz default null,before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; cutoff timestamptz:=clock_timestamp(); next_time timestamptz; next_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(viewer::text,113));
 delete from public.notifications where recipient_id=viewer and created_at<cutoff-interval '90 days';
 with batches as (
  select batch_id,max(created_at) last_at,bool_or(read_at is null) unread,count(*) actor_count from public.notifications where recipient_id=viewer group by batch_id
 ), selected as (
  select * from batches where before_time is null or (last_at,batch_id)<(before_time,before_id) order by last_at desc,batch_id desc limit 21
 ), detailed as (
  select b.*,n.actor_id,n.type,n.post_id,n.comment_id from selected b cross join lateral(select * from public.notifications n where n.recipient_id=viewer and n.batch_id=b.batch_id order by n.created_at desc,n.id desc limit 1) n
 ) select coalesce(jsonb_agg(jsonb_build_object('id',batch_id,'actor',public.humor_author(actor_id),'type',type,'postId',post_id,'commentId',comment_id,'createdAt',last_at,'wasUnread',unread,'actorCount',actor_count,'thumbnailUrl','/api/posts/'||post_id::text||'/media?kind=thumb') order by last_at desc,batch_id desc),'[]'::jsonb) into result from detailed;
 if jsonb_array_length(result)>20 then next_time:=(result->19->>'createdAt')::timestamptz;next_id:=(result->19->>'id')::uuid;result:=result-20;end if;
 if opening then update public.notifications set read_at=cutoff where recipient_id=viewer and read_at is null and created_at<=cutoff;end if;
 return jsonb_build_object('items',result,'nextCursor',case when next_id is not null then jsonb_build_object('time',next_time,'id',next_id) else null end,'summary',public.humor_notification_summary(viewer));
end $$;
create function public.humor_profile_summary(profile_id uuid,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile jsonb; ranks jsonb; total bigint; received bigint; best bigint;
begin
 select public.humor_author(p.id)||jsonb_build_object('joinedAt',p.created_at,'onboardedAt',case when p.id=viewer then p.onboarded_at else null end,'username',p.username) into profile from public.profiles p where p.id=profile_id;
 if profile is null then return null;end if;
 perform public.humor_leaderboard('all',viewer);
 select min((r->>'rank')::bigint) into best from public.humor_rank_snapshots s cross join lateral jsonb_array_elements(s.posts) r where s.period='all' and (r->>'author_id')::uuid=profile_id and public.humor_post((r->>'id')::uuid,viewer) is not null;
 select count(*),coalesce(sum(s.ha_count),0) into total,received from public.humor_rank_source(null) s where s.author_id=profile_id;
 return profile||jsonb_build_object('postCount',total,'haReceived',received,'bestRank',best);
end $$;
-- A private snapshot for another member's public posts. Saved never accepts an owner override.
create table public.humor_profile_snapshots(id uuid primary key default gen_random_uuid(),viewer_id uuid not null references auth.users(id) on delete cascade,profile_id uuid not null references auth.users(id) on delete cascade,post_ids uuid[] not null,expires_at timestamptz not null default now()+interval '20 minutes');
alter table public.humor_profile_snapshots enable row level security;
revoke all on public.humor_profile_snapshots from anon,authenticated;
grant all on public.humor_profile_snapshots to service_role;
create function public.humor_profile_posts(profile_id uuid,viewer uuid,snapshot_id uuid default null,page_offset int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare snap public.humor_profile_snapshots; rows jsonb;
begin
 if snapshot_id is null then
  delete from public.humor_profile_snapshots where expires_at<now();
  insert into public.humor_profile_snapshots(viewer_id,profile_id,post_ids) select viewer,profile_id,coalesce(array_agg(c.id order by c.created_at desc,c.id desc),'{}'::uuid[]) from public.humor_captions c join public.humor_images i on i.id=c.image_id where i.user_id=profile_id and i.status='ready' and c.deleted_at is null returning * into snap;
 else
  select * into snap from public.humor_profile_snapshots s where s.id=snapshot_id and s.profile_id=humor_profile_posts.profile_id and s.viewer_id=viewer and s.expires_at>now();
  if not found then raise exception 'Profile snapshot expired';end if;
 end if;
 if page_offset<0 then raise exception 'Invalid pagination';end if;
 select coalesce(jsonb_agg(public.humor_post(u.id,viewer) order by u.pos),'[]'::jsonb) into rows from unnest(snap.post_ids) with ordinality u(id,pos) where pos>page_offset and pos<=page_offset+12 and public.humor_post(u.id,viewer) is not null;
 return jsonb_build_object('posts',rows,'snapshotId',snap.id,'nextOffset',case when page_offset+12<cardinality(snap.post_ids) then page_offset+12 else null end);
end $$;
create function public.humor_save_profile(owner uuid,new_name text,upload_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare path text;
begin
 if char_length(trim(new_name)) not between 2 and 30 or new_name~'[\x01-\x1f]' then raise exception 'Invalid display name';end if;
 if upload_id is not null then select storage_path into path from public.humor_avatar_uploads u where u.id=upload_id and u.user_id=owner and u.expires_at>now() for update;if not found then raise exception 'Avatar preview expired';end if;end if;
 update public.profiles set display_name=trim(new_name),avatar_path=coalesce(path,avatar_path) where id=owner;
 if not found then raise exception 'Profile not found';end if;
 if upload_id is not null then delete from public.humor_avatar_uploads where id=upload_id and user_id=owner;end if;
end $$;
-- Client-readable DTOs always hydrate current author data; retain existing reaction checks.
create or replace function public.humor_post(post_id uuid,viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('firstPostPending',exists(select 1 from public.profiles p where p.id=viewer and p.first_post_notice_id=c.id and p.first_post_notice_seen_at is null),'id',c.id,'imageUrl','/api/posts/'||c.id::text||'/media','imageWidth',coalesce(i.image_width,800),'imageHeight',coalesce(i.image_height,800),'caption',c.content,'style',c.style,'createdAt',c.created_at,'author',public.humor_author(i.user_id),'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=viewer and v.value=1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=viewer),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready'
$$;
create or replace function public.humor_comment_row(comment_id uuid,viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'postId',c.caption_id,'body',c.content,'createdAt',c.created_at,'author',public.humor_author(c.user_id),'haCount',(select count(*) from public.humor_comment_votes v where v.comment_id=c.id),'viewerHasHa',exists(select 1 from public.humor_comment_votes v where v.comment_id=c.id and v.user_id=viewer),'replyTo',case when c.reply_to_id is null then null else jsonb_build_object('id',r.id,'authorId',case when r.deleted_at is null then r.user_id else null end,'authorName',case when r.deleted_at is not null then 'deleted' else public.humor_author(r.user_id)->>'name' end) end) from public.humor_comments c left join public.humor_comments r on r.id=c.reply_to_id where c.id=comment_id and c.deleted_at is null
$$;
create function public.humor_publish_onboarded(image_id uuid,owner uuid,generation_id uuid,candidate_id uuid,final_text text,publication_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare post uuid; first_post boolean; existed boolean;
begin
 perform 1 from public.profiles p where p.id=owner for update;
 select exists(select 1 from public.humor_drafts d where d.image_id=humor_publish_onboarded.image_id and d.caption_id is not null) into existed;
 -- Deleted earlier posts still count as having posted before.
 select not exists(select 1 from public.humor_drafts d where d.user_id=owner and d.published_at is not null) and not exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where i.user_id=owner) into first_post;
 post:=public.publish_humor_draft(image_id,owner,generation_id,candidate_id,final_text,publication_key);
 update public.profiles set onboarded_at=coalesce(onboarded_at,now()),first_post_notice_id=case when first_post then post else first_post_notice_id end where id=owner;
 return jsonb_build_object('postId',post,'isFirstPost',exists(select 1 from public.profiles p where p.id=owner and p.first_post_notice_id=post and p.first_post_notice_seen_at is null));
end $$;
create function public.humor_cleanup_notifications() returns void language sql security definer set search_path='' as $$ delete from public.notifications where created_at<clock_timestamp()-interval '90 days' $$;
create or replace function public.humor_feed_page(owner uuid,ordering text,snapshot_id uuid default null,page_offset integer default 0,page_limit integer default 12) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snap public.humor_feed_snapshots; ids uuid[]; rows jsonb;
begin
 if ordering not in ('hot','new','mine','saved') or page_limit not between 1 and 12 or page_offset<0 then raise exception 'Invalid pagination'; end if;
 if snapshot_id is null then
  delete from public.humor_feed_snapshots where expires_at<now();
  select coalesce(array_agg(q.id order by q.score desc,q.sort_time desc,q.id desc),'{}'::uuid[]) into ids from (
   select c.id,case when ordering='saved' then (select s.created_at from public.humor_saves s where s.user_id=owner and s.caption_id=c.id) else c.created_at end as sort_time,case when ordering='hot' then (select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1)::double precision / power(greatest(0,extract(epoch from (now()-c.created_at))/3600)+2,1.5) else 0 end as score
   from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.deleted_at is null and i.status='ready' and (ordering<>'mine' or i.user_id=owner) and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.user_id=owner and s.caption_id=c.id))
  ) q;
  insert into public.humor_feed_snapshots(user_id,sort,post_ids) values(owner,ordering,ids) returning * into snap;
 else
  select * into snap from public.humor_feed_snapshots s where s.id=snapshot_id and s.user_id=owner and s.sort=ordering and s.expires_at>now();
  if not found then raise exception 'Feed snapshot expired'; end if;
 end if;
 select coalesce(jsonb_agg(q.body order by q.pos),'[]'::jsonb) into rows from (
  select selected.pos,jsonb_build_object('id',c.id,'caption',c.content,'style',c.style,'createdAt',c.created_at,'imageId',i.id,'imagePath',i.storage_path,'imageWidth',i.image_width,'imageHeight',i.image_height,'author',public.humor_author(i.user_id),'authorId',i.user_id,'authorName',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarPath',p.avatar_path,'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=owner and v.value=1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) body
  from unnest(snap.post_ids) with ordinality selected(id,pos) join public.humor_captions c on c.id=selected.id join public.humor_images i on i.id=c.image_id left join public.profiles p on p.id=i.user_id
  where selected.pos>page_offset and selected.pos<=page_offset+page_limit and c.deleted_at is null and i.status='ready' and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner))
 ) q;
 return jsonb_build_object('posts',rows,'snapshotId',snap.id,'cutoff',snap.created_at,'nextOffset',case when page_offset+page_limit<cardinality(snap.post_ids) then page_offset+page_limit else null end);
end $$;

-- Keep all privileged RPCs server-only. Trigger functions cannot be called by members.
do $$ declare f record;begin for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('humor_author','humor_notify','humor_vote_notification','humor_comment_notification','humor_deleted_post_notifications','humor_notification_summary','humor_notifications_page','humor_profile_summary','humor_profile_posts','humor_save_profile','humor_publish_onboarded','humor_cleanup_notifications') loop execute 'revoke all on function '||f.sig||' from public,anon,authenticated';execute 'grant execute on function '||f.sig||' to service_role';end loop;end $$;
commit;
