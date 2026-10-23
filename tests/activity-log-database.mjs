// Local in-memory check of the activity-log triggers. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  grant usage on schema auth to authenticated,service_role;
  create table auth.users(id uuid primary key,last_sign_in_at timestamptz);
  create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,created_at timestamptz default now(),user_agent text);
  create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt()returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table public.profiles(id uuid primary key references auth.users(id),username text,first_name text,last_name text,display_name text,avatar_path text,onboarded_at timestamptz,created_at timestamptz default now());
  create table public.humor_images(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),status text default 'ready',created_at timestamptz default now());
  create table public.humor_captions(id uuid primary key default gen_random_uuid(),image_id uuid references public.humor_images(id) on delete cascade,content text,style text default 'Pun',source text default 'ai',created_at timestamptz default now(),deleted_at timestamptz);
  create table public.humor_votes(id uuid primary key default gen_random_uuid(),user_id uuid,caption_id uuid references public.humor_captions(id) on delete cascade,value smallint,created_at timestamptz default now());
  create table public.humor_comments(id uuid primary key default gen_random_uuid(),caption_id uuid references public.humor_captions(id) on delete cascade,user_id uuid,content text,reply_to_id uuid,created_at timestamptz default now(),deleted_at timestamptz);
  create table public.humor_comment_votes(comment_id uuid references public.humor_comments(id) on delete cascade,user_id uuid,created_at timestamptz default now());
  create table public.humor_saves(user_id uuid,caption_id uuid references public.humor_captions(id) on delete cascade,created_at timestamptz default now());
  create table public.humor_reports(user_id uuid,caption_id uuid,reason text,created_at timestamptz default now());
  create table public.humor_comment_reports(user_id uuid,comment_id uuid,reason text,created_at timestamptz default now());
  create table public.humor_generations(id uuid primary key default gen_random_uuid(),image_id uuid,user_id uuid,provider text default 'google',model text default 'gemini-x',prompt_version text default 'v1',status text default 'processing',failure_stage text,created_at timestamptz default now(),completed_at timestamptz);
  grant usage on schema public to authenticated,service_role;`);
 await db.exec(await readFile('supabase/migrations/202610200001_superadmin.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/202610210001_superadmin_requests.sql','utf8'));
 // History that exists before the migration is backfilled.
 const old=randomUUID();
 await db.query("insert into auth.users(id,last_sign_in_at)values($1,now()-interval '2 days')",[old]);
 await db.query("insert into public.profiles(id,created_at)values($1,now()-interval '3 days')",[old]);
 const oldImage=(await db.query('insert into public.humor_images(user_id)values($1)returning id',[old])).rows[0].id;
 const oldPost=(await db.query("insert into public.humor_captions(image_id,content)values($1,'Old joke')returning id",[oldImage])).rows[0].id;
 await db.query('insert into public.humor_votes(user_id,caption_id,value)values($1,$2,1)',[old,oldPost]);
 await db.exec(await readFile('supabase/migrations/202610220002_activity_log.sql','utf8'));
 const actions=async(where='true',params=[])=>(await db.query(`select actor_id,category,action,via,post_id,detail from public.humor_activity_log where ${where} order by id`,params)).rows;
 assert.deepEqual((await actions()).map(r=>r.action),['signup','login','upload','publish','ha']);
 assert.ok((await actions()).every(r=>r.via==='system'&&r.detail.backfilled));
 await db.exec('truncate public.humor_activity_log');

 const member=randomUUID(),fan=randomUUID(),admin=randomUUID();
 for(const id of [member,fan,admin]){await db.query('insert into auth.users(id)values($1)',[id]);await db.query('insert into public.profiles(id)values($1)',[id]);}
 await db.query("insert into auth.sessions(user_id,user_agent)values($1,'Safari')",[member]);
 await db.query("update public.profiles set username='mia',onboarded_at=now() where id=$1",[member]);
 await db.query("update public.profiles set username='mia2' where id=$1",[member]);
 const image=(await db.query('insert into public.humor_images(user_id)values($1)returning id',[member])).rows[0].id;
 const gen=(await db.query('insert into public.humor_generations(image_id,user_id)values($1,$2)returning id',[image,member])).rows[0].id;
 await db.query("update public.humor_generations set status='completed',completed_at=now() where id=$1",[gen]);
 const post=(await db.query("insert into public.humor_captions(image_id,content)values($1,'Butler at 3am')returning id",[image])).rows[0].id;
 await db.query('insert into public.humor_votes(user_id,caption_id,value)values($1,$2,1)',[fan,post]);
 await db.query('delete from public.humor_votes where user_id=$1 and caption_id=$2',[fan,post]);
 await db.query('insert into public.humor_votes(user_id,caption_id,value)values($1,$2,1)',[fan,post]);
 const comment=(await db.query("insert into public.humor_comments(caption_id,user_id,content)values($1,$2,'lol')returning id",[post,fan])).rows[0].id;
 await db.query("insert into public.humor_comments(caption_id,user_id,content,reply_to_id)values($1,$2,'thanks',$3)",[post,member,comment]);
 await db.query('insert into public.humor_comment_votes(comment_id,user_id)values($1,$2)',[comment,member]);
 await db.query('insert into public.humor_saves(user_id,caption_id)values($1,$2)',[fan,post]);
 await db.query("insert into public.humor_reports(user_id,caption_id,reason)values($1,$2,'Spam')",[fan,post]);
 await db.query("update public.humor_captions set content='Butler at 4am' where id=$1",[post]);
 // An admin edit through the console is attributed to the admin, not the owner.
 await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-humor-admin':admin})]);
 await db.query("update public.humor_captions set deleted_at=now() where id=$1",[post]);
 // Cleanup of a deleted post's votes/comments/saves is not logged as member actions.
 await db.query('delete from public.humor_votes where caption_id=$1',[post]);
 await db.query('delete from public.humor_saves where caption_id=$1',[post]);
 await db.query("update public.humor_comments set deleted_at=now() where caption_id=$1",[post]);
 await db.query("select set_config('request.headers','',false)");
 const req=(await db.query('insert into public.humor_admin_requests(user_id)values($1)returning id',[fan])).rows[0].id;
 await db.query('update public.profiles set is_superadmin=true where id=$1',[admin]);
 await db.query('select public.humor_decide_admin_request($1,$2,true)',[req,admin]);
 await db.query('delete from auth.sessions where user_id=$1',[member]);
 const log=await actions();
 assert.deepEqual(log.map(r=>`${r.category}:${r.action}`),[
  'auth:signup','auth:signup','auth:signup','auth:login','profile:onboard','profile:update_profile','post:upload','ai:generate','post:publish',
  'reaction:ha','reaction:unha','reaction:ha','comment:comment','comment:reply','reaction:heart','save:save','report:report_post','post:edit',
  'post:delete','admin:request_superadmin','admin:grant_superadmin','admin:approve_request','admin:grant_superadmin','auth:logout']);
 const del=log.find(r=>r.action==='delete');
 assert.equal(del.actor_id,admin);assert.equal(del.via,'admin');assert.equal(del.detail.ownerId,member);
 assert.equal(log.find(r=>r.action==='login').detail.userAgent,'Safari');
 assert.equal(log.find(r=>r.action==='edit').detail.before,'Butler at 3am');
 // Logging never blocks the action (here the log row's actor FK fails), and members cannot read the log.
 const image2=(await db.query('insert into public.humor_images(user_id)values($1)returning id',[member])).rows[0].id;
 const post2=(await db.query("insert into public.humor_captions(image_id,content)values($1,'second')returning id",[image2])).rows[0].id;
 const ghost=randomUUID();
 await db.query('insert into public.humor_votes(user_id,caption_id,value)values($1,$2,1)',[ghost,post2]);
 assert.equal((await db.query('select count(*)::int n from public.humor_votes where user_id=$1',[ghost])).rows[0].n,1);
 await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select * from public.humor_activity_log'),/permission denied/);
 await db.exec('reset role');
 await db.exec(await readFile('supabase/migrations/202610230001_admin_roles.sql','utf8'));
 await db.exec('truncate public.humor_activity_log');
 const r2=(await db.query('insert into public.humor_admin_requests(user_id)values($1)returning id',[member])).rows[0].id;
 await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-humor-admin':admin})]);
 await db.query('select public.humor_decide_admin_request($1,$2,true)',[r2,admin]);
 await db.query('select public.humor_revoke_admin($1,$2)',[member,admin]);
 await db.query("select set_config('request.headers','',false)");
 const roles=await actions();
 assert.deepEqual(roles.map(r=>r.action),['request_superadmin','approve_request','grant_admin','revoke_admin']);
 assert.ok(roles.slice(1).every(r=>r.actor_id===admin&&r.via==='admin'),'credited to the superadmin');
 assert.equal(roles.at(-1).detail.ownerId,member);
 console.log('PASS activity log: backfill, sign-in/out, profile, upload, AI, publish/edit/delete, Ha/unHa, comments, hearts, saves, reports, admin attribution, superadmin flow; deletion cleanup not logged; private to the server.');
} finally { await db.close(); }
