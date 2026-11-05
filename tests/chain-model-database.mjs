// Local in-memory check of the chain model migration. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table public.humor_generations(id uuid primary key default gen_random_uuid(),provider text,model text,system_prompt text,user_prompt text,generation_config jsonb,prompt_version text,created_at timestamptz default now());`);
 const files=['202610280001_admin_catalog.sql','202611050001_prompt_chain_tool.sql','202611060001_member_three_step_chain.sql','202611060002_prompt_chain_versions.sql'];
 for (const f of files) await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const q=async(sql,p=[])=>(await db.query(sql,p)).rows;
 const chain=(await q("select id from public.humor_prompt_chains where prompt_version='campus-captions-v4'"))[0].id;
 const gemini=(await q("select id from public.humor_llm_models where model_id='gemini-3.8-flash'"))[0].id;
 // A chain with no steps gets no model.
 await q("insert into public.humor_prompt_chains(prompt_version,name) values('empty-v1','Empty')");
 const sql=await readFile('supabase/migrations/202611070001_chain_model.sql','utf8');
 await db.exec(sql); await db.exec(sql); // safe to run again
 assert.equal((await q('select llm_model_id from public.humor_prompt_chains where id=$1',[chain]))[0].llm_model_id,gemini,'backfilled from the steps');
 assert.equal((await q("select llm_model_id from public.humor_prompt_chains where prompt_version='empty-v1'"))[0].llm_model_id,null);
 // Snapshots carry it; restore brings it back; old snapshots keep the current model.
 const user=randomUUID();await q('insert into auth.users(id)values($1)',[user]);
 const v1=(await q('select id from public.humor_prompt_chain_versions where chain_id=$1 and version=1',[chain]))[0].id;
 const save=(l)=>q('select public.humor_save_prompt_chain_version($1,$2,$3) v',[chain,l,user]).then(r=>r[0].v);
 assert.equal(await save('Chain model added'),2);
 const gpt=(await q("insert into public.humor_llm_models(provider_id,model_id,display_name) select provider_id,'gpt-test','GPT' from public.humor_llm_models limit 1 returning id"))[0].id;
 await q('update public.humor_prompt_chains set llm_model_id=$2 where id=$1',[chain,gpt]);
 await q('update public.humor_prompt_chain_steps set llm_model_id=$2 where chain_id=$1',[chain,gpt]);
 assert.equal(await save('Every step on GPT'),3);
 const v2=(await q('select id,snapshot from public.humor_prompt_chain_versions where chain_id=$1 and version=2',[chain]))[0];
 assert.equal(v2.snapshot.llm_model_id,gemini);
 await q('select public.humor_restore_prompt_chain_version($1,$2)',[v2.id,user]);
 assert.equal((await q('select llm_model_id from public.humor_prompt_chains where id=$1',[chain]))[0].llm_model_id,gemini);
 await q('update public.humor_prompt_chains set llm_model_id=$2 where id=$1',[chain,gpt]);
 await q('select public.humor_restore_prompt_chain_version($1,$2)',[v1,user]);
 assert.equal((await q('select llm_model_id from public.humor_prompt_chains where id=$1',[chain]))[0].llm_model_id,gpt,'old snapshot keeps the current chain model');
 // Duplicate copies the chain model.
 const copy=(await q("select public.humor_duplicate_prompt_chain($1,'campus-copy','Copy',$2) id",[chain,user]))[0].id;
 assert.equal((await q('select llm_model_id from public.humor_prompt_chains where id=$1',[copy]))[0].llm_model_id,gpt);
 // Deleting the model clears it.
 await q('update public.humor_prompt_chain_steps set llm_model_id=null where llm_model_id=$1',[gpt]);
 await q('delete from public.humor_llm_models where id=$1',[gpt]);
 assert.equal((await q('select llm_model_id from public.humor_prompt_chains where id=$1',[chain]))[0].llm_model_id,null);
 console.log('chain model migration: ok');
} finally { await db.close(); }
