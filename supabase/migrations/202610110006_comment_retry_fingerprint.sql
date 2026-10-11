begin;
-- Structured fingerprints distinguish reply targets from text that ends in a UUID.
create or replace function public.add_humor_comment(post_id uuid,owner uuid,body text,reply_id uuid,request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid; prev public.humor_comment_requests; fingerprint text; total bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text,101));
 perform 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready' for update of c;
 if not found then raise exception 'Post not found'; end if;
 if char_length(trim(body)) not between 1 and 280 or body ~ '[\x01-\x08]' then raise exception 'Invalid comment'; end if;
 fingerprint:=md5(jsonb_build_array(post_id,trim(body),reply_id)::text);
 select * into prev from public.humor_comment_requests r where r.user_id=owner and r.request_key=add_humor_comment.request_key;
 if found then
  if prev.fingerprint<>fingerprint then raise exception 'Invalid request'; end if;
  cid:=prev.comment_id;
 else
  if reply_id is not null and not exists(select 1 from public.humor_comments c where c.id=reply_id and c.caption_id=post_id and c.deleted_at is null) then raise exception 'Reply no longer available'; end if;
  delete from public.humor_comment_rate_events where created_at<clock_timestamp()-interval '1 minute';
  if (select count(*) from public.humor_comment_rate_events e where e.user_id=owner and e.created_at>clock_timestamp()-interval '10 seconds')>=3 then raise exception 'Comment rate limit'; end if;
  insert into public.humor_comments(caption_id,user_id,content,reply_to_id) values(post_id,owner,trim(body),reply_id) returning id into cid;
  insert into public.humor_comment_requests values(owner,request_key,post_id,cid,fingerprint);
  insert into public.humor_comment_rate_events(user_id) values(owner);
 end if;
 select count(*) into total from public.humor_comments c where c.caption_id=post_id and c.deleted_at is null;
 return jsonb_build_object('comment',public.humor_comment_row(cid,owner),'commentCount',total);
end $$;
commit;
