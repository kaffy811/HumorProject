-- Run in the new project's SQL Editor. All fixtures are rolled back.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.humor_images(id,user_id,storage_path,status) values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001/test.png','ready'),('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001',null,'processing');
insert into public.humor_captions(id,image_id,content) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','A test punchline');
set local role anon;
do $$ begin
begin insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1); raise exception 'FAIL anon vote'; exception when insufficient_privilege then null; end;
begin perform public.reserve_humor_image(); raise exception 'FAIL anon reserve'; exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1);
do $$ begin
begin insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',-1); raise exception 'FAIL duplicate'; exception when unique_violation then null; end;
begin insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',1); raise exception 'FAIL forged user'; exception when insufficient_privilege then null; end;
begin update public.humor_votes set value=-1; raise exception 'FAIL vote edit'; exception when insufficient_privilege then null; end;
begin insert into public.humor_captions(image_id,content) values('10000000-0000-4000-8000-000000000001','Forged'); raise exception 'FAIL client caption'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
if exists(select 1 from public.humor_votes) then raise exception 'FAIL private votes'; end if;
if exists(select 1 from public.humor_images where id='10000000-0000-4000-8000-000000000002') then raise exception 'FAIL private draft'; end if;
if not exists(select 1 from public.humor_captions where id='20000000-0000-4000-8000-000000000001') then raise exception 'FAIL gallery'; end if;
end $$;
insert into public.humor_votes(user_id,caption_id,value) values('00000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',-1);
reset role;
do $$ begin if exists(select 1 from pg_tables where schemaname='public' and not rowsecurity) then raise exception 'FAIL RLS'; end if; end $$;
rollback;
select 'PASS: anonymous access, own vote, duplicate, forged user, immutable votes, private drafts/votes, two-user voting, RLS' as result;
