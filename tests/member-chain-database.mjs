// Local in-memory check of the member three-step chain migration. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table public.humor_generations(id uuid primary key default gen_random_uuid(),provider text,model text,system_prompt text,user_prompt text,generation_config jsonb,prompt_version text,created_at timestamptz default now());`);
 for (const f of ['202610280001_admin_catalog.sql','202611050001_prompt_chain_tool.sql']) await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const q=async(sql,p=[])=>(await db.query(sql,p)).rows;
 // State before: the user's GPT chain has the members; a tool run points at the demo chain.
 await db.exec(`insert into public.humor_llm_providers(slug,name) values('openai','OpenAI');
  insert into public.humor_llm_models(provider_id,model_id,display_name) select id,'gpt-6-astra','GPT-6 Astra' from public.humor_llm_providers where slug='openai';
  insert into public.humor_prompt_chains(prompt_version,name) values('gpt-captions-v1','GPT four-style captions');`);
 const ids=Object.fromEntries((await q('select prompt_version,id from public.humor_prompt_chains')).map(r=>[r.prompt_version,r.id]));
 await q('select public.humor_set_prompt_chain_mix($1,null)',[JSON.stringify(Object.fromEntries(Object.entries(ids).map(([v,id])=>[id,v==='gpt-captions-v1'?100:0])))]);
 await q("insert into public.humor_chain_runs(chain_id,chain_name,prompt_version,image_path,step_count) values($1,'Demo','demo-three-step-v1','11111111-1111-4111-8111-111111111111.jpg',3)",[ids['demo-three-step-v1']]);

 const sql=await readFile('supabase/migrations/202611060001_member_three_step_chain.sql','utf8');
 await db.exec(sql); await db.exec(sql); // safe to run again
 const chains=await q('select c.prompt_version,m.share from public.humor_prompt_chains c left join public.humor_prompt_chain_mix m on m.chain_id=c.id order by 1');
 assert.deepEqual(chains,[{prompt_version:'campus-captions-v4',share:100}],'only the new chain is left, and members use it');
 const steps=await q("select s.position,s.include_image,s.output_kind,s.user_prompt,s.output_schema,m.model_id from public.humor_prompt_chain_steps s join public.humor_prompt_chains c on c.id=s.chain_id join public.humor_llm_models m on m.id=s.llm_model_id where c.prompt_version='campus-captions-v4' order by s.position");
 assert.deepEqual(steps.map(s=>[s.position,s.include_image,s.output_kind,s.model_id]),[[1,true,'text','gemini-3.8-flash'],[2,false,'text','gemini-3.8-flash'],[3,false,'captions','gemini-3.8-flash']]);
 assert.ok(steps.every(s=>s.user_prompt.includes('{direction}')),'every step follows the member direction');
 assert.match(steps[1].user_prompt,/\{previous\}/);assert.match(steps[2].user_prompt,/\{step1\}[\s\S]*\{previous\}/);
 assert.equal(steps[2].output_schema.properties.captions.minItems,4);assert.equal(steps[2].output_schema.properties.captions.maxItems,4);
 assert.equal((await q("select chain_id from public.humor_chain_runs"))[0].chain_id,null,'old runs are kept, unlinked');
 assert.equal((await q("select count(*)::int n from public.humor_llm_models where model_id='gpt-6-astra'"))[0].n,1,'models are not touched');
 console.log('member three-step chain migration: ok');
} finally { await db.close(); }
