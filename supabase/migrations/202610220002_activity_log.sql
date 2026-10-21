begin;

-- One row per member or admin action, written by database triggers so every
-- path (member site, admin console, SQL, scripts) is captured the same way.
-- Only the server (service role) can read it; logging never blocks the action.
create table public.humor_activity_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default clock_timestamp(),
  actor_id uuid references auth.users(id) on delete set null,
  category text not null check (category in ('auth','post','ai','reaction','comment','save','report','profile','admin')),
  action text not null,
  via text not null default 'member' check (via in ('member','admin','system')),
  post_id uuid,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb
);
create index humor_activity_recent on public.humor_activity_log(created_at desc, id desc);
create index humor_activity_actor on public.humor_activity_log(actor_id, created_at desc);
create index humor_activity_category on public.humor_activity_log(category, created_at desc);
alter table public.humor_activity_log enable row level security;
revoke all on public.humor_activity_log from anon, authenticated;
grant all on public.humor_activity_log to service_role;

-- The admin console sends `x-humor-admin: <admin id>` on its service-role
-- requests, so its edits are attributed to the admin, not the post owner.
create function public.humor_admin_actor() returns uuid
language plpgsql stable set search_path='' as $$
declare value text;
begin
  value := nullif(current_setting('request.headers', true), '')::json->>'x-humor-admin';
  return case when value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then value::uuid end;
exception when others then return null;
end $$;

create function public.humor_log(actor uuid, category text, action text, post uuid default null, target uuid default null, detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare admin uuid := public.humor_admin_actor();
begin
  insert into public.humor_activity_log(actor_id, category, action, via, post_id, target_id, detail)
  values (coalesce(admin, actor), category, action, case when admin is not null then 'admin' else 'member' end, post, target,
    coalesce(detail, '{}'::jsonb) || case when admin is not null and actor is distinct from admin then jsonb_build_object('ownerId', actor) else '{}'::jsonb end);
exception when others then
  -- Never fail the member's action because of logging.
  raise warning 'activity log skipped: %', sqlerrm;
end $$;
revoke all on function public.humor_log(uuid, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.humor_admin_actor() from public, anon, authenticated;

-- A post's owner, for rows that only reference the caption.
create function public.humor_post_owner(post uuid) returns uuid
language sql stable security definer set search_path='' as $$
  select i.user_id from public.humor_captions c join public.humor_images i on i.id = c.image_id where c.id = post
$$;
create function public.humor_post_live(post uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.humor_captions c where c.id = post and c.deleted_at is null)
$$;
revoke all on function public.humor_post_owner(uuid), public.humor_post_live(uuid) from public, anon, authenticated;

-- Posts: publish, edit, delete, restore, purge.
create function public.humor_log_posts() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
  if tg_op = 'DELETE' then
    select user_id into owner from public.humor_images where id = old.image_id;
    perform public.humor_log(owner, 'post', 'purge', old.id, old.id, jsonb_build_object('caption', left(old.content, 120)));
    return old;
  end if;
  select user_id into owner from public.humor_images where id = new.image_id;
  if tg_op = 'INSERT' then
    perform public.humor_log(owner, 'post', 'publish', new.id, new.id, jsonb_build_object('caption', left(new.content, 120), 'style', new.style, 'source', new.source));
  elsif new.deleted_at is not null and old.deleted_at is null then
    perform public.humor_log(owner, 'post', 'delete', new.id, new.id, jsonb_build_object('caption', left(new.content, 120)));
  elsif new.deleted_at is null and old.deleted_at is not null then
    perform public.humor_log(owner, 'post', 'restore', new.id, new.id, jsonb_build_object('caption', left(new.content, 120)));
  elsif (new.content, new.style, new.source) is distinct from (old.content, old.style, old.source) then
    perform public.humor_log(owner, 'post', 'edit', new.id, new.id, jsonb_build_object('caption', left(new.content, 120), 'before', left(old.content, 120)));
  end if;
  return new;
end $$;
create trigger humor_log_posts after insert or update of content, style, source, deleted_at or delete on public.humor_captions
  for each row execute function public.humor_log_posts();

-- Photo uploads (the start of every post).
create function public.humor_log_uploads() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform public.humor_log(new.user_id, 'post', 'upload', null, new.id, '{}'::jsonb);
  return new;
end $$;
create trigger humor_log_uploads after insert on public.humor_images
  for each row execute function public.humor_log_uploads();

-- AI generation: one row when a run finishes or fails.
create function public.humor_log_generations() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('completed', 'failed') and old.status is distinct from new.status then
    perform public.humor_log(new.user_id, 'ai', case when new.status = 'completed' then 'generate' else 'generate_failed' end, null, new.id,
      jsonb_build_object('model', new.model, 'provider', new.provider, 'promptVersion', new.prompt_version, 'stage', new.failure_stage));
  end if;
  return new;
end $$;
create trigger humor_log_generations after update of status on public.humor_generations
  for each row execute function public.humor_log_generations();

-- Ha on posts. Votes removed by a post deletion are not member actions.
create function public.humor_log_votes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.user_id, 'reaction', case when new.value = 1 then 'ha' else 'downvote' end, new.caption_id, new.caption_id, '{}'::jsonb);
  elsif tg_op = 'UPDATE' and new.value is distinct from old.value then
    perform public.humor_log(new.user_id, 'reaction', case when new.value = 1 then 'ha' else 'downvote' end, new.caption_id, new.caption_id, '{}'::jsonb);
  elsif tg_op = 'DELETE' and public.humor_post_live(old.caption_id) then
    perform public.humor_log(old.user_id, 'reaction', 'unha', old.caption_id, old.caption_id, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;
create trigger humor_log_votes after insert or update of value or delete on public.humor_votes
  for each row execute function public.humor_log_votes();

-- Comments and replies.
create function public.humor_log_comments() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.user_id, 'comment', case when new.reply_to_id is null then 'comment' else 'reply' end, new.caption_id, new.id,
      jsonb_build_object('text', left(new.content, 120)));
  elsif new.deleted_at is not null and old.deleted_at is null and public.humor_post_live(new.caption_id) then
    perform public.humor_log(new.user_id, 'comment', 'delete_comment', new.caption_id, new.id, '{}'::jsonb);
  end if;
  return new;
end $$;
create trigger humor_log_comments after insert or update of deleted_at on public.humor_comments
  for each row execute function public.humor_log_comments();

-- Hearts on comments.
create function public.humor_log_comment_votes() returns trigger
language plpgsql security definer set search_path='' as $$
declare post uuid;
begin
  select caption_id into post from public.humor_comments where id = coalesce(new.comment_id, old.comment_id) and deleted_at is null;
  if post is null then return coalesce(new, old); end if;
  perform public.humor_log(coalesce(new.user_id, old.user_id), 'reaction', case when tg_op = 'INSERT' then 'heart' else 'unheart' end, post, coalesce(new.comment_id, old.comment_id), '{}'::jsonb);
  return coalesce(new, old);
end $$;
create trigger humor_log_comment_votes after insert or delete on public.humor_comment_votes
  for each row execute function public.humor_log_comment_votes();

-- Saves.
create function public.humor_log_saves() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.user_id, 'save', 'save', new.caption_id, new.caption_id, '{}'::jsonb);
  elsif public.humor_post_live(old.caption_id) then
    perform public.humor_log(old.user_id, 'save', 'unsave', old.caption_id, old.caption_id, '{}'::jsonb);
  end if;
  return coalesce(new, old);
end $$;
create trigger humor_log_saves after insert or delete on public.humor_saves
  for each row execute function public.humor_log_saves();

-- Reports on posts and comments.
create function public.humor_log_reports() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name = 'humor_reports' then
    perform public.humor_log(new.user_id, 'report', 'report_post', new.caption_id, new.caption_id, jsonb_build_object('reason', new.reason));
  else
    perform public.humor_log(new.user_id, 'report', 'report_comment', (select caption_id from public.humor_comments where id = new.comment_id), new.comment_id, jsonb_build_object('reason', new.reason));
  end if;
  return new;
end $$;
create trigger humor_log_reports after insert on public.humor_reports
  for each row execute function public.humor_log_reports();
create trigger humor_log_comment_reports after insert on public.humor_comment_reports
  for each row execute function public.humor_log_reports();

-- Accounts and profiles.
create function public.humor_log_profiles() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.id, 'auth', 'signup', null, new.id, '{}'::jsonb);
    return new;
  end if;
  if new.is_superadmin is distinct from old.is_superadmin then
    perform public.humor_log(new.id, 'admin', case when new.is_superadmin then 'grant_superadmin' else 'revoke_superadmin' end, null, new.id, '{}'::jsonb);
  end if;
  if new.onboarded_at is not null and old.onboarded_at is null then
    perform public.humor_log(new.id, 'profile', 'onboard', null, new.id, '{}'::jsonb);
  elsif (new.username, new.first_name, new.last_name, new.display_name, new.avatar_path)
    is distinct from (old.username, old.first_name, old.last_name, old.display_name, old.avatar_path) then
    perform public.humor_log(new.id, 'profile', 'update_profile', null, new.id, jsonb_strip_nulls(jsonb_build_object(
      'username', case when new.username is distinct from old.username then new.username end,
      'avatar', case when new.avatar_path is distinct from old.avatar_path then true end)));
  end if;
  return new;
end $$;
create trigger humor_log_profiles after insert or update on public.profiles
  for each row execute function public.humor_log_profiles();

-- Superadmin requests and decisions.
create function public.humor_log_admin_requests() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.user_id, 'admin', 'request_superadmin', null, new.id, '{}'::jsonb);
  elsif new.status <> old.status then
    perform public.humor_log(new.decided_by, 'admin', case when new.status = 'approved' then 'approve_request' else 'reject_request' end, null, new.id, jsonb_build_object('memberId', new.user_id));
  end if;
  return new;
end $$;
create trigger humor_log_admin_requests after insert or update of status on public.humor_admin_requests
  for each row execute function public.humor_log_admin_requests();

-- Sign-in and sign-out come from Supabase Auth sessions. If this project's
-- role cannot attach triggers to auth.sessions, the rest still installs.
create function public.humor_log_sessions() returns trigger
language plpgsql security definer set search_path='' as $$
declare row jsonb := to_jsonb(coalesce(new, old));
begin
  perform public.humor_log((row->>'user_id')::uuid, 'auth', case when tg_op = 'INSERT' then 'login' else 'logout' end, null, null,
    jsonb_strip_nulls(jsonb_build_object('userAgent', left(row->>'user_agent', 160))));
  return coalesce(new, old);
end $$;
do $$ begin
  create trigger humor_log_sessions after insert or delete on auth.sessions
    for each row execute function public.humor_log_sessions();
exception when others then
  raise notice 'Login/logout logging skipped: %', sqlerrm;
end $$;

revoke all on function public.humor_log_posts(), public.humor_log_uploads(), public.humor_log_generations(), public.humor_log_votes(),
  public.humor_log_comments(), public.humor_log_comment_votes(), public.humor_log_saves(), public.humor_log_reports(),
  public.humor_log_profiles(), public.humor_log_admin_requests(), public.humor_log_sessions() from public, anon, authenticated;

-- Backfill history that already exists, marked as reconstructed.
insert into public.humor_activity_log(created_at, actor_id, category, action, via, target_id, detail)
  select created_at, id, 'auth', 'signup', 'system', id, '{"backfilled":true}' from public.profiles;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, target_id, detail)
  select last_sign_in_at, id, 'auth', 'login', 'system', null, '{"backfilled":true,"note":"last sign-in before logging started"}'
  from auth.users where last_sign_in_at is not null and exists(select 1 from public.profiles p where p.id = auth.users.id);
insert into public.humor_activity_log(created_at, actor_id, category, action, via, target_id, detail)
  select created_at, user_id, 'post', 'upload', 'system', id, '{"backfilled":true}' from public.humor_images;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select c.created_at, i.user_id, 'post', 'publish', 'system', c.id, c.id, jsonb_build_object('backfilled', true, 'caption', left(c.content, 120), 'style', c.style, 'source', c.source)
  from public.humor_captions c join public.humor_images i on i.id = c.image_id;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select c.deleted_at, i.user_id, 'post', 'delete', 'system', c.id, c.id, '{"backfilled":true}'
  from public.humor_captions c join public.humor_images i on i.id = c.image_id where c.deleted_at is not null;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, target_id, detail)
  select coalesce(completed_at, created_at), user_id, 'ai', case when status = 'completed' then 'generate' else 'generate_failed' end, 'system', id,
    jsonb_build_object('backfilled', true, 'model', model, 'provider', provider, 'promptVersion', prompt_version, 'stage', failure_stage)
  from public.humor_generations where status in ('completed', 'failed');
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select created_at, user_id, 'reaction', case when value = 1 then 'ha' else 'downvote' end, 'system', caption_id, caption_id, '{"backfilled":true}' from public.humor_votes;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select created_at, user_id, 'comment', case when reply_to_id is null then 'comment' else 'reply' end, 'system', caption_id, id, jsonb_build_object('backfilled', true, 'text', left(content, 120))
  from public.humor_comments where deleted_at is null;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select v.created_at, v.user_id, 'reaction', 'heart', 'system', m.caption_id, v.comment_id, '{"backfilled":true}'
  from public.humor_comment_votes v join public.humor_comments m on m.id = v.comment_id;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select created_at, user_id, 'save', 'save', 'system', caption_id, caption_id, '{"backfilled":true}' from public.humor_saves;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, post_id, target_id, detail)
  select created_at, user_id, 'report', 'report_post', 'system', caption_id, caption_id, jsonb_build_object('backfilled', true, 'reason', reason) from public.humor_reports;
insert into public.humor_activity_log(created_at, actor_id, category, action, via, target_id, detail)
  select created_at, user_id, 'admin', 'request_superadmin', 'system', id, '{"backfilled":true}' from public.humor_admin_requests;

commit;
