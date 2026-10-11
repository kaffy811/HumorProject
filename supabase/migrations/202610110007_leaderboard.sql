begin;
-- Shared ranks only; viewer-specific reactions are hydrated outside the snapshot.
create table public.humor_rank_snapshots (
 period text primary key check (period in ('week','month','all')),
 starts_at timestamptz, computed_at timestamptz not null, expires_at timestamptz not null,
 posts jsonb not null, people jsonb not null
);
alter table public.humor_rank_snapshots enable row level security;
revoke all on public.humor_rank_snapshots from anon,authenticated;
grant all on public.humor_rank_snapshots to service_role;
create index humor_positive_votes_by_caption on public.humor_votes(caption_id) where value=1;
create function public.humor_rank_source(start_at timestamptz) returns table(id uuid,author_id uuid,content text,created_at timestamptz,ha_count bigint)
language sql stable security definer set search_path='' as $$
 select c.id,i.user_id,c.content,c.created_at,(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1)
 from public.humor_captions c join public.humor_images i on i.id=c.image_id
 where c.deleted_at is null and i.status='ready' and (start_at is null or c.created_at>=start_at) and c.created_at<=now()
$$;
create function public.humor_leaderboard(period text,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare snap public.humor_rank_snapshots; start_at timestamptz; local_now timestamp; next_boundary timestamptz; t timestamptz:=clock_timestamp(); post_rows jsonb; people_rows jsonb; own_post jsonb; own_person jsonb; own_ha bigint;
begin
 if period not in ('week','month','all') then raise exception 'Invalid ranking window'; end if;
 local_now:=t at time zone 'America/New_York';
 start_at:=case period when 'week' then date_trunc('week',local_now) at time zone 'America/New_York' when 'month' then date_trunc('month',local_now) at time zone 'America/New_York' else null end;
 next_boundary:=case period when 'week' then (date_trunc('week',local_now)+interval '1 week') at time zone 'America/New_York' when 'month' then (date_trunc('month',local_now)+interval '1 month') at time zone 'America/New_York' else t+interval '5 minutes' end;
 select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
 if snap.period is null or snap.expires_at<=t or snap.starts_at is distinct from start_at then
  -- Warm refresh never blocks concurrent readers: they use the old committed ranks.
  -- A cold/rolled-over window has no valid old snapshot, so only then wait for the builder.
  if pg_try_advisory_xact_lock(hashtextextended(period,107)) then
   select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
   if snap.period is null or snap.expires_at<=t or snap.starts_at is distinct from start_at then
    with source as (select * from public.humor_rank_source(start_at)), ranked as (
     select id,author_id,row_number() over(order by ha_count desc,created_at asc,id asc) as rank from source where ha_count>0
    ) select coalesce(jsonb_agg(to_jsonb(r) order by r.rank),'[]'::jsonb) into post_rows from ranked r;
    with source as (select * from public.humor_rank_source(start_at)), groups as (
     select author_id,sum(ha_count)::bigint ha_received,count(*) post_count from source group by author_id having sum(ha_count)>0
    ), ranked as (
     select author_id,row_number() over(order by ha_received desc,post_count asc,author_id asc) as rank from groups
    ) select coalesce(jsonb_agg(to_jsonb(r) order by r.rank),'[]'::jsonb) into people_rows from ranked r;
    insert into public.humor_rank_snapshots values(period,start_at,t,least(t+interval '5 minutes',next_boundary),post_rows,people_rows)
    on conflict on constraint humor_rank_snapshots_pkey do update set starts_at=excluded.starts_at,computed_at=excluded.computed_at,expires_at=excluded.expires_at,posts=excluded.posts,people=excluded.people returning * into snap;
   end if;
  elsif snap.period is null or snap.starts_at is distinct from start_at then
   perform pg_advisory_xact_lock(hashtextextended(period,107));
   select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
   if snap.period is null or snap.starts_at is distinct from start_at then raise exception 'Ranking refresh unavailable'; end if;
  end if;
 end if;
 -- Live counts match feed/detail, but order and ranks stay fixed until the next snapshot.
 select coalesce(jsonb_agg(p.row||jsonb_build_object('rank',(r->>'rank')::bigint) order by (r->>'rank')::bigint),'[]'::jsonb) into post_rows
 from jsonb_array_elements(snap.posts) r cross join lateral (select public.humor_post((r->>'id')::uuid,viewer) row) p where (r->>'rank')::bigint<=50 and p.row is not null;
 with source as (select * from public.humor_rank_source(start_at)), totals as (select author_id,sum(ha_count)::bigint ha_received,count(*) post_count from source group by author_id), best as (
 select distinct on(author_id) author_id,id,content from source order by author_id,ha_count desc,created_at asc,id asc
 ) select coalesce(jsonb_agg(jsonb_build_object('rank',(r->>'rank')::bigint,'user',jsonb_build_object('id',p.id,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarUrl',case when p.avatar_path is not null then '/api/posts/'||b.id::text||'/media?kind=avatar' else null end),'haReceived',g.ha_received,'postCount',g.post_count,'bestPost',jsonb_build_object('id',b.id,'caption',b.content)) order by (r->>'rank')::bigint),'[]'::jsonb) into people_rows
 from jsonb_array_elements(snap.people) r join public.profiles p on p.id=(r->>'author_id')::uuid join totals g on g.author_id=p.id join best b on b.author_id=p.id where (r->>'rank')::bigint<=50;
 select r into own_post from jsonb_array_elements(snap.posts) r where (r->>'author_id')::uuid=viewer and public.humor_post((r->>'id')::uuid,viewer) is not null order by (r->>'rank')::bigint limit 1;
 select r into own_person from jsonb_array_elements(snap.people) r where (r->>'author_id')::uuid=viewer limit 1;
 select coalesce(sum(s.ha_count),0) into own_ha from public.humor_rank_source(start_at) s where s.author_id=viewer;
 return jsonb_build_object('window',period,'startsAt',start_at,'computedAt',snap.computed_at,'expiresAt',snap.expires_at,'stale',snap.expires_at<=clock_timestamp(),'posts',post_rows,'people',people_rows,'standing',jsonb_build_object('bestPostRank',(own_post->>'rank')::bigint,'bestPostId',own_post->>'id','bestPostCaption',(public.humor_post((own_post->>'id')::uuid,viewer))->>'caption','peopleRank',(own_person->>'rank')::bigint,'haReceived',own_ha));
end $$;
create function public.invalidate_humor_ranks() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' or (new.deleted_at is not null and old.deleted_at is null) then
  -- Invalidate, retaining the previous snapshot for readers during the next refresh.
  update public.humor_rank_snapshots set expires_at=least(expires_at,clock_timestamp());
 end if;
 return null;
end $$;
create trigger invalidate_deleted_humor_ranks after update of deleted_at or delete on public.humor_captions for each row execute function public.invalidate_humor_ranks();
revoke all on function public.humor_rank_source(timestamptz),public.humor_leaderboard(text,uuid),public.invalidate_humor_ranks() from public,anon,authenticated;
grant execute on function public.humor_rank_source(timestamptz),public.humor_leaderboard(text,uuid) to service_role;
commit;
