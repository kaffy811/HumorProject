-- Run in Supabase SQL Editor. All fixtures are rolled back; no published test post remains.
rollback;
begin;
do $$
declare v_owner uuid; v_image uuid; v_generation uuid; v_regeneration uuid; v_first uuid; v_second uuid; v_candidate uuid:=gen_random_uuid();
begin
 select id into v_owner from public.profiles limit 1;
 if v_owner is null then raise exception 'No test owner'; end if;
 v_image:=public.create_humor_draft(v_owner,'image/png',100,'png');
 update public.humor_drafts d set upload_status='ready',ai_path=v_owner::text||'/'||v_image::text||'-ai.png',image_sha256=repeat('a',64) where d.image_id=v_image;
 v_generation:=public.reserve_humor_generation(v_image,v_owner,gen_random_uuid(),'google','test','system','user','{}'::jsonb,'Deadpan','');
 update public.humor_generations g set status='completed',scene='test',caption_candidates=jsonb_build_array(jsonb_build_object('id',v_candidate::text),jsonb_build_object('id',gen_random_uuid()::text),jsonb_build_object('id',gen_random_uuid()::text),jsonb_build_object('id',gen_random_uuid()::text)) where g.id=v_generation;
 v_regeneration:=public.reserve_humor_generation(v_image,v_owner,gen_random_uuid(),'google','test','system','user','{}'::jsonb,'Deadpan','');
 begin
  perform public.reserve_humor_generation(v_image,v_owner,gen_random_uuid(),'google','test','system','user','{}'::jsonb,'Deadpan','');
  raise exception 'Concurrent generation was accepted';
 exception when others then
  if sqlerrm <> 'Generation busy' then raise; end if;
 end;
 update public.humor_generations set status='failed' where id=v_regeneration;
 v_first:=public.publish_humor_draft(v_image,v_owner,v_generation,v_candidate,'Transaction test',gen_random_uuid());
 v_second:=public.publish_humor_draft(v_image,v_owner,v_generation,v_candidate,'Transaction test',gen_random_uuid());
 if v_first is distinct from v_second then raise exception 'Duplicate publication'; end if;
 if (select count(*) from public.humor_captions c where c.image_id=v_image)<>1 then raise exception 'Wrong caption count'; end if;
 if has_function_privilege('authenticated','public.publish_humor_draft(uuid,uuid,uuid,uuid,text,uuid)','execute') then raise exception 'Unsafe RPC permission'; end if;
 if has_table_privilege('anon','public.humor_drafts','select') then raise exception 'Anonymous draft access'; end if;
 if not (select relrowsecurity from pg_class where oid='public.humor_drafts'::regclass) then raise exception 'Draft RLS disabled'; end if;
end $$;
rollback;
select 'PASS: draft, immediate regeneration, concurrent rejection, single publication, idempotence and RPC privileges; test rolled back' as result;
