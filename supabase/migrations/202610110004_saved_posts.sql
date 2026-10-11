begin;
create table public.humor_saves (
 user_id uuid not null references auth.users(id) on delete cascade,
 caption_id uuid not null references public.humor_captions(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,caption_id)
);
create index humor_saves_recent on public.humor_saves(user_id,created_at desc);
create table public.humor_save_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_key uuid not null,
 caption_id uuid not null references public.humor_captions(id) on delete cascade,
 has_saved boolean not null,
 created_at timestamptz not null default now(),
 primary key(user_id,request_key)
);
alter table public.humor_saves enable row level security;
alter table public.humor_save_requests enable row level security;
revoke all on public.humor_saves,public.humor_save_requests from anon,authenticated;
grant all on public.humor_saves,public.humor_save_requests to service_role;
grant select on public.humor_saves to authenticated;
create policy "Read own Google saves" on public.humor_saves for select to authenticated using(user_id=(select auth.uid()) and (select public.humor_google_session()) and exists(select 1 from public.humor_captions c where c.id=caption_id and c.deleted_at is null));
alter table public.humor_feed_snapshots drop constraint humor_feed_snapshots_sort_check;
alter table public.humor_feed_snapshots add constraint humor_feed_snapshots_sort_check check(sort in ('hot','new','mine','saved'));
create function public.toggle_humor_save(post_id uuid,owner uuid,request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.humor_save_requests; saved boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text||post_id::text,5));
 if not exists(select 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready') then raise exception 'Post not found'; end if;
 select * into previous from public.humor_save_requests r where r.user_id=owner and r.request_key=toggle_humor_save.request_key;
 if found then
  if previous.caption_id<>post_id then raise exception 'Invalid request'; end if;
  saved:=previous.has_saved;
 else
  select exists(select 1 from public.humor_saves s where s.caption_id=post_id and s.user_id=owner) into saved;
  saved:=not saved;
  if saved then insert into public.humor_saves(user_id,caption_id) values(owner,post_id);
  else delete from public.humor_saves where user_id=owner and caption_id=post_id; end if;
  insert into public.humor_save_requests(user_id,request_key,caption_id,has_saved) values(owner,toggle_humor_save.request_key,post_id,saved);
 end if;
 return jsonb_build_object('viewerHasSaved',saved);
end $$;
revoke all on function public.toggle_humor_save(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.toggle_humor_save(uuid,uuid,uuid) to service_role;
create or replace function public.humor_feed_page(owner uuid,ordering text,snapshot_id uuid default null,page_offset integer default 0,page_limit integer default 12) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snap public.humor_feed_snapshots; ids uuid[]; rows jsonb;
begin
 if ordering not in ('hot','new','mine','saved') or page_limit not between 1 and 12 or page_offset<0 then raise exception 'Invalid pagination'; end if;
 if snapshot_id is null then
  delete from public.humor_feed_snapshots where expires_at<now();
  select coalesce(array_agg(q.id order by q.score desc,q.sort_time desc,q.id desc),'{}'::uuid[]) into ids from (
   select c.id,case when ordering='saved' then (select s.created_at from public.humor_saves s where s.user_id=owner and s.caption_id=c.id) else c.created_at end as sort_time,case when ordering='hot' then (select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1)::double precision / power(greatest(0,extract(epoch from (now()-c.created_at))/3600)+2,1.5) else 0 end as score
   from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.deleted_at is null and i.status='ready' and (ordering<>'mine' or i.user_id=owner) and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.user_id=owner and s.caption_id=c.id))
  ) q;
  insert into public.humor_feed_snapshots(user_id,sort,post_ids) values(owner,ordering,ids) returning * into snap;
 else
  select * into snap from public.humor_feed_snapshots s where s.id=snapshot_id and s.user_id=owner and s.sort=ordering and s.expires_at>now();
  if not found then raise exception 'Feed snapshot expired'; end if;
 end if;
 select coalesce(jsonb_agg(q.body order by q.pos),'[]'::jsonb) into rows from (
  select selected.pos,jsonb_build_object('id',c.id,'caption',c.content,'style',c.style,'createdAt',c.created_at,'imageId',i.id,'imagePath',i.storage_path,'imageWidth',i.image_width,'imageHeight',i.image_height,'authorId',i.user_id,'authorName',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarPath',p.avatar_path,'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=owner and v.value=1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) body
  from unnest(snap.post_ids) with ordinality selected(id,pos) join public.humor_captions c on c.id=selected.id join public.humor_images i on i.id=c.image_id left join public.profiles p on p.id=i.user_id
  where selected.pos>page_offset and selected.pos<=page_offset+page_limit and c.deleted_at is null and i.status='ready' and (ordering<>'saved' or exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=owner))
 ) q;
 return jsonb_build_object('posts',rows,'snapshotId',snap.id,'cutoff',snap.created_at,'nextOffset',case when page_offset+page_limit<cardinality(snap.post_ids) then page_offset+page_limit else null end);
end $$;
revoke all on function public.humor_feed_page(uuid,text,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.humor_feed_page(uuid,text,uuid,integer,integer) to service_role;

commit;
