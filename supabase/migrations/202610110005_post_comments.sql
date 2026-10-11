begin;
alter table public.humor_images add column locked_thumbnail_path text;
alter table public.humor_captions add column og_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('humor-previews','humor-previews',false,3000000,array['image/webp','image/png']) on conflict(id) do nothing;
alter table public.humor_comments add column reply_to_id uuid references public.humor_comments(id) on delete set null;
create index humor_comments_order on public.humor_comments(caption_id,created_at desc,id desc) where deleted_at is null;
create table public.humor_comment_votes(comment_id uuid references public.humor_comments(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(comment_id,user_id));
create table public.humor_comment_reports(comment_id uuid references public.humor_comments(id) on delete cascade,user_id uuid references auth.users(id) on delete cascade,reason text not null check(reason in ('Spam','Harassment','Inappropriate content','Other')),created_at timestamptz not null default now(),primary key(comment_id,user_id));
create table public.humor_comment_requests(user_id uuid references auth.users(id) on delete cascade,request_key uuid,caption_id uuid references public.humor_captions(id) on delete cascade,comment_id uuid references public.humor_comments(id) on delete cascade,fingerprint text not null,primary key(user_id,request_key));
create table public.humor_comment_ha_requests(user_id uuid references auth.users(id) on delete cascade,request_key uuid,comment_id uuid references public.humor_comments(id) on delete cascade,has_ha boolean not null,primary key(user_id,request_key));
-- Keep rate events even when content is removed: deletion must not reset the limit.
create table public.humor_comment_rate_events(user_id uuid references auth.users(id) on delete cascade,created_at timestamptz not null default clock_timestamp());
create index on public.humor_comment_rate_events(user_id,created_at desc);
create table public.humor_comment_snapshots(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,caption_id uuid references public.humor_captions(id) on delete cascade,sort text not null check(sort in ('top','new')),comment_ids uuid[] not null,expires_at timestamptz not null default now()+interval '20 minutes');
alter table public.humor_comment_votes enable row level security;
alter table public.humor_comment_reports enable row level security;
alter table public.humor_comment_requests enable row level security;
alter table public.humor_comment_ha_requests enable row level security;
alter table public.humor_comment_rate_events enable row level security;
alter table public.humor_comment_snapshots enable row level security;
revoke all on public.humor_comment_votes,public.humor_comment_reports,public.humor_comment_requests,public.humor_comment_ha_requests,public.humor_comment_rate_events,public.humor_comment_snapshots from anon,authenticated;
grant all on public.humor_comment_votes,public.humor_comment_reports,public.humor_comment_requests,public.humor_comment_ha_requests,public.humor_comment_rate_events,public.humor_comment_snapshots to service_role;
create function public.humor_comment_row(comment_id uuid,viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'postId',c.caption_id,'body',c.content,'createdAt',c.created_at,'author',jsonb_build_object('id',c.user_id,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarUrl',case when p.avatar_path is not null then '/api/comments/'||c.id::text||'/avatar' else null end),'haCount',(select count(*) from public.humor_comment_votes v where v.comment_id=c.id),'viewerHasHa',exists(select 1 from public.humor_comment_votes v where v.comment_id=c.id and v.user_id=viewer),'replyTo',case when c.reply_to_id is null then null else jsonb_build_object('id',r.id,'authorName',case when r.deleted_at is not null then 'deleted' else coalesce(nullif(trim(concat_ws(' ',rp.first_name,rp.last_name)),''),rp.username,'Member') end) end)
 from public.humor_comments c left join public.profiles p on p.id=c.user_id left join public.humor_comments r on r.id=c.reply_to_id left join public.profiles rp on rp.id=r.user_id where c.id=comment_id and c.deleted_at is null
$$;
create function public.humor_post(post_id uuid,viewer uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'imageUrl','/api/posts/'||c.id::text||'/media','imageWidth',coalesce(i.image_width,800),'imageHeight',coalesce(i.image_height,800),'caption',c.content,'style',c.style,'createdAt',c.created_at,'author',jsonb_build_object('id',i.user_id,'name',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Member'),'avatarUrl',case when p.avatar_path is not null then '/api/posts/'||c.id::text||'/media?kind=avatar' else null end),'haCount',(select count(*) from public.humor_votes v where v.caption_id=c.id and v.value=1),'viewerHasHa',exists(select 1 from public.humor_votes v where v.caption_id=c.id and v.user_id=viewer and v.value=1),'viewerHasSaved',exists(select 1 from public.humor_saves s where s.caption_id=c.id and s.user_id=viewer),'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.id and m.deleted_at is null)) from public.humor_captions c join public.humor_images i on i.id=c.image_id left join public.profiles p on p.id=i.user_id where c.id=post_id and c.deleted_at is null and i.status='ready'
$$;
create function public.add_humor_comment(post_id uuid,owner uuid,body text,reply_id uuid,request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid; prev public.humor_comment_requests; fingerprint text; total bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text,101));
 perform 1 from public.humor_captions c join public.humor_images i on i.id=c.image_id where c.id=post_id and c.deleted_at is null and i.status='ready' for update of c;
 if not found then raise exception 'Post not found'; end if;
 if char_length(trim(body)) not between 1 and 280 or body ~ '[\x01-\x08]' then raise exception 'Invalid comment'; end if;
 fingerprint:=md5(jsonb_build_array(post_id,trim(body),reply_id)::text);
 select * into prev from public.humor_comment_requests r where r.user_id=owner and r.request_key=add_humor_comment.request_key;
 if found then
  if prev.fingerprint<>fingerprint then raise exception 'Invalid request'; end if;
  cid:=prev.comment_id;
 else
  if reply_id is not null and not exists(select 1 from public.humor_comments c where c.id=reply_id and c.caption_id=post_id and c.deleted_at is null) then raise exception 'Reply no longer available'; end if;
  delete from public.humor_comment_rate_events where created_at<clock_timestamp()-interval '1 minute';
  if (select count(*) from public.humor_comment_rate_events e where e.user_id=owner and e.created_at>clock_timestamp()-interval '10 seconds')>=3 then raise exception 'Comment rate limit'; end if;
  insert into public.humor_comments(caption_id,user_id,content,reply_to_id) values(post_id,owner,trim(body),reply_id) returning id into cid;
  insert into public.humor_comment_requests values(owner,request_key,post_id,cid,fingerprint);
  insert into public.humor_comment_rate_events(user_id) values(owner);
 end if;
 select count(*) into total from public.humor_comments c where c.caption_id=post_id and c.deleted_at is null;
 return jsonb_build_object('comment',public.humor_comment_row(cid,owner),'commentCount',total);
end $$;
create function public.humor_comments_page(post_id uuid,owner uuid,ordering text,snapshot_id uuid default null,page_offset integer default 0,page_limit integer default 20) returns jsonb language plpgsql security definer set search_path='' as $$
declare snap public.humor_comment_snapshots; ids uuid[]; rows jsonb;
begin
 if ordering not in ('top','new') or page_limit not between 1 and 20 or page_offset<0 then raise exception 'Invalid pagination'; end if;
 if not exists(select 1 from public.humor_captions c where c.id=post_id and c.deleted_at is null) then raise exception 'Post not found'; end if;
 if snapshot_id is null then
  delete from public.humor_comment_snapshots where expires_at<now();
  select coalesce(array_agg(q.id order by q.score desc,q.created_at desc,q.id desc),'{}'::uuid[]) into ids from(select c.id,c.created_at,case when ordering='top' then (select count(*) from public.humor_comment_votes v where v.comment_id=c.id) else 0 end as score from public.humor_comments c where c.caption_id=post_id and c.deleted_at is null) q;
  insert into public.humor_comment_snapshots(user_id,caption_id,sort,comment_ids) values(owner,post_id,ordering,ids) returning * into snap;
 else
  select * into snap from public.humor_comment_snapshots s where s.id=snapshot_id and s.user_id=owner and s.caption_id=post_id and s.sort=ordering and s.expires_at>now();
  if not found then raise exception 'Comment snapshot expired'; end if;
 end if;
 select coalesce(jsonb_agg(public.humor_comment_row(c.id,owner) order by u.pos),'[]'::jsonb) into rows from unnest(snap.comment_ids) with ordinality u(id,pos) join public.humor_comments c on c.id=u.id where u.pos>page_offset and u.pos<=page_offset+page_limit and c.deleted_at is null;
 return jsonb_build_object('comments',rows,'snapshotId',snap.id,'nextOffset',case when page_offset+page_limit<cardinality(snap.comment_ids) then page_offset+page_limit else null end,'commentCount',(select count(*) from public.humor_comments c where c.caption_id=post_id and c.deleted_at is null));
end $$;
create function public.toggle_humor_comment_ha(comment_id uuid,owner uuid,request_key uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare prev public.humor_comment_ha_requests; active boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner::text||comment_id::text,102));
 perform 1 from public.humor_comments c join public.humor_captions p on p.id=c.caption_id where c.id=comment_id and c.deleted_at is null and p.deleted_at is null for update of c;
 if not found then raise exception 'Comment not found'; end if;
 select * into prev from public.humor_comment_ha_requests r where r.user_id=owner and r.request_key=toggle_humor_comment_ha.request_key;
 if found then
  if prev.comment_id<>comment_id then raise exception 'Invalid request'; end if;
  active:=prev.has_ha;
 else
  select not exists(select 1 from public.humor_comment_votes v where v.comment_id=toggle_humor_comment_ha.comment_id and v.user_id=owner) into active;
  if active then insert into public.humor_comment_votes values(comment_id,owner,now()); else delete from public.humor_comment_votes v where v.comment_id=toggle_humor_comment_ha.comment_id and v.user_id=owner; end if;
  insert into public.humor_comment_ha_requests values(owner,request_key,comment_id,active);
 end if;
 return jsonb_build_object('viewerHasHa',active,'haCount',(select count(*) from public.humor_comment_votes v where v.comment_id=toggle_humor_comment_ha.comment_id));
end $$;
create function public.delete_humor_comment(comment_id uuid,owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.humor_comments;
begin
 select * into c from public.humor_comments m where m.id=comment_id;
 if not found then raise exception 'Comment not found'; end if;
 if c.user_id<>owner then raise exception 'Only the author can delete this comment'; end if;
 perform 1 from public.humor_captions p where p.id=c.caption_id and p.deleted_at is null for update;
 if not found then raise exception 'Post not found'; end if;
 -- Retain a tombstone for replies, erase the text and its interactions.
 update public.humor_comments m set content='[deleted]',deleted_at=coalesce(m.deleted_at,now()) where m.id=comment_id;
 delete from public.humor_comment_votes v where v.comment_id=delete_humor_comment.comment_id;
 delete from public.humor_comment_reports r where r.comment_id=delete_humor_comment.comment_id;
 delete from public.humor_comment_ha_requests r where r.comment_id=delete_humor_comment.comment_id;
 return jsonb_build_object('postId',c.caption_id,'commentCount',(select count(*) from public.humor_comments m where m.caption_id=c.caption_id and m.deleted_at is null));
end $$;
create function public.cleanup_humor_post() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.deleted_at is not null and old.deleted_at is null then
  delete from public.humor_comments where caption_id=new.id;
  delete from public.humor_comment_snapshots where caption_id=new.id;
  delete from public.humor_votes where caption_id=new.id;
  delete from public.humor_saves where caption_id=new.id;
  delete from public.humor_reports where caption_id=new.id;
  delete from public.humor_ha_requests where caption_id=new.id;
  delete from public.humor_save_requests where caption_id=new.id;
 end if;
 return new;
end $$;
create trigger cleanup_deleted_humor_post after update of deleted_at on public.humor_captions for each row execute function public.cleanup_humor_post();
revoke all on function public.humor_comment_row(uuid,uuid),public.humor_post(uuid,uuid),public.add_humor_comment(uuid,uuid,text,uuid,uuid),public.humor_comments_page(uuid,uuid,text,uuid,integer,integer),public.toggle_humor_comment_ha(uuid,uuid,uuid),public.delete_humor_comment(uuid,uuid),public.cleanup_humor_post() from public,anon,authenticated;
grant execute on function public.humor_comment_row(uuid,uuid),public.humor_post(uuid,uuid),public.add_humor_comment(uuid,uuid,text,uuid,uuid),public.humor_comments_page(uuid,uuid,text,uuid,integer,integer),public.toggle_humor_comment_ha(uuid,uuid,uuid),public.delete_humor_comment(uuid,uuid) to service_role;
commit;
