// Local in-memory check of the admin catalog migration. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;
  create table public.humor_generations(id uuid primary key default gen_random_uuid(),provider text not null,model text not null,
   system_prompt text not null,user_prompt text not null,generation_config jsonb not null,prompt_version text not null,created_at timestamptz not null default now());
  insert into public.humor_generations(provider,model,system_prompt,user_prompt,generation_config,prompt_version,created_at)values
   ('google','gemini-old','old system','old user','{}','campus-nyc-v1','2026-10-01'),
   ('google','gemini-3.8-flash','newest v3 system','Image: [image]\nDirection: none','{"responseJsonSchema":{"type":"object"}}','caption-styles-v3','2026-10-20'),
   ('google','gemini-3.8-flash','older v3 system','u','{}','caption-styles-v3','2026-10-15');
  create table public.humor_activity_log(category text,action text,target_id uuid,detail jsonb);
  create function public.humor_log(actor uuid,category text,action text,post uuid default null,target uuid default null,detail jsonb default '{}')
   returns void language sql as $$insert into public.humor_activity_log values(category,action,target,detail)$$;`);
 await db.exec(await readFile('supabase/migrations/202610280001_admin_catalog.sql','utf8'));
 const one=async(sql,params=[])=>(await db.query(sql,params)).rows;

 // Seeds reflect real usage: runs become models and chains with their newest prompts.
 assert.deepEqual((await one("select model_id,is_active from public.humor_llm_models order by model_id")).map(r=>[r.model_id,r.is_active]),[['gemini-3.8-flash',true],['gemini-old',false]]);
 const chains=await one('select c.prompt_version,s.system_prompt,s.output_schema,m.share from public.humor_prompt_chains c join public.humor_prompt_chain_steps s on s.chain_id=c.id join public.humor_prompt_chain_mix m on m.chain_id=c.id order by c.prompt_version');
 assert.deepEqual(chains.map(c=>[c.prompt_version,c.system_prompt,c.share]),[['campus-nyc-v1','old system',0],['caption-styles-v3','newest v3 system',100]]);
 assert.deepEqual(chains[1].output_schema,{type:'object'});
 assert.equal((await one('select count(*)::int n from public.humor_allowed_signup_domains'))[0].n,2);

 // Constraints.
 await assert.rejects(()=>db.query("insert into public.humor_allowed_signup_domains(domain)values('Columbia.EDU')"),/check constraint/);
 await assert.rejects(()=>db.query("insert into public.humor_allowed_signup_domains(domain)values('columbia.edu')"),/duplicate key/);
 await assert.rejects(()=>db.query("insert into public.humor_whitelisted_emails(email)values('not-an-email')"),/check constraint/);
 await db.query("insert into public.humor_whitelisted_emails(email)values('guest@gmail.com')");
 await assert.rejects(()=>db.query("insert into public.humor_terms(term,definition)values('butler','dup')"),/duplicate key/);
 await assert.rejects(()=>db.query("insert into public.humor_generation_examples(scene,caption,style)values('s','c','HANDMADE')"),/check constraint/);
 await assert.rejects(()=>db.query("delete from public.humor_llm_providers where slug='google'"),/foreign key/);

 // updated_at moves on update.
 const [before]=await one("select updated_at from public.humor_terms where term='Bodega'");
 await new Promise(r=>setTimeout(r,5));
 await db.query("update public.humor_terms set definition='Corner store.' where term='Bodega'");
 assert.ok((await one("select updated_at from public.humor_terms where term='Bodega'"))[0].updated_at>before.updated_at);

 // Mix: must list every chain, be whole numbers and add up to 100.
 const ids=Object.fromEntries((await one('select prompt_version,id from public.humor_prompt_chains')).map(r=>[r.prompt_version,r.id]));
 const admin=randomUUID();await db.query('insert into auth.users(id)values($1)',[admin]);
 const setMix=(mix)=>db.query('select public.humor_set_prompt_chain_mix($1,$2)',[JSON.stringify(mix),admin]);
 await assert.rejects(()=>setMix({[ids['caption-styles-v3']]:60,[ids['campus-nyc-v1']]:30}),/add up to 100/);
 await assert.rejects(()=>setMix({[ids['caption-styles-v3']]:100}),/every prompt chain/);
 await assert.rejects(()=>setMix({[ids['caption-styles-v3']]:99.5,[ids['campus-nyc-v1']]:0.5}),/whole number/);
 await assert.rejects(()=>setMix({[ids['caption-styles-v3']]:100,[randomUUID()]:0}),/Unknown prompt chain/);
 await setMix({[ids['caption-styles-v3']]:70,[ids['campus-nyc-v1']]:30});
 assert.deepEqual((await one('select share,updated_by from public.humor_prompt_chain_mix order by share')).map(r=>[r.share,r.updated_by]),[[30,admin],[70,admin]]);

 // Activity log gets admin catalog changes.
 const logged=await one("select action,detail from public.humor_activity_log where detail->>'table'='humor_whitelisted_emails'");
 assert.deepEqual(logged.map(l=>[l.action,l.detail.label]),[['catalog_insert','guest@gmail.com']]);
 assert.ok((await one("select 1 from public.humor_activity_log where action='catalog_update' and detail->>'table'='humor_prompt_chain_mix'")).length>=2);
 // Logging never blocks the change, even without the activity log.
 await db.exec('drop function public.humor_log(uuid,text,text,uuid,uuid,jsonb)');
 await db.query("insert into public.humor_terms(term,definition)values('Ferris','Ferris Booth Commons')");

 // Members cannot read or call any of it.
 await db.exec('set role authenticated');
 for(const t of ['humor_llm_providers','humor_llm_models','humor_prompt_chains','humor_prompt_chain_steps','humor_prompt_chain_mix','humor_terms','humor_generation_examples','humor_allowed_signup_domains','humor_whitelisted_emails'])
  await assert.rejects(()=>db.query(`select * from public.${t}`),/permission denied/,t);
 await assert.rejects(()=>setMix({}),/permission denied/);
 await db.exec('reset role');
 console.log('admin catalog migration: ok');
} finally { await db.close(); }
