begin;

-- Two console roles:
--   superadmin (profiles.is_superadmin): the owner. Full console, approves
--     requests, adds and removes admins. Set only by a database owner.
--   admin (profiles.is_admin): full console except managing the team.
--     Granted by approving a request; a superadmin can remove it any time.
alter table public.profiles add column is_admin boolean not null default false;
comment on column public.profiles.is_admin is
  'Humor Admin console access without team management. Granted and revoked by superadmins.';

-- Members can never change either flag (also blocked by column grants).
create or replace function public.humor_guard_superadmin() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if (new.is_superadmin is distinct from old.is_superadmin or new.is_admin is distinct from old.is_admin)
    and coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated')
  then raise exception 'Console roles can only be changed by a superadmin or database owner'; end if;
  return new;
end $$;
drop trigger humor_guard_superadmin on public.profiles;
create trigger humor_guard_superadmin before update of is_superadmin, is_admin on public.profiles
  for each row execute function public.humor_guard_superadmin();

do $$ begin
  if to_regclass('humor_preview.profiles') is not null then
    alter table humor_preview.profiles add column if not exists is_admin boolean not null default false;
  end if;
end $$;

-- People who became superadmins by having a request approved are admins under
-- the new model. Whoever approves requests (or was granted directly) stays superadmin.
update public.profiles p set is_admin = true, is_superadmin = false
where p.is_superadmin
  and exists(select 1 from public.humor_admin_requests r where r.user_id = p.id and r.status = 'approved')
  and not exists(select 1 from public.humor_admin_requests r where r.decided_by = p.id);
do $$ begin
  if not exists(select 1 from public.profiles where is_superadmin) then
    raise exception 'Role migration would leave no superadmin; grant one first';
  end if;
end $$;

-- Approving a request now grants admin, not superadmin.
create or replace function public.humor_decide_admin_request(request_id uuid, approver uuid, approve boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare request public.humor_admin_requests;
begin
  if not exists(select 1 from public.profiles where id = approver and is_superadmin) then
    raise exception 'Only superadmins can decide requests';
  end if;
  update public.humor_admin_requests r
    set status = case when approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = approver
    where r.id = request_id and r.status = 'pending'
    returning * into request;
  if not found then raise exception 'Request was already decided'; end if;
  if approve then
    update public.profiles set is_admin = true where id = request.user_id and not is_superadmin;
  end if;
  return jsonb_build_object('userId', request.user_id, 'status', request.status);
end $$;

-- Removing an admin (someone left the team). Superadmins cannot be removed
-- here, so the owner can never be locked out from the console.
create function public.humor_revoke_admin(member uuid, revoker uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id = revoker and is_superadmin) then
    raise exception 'Only superadmins can remove admins';
  end if;
  if exists(select 1 from public.profiles where id = member and is_superadmin) then
    raise exception 'Superadmins can only be changed by a database owner';
  end if;
  update public.profiles set is_admin = false where id = member and is_admin;
  if not found then raise exception 'This member is not an admin'; end if;
  -- A pending request from before would otherwise re-grant access on approval.
  update public.humor_admin_requests set status = 'rejected', decided_at = now(), decided_by = revoker
    where user_id = member and status = 'pending';
end $$;
revoke all on function public.humor_revoke_admin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.humor_revoke_admin(uuid, uuid) to service_role;

-- Activity log: record admin grants and removals too.
create or replace function public.humor_log_profiles() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op = 'INSERT' then
    perform public.humor_log(new.id, 'auth', 'signup', null, new.id, '{}'::jsonb);
    return new;
  end if;
  if new.is_superadmin is distinct from old.is_superadmin then
    perform public.humor_log(new.id, 'admin', case when new.is_superadmin then 'grant_superadmin' else 'revoke_superadmin' end, null, new.id, '{}'::jsonb);
  end if;
  if new.is_admin is distinct from old.is_admin then
    perform public.humor_log(new.id, 'admin', case when new.is_admin then 'grant_admin' else 'revoke_admin' end, null, new.id, '{}'::jsonb);
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

commit;
