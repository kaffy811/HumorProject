-- Retire name requirements without destroying legacy data. Back up before apply.
begin;
create or replace function public.humor_profile_summary(profile_id uuid,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile jsonb; ranks jsonb; total bigint; received bigint; best bigint;
begin
 select public.humor_author(p.id)||jsonb_build_object('joinedAt',p.created_at,'onboardedAt',case when p.id=viewer then p.onboarded_at else null end,'username',p.username) into profile from public.profiles p where p.id=profile_id;
 if profile is null then return null;end if;
 perform public.humor_leaderboard('all',viewer);
 select min((r->>'rank')::bigint) into best from public.humor_rank_snapshots s cross join lateral jsonb_array_elements(s.posts) r where s.period='all' and (r->>'author_id')::uuid=profile_id and public.humor_post((r->>'id')::uuid,viewer) is not null;
 select count(*),coalesce(sum(s.ha_count),0) into total,received from public.humor_rank_source(null) s where s.author_id=profile_id;
 return profile||jsonb_build_object('postCount',total,'haReceived',received,'bestRank',best);
end $$;
create or replace function public.humor_save_profile_v3(owner uuid,handle text,avatar_action text,upload_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare photo text;
begin
 if handle is null or avatar_action is null or handle!~'^[a-z0-9_]{3,24}$' or avatar_action not in('keep','remove','upload') then raise exception 'Invalid profile';end if;
 if avatar_action='upload' then select storage_path into photo from public.humor_avatar_uploads u where u.id=upload_id and u.user_id=owner and u.expires_at>now() for update;if not found then raise exception 'Avatar preview expired';end if;end if;
 update public.profiles set username=handle,avatar_path=case when avatar_action='remove' then null when avatar_action='upload' then photo else avatar_path end where id=owner;
 if not found then raise exception 'Profile not found';end if;
 update public.humor_captions c set og_path=null from public.humor_images i where c.image_id=i.id and i.user_id=owner;
 if avatar_action='upload' then delete from public.humor_avatar_uploads where id=upload_id and user_id=owner;end if;
end $$;
CREATE OR REPLACE FUNCTION public.reserve_humor_image()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare uid uuid := auth.uid(); result uuid;
begin
  if not public.humor_google_session() then raise exception 'Google sign-in required'; end if;
  if not exists(select 1 from public.profiles p where p.id=uid
    and username ~ '^[a-z0-9_]{3,24}$'
)
  then raise exception 'Complete your profile'; end if;
  perform pg_advisory_xact_lock(6909261009);
  if exists(select 1 from public.humor_images where user_id=uid and created_at>now()-interval '1 minute')
    or (select count(*) from public.humor_images where user_id=uid and created_at>now()-interval '1 day')>=10
    or (select count(*) from public.humor_images where created_at>now()-interval '1 day')>=100
  then raise exception 'Upload limit'; end if;
  insert into public.humor_images(user_id) values(uid) returning id into result; return result;
end $function$;
revoke all on function public.humor_save_profile_v3(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.humor_save_profile_v3(uuid,text,text,uuid) to service_role;

drop policy "Completed profile required to vote" on public.humor_votes;
create policy "Completed profile required to vote" on public.humor_votes as restrictive for insert to authenticated
with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.username ~ '^[a-z0-9_]{3,24}$'));
revoke update(first_name,last_name) on public.profiles from authenticated;

-- Soft-deleted ancestors still count. Cap malformed/legacy chains at four.
create or replace function public.humor_comment_depth(comment_id uuid) returns integer
language plpgsql stable security definer set search_path='' as $$
declare parent uuid:=comment_id; seen uuid[]:='{}'; result int:=0; next_parent uuid;
begin
 while parent is not null loop
  if parent=any(seen) or result>=4 then return 4;end if;
  select c.reply_to_id into next_parent from public.humor_comments c where c.id=parent;
  if not found then return result;end if;
  seen:=array_append(seen,parent);result:=result+1;parent:=next_parent;
 end loop;
 return result;
end $$;
create or replace function public.humor_limit_comment_depth() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.reply_to_id is not null then
  if new.reply_to_id=new.id or not exists(select 1 from public.humor_comments p where p.id=new.reply_to_id and p.caption_id=new.caption_id and p.deleted_at is null)
  then raise exception 'Reply no longer available';end if;
  if public.humor_comment_depth(new.reply_to_id)>=3 then raise exception 'Replies can only go three levels deep.';end if;
 end if;
 return new;
end $$;
create trigger humor_comment_depth_limit before insert or update of reply_to_id,caption_id on public.humor_comments
for each row execute function public.humor_limit_comment_depth();
revoke all on function public.humor_comment_depth(uuid),public.humor_limit_comment_depth() from public,anon,authenticated;
grant execute on function public.humor_comment_depth(uuid) to service_role;

create or replace function public.humor_comment_row(comment_id uuid,viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('depth',public.humor_comment_depth(c.id),'id',c.id,'postId',c.caption_id,'body',c.content,'createdAt',c.created_at,'author',public.humor_author(c.user_id),'haCount',(select count(*) from public.humor_comment_votes v where v.comment_id=c.id),'viewerHasHa',exists(select 1 from public.humor_comment_votes v where v.comment_id=c.id and v.user_id=viewer),'replyTo',case when c.reply_to_id is null then null else jsonb_build_object('id',r.id,'authorId',case when r.deleted_at is null then r.user_id else null end,'authorName',case when r.deleted_at is not null then 'deleted' else public.humor_author(r.user_id)->>'name' end) end) from public.humor_comments c left join public.humor_comments r on r.id=c.reply_to_id where c.id=comment_id and c.deleted_at is null
$$;
notify pgrst, 'reload schema';
commit;
