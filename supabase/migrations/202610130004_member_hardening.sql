begin;
create or replace function public.humor_notify(recipient uuid,actor uuid,kind text,post uuid,comment uuid default null,parent uuid default null) returns void language plpgsql security definer set search_path='' as $$
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
create or replace function public.humor_vote_notification() returns trigger language plpgsql security definer set search_path='' as $$
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
create or replace function public.humor_notifications_page(viewer uuid,opening boolean default false,before_time timestamptz default null,before_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
create function public.humor_abandon_avatar(owner uuid,upload_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare path text;
begin
 delete from public.humor_avatar_uploads u where u.id=upload_id and u.user_id=owner and not exists(select 1 from public.profiles p where p.avatar_path=u.storage_path) returning storage_path into path;
 return path;
end $$;
revoke all on function public.humor_abandon_avatar(uuid,uuid) from public,anon,authenticated;
grant execute on function public.humor_abandon_avatar(uuid,uuid) to service_role;
commit;
