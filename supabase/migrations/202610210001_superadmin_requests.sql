begin;

-- Members ask for admin access; existing superadmins approve or reject in the
-- Humor Admin console. Only the server (service role) reads or writes this table,
-- after checking the caller's Google session and, for decisions, is_superadmin.
create table public.humor_admin_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text check (message is null or char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  check ((status = 'pending') = (decided_at is null))
);
-- One open request per member at a time.
create unique index humor_admin_requests_one_pending on public.humor_admin_requests(user_id) where status = 'pending';
create index humor_admin_requests_inbox on public.humor_admin_requests(status, created_at desc);
alter table public.humor_admin_requests enable row level security;
revoke all on public.humor_admin_requests from anon, authenticated;
grant all on public.humor_admin_requests to service_role;

-- Approval is atomic: the request closes and the flag flips together, and a
-- request can only be decided once.
create function public.humor_decide_admin_request(request_id uuid, approver uuid, approve boolean) returns jsonb
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
    update public.profiles set is_superadmin = true where id = request.user_id;
  end if;
  return jsonb_build_object('userId', request.user_id, 'status', request.status);
end $$;
revoke all on function public.humor_decide_admin_request(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.humor_decide_admin_request(uuid, uuid, boolean) to service_role;

commit;
