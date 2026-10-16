// Local in-memory restoration only. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function storage.foldername(name text)returns text[]language sql as $$select string_to_array(name,'/')$$;`);
 const sql=await readFile(process.argv[2]||'deliverables/backups/2026-10-14-public.sql','utf8');
 for(const id of new Set(sql.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[]))await db.query('insert into auth.users(id)values($1)on conflict do nothing',[id]);
 await db.exec(sql);
 const prior=(await db.query("select exists(select 1 from information_schema.columns where table_schema='public'and table_name='profiles'and column_name='saved_hint_seen_at')present")).rows[0].present;
 if(!prior)for(const f of ['202610140001_profile_feed_rank.sql','202610140002_auto_styles_handmade.sql','202610140003_cache_invalidation_where.sql'])await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
 await db.exec(await readFile('supabase/migrations/202610160001_username_hearts_comment_depth.sql','utf8'));
 const user=randomUUID(),image=randomUUID(),post=randomUUID();
 await db.query('insert into auth.users(id)values($1)',[user]);
 await db.query('insert into public.profiles(id)values($1)',[user]);
 await db.query("select public.humor_save_profile_v3($1,'nameless_member','keep',null)",[user]);
 const profile=(await db.query('select public.humor_profile_summary($1,$1)p',[user])).rows[0].p;
 assert.equal(profile.name,'@nameless_member');assert.equal('firstName'in profile,false);assert.equal('lastName'in profile,false);
 const stored=(await db.query('select first_name,last_name from public.profiles where id=$1',[user])).rows[0];
 assert.equal(stored.first_name,null);assert.equal(stored.last_name,null);
 await db.query("insert into public.humor_images(id,user_id,status,storage_path,image_width,image_height,locked_thumbnail_path)values($1,$2,'ready',($2::uuid::text||'/'||$1::uuid::text||'.webp'),640,480,'local-blur.webp')",[image,user]);
 await db.query("insert into public.humor_captions(id,image_id,content,style)values($1,$2,'Local test only','Deadpan')",[post,image]);
 const chain=[];
 for(let i=0;i<3;i++){
  const id=randomUUID();await db.query("insert into public.humor_comments(id,caption_id,user_id,content,reply_to_id)values($1,$2,$3,'Local test only',$4)",[id,post,user,chain[i-1]||null]);chain.push(id);
  assert.equal((await db.query('select public.humor_comment_depth($1)d',[id])).rows[0].d,i+1);
  assert.equal((await db.query('select public.humor_comment_row($1,$2)c',[id,user])).rows[0].c.depth,i+1);
 }
 await assert.rejects(()=>db.query("insert into public.humor_comments(caption_id,user_id,content,reply_to_id)values($1,$2,'No fourth layer',$3)",[post,user,chain[2]]),/three levels deep/);
 await db.query('update public.humor_comments set deleted_at=now()where id=$1',[chain[0]]);
 assert.equal((await db.query('select public.humor_comment_depth($1)d',[chain[2]])).rows[0].d,3);
 await assert.rejects(()=>db.query("insert into public.humor_comments(caption_id,user_id,content,reply_to_id)values($1,$2,'Still no fourth layer',$3)",[post,user,chain[2]]),/three levels deep/);
 const access=(await db.query("select has_function_privilege('authenticated','public.humor_save_profile_v3(uuid,text,text,uuid)','execute')member,has_function_privilege('service_role','public.humor_save_profile_v3(uuid,text,text,uuid)','execute')server")).rows[0];
 assert.equal(access.member,false);assert.equal(access.server,true);
 await db.query("update public.humor_images set created_at=now()-interval '2 minutes'where user_id=$1",[user]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,app_metadata:{providers:['google']},amr:[{method:'oauth',timestamp:1}]})]);
 await db.exec('set role authenticated');
 await db.query('insert into public.humor_votes(caption_id,user_id,value)values($1,$2,1)',[post,user]);
 const reservation=(await db.query('select public.reserve_humor_image()id')).rows[0];assert.ok(reservation.id);
 await db.exec('reset role');
 console.log('PASS backup restores; username-only save/summary/vote/upload, private service RPC, three comment layers, fourth blocked, deleted ancestors retain depth. No external writes.');
} finally { await db.close(); }
