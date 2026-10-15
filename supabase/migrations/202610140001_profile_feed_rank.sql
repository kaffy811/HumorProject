begin;
alter table public.profiles add column saved_hint_seen_at timestamptz;
update public.profiles p set saved_hint_seen_at=now() where exists(select 1 from public.humor_saves s where s.user_id=p.id);
update public.humor_captions set og_path=null;
revoke update(display_name) on public.profiles from authenticated;
create or replace function public.humor_author(author_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'username',coalesce(p.username,'member_'||left(p.id::text,8)),'name','@'||coalesce(p.username,'member_'||left(p.id::text,8)),'avatarUrl',case when p.is_official then '/baby/bust/smirk.png' when p.avatar_path is not null then '/api/profiles/'||p.id::text||'/avatar?v='||extract(epoch from p.updated_at)::text else null end,'isOfficial',p.is_official) from public.profiles p where p.id=author_id
$$;
create or replace function public.humor_profile_summary(profile_id uuid,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare profile jsonb; ranks jsonb; total bigint; received bigint; best bigint;
begin
 select public.humor_author(p.id)||jsonb_build_object('joinedAt',p.created_at,'onboardedAt',case when p.id=viewer then p.onboarded_at else null end,'username',p.username,'firstName',p.first_name,'lastName',p.last_name) into profile from public.profiles p where p.id=profile_id;
 if profile is null then return null;end if;
 perform public.humor_leaderboard('all',viewer);
 select min((r->>'rank')::bigint) into best from public.humor_rank_snapshots s cross join lateral jsonb_array_elements(s.posts) r where s.period='all' and (r->>'author_id')::uuid=profile_id and public.humor_post((r->>'id')::uuid,viewer) is not null;
 select count(*),coalesce(sum(s.ha_count),0) into total,received from public.humor_rank_source(null) s where s.author_id=profile_id;
 return profile||jsonb_build_object('postCount',total,'haReceived',received,'bestRank',best);
end $$;
create function public.humor_username_available(owner uuid,handle text) returns boolean language sql stable security definer set search_path='' as $$
 select handle~'^[a-z0-9_]{3,24}$' and not exists(select 1 from public.profiles p where p.username=handle and p.id<>owner)
$$;
create function public.humor_save_profile_v2(owner uuid,first text,last text,handle text,avatar_action text,upload_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare photo text;
begin
 if handle!~'^[a-z0-9_]{3,24}$' or char_length(trim(first)) not between 1 and 80 or char_length(trim(last)) not between 1 and 80 or first~'[\x01-\x1f]' or last~'[\x01-\x1f]' or avatar_action not in('keep','remove','upload') then raise exception 'Invalid profile';end if;
 if avatar_action='upload' then select storage_path into photo from public.humor_avatar_uploads u where u.id=upload_id and u.user_id=owner and u.expires_at>now() for update;if not found then raise exception 'Avatar preview expired';end if;end if;
 update public.profiles set first_name=trim(first),last_name=trim(last),username=handle,avatar_path=case when avatar_action='remove' then null when avatar_action='upload' then photo else avatar_path end where id=owner;
 if not found then raise exception 'Profile not found';end if;
 update public.humor_captions c set og_path=null from public.humor_images i where c.image_id=i.id and i.user_id=owner;
 if avatar_action='upload' then delete from public.humor_avatar_uploads where id=upload_id and user_id=owner;end if;
end $$;
create function public.humor_paged_feed(owner uuid,ordering text,page_number int default 1,snapshot_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare snap public.humor_feed_snapshots;rows jsonb;total int;
begin
 if ordering not in('hot','new','mine','saved') or page_number<1 then raise exception 'Invalid pagination';end if;
 if snapshot_id is null then
  insert into public.humor_feed_snapshots(user_id,sort,post_ids) select owner,ordering,coalesce(array_agg(q.id order by q.score desc,q.sort_time desc,q.id desc),'{}'::uuid[]) from (
   select c.id,case when ordering='hot' then(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1) else 0 end score,case when ordering='saved' then(select s.created_at from public.humor_saves s where s.caption_id=c.id and s.user_id=owner) else c.created_at end sort_time
   from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.deleted_at is null and i.status='ready' and(ordering<>'mine' or i.user_id=owner)and(ordering<>'saved' or exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner))
  ) q returning * into snap;
 else select * into snap from public.humor_feed_snapshots s where s.id=snapshot_id and s.user_id=owner and s.sort=ordering and s.expires_at>now();if not found then raise exception 'Feed snapshot expired';end if;end if;
 total:=cardinality(snap.post_ids);
 select coalesce(jsonb_agg(public.humor_post(x.id,owner) order by x.pos),'[]'::jsonb) into rows from unnest(snap.post_ids) with ordinality x(id,pos) where x.pos>(page_number-1)*9 and x.pos<=page_number*9 and public.humor_post(x.id,owner)is not null;
 return jsonb_build_object('posts',rows,'nextCursor',null,'cutoff',snap.created_at,'snapshotId',snap.id,'page',page_number,'totalCount',total,'totalPages',greatest(1,ceil(total/9.0)::int));
end $$;
create or replace function public.humor_feed_page(owner uuid,ordering text,snapshot_id uuid default null,page_offset integer default 0,page_limit integer default 12) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snap public.humor_feed_snapshots; ids uuid[]; rows jsonb;
begin
 if ordering not in ('hot','new','mine','saved') or page_limit not between 1 and 12 or page_offset<0 then raise exception 'Invalid pagination'; end if;
 if snapshot_id is null then
  delete from public.humor_feed_snapshots where expires_at<now();
  select coalesce(array_agg(q.id order by q.score desc,q.sort_time desc,q.id desc),'{}'::uuid[]) into ids from (
   select c.id,case when ordering='saved' then (select s.created_at from public.humor_saves s where s.user_id=owner and s.caption_id=c.id) else c.created_at end as sort_time,case when ordering='hot' then (select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1)::double precision else 0 end as score
   from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.deleted_at is null and i.status='ready' and (ordering<>'mine' or i.user_id=owner) and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.user_id=owner and s.caption_id=c.id))
  ) q;
  insert into public.humor_feed_snapshots(user_id,sort,post_ids) values(owner,ordering,ids) returning * into snap;
 else
  select * into snap from public.humor_feed_snapshots s where s.id=snapshot_id and s.user_id=owner and s.sort=ordering and s.expires_at>now();
  if not found then raise exception 'Feed snapshot expired'; end if;
 end if;
 select coalesce(jsonb_agg(q.body order by q.pos),'[]'::jsonb) into rows from (
  select selected.pos,jsonb_build_object('id',c.id,'caption',c.content,'style',c.style,'createdAt',c.created_at,'imageId',i.id,'imagePath',i.storage_path,'imageWidth',i.image_width,'imageHeight',i.image_height,'author',public.humor_author(i.user_id),'authorId',i.user_id,'authorName','@'||coalesce(p.username,'member_'||left(p.id::text,8)),'avatarPath',p.avatar_path,'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=owner and v.value=1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) body
  from unnest(snap.post_ids) with ordinality selected(id,pos) join public.humor_captions c on c.id=selected.id join public.humor_images i on i.id=c.image_id left join public.profiles p on p.id=i.user_id
  where selected.pos>page_offset and selected.pos<=page_offset+page_limit and c.deleted_at is null and i.status='ready' and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner))
 ) q;
 return jsonb_build_object('posts',rows,'snapshotId',snap.id,'cutoff',snap.created_at,'nextOffset',case when page_offset+page_limit<cardinality(snap.post_ids) then page_offset+page_limit else null end);
end $$;
alter table public.humor_rank_snapshots add column cache_version text not null default 'calendar-v1';
create or replace function public.humor_leaderboard(period text,viewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare snap public.humor_rank_snapshots;start_at timestamptz;t timestamptz:=clock_timestamp();post_rows jsonb;people_rows jsonb;own_post jsonb;own_person jsonb;own_ha bigint;
begin
 if period not in('week','month','all')then raise exception 'Invalid ranking window';end if;
 select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
 if snap.period is null or snap.expires_at<=t or snap.cache_version<>'rolling-v2' then
  if pg_try_advisory_xact_lock(hashtextextended('rolling-v2:'||period,107)) then
   select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;
   if snap.period is null or snap.expires_at<=t or snap.cache_version<>'rolling-v2' then
    start_at:=case period when 'week' then t-interval '168 hours' when 'month' then t-interval '720 hours' else null end;
    with source as(select * from public.humor_rank_source(start_at)),ranked as(select id,author_id,row_number()over(order by ha_count desc,created_at asc,id asc)rank from source)select coalesce(jsonb_agg(to_jsonb(r)order by r.rank),'[]')into post_rows from ranked r;
    with source as(select * from public.humor_rank_source(start_at)),groups as(select author_id,sum(ha_count)::bigint ha_received,count(*)post_count from source group by author_id),ranked as(select author_id,row_number()over(order by ha_received desc,post_count asc,author_id asc)rank from groups)select coalesce(jsonb_agg(to_jsonb(r)order by r.rank),'[]')into people_rows from ranked r;
    insert into public.humor_rank_snapshots(period,starts_at,computed_at,expires_at,posts,people,cache_version)values(period,start_at,t,t+interval '5 minutes',post_rows,people_rows,'rolling-v2')on conflict on constraint humor_rank_snapshots_pkey do update set starts_at=excluded.starts_at,computed_at=excluded.computed_at,expires_at=excluded.expires_at,posts=excluded.posts,people=excluded.people,cache_version=excluded.cache_version returning * into snap;
   end if;
  elsif snap.period is null or snap.cache_version<>'rolling-v2' then
   perform pg_advisory_xact_lock(hashtextextended('rolling-v2:'||period,107));select * into snap from public.humor_rank_snapshots s where s.period=humor_leaderboard.period;if snap.period is null or snap.cache_version<>'rolling-v2' then raise exception 'Ranking refresh unavailable';end if;
  end if;
 end if;
 start_at:=snap.starts_at;
 select coalesce(jsonb_agg(p.row||jsonb_build_object('rank',(r->>'rank')::bigint)order by(r->>'rank')::bigint),'[]')into post_rows from jsonb_array_elements(snap.posts)r cross join lateral(select public.humor_post((r->>'id')::uuid,viewer)row)p where(r->>'rank')::bigint<=50 and p.row is not null;
 with source as(select * from public.humor_rank_source(start_at)),totals as(select author_id,sum(ha_count)::bigint ha_received,count(*)post_count from source group by author_id),best as(select distinct on(author_id)author_id,id,content from source order by author_id,ha_count desc,created_at asc,id asc)
 select coalesce(jsonb_agg(jsonb_build_object('rank',(r->>'rank')::bigint,'user',public.humor_author(p.id),'haReceived',g.ha_received,'postCount',g.post_count,'bestPost',jsonb_build_object('id',b.id,'caption',b.content))order by(r->>'rank')::bigint),'[]')into people_rows from jsonb_array_elements(snap.people)r join public.profiles p on p.id=(r->>'author_id')::uuid join totals g on g.author_id=p.id join best b on b.author_id=p.id where(r->>'rank')::bigint<=50;
 select r into own_post from jsonb_array_elements(snap.posts)r where(r->>'author_id')::uuid=viewer and public.humor_post((r->>'id')::uuid,viewer)is not null order by(r->>'rank')::bigint limit 1;
 select r into own_person from jsonb_array_elements(snap.people)r where(r->>'author_id')::uuid=viewer;
 select coalesce(sum(s.ha_count),0)into own_ha from public.humor_rank_source(start_at)s where s.author_id=viewer;
 return jsonb_build_object('window',period,'startsAt',start_at,'computedAt',snap.computed_at,'expiresAt',snap.expires_at,'stale',snap.expires_at<=clock_timestamp(),'posts',post_rows,'people',people_rows,'standing',jsonb_build_object('bestPostRank',(own_post->>'rank')::bigint,'bestPostId',own_post->>'id','bestPostCaption',public.humor_post((own_post->>'id')::uuid,viewer)->>'caption','peopleRank',(own_person->>'rank')::bigint,'haReceived',own_ha));
end $$;
create function public.invalidate_humor_lists()returns trigger language plpgsql security definer set search_path='' as $$begin update public.humor_feed_snapshots set expires_at=now();update public.humor_profile_snapshots set expires_at=now();update public.humor_rank_snapshots set expires_at=least(expires_at,clock_timestamp());return null;end $$;
create trigger invalidate_humor_lists after insert or update of deleted_at or delete on public.humor_captions for each row execute function public.invalidate_humor_lists();
create function public.toggle_humor_save_v2(post_id uuid,owner uuid,request_key uuid)returns jsonb language plpgsql security definer set search_path='' as $$declare result jsonb;shown boolean:=false;begin result:=public.toggle_humor_save(post_id,owner,request_key);if(result->>'viewerHasSaved')::boolean then update public.profiles set saved_hint_seen_at=now()where id=owner and saved_hint_seen_at is null;shown:=found;end if;return result||jsonb_build_object('showSavedHint',shown);end $$;
revoke all on function public.humor_username_available(uuid,text),public.humor_save_profile_v2(uuid,text,text,text,text,uuid),public.humor_paged_feed(uuid,text,int,uuid),public.invalidate_humor_lists(),public.toggle_humor_save_v2(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.humor_username_available(uuid,text),public.humor_save_profile_v2(uuid,text,text,text,text,uuid),public.humor_paged_feed(uuid,text,int,uuid),public.toggle_humor_save_v2(uuid,uuid,uuid)to service_role;
commit;
