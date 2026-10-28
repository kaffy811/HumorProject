// Local in-memory check of the admin model routing migration. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key);
  create table public.humor_images(id uuid primary key default gen_random_uuid(),user_id uuid not null,status text not null default 'processing',storage_path text,description text);
  create table public.humor_drafts(image_id uuid primary key,user_id uuid not null,upload_status text not null,caption_id uuid,ai_path text not null,image_path text not null,image_sha256 text not null,publish_key uuid,published_at timestamptz);
  create table public.humor_generations(id uuid primary key default gen_random_uuid(),image_id uuid not null,user_id uuid not null,
   provider text not null constraint humor_generations_provider_check check(provider in ('google','mock')),model text not null,system_prompt text not null,user_prompt text not null,
   generation_config jsonb not null,image_path text not null,image_mime text not null,image_sha256 text not null,prompt_version text not null default 'caption-styles-v3',
   status text not null default 'processing',request_key uuid,joke_style text,extra_context text,caption_candidates jsonb,scene text,created_at timestamptz not null default now());
  create table public.humor_moderation_checks(user_id uuid,image_id uuid,content_hash text,model text,allowed boolean,created_at timestamptz default now());
  create table public.humor_captions(id uuid primary key default gen_random_uuid(),image_id uuid not null,content text not null,style text not null);
  create function public.reserve_humor_generation(image_id uuid, owner uuid, request_key uuid, provider_name text, model_name text, system_text text, user_text text, settings jsonb, joke_style text, extra_context text) returns uuid language sql as $$select null::uuid$$;`);
 await db.exec(await readFile('supabase/migrations/202610290001_admin_model_routing.sql','utf8'));
 const q=async(sql,params=[])=>(await db.query(sql,params)).rows;
 const owner=randomUUID();
 const draft=async()=>{const image=randomUUID();await q("insert into public.humor_drafts(image_id,user_id,upload_status,ai_path,image_path,image_sha256)values($1,$2,'ready',$3,$3,'abc')",[image,owner,`${owner}/${image}.png`]);return image;};
 const reserve=(image,provider,version)=>q(`select public.reserve_humor_generation($1,$2,$3,$4,'m','sys','user','{}'::jsonb,'AUTO',''${version===undefined?'':',$5'}) id`,version===undefined?[image,owner,randomUUID(),provider]:[image,owner,randomUUID(),provider,version]);

 // New signature records the chain's prompt version and any provider slug.
 const image=await draft();
 const [{id}]=await reserve(image,'openai','challenger-v1');
 assert.deepEqual((await q('select provider,prompt_version from public.humor_generations where id=$1',[id]))[0],{provider:'openai',prompt_version:'challenger-v1'});
 await q("update public.humor_generations set status='completed'");
 await assert.rejects(async()=>reserve(await draft(),'OpenAI!','x'),/provider_check/);
 // Old signature still works and defaults the version.
 await q("update public.humor_generations set status='completed'");
 const [{id:old}]=await reserve(await draft(),'google');
 assert.equal((await q('select prompt_version from public.humor_generations where id=$1',[old]))[0].prompt_version,'caption-styles-v3');
 // Busy and daily limits count every real provider, not just google.
 await assert.rejects(()=>reserve(image,'openai','v'),/Generation busy/,'a google run is still processing');
 await q("update public.humor_generations set status='completed'");
 for(let i=0;i<8;i++){await reserve(await draft(),i%2?'google':'openai','v');await q("update public.humor_generations set status='completed'");}
 await assert.rejects(async()=>reserve(await draft(),'openai','v'),/Generation limit/);
 assert.ok((await reserve(await draft(),'mock','v'))[0].id,'mock runs are not limited');

 // Publishing accepts an OpenAI generation (was google only) but never a mock one.
 const candidate=randomUUID();
 const pub=async(provider)=>{const img=await draft();const g=randomUUID();
  await q("insert into public.humor_generations(id,image_id,user_id,provider,model,system_prompt,user_prompt,generation_config,image_path,image_mime,image_sha256,status,caption_candidates)values($1,$2,$3,$4,'m','s','u','{}',$5,'image/png','abc','completed',$6)",[g,img,owner,provider,`${owner}/${img}.png`,JSON.stringify([{id:candidate,style:'Pun'}])]);
  await q("insert into public.humor_moderation_checks(user_id,image_id,content_hash,model,allowed)values($1,$2,encode(sha256(convert_to('Ha','UTF8')),'hex'),'m',true)",[owner,img]);
  return q('select public.publish_humor_draft($1,$2,$3,$4,$5,$6) id',[img,owner,g,candidate,'Ha',randomUUID()]);};
 assert.ok((await pub('openai'))[0].id);
 await assert.rejects(()=>pub('mock'),/Invalid candidate/);
 assert.equal((await q("select style from public.humor_captions"))[0].style,'Pun');

 await db.exec('set role authenticated');
 await assert.rejects(()=>reserve(image,'openai','v'),/permission denied/);
 await db.exec('reset role');
 console.log('model routing migration: ok');
} finally { await db.close(); }
