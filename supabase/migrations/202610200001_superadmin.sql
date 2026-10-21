begin;

-- Admin console gate. Only database owners (SQL editor / service role) can set it:
-- member UPDATE grants on profiles are column-scoped and never include this column.
alter table public.profiles add column is_superadmin boolean not null default false;
create index profiles_superadmins on public.profiles(id) where is_superadmin;
comment on column public.profiles.is_superadmin is
  'Grants the Humor Admin console. Set only via SQL or the service role (admin/scripts/grant-superadmin.mjs).';

-- Defense in depth: even if a future migration grants broad UPDATE on profiles,
-- a member session can never change its own (or anyone's) superadmin flag.
create function public.humor_guard_superadmin() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.is_superadmin is distinct from old.is_superadmin
    and coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated')
  then raise exception 'is_superadmin can only be changed by a database owner'; end if;
  return new;
end $$;
revoke all on function public.humor_guard_superadmin() from public, anon, authenticated;
create trigger humor_guard_superadmin before update of is_superadmin on public.profiles
  for each row execute function public.humor_guard_superadmin();

-- The isolated preview schema mirrors public.profiles when it exists.
do $$ begin
  if to_regclass('humor_preview.profiles') is not null then
    alter table humor_preview.profiles add column if not exists is_superadmin boolean not null default false;
  end if;
end $$;

commit;

-- Bootstrap the first superadmin (run once, as the database owner):
--   update public.profiles set is_superadmin = true
--   where id = (select id from auth.users where lower(email) = lower('<your Google email>'));
