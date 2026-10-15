begin;
-- pg-safeupdate is active in Data API sessions. Only fresh snapshots need to
-- expire; already expired snapshots remain available during recomputation.
create or replace function public.invalidate_humor_lists()
returns trigger language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz := now();
begin
 update public.humor_feed_snapshots set expires_at=cutoff where expires_at>cutoff;
 update public.humor_profile_snapshots set expires_at=cutoff where expires_at>cutoff;
 update public.humor_rank_snapshots set expires_at=cutoff where expires_at>cutoff;
 return null;
end $$;
create or replace function public.invalidate_humor_ranks()
returns trigger language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz := now();
begin
 if tg_op='DELETE' or (new.deleted_at is not null and old.deleted_at is null) then
  update public.humor_rank_snapshots set expires_at=cutoff where expires_at>cutoff;
 end if;
 return null;
end $$;
notify pgrst,'reload schema';
commit;
