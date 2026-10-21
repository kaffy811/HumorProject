begin;

-- Ranking rule shared by the member Top page, profile ranks and the admin
-- console: more Ha first; equal Ha → the newer post first (it is hotter),
-- then id for a stable order. Matches the member Feed's Hot sort.
-- People keep their rule: more Ha received, then fewer posts.
-- The cache version bump makes every stored snapshot recompute.
create or replace function public.humor_leaderboard(period text,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare snap public.humor_rank_snapshots;start_at timestamptz;t timestamptz:=clock_timestamp();post_rows jsonb;people_rows jsonb;own_post jsonb;own_person jsonb;own_ha bigint;
begin
 if period not in('week','month','all')then raise exception 'Invalid ranking window';end if;
 select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
 if snap.period is null or snap.expires_at<=t or snap.cache_version<>'rolling-v3' then
  if pg_try_advisory_xact_lock(hashtextextended('rolling-v3:'||period,107)) then
   select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
   if snap.period is null or snap.expires_at<=t or snap.cache_version<>'rolling-v3' then
    start_at:=case period when 'week' then t-interval '168 hours' when 'month' then t-interval '720 hours' else null end;
    with source as(select * from public.humor_rank_source(start_at)),ranked as(select id,author_id,row_number()over(order by ha_count desc,created_at desc,id desc)rank from source)select coalesce(jsonb_agg(to_jsonb(r)order by r.rank),'[]')into post_rows from ranked r;
    with source as(select * from public.humor_rank_source(start_at)),groups as(select author_id,sum(ha_count)::bigint ha_received,count(*)post_count from source group by author_id),ranked as(select author_id,row_number()over(order by ha_received desc,post_count asc,author_id asc)rank from groups)select coalesce(jsonb_agg(to_jsonb(r)order by r.rank),'[]')into people_rows from ranked r;
    insert into public.humor_rank_snapshots(period,starts_at,computed_at,expires_at,posts,people,cache_version)values(period,start_at,t,t+interval '5 minutes',post_rows,people_rows,'rolling-v3')on conflict on constraint humor_rank_snapshots_pkey do update set starts_at=excluded.starts_at,computed_at=excluded.computed_at,expires_at=excluded.expires_at,posts=excluded.posts,people=excluded.people,cache_version=excluded.cache_version returning * into snap;
   end if;
  elsif snap.period is null or snap.cache_version<>'rolling-v3' then
   perform pg_advisory_xact_lock(hashtextextended('rolling-v3:'||period,107));select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;if snap.period is null or snap.cache_version<>'rolling-v3' then raise exception 'Ranking refresh unavailable';end if;
  end if;
 end if;
 start_at:=snap.starts_at;
 select coalesce(jsonb_agg(p.row||jsonb_build_object('rank',(r->>'rank')::bigint)order by(r->>'rank')::bigint),'[]')into post_rows from jsonb_array_elements(snap.posts)r cross join lateral(select public.humor_post((r->>'id')::uuid,viewer)row)p where(r->>'rank')::bigint<=50 and p.row is not null;
 with source as(select * from public.humor_rank_source(start_at)),totals as(select author_id,sum(ha_count)::bigint ha_received,count(*)post_count from source group by author_id),best as(select distinct on(author_id)author_id,id,content from source order by author_id,ha_count desc,created_at desc,id desc)
 select coalesce(jsonb_agg(jsonb_build_object('rank',(r->>'rank')::bigint,'user',public.humor_author(p.id),'haReceived',g.ha_received,'postCount',g.post_count,'bestPost',jsonb_build_object('id',b.id,'caption',b.content))order by(r->>'rank')::bigint),'[]')into people_rows from jsonb_array_elements(snap.people)r join public.profiles p on p.id=(r->>'author_id')::uuid join totals g on g.author_id=p.id join best b on b.author_id=p.id where(r->>'rank')::bigint<=50;
 select r into own_post from jsonb_array_elements(snap.posts)r where(r->>'author_id')::uuid=viewer and public.humor_post((r->>'id')::uuid,viewer)is not null order by(r->>'rank')::bigint limit 1;
 select r into own_person from jsonb_array_elements(snap.people)r where(r->>'author_id')::uuid=viewer;
 select coalesce(sum(s.ha_count),0)into own_ha from public.humor_rank_source(start_at)s where s.author_id=viewer;
 return jsonb_build_object('window',period,'startsAt',start_at,'computedAt',snap.computed_at,'expiresAt',snap.expires_at,'stale',snap.expires_at<=clock_timestamp(),'posts',post_rows,'people',people_rows,'standing',jsonb_build_object('bestPostRank',(own_post->>'rank')::bigint,'bestPostId',own_post->>'id','bestPostCaption',public.humor_post((own_post->>'id')::uuid,viewer)->>'caption','peopleRank',(own_person->>'rank')::bigint,'haReceived',own_ha));
end $$;

commit;
