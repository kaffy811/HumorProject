// Local in-memory check of the superadmin migration. Never connects to a deployed database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key);grant usage on schema auth to authenticated,service_role;
  create function auth.uid()returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt()returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table public.profiles(id uuid primary key references auth.users(id),username text,first_name text);
  alter table public.profiles enable row level security;
  grant usage on schema public to authenticated,service_role;
  grant select on public.profiles to authenticated;grant update(first_name,username) on public.profiles to authenticated;
  grant all on public.profiles to service_role;
  create policy "Read own profile" on public.profiles for select to authenticated using(id=(select auth.uid()));
  create policy "Update own profile" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));`);
 await db.exec(await readFile('supabase/migrations/202610200001_superadmin.sql','utf8'));
 const member=randomUUID();
 await db.query('insert into auth.users(id)values($1)',[member]);
 await db.query('insert into public.profiles(id)values($1)',[member]);
 assert.equal((await db.query('select is_superadmin from public.profiles where id=$1',[member])).rows[0].is_superadmin,false);
 const asMember=async()=>{await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[member,JSON.stringify({sub:member,role:'authenticated'})]);await db.exec('set role authenticated');};
 await asMember();
 await assert.rejects(()=>db.query('update public.profiles set is_superadmin=true where id=$1',[member]),/permission denied/);
 await db.query("update public.profiles set first_name='Still editable' where id=$1",[member]);
 await db.exec('reset role');
 // Even a future broad grant cannot let a member promote itself.
 await db.exec('grant update on public.profiles to authenticated');
 await asMember();
 await assert.rejects(()=>db.query('update public.profiles set is_superadmin=true where id=$1',[member]),/database owner/);
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'service_role'})]);
 await db.exec('set role service_role');
 await db.query('update public.profiles set is_superadmin=true where id=$1',[member]);
 await db.exec('reset role');
 assert.equal((await db.query('select is_superadmin from public.profiles where id=$1',[member])).rows[0].is_superadmin,true);
 console.log('PASS superadmin flag defaults false, members cannot grant it (column grant + trigger), service role and owners can.');
} finally { await db.close(); }
