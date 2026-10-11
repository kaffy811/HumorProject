rollback;
begin;
do $$
declare v_owner uuid;v_image uuid;v_post uuid;v_request uuid:=gen_random_uuid();v_page jsonb;v_second jsonb;v_rating jsonb;v_snapshot uuid;v_i integer;
begin
 select id into v_owner from public.profiles limit 1;
 insert into public.humor_images(user_id,status,image_width,image_height) values(v_owner,'ready',600,800) returning id into v_image;
 update public.humor_images set storage_path=v_owner::text||'/'||v_image::text||'.png' where id=v_image;
 for v_i in 1..25 loop
  insert into public.humor_captions(image_id,content,created_at) values(v_image,'Feed rollback fixture '||v_i,now()) returning id into v_post;
 end loop;
 v_page:=public.humor_feed_page(v_owner,'new',null,0,12);
 if jsonb_array_length(v_page->'posts')<>12 then raise exception 'Wrong page size';end if;
 v_snapshot:=(v_page->>'snapshotId')::uuid;
 v_post:=(v_page->'posts'->0->>'id')::uuid;
 v_second:=public.humor_feed_page(v_owner,'new',v_snapshot,12,12);
 if exists(select 1 from jsonb_array_elements(v_page->'posts') a,jsonb_array_elements(v_second->'posts') b where a->>'id'=b->>'id') then raise exception 'Duplicate cursor page';end if;
 v_rating:=public.toggle_humor_ha(v_post,v_owner,v_request);
 if (v_rating->>'viewerHasHa')::boolean is not true or (v_rating->>'haCount')::integer<>1 then raise exception 'Ha failed';end if;
 v_rating:=public.toggle_humor_ha(v_post,v_owner,v_request);
 if (v_rating->>'haCount')::integer<>1 then raise exception 'Retry toggled twice';end if;
 v_rating:=public.toggle_humor_ha(v_post,v_owner,gen_random_uuid());
 if (v_rating->>'viewerHasHa')::boolean is not false or (v_rating->>'haCount')::integer<>0 then raise exception 'Unha failed';end if;
 v_rating:=public.humor_feed_page(v_owner,'new',v_snapshot,0,12);
 if v_page->'posts' is distinct from v_rating->'posts' then raise exception 'Snapshot order changed';end if;
 update public.humor_captions set deleted_at=now() where id=v_post;
 if exists(select 1 from jsonb_array_elements(public.humor_feed_page(v_owner,'new',v_snapshot,0,12)->'posts') p where p->>'id'=v_post::text) then raise exception 'Deleted post visible';end if;
 if has_function_privilege('authenticated','public.toggle_humor_ha(uuid,uuid,uuid)','execute') or has_function_privilege('authenticated','public.humor_feed_page(uuid,text,uuid,integer,integer)','execute') then raise exception 'Unsafe RPC access';end if;
 if has_table_privilege('anon','public.humor_reports','select') then raise exception 'Anonymous reports access';end if;
end $$;
rollback;
select 'PASS: pagination, stable ordering, Ha/un-Ha, retry idempotence, soft-delete filtering and private RPC access. Fixtures rolled back.' as result;
