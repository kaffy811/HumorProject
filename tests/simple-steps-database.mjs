// Local in-memory check of the simple-steps migration. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key);
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table public.humor_generations(id uuid primary key default gen_random_uuid(),provider text,model text,system_prompt text,user_prompt text,generation_config jsonb,prompt_version text,created_at timestamptz default now());`);
 for (const f of ['202610280001_admin_catalog.sql','202611050001_prompt_chain_tool.sql','202611060001_member_three_step_chain.sql','202611060002_prompt_chain_versions.sql','202611070001_chain_model.sql'])
  await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'));
 const q=async(sql,p=[])=>(await db.query(sql,p)).rows;
 const chain=(await q("select id from public.humor_prompt_chains where prompt_version='campus-captions-v4'"))[0].id;
 const steps=()=>q('select position,name,system_prompt,user_prompt,output_kind,include_image from public.humor_prompt_chain_steps where chain_id=$1 order by position',[chain]);
 const before=await steps();
 const sql=await readFile('supabase/migrations/202611070002_simple_step_inputs.sql','utf8');
 await db.exec(sql);
 const after=await steps();
 // Generated inputs: member input, then every earlier output once (same text as lib/chain-rules.ts stepTemplate).
 assert.deepEqual(after.map(s=>s.user_prompt),[
  'User input: {direction}',
  'User input: {direction}\n\nStep 1 output (Look at the photo):\n{step1}',
  'User input: {direction}\n\nStep 1 output (Look at the photo):\n{step1}\n\nStep 2 output (Find the angles):\n{step2}']);
 assert.deepEqual(after.map(s=>s.output_kind),['text','text','captions']);
 assert.deepEqual(after.map(s=>s.include_image),before.map(s=>s.include_image),'seeing the photo is unchanged');
 // Instructions moved into the Prompt, without the {…} lines and their labels.
 assert.ok(after[0].system_prompt.startsWith(before[0].system_prompt+'\n\nDescribe this photo in 3 to 5 sentences'));
 assert.ok(after[1].system_prompt.endsWith('only where the photo supports it.') && after[1].system_prompt.includes('\n\nList 5 different comic angles'));
 assert.ok(after[2].system_prompt.includes('\n\nWrite 4 captions from the best angles.'));
 for (const s of after) {
  assert.doesNotMatch(s.system_prompt,/\{(direction|previous|step\d)\}|Photo description:|The member's direction:/, `clean Prompt for ${s.name}`);
 }
 // Safe to run again; one version per change.
 await db.exec(sql);
 assert.deepEqual(await steps(),after);
 const versions=(await q('select label from public.humor_prompt_chain_versions where chain_id=$1 order by version',[chain])).map(r=>r.label);
 assert.equal(versions.filter(l=>l.startsWith('Simple steps')).length,1,'running again adds no version');
 console.log('simple steps migration: ok');
} finally { await db.close(); }
