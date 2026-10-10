-- A transaction simulates Auth-issued claims; it never alters a real account.
begin;
insert into auth.users(id) values('00000000-0000-4000-a000-000000000001'),('00000000-0000-4000-a000-000000000002');
insert into public.humor_images(id,user_id,storage_path,status,created_at) values('10000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001','00000000-0000-4000-a000-000000000001/photo.png','ready',now()-interval '2 minutes');
insert into public.humor_captions(id,image_id,content) values('20000000-0000-4000-a000-000000000001','10000000-0000-4000-a000-000000000001','A rollback-only joke.');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","app_metadata":{"providers":["email","google"]},"amr":[{"method":"password","timestamp":20}]}',true);
do $$ begin
 if public.humor_google_session() then raise exception 'FAIL password accepted as Google'; end if;
 if exists(select 1 from public.humor_images) then raise exception 'FAIL email session can read jokes'; end if;
 if exists(select 1 from public.profiles) then raise exception 'FAIL email session can read profile'; end if;
 begin insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001',1); raise exception 'FAIL email vote'; exception when insufficient_privilege then null; end;
 begin perform public.reserve_humor_image(); raise exception 'FAIL email generation'; exception when raise_exception then if sqlerrm='FAIL email generation' then raise; end if; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":20}]}',true);
do $$ begin
 if not public.humor_google_session() then raise exception 'FAIL Google rejected'; end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'FAIL own profile visibility'; end if;
 if exists(select 1 from public.profiles where username is not null or first_name is not null or last_name is not null or avatar_path is not null) then raise exception 'FAIL nullable onboarding fields'; end if;
 begin perform public.reserve_humor_image(); raise exception 'FAIL incomplete generation'; exception when raise_exception then if sqlerrm='FAIL incomplete generation' then raise; end if; end;
 begin insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001',1); raise exception 'FAIL incomplete vote'; exception when insufficient_privilege then null; end;
 begin update public.profiles set avatar_path=id::text||'/not-uploaded.png' where id='00000000-0000-4000-a000-000000000001'; raise exception 'FAIL fake avatar'; exception when raise_exception then if sqlerrm='FAIL fake avatar' then raise; end if; end;
end $$;
insert into storage.objects(bucket_id,name) values('humor-avatars','00000000-0000-4000-a000-000000000001/avatar.png');
update public.profiles set username='rollback_sam',first_name='Sam',last_name='Example',avatar_path=id::text||'/avatar.png' where id='00000000-0000-4000-a000-000000000001';
insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-a000-000000000001','20000000-0000-4000-a000-000000000001',1);
select public.reserve_humor_image();
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":20}]}',true);
do $$ begin
 begin update public.profiles set username='rollback_sam' where id='00000000-0000-4000-a000-000000000002'; raise exception 'FAIL duplicate username'; exception when unique_violation then null; end;
 update public.profiles set username='UPPERCASE' where id='00000000-0000-4000-a000-000000000002'; raise exception 'FAIL uppercase username';
 exception when check_violation then null;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-a000-000000000002","role":"authenticated","app_metadata":{"providers":["google"]},"amr":[{"method":"oauth","timestamp":20},{"method":"password","timestamp":30}]}',true);
do $$ begin if public.humor_google_session() then raise exception 'FAIL newer password session'; end if; end $$;
reset role;
rollback;
select 'PASS Google-only database and storage gate, old email rejection, nullable signup profile, complete-profile voting/generation, genuine avatar, unique normalized username and newer-password rejection' as result;
