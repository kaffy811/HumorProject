// Local in-memory restoration only. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create function storage.foldername(name text)returns text[]language sql as $$select string_to_array(name,'/')$$;`);
 const sql=await readFile(process.argv[2]||'deliverables/backups/2026-10-23-before-dislike.sql','utf8');
 for(const id of new Set(sql.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)||[]))await db.query('insert into auth.users(id)values($1)on conflict do nothing',[id]);
 await db.exec(sql);
 await db.exec(await readFile('supabase/migrations/202610230001_post_dislike.sql','utf8'));
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

 const voter=randomUUID();await db.query('insert into auth.users(id)values($1)',[voter]);await db.query("insert into public.profiles(id,username)values($1,'reaction_tester')",[voter]);
 const react=async(value,key=randomUUID(),target=post)=> (await db.query('select public.toggle_humor_reaction($1,$2,$3,$4::smallint)r',[target,voter,key,value])).rows[0].r;
 const readPost=async(viewer=voter)=>(await db.query('select public.humor_post($1,$2)p',[post,viewer])).rows[0].p;
 const notifications=async()=>Number((await db.query("select count(*)n from public.notifications where actor_id=$1 and post_id=$2",[voter,post])).rows[0].n);
 const dk=randomUUID();let r=await react(-1,dk);assert.deepEqual(r,{haCount:0,viewerHasHa:false,viewerHasDisliked:true});
 assert.deepEqual(await react(-1,dk),r);assert.equal((await readPost()).viewerHasDisliked,true);assert.equal((await readPost(user)).viewerHasDisliked,false);assert.equal(await notifications(),0);
 r=(await db.query('select public.toggle_humor_ha($1,$2,$3)r',[post,voter,randomUUID()])).rows[0].r;
 assert.deepEqual(r,{haCount:1,viewerHasHa:true,viewerHasDisliked:false});assert.equal(await notifications(),1);
 r=await react(-1);assert.deepEqual(r,{haCount:0,viewerHasHa:false,viewerHasDisliked:true});assert.equal(await notifications(),0);
 await assert.rejects(()=>react(1,dk),/Invalid request/);
 await assert.rejects(()=>react(0),/Invalid rating request/);
 const raw=(await db.query("select public.humor_feed_page($1,'new',null,0,12)p",[voter])).rows[0].p;
 assert.equal(raw.posts.find(p=>p.id===post).viewerHasDisliked,true);
 const paged=(await db.query("select public.humor_paged_feed($1,'new',1,null)p",[voter])).rows[0].p;
 assert.equal(paged.posts.find(p=>p.id===post).viewerHasDisliked,true);
 r=await react(-1);assert.deepEqual(r,{haCount:0,viewerHasHa:false,viewerHasDisliked:false});
 r=await react(1);assert.equal(r.haCount,1);r=await react(1);assert.equal(r.haCount,0);
 assert.equal(Number((await db.query('select count(*)n from public.humor_votes where caption_id=$1 and user_id=$2',[post,voter])).rows[0].n),0);
 const access=(await db.query("select has_function_privilege('authenticated','public.toggle_humor_reaction(uuid,uuid,uuid,smallint)','execute')member,has_function_privilege('anon','public.toggle_humor_reaction(uuid,uuid,uuid,smallint)','execute')anon,has_function_privilege('service_role','public.toggle_humor_reaction(uuid,uuid,uuid,smallint)','execute')server")).rows[0];
 assert.deepEqual(access,{member:false,anon:false,server:true});
 await db.query('update public.humor_captions set deleted_at=now()where id=$1',[post]);await assert.rejects(()=>react(-1),/Post not found/);
 console.log('PASS fresh backup restoration and migration; persisted exclusive reactions, retries, positive-only counts, old Like API, private viewer flags, both feeds, notification cleanup, service-only grants and deleted-post rejection. No external writes.');
} finally {await db.close();}
