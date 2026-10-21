rollback;
begin;
do $$
declare owner uuid;uid uuid;image uuid;post uuid;last_post uuid;old_post uuid;first_post uuid;board jsonb;again jsonb;stamp text;start_at timestamptz; n int;
begin
 select id into owner from public.profiles limit 1;
 -- Uncommitted fixtures never appear to readers, and the whole check rolls back.
 update public.humor_images set status='failed' where status='ready';
 update public.humor_rank_snapshots set expires_at=now()-interval '1 second';
 start_at:=date_trunc('week',now() at time zone 'America/New_York') at time zone 'America/New_York';
 for n in 1..60 loop
  uid:=case when n=1 then owner else gen_random_uuid() end;
  if n>1 then insert into auth.users(id,raw_user_meta_data) values(uid,'{}'::jsonb); end if;
  insert into public.humor_images(user_id,status,image_width,image_height) values(uid,'ready',600,800) returning id into image;
  insert into public.humor_captions(image_id,content,created_at) values(image,'Leaderboard rollback fixture '||n,start_at+(n||' seconds')::interval) returning id into post;
  insert into public.humor_votes(user_id,caption_id,value) values(owner,post,1);
  -- Equal Ha: the newest post ranks first, so the owner's oldest post is #60.
  if n=60 then first_post:=post; end if;
  if n=1 then last_post:=post;
   insert into public.humor_captions(image_id,content,created_at) values(image,'Zero-Ha fixture',start_at+interval '61 seconds');
   insert into public.humor_captions(image_id,content,created_at) values(image,'Excluded old fixture',start_at-interval '1 second') returning id into old_post;
   insert into public.humor_votes(user_id,caption_id,value) values(owner,old_post,1);
  end if;
 end loop;
 board:=public.humor_leaderboard('week',owner);
 if jsonb_array_length(board->'posts')<>50 or jsonb_array_length(board->'people')<>50 then raise exception 'Top 50 limit failed';end if;
 if (board->'standing'->>'bestPostRank')::int<>60 or (board->'standing'->>'peopleRank')::int<>60 then raise exception 'Standing outside 50 or People tie failed';end if;
 if (board->'standing'->>'haReceived')::int<>1 then raise exception 'Old post included in week total';end if;
 if board->'posts'->0->>'id'<>first_post::text then raise exception 'Newest post tie failed';end if;
 stamp:=board->>'computedAt';
 perform public.toggle_humor_ha(first_post,owner,gen_random_uuid());
 again:=public.humor_leaderboard('week',owner);
 if again->>'computedAt'<>stamp or (again->'posts'->0->>'haCount')::int<>0 then raise exception 'Ha did not hydrate without reranking';end if;
 -- Force expiry: the next request rebuilds once; the next one reuses it.
 update public.humor_rank_snapshots set expires_at=clock_timestamp()-interval '1 second' where period='week';
 again:=public.humor_leaderboard('week',owner);
 if again->>'computedAt'=stamp or again->'posts'->0->>'id'=first_post::text then raise exception 'Expired ranking not rebuilt';end if;
 stamp:=again->>'computedAt';
 if public.humor_leaderboard('week',owner)->>'computedAt'<>stamp then raise exception 'Fresh snapshot recalculated';end if;
 update public.humor_captions set deleted_at=now() where id=last_post;
 again:=public.humor_leaderboard('week',owner);
 if again->'standing'->>'bestPostRank' is not null or again->'standing'->>'peopleRank' is not null then raise exception 'Deleted ranking remains';end if;
 if has_function_privilege('authenticated','public.humor_leaderboard(text,uuid)','execute') or has_table_privilege('anon','public.humor_rank_snapshots','select') then raise exception 'Private leaderboard permissions failed';end if;
end $$;
rollback;
select 'PASS: top-50 limits, true #60 standings, publication-window totals, both ties, live Ha without reordering, expiry reuse, deletion invalidation and private permissions. All fixtures rolled back.' as result;
