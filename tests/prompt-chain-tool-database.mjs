// Local in-memory check of the Prompt Chain Tool migration. Never connects to a deployed database.
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
 await db.exec(await readFile('supabase/migrations/202610280001_admin_catalog.sql','utf8'));
 await db.exec(await readFile('supabase/migrations/202611050001_prompt_chain_tool.sql','utf8'));
 const q=async(sql,params=[])=>(await db.query(sql,params)).rows;

 // Existing steps keep working as single caption steps.
 const [old]=await q("select s.include_image,s.output_kind from public.humor_prompt_chain_steps s join public.humor_prompt_chains c on c.id=s.chain_id where c.prompt_version='caption-styles-v3'");
 assert.deepEqual(old,{include_image:true,output_kind:'captions'});

 // The example chain: describe (image, text) → funny (text) → five captions.
 const demo=(await q("select id from public.humor_prompt_chains where prompt_version='demo-three-step-v1'"))[0].id;
 const steps=await q('select id,position,name,include_image,output_kind,user_prompt from public.humor_prompt_chain_steps where chain_id=$1 order by position',[demo]);
 assert.deepEqual(steps.map(s=>[s.position,s.include_image,s.output_kind]),[[1,true,'text'],[2,false,'text'],[3,false,'captions']]);
 assert.match(steps[0].user_prompt,/\{direction\}/);assert.match(steps[1].user_prompt,/\{previous\}/);
 assert.equal((await q("select count(*)::int n from public.humor_prompt_chain_mix where chain_id=$1",[demo]))[0].n,0,'demo is not given to members');

 // Reorder: move step 3 to the top, atomically, keeping ids.
 const reorder=(ids)=>q('select public.humor_reorder_prompt_chain_steps($1,$2::uuid[])',[demo,ids]);
 await reorder([steps[2].id,steps[0].id,steps[1].id]);
 assert.deepEqual((await q('select id from public.humor_prompt_chain_steps where chain_id=$1 order by position',[demo])).map(r=>r.id),[steps[2].id,steps[0].id,steps[1].id]);
 assert.deepEqual((await q('select position from public.humor_prompt_chain_steps where chain_id=$1 order by position',[demo])).map(r=>r.position),[1,2,3]);
 await assert.rejects(()=>reorder([steps[0].id,steps[1].id]),/every step of this chain exactly once/,'missing a step');
 await assert.rejects(()=>reorder([steps[0].id,steps[0].id,steps[1].id]),/exactly once/,'duplicate');
 const other=(await q("select s.id from public.humor_prompt_chain_steps s join public.humor_prompt_chains c on c.id=s.chain_id where c.prompt_version='caption-styles-v3'"))[0].id;
 await assert.rejects(()=>reorder([steps[0].id,steps[1].id,other]),/exactly once/,'step from another chain');
 await assert.rejects(()=>q('select public.humor_reorder_prompt_chain_steps($1,$2::uuid[])',[randomUUID(),[]]),/Unknown prompt chain/);
 // Gaps left by deletes are closed by the next reorder.
 await q('delete from public.humor_prompt_chain_steps where id=$1',[steps[0].id]);
 await reorder([steps[1].id,steps[2].id]);
 assert.deepEqual((await q('select position from public.humor_prompt_chain_steps where chain_id=$1 order by position',[demo])).map(r=>r.position),[1,2]);

 // Runs keep a copy of their steps; deleting the chain keeps the run.
 const user=randomUUID();await q('insert into auth.users(id)values($1)',[user]);
 const run=(await q("insert into public.humor_chain_runs(chain_id,chain_name,prompt_version,image_path,step_count,created_by)values($1,'Demo','demo-three-step-v1',$2,2,$3) returning id",[demo,`${randomUUID()}.jpg`,user]))[0].id;
 await q("insert into public.humor_chain_run_steps(run_id,position,step_id,name,provider,model,system_prompt,user_prompt_template,include_image,output_kind)values($1,1,$2,'a','google','m','s','u',true,'text')",[run,steps[1].id]);
 await assert.rejects(()=>q("insert into public.humor_chain_runs(chain_name,prompt_version,image_path,step_count)values('x','v','../etc/passwd',1)"),/check constraint/);
 await q('delete from public.humor_prompt_chains where id=$1',[demo]);
 assert.deepEqual((await q('select chain_id,chain_name from public.humor_chain_runs where id=$1',[run]))[0],{chain_id:null,chain_name:'Demo'});
 assert.equal((await q('select step_id from public.humor_chain_run_steps where run_id=$1',[run]))[0].step_id,null);
 assert.equal((await q("select public from storage.buckets where id='humor-chain-runs'"))[0].public,false);

 // Members cannot read runs or call the reorder function.
 await db.exec('set role authenticated');
 for(const t of ['humor_chain_runs','humor_chain_run_steps']) await assert.rejects(()=>q(`select * from public.${t}`),/permission denied/,t);
 await assert.rejects(()=>reorder([]),/permission denied/);
 await db.exec('reset role');
 console.log('prompt chain tool migration: ok');
} finally { await db.close(); }
