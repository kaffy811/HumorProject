-- Rollback-only verification. No seed content or accounts survive this transaction.
rollback;
begin;
do $$
declare owner uuid:=gen_random_uuid();image uuid;generation uuid;candidate uuid:=gen_random_uuid();result jsonb;again jsonb;post uuid;reservation jsonb;second jsonb;official uuid;actor uuid:=gen_random_uuid();item uuid;batch jsonb;i int;
begin
 insert into auth.users(id,raw_user_meta_data) values(owner,'{}'),(actor,'{}');
 image:=public.create_humor_draft(owner,'image/png',100,'png');
 update public.humor_drafts set upload_status='ready',ai_path=owner::text||'/'||image::text||'-ai.png',image_sha256=repeat('a',64) where image_id=image;
 generation:=public.reserve_humor_generation(image,owner,gen_random_uuid(),'google','test','system','user','{}'::jsonb,'Deadpan','');
 update public.humor_generations set status='completed',scene='test',caption_candidates=jsonb_build_array(jsonb_build_object('id',candidate::text),jsonb_build_object('id',gen_random_uuid()::text),jsonb_build_object('id',gen_random_uuid()::text),jsonb_build_object('id',gen_random_uuid()::text)) where id=generation;
 result:=public.humor_publish_onboarded(image,owner,generation,candidate,'Rollback-only first post',gen_random_uuid());
 post:=(result->>'postId')::uuid;
 again:=public.humor_publish_onboarded(image,owner,generation,candidate,'Rollback-only first post',gen_random_uuid());
 if not (result->>'isFirstPost')::boolean or again->>'postId'<>post::text then raise exception 'First publication/idempotence failed';end if;
 if not exists(select 1 from public.profiles where id=owner and onboarded_at is not null and first_post_notice_id=post) then raise exception 'Onboarding marker missing';end if;
 update public.profiles set first_post_notice_seen_at=now() where id=owner;
 if (public.humor_publish_onboarded(image,owner,generation,candidate,'Rollback-only first post',gen_random_uuid())->>'isFirstPost')::boolean then raise exception 'First notice repeated';end if;
 reservation:=public.humor_reserve_seed('rollback-check.png','production',false);
 second:=public.humor_reserve_seed('rollback-check.png','production',false);
 if reservation->>'id'<>second->>'id' or reservation->>'imageId'<>second->>'imageId' then raise exception 'Seed reservation not idempotent';end if;
 begin
  perform public.humor_reserve_seed('rollback-placeholder.png','production',true);
  raise exception 'Production placeholder was accepted';
 exception when others then
  if sqlerrm='Production placeholder was accepted' then raise;end if;
 end;
 select id into official from public.profiles where is_official;
 if official is null or exists(select 1 from auth.identities where user_id=official) or exists(select 1 from auth.users where id=official and (email is not null or encrypted_password is not null)) then raise exception 'Official identity can log in';end if;
 if has_function_privilege('authenticated','public.humor_reserve_seed(text,text,boolean)','execute') then raise exception 'Member can import seeds';end if;
 -- More than one notification page and retention of only 90 days.
 for i in 1..22 loop
  insert into public.humor_comments(caption_id,user_id,content) values(post,actor,'Rollback pagination '||i) returning id into item;
 end loop;
 batch:=public.humor_notifications_page(owner,false);
 if jsonb_array_length(batch->'items')<>20 or batch->'nextCursor'='null'::jsonb then raise exception 'Notification pagination failed';end if;
 batch:=public.humor_notifications_page(owner,false,(batch->'nextCursor'->>'time')::timestamptz,(batch->'nextCursor'->>'id')::uuid);
 if jsonb_array_length(batch->'items')<>2 then raise exception 'Notification second page failed';end if;
 update public.notifications set created_at=now()-interval '91 days' where recipient_id=owner;
 perform public.humor_cleanup_notifications();
 if exists(select 1 from public.notifications where recipient_id=owner) then raise exception 'Retention failed';end if;
end $$;
rollback;
select 'PASS: first publication/onboarding/one-time notice, idempotent seed reservation, production placeholder refusal, official non-login identity, notification pagination and 90-day retention. All fixtures rolled back.' as result;
