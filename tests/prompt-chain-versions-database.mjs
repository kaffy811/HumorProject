// Local in-memory check of the prompt chain history migration. Never connects to a deployed database.
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
 for (const f of ['202610280001_admin_catalog.sql','202611050001_prompt_chain_tool.sql','202611060001_member_three_step_chain.sql','202611060002_prompt_chain_versions.sql'])
  await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const q=async(sql,p=[])=>(await db.query(sql,p)).rows;
 const user=randomUUID();await q('insert into auth.users(id)values($1)',[user]);
 const chain=(await q("select id from public.humor_prompt_chains where prompt_version='campus-captions-v4'"))[0].id;
 const versions=()=>q('select version,label,created_by from public.humor_prompt_chain_versions where chain_id=$1 order by version',[chain]);
 const save=(label)=>q('select public.humor_save_prompt_chain_version($1,$2,$3) v',[chain,label,user]).then(r=>r[0].v);
 const steps=()=>q('select position,name,user_prompt,llm_model_id,include_image,output_kind from public.humor_prompt_chain_steps where chain_id=$1 order by position',[chain]);

 // Existing chains start at version 1.
 assert.deepEqual(await versions(),[{version:1,label:'Version before history was kept',created_by:null}]);
 const original=await steps();
 // Saving with nothing changed does not add a version.
 assert.equal(await save('No change'),1);
 // An edit adds version 2 with the step in its snapshot.
 await q("update public.humor_prompt_chain_steps set user_prompt='Edited {direction}' where chain_id=$1 and position=2",[chain]);
 await q("update public.humor_prompt_chains set name='Renamed' where id=$1",[chain]);
 assert.equal(await save('Edited step 2'),2);
 const [snap]=await q('select snapshot from public.humor_prompt_chain_versions where chain_id=$1 and version=2',[chain]);
 assert.equal(snap.snapshot.name,'Renamed');assert.equal(snap.snapshot.steps.length,3);assert.equal(snap.snapshot.steps[1].user_prompt,'Edited {direction}');
 // Delete a step, then restore version 1: details and all steps come back, in one transaction.
 await q('delete from public.humor_prompt_chain_steps where chain_id=$1 and position=3',[chain]);
 const v1=(await q('select id from public.humor_prompt_chain_versions where chain_id=$1 and version=1',[chain]))[0].id;
 assert.equal((await q('select public.humor_restore_prompt_chain_version($1,$2) v',[v1,user]))[0].v,4);
 assert.deepEqual((await versions()).map(v=>[v.version,v.label]),[[1,'Version before history was kept'],[2,'Edited step 2'],[3,'Before restoring version 1'],[4,'Restored version 1']]);
 assert.deepEqual((await steps()),original);
 assert.equal((await q('select name,prompt_version from public.humor_prompt_chains where id=$1',[chain]))[0].name,'Campus captions (3 steps)');
 // A model deleted after the snapshot is restored as no model.
 const v4=(await q('select id from public.humor_prompt_chain_versions where chain_id=$1 and version=4',[chain]))[0].id;
 const temp=(await q("insert into public.humor_llm_models(provider_id,model_id,display_name) select provider_id,'temp-model','Temp' from public.humor_llm_models limit 1 returning id"))[0].id;
 await q('update public.humor_prompt_chain_steps set llm_model_id=$2 where chain_id=$1',[chain,temp]);
 await save('All steps on Temp');
 const v5=(await q('select id from public.humor_prompt_chain_versions where chain_id=$1 and version=5',[chain]))[0].id;
 await q('update public.humor_prompt_chain_steps set llm_model_id=null where chain_id=$1',[chain]);
 await q('delete from public.humor_llm_models where id=$1',[temp]);
 await q('select public.humor_restore_prompt_chain_version($1,$2)',[v5,user]);
 assert.ok((await steps()).every(s=>s.llm_model_id===null));
 await q('select public.humor_restore_prompt_chain_version($1,$2)',[v4,user]);
 assert.deepEqual(await steps(),original);
 await assert.rejects(()=>q('select public.humor_restore_prompt_chain_version($1,$2)',[randomUUID(),user]),/Unknown version/);

 // Duplicate: same steps under a new version, version 1 of its own history, not given to members.
 const copy=(await q("select public.humor_duplicate_prompt_chain($1,'campus-captions-v4-copy','Campus captions (copy)',$2) id",[chain,user]))[0].id;
 assert.deepEqual((await q('select position,name,user_prompt,llm_model_id,include_image,output_kind from public.humor_prompt_chain_steps where chain_id=$1 order by position',[copy])),original);
 assert.deepEqual((await q('select version,label from public.humor_prompt_chain_versions where chain_id=$1',[copy])),[{version:1,label:'Duplicated from campus-captions-v4'}]);
 assert.equal((await q('select count(*)::int n from public.humor_prompt_chain_mix where chain_id=$1 and share>0',[copy]))[0].n,0);
 await assert.rejects(()=>q("select public.humor_duplicate_prompt_chain($1,'campus-captions-v4-copy','Again',$2)",[chain,user]),/duplicate key|unique/);
 // Deleting a chain deletes its history.
 await q('delete from public.humor_prompt_chains where id=$1',[copy]);
 assert.equal((await q('select count(*)::int n from public.humor_prompt_chain_versions where chain_id=$1',[copy]))[0].n,0);

 // Members cannot read history or call the functions.
 await db.exec('set role authenticated');
 await assert.rejects(()=>q('select * from public.humor_prompt_chain_versions'),/permission denied/);
 await assert.rejects(()=>save('x'),/permission denied/);
 await assert.rejects(()=>q('select public.humor_duplicate_prompt_chain($1,$2,$3,null)',[chain,'x-copy','x']),/permission denied/);
 await db.exec('reset role');
 console.log('prompt chain versions migration: ok');
} finally { await db.close(); }
