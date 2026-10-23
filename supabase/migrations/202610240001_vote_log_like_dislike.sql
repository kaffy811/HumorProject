begin;

-- humor_votes.value: 1 = like, -1 = dislike (member Dislike button). Toggling
-- deletes the row; switching inserts-on-conflict-updates the value.
create or replace function public.humor_log_votes() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text;
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.user_id, 'reaction', case when new.value = 1 then 'like' else 'dislike' end, new.caption_id, new.caption_id, '{}'::jsonb);
  elsif tg_op = 'UPDATE' and new.value is distinct from old.value then
    perform public.humor_log(new.user_id, 'reaction', case when new.value = 1 then 'like' else 'dislike' end, new.caption_id, new.caption_id,
      jsonb_build_object('switchedFrom', case when old.value = 1 then 'like' else 'dislike' end));
  elsif tg_op = 'DELETE' and public.humor_post_live(old.caption_id) then
    perform public.humor_log(old.user_id, 'reaction', case when old.value = 1 then 'unlike' else 'undislike' end, old.caption_id, old.caption_id, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;

-- Earlier entries used Ha wording; removing a dislike was recorded as un-Ha.
update public.humor_activity_log set action = 'like' where action = 'ha';
update public.humor_activity_log set action = 'dislike' where action = 'downvote';
update public.humor_activity_log set action = 'unlike' where action = 'unha';

commit;
