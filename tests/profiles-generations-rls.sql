-- All test fixtures are rolled back. No real account is altered.
begin;
insert into auth.users(id) values('00000000-0000-4000-9000-000000000001'),('00000000-0000-4000-9000-000000000002');
do $$ begin
 if (select count(*) from public.profiles where id in ('00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000002'))<>2 then raise exception 'FAIL signup trigger'; end if;
 if exists(select 1 from public.profiles where id='00000000-0000-4000-9000-000000000001' and (first_name is not null or last_name is not null)) then raise exception 'FAIL nullable names'; end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.profiles; raise exception 'FAIL anonymous profile'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.humor_generations; raise exception 'FAIL anonymous prompts'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":10}]}',true);
do $$ begin
 if (select count(*) from public.profiles)<>1 then raise exception 'FAIL other profile visible'; end if;
 begin perform public.reserve_humor_image(); raise exception 'FAIL incomplete profile generated'; exception when raise_exception then if sqlerrm='FAIL incomplete profile generated' then raise; end if; end;
end $$;
update public.profiles set first_name='Sam',last_name='Example' where id='00000000-0000-4000-9000-000000000001';
do $$ begin
 if not exists(select 1 from public.profiles where first_name='Sam') then raise exception 'FAIL own profile update'; end if;
 update public.profiles set first_name='Forged' where id='00000000-0000-4000-9000-000000000002';
 if found then raise exception 'FAIL other profile update'; end if;
 begin update public.profiles set id='00000000-0000-4000-9000-000000000002' where id='00000000-0000-4000-9000-000000000001'; raise exception 'FAIL identity rewrite'; exception when insufficient_privilege then null; end;
 begin update public.profiles set avatar_path='00000000-0000-4000-9000-000000000002/photo.png' where id='00000000-0000-4000-9000-000000000001'; raise exception 'FAIL foreign avatar'; exception when check_violation then null; when raise_exception then if sqlerrm='FAIL foreign avatar' then raise; end if; end;
end $$;
insert into storage.objects(bucket_id,name) values('humor-avatars','00000000-0000-4000-9000-000000000001/test.png');
do $$ begin
 begin insert into storage.objects(bucket_id,name) values('humor-avatars','00000000-0000-4000-9000-000000000002/forged.png'); raise exception 'FAIL foreign avatar upload'; exception when insufficient_privilege then null; end;
end $$;
update public.profiles set avatar_path='00000000-0000-4000-9000-000000000001/test.png' where id='00000000-0000-4000-9000-000000000001';
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000002","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":10}]}',true);
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='humor-avatars') then raise exception 'FAIL other avatar visible'; end if;
end $$;
reset role;
insert into public.humor_images(id,user_id) values('10000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001');
insert into public.humor_generations(image_id,user_id,provider,model,system_prompt,user_prompt,generation_config,image_path,image_mime,image_sha256)
values('10000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001','google','gemini-test','System test prompt','User test prompt','{}','00000000-0000-4000-9000-000000000001/test.png','image/png',repeat('a',64));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000001","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":10}]}',true);
do $$ begin
 if not exists(select 1 from public.humor_generations where system_prompt='System test prompt') then raise exception 'FAIL own prompt read'; end if;
 begin update public.humor_generations set system_prompt='Forged' where image_id='10000000-0000-4000-9000-000000000001'; raise exception 'FAIL client prompt rewrite'; exception when insufficient_privilege then null; end;
 begin perform public.complete_humor_image('10000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001/test.png','Scene',array['A','B','C','D'],'{}'::jsonb); raise exception 'FAIL client publication'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-9000-000000000002","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":10}]}',true);
do $$ begin if exists(select 1 from public.humor_generations) then raise exception 'FAIL private prompts'; end if; end $$;
set local role service_role;
do $$ begin
 begin perform public.complete_humor_image('10000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001/test.png','Scene',array['A','A','C','D'],'{}'::jsonb); raise exception 'FAIL duplicate generation'; exception when raise_exception then if sqlerrm='FAIL duplicate generation' then raise; end if; end;
end $$;
select public.complete_humor_image('10000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001','00000000-0000-4000-9000-000000000001/test.png','A test scene',array['A','B','C','D'],'{"promptTokenCount":10}'::jsonb);
reset role;
do $$ begin
 if (select count(*) from public.humor_captions where image_id='10000000-0000-4000-9000-000000000001')<>4 then raise exception 'FAIL caption publication'; end if;
 if not exists(select 1 from public.humor_generations where image_id='10000000-0000-4000-9000-000000000001' and status='completed' and usage_metadata->>'promptTokenCount'='10') then raise exception 'FAIL audit completion'; end if;
 if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'FAIL all tables RLS'; end if;
end $$;
rollback;
select 'PASS profiles trigger, nullable names, own profile, avatar ownership, private prompts, immutable audit, atomic publication, Gemini usage and all-table RLS' as result;
