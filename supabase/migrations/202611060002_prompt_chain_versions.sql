begin;

-- Prompt Chain Tool phase 2: version history, restore and duplicate.
-- Needs 202611050001. Server-only like the rest of the catalog.

-- 1. Every saved change to a chain (its details or any step) adds a numbered
--    snapshot. Snapshots hold model ids; a model deleted later shows as none.
create table public.humor_prompt_chain_versions (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.humor_prompt_chains(id) on delete cascade,
  version integer not null check (version >= 1),
  label text not null check (char_length(label) between 1 and 160),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (chain_id, version)
);
alter table public.humor_prompt_chain_versions enable row level security;
revoke all on public.humor_prompt_chain_versions from public, anon, authenticated;
grant all on public.humor_prompt_chain_versions to service_role;

-- The chain as it is now: details plus its steps in order.
create function public.humor_prompt_chain_snapshot(chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', c.name, 'prompt_version', c.prompt_version, 'description', c.description,
    'steps', coalesce((select jsonb_agg(jsonb_build_object(
        'position', s.position, 'name', s.name, 'llm_model_id', s.llm_model_id,
        'system_prompt', s.system_prompt, 'user_prompt', s.user_prompt, 'output_schema', s.output_schema,
        'include_image', s.include_image, 'output_kind', s.output_kind) order by s.position)
      from public.humor_prompt_chain_steps s where s.chain_id = c.id), '[]'::jsonb))
  from public.humor_prompt_chains c where c.id = chain
$$;
revoke all on function public.humor_prompt_chain_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.humor_prompt_chain_snapshot(uuid) to service_role;

-- Saves the current state as the next version, unless nothing changed since
-- the latest one. Returns the version number that matches the current state.
create function public.humor_save_prompt_chain_version(chain uuid, label text, actor uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare snap jsonb; latest record; next_version integer;
begin
  perform 1 from public.humor_prompt_chains c where c.id = chain for update;
  if not found then raise exception 'Unknown prompt chain'; end if;
  snap := public.humor_prompt_chain_snapshot(chain);
  select v.version, v.snapshot into latest from public.humor_prompt_chain_versions v
  where v.chain_id = chain order by v.version desc limit 1;
  if found and latest.snapshot = snap then return latest.version; end if;
  next_version := coalesce(latest.version, 0) + 1;
  insert into public.humor_prompt_chain_versions(chain_id, version, label, snapshot, created_by)
  values (chain, next_version, left(coalesce(nullif(trim(label), ''), 'Saved'), 160), snap, actor);
  return next_version;
end $$;
revoke all on function public.humor_save_prompt_chain_version(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.humor_save_prompt_chain_version(uuid, text, uuid) to service_role;

-- Puts a chain back to an earlier version in one transaction: its name,
-- description and steps. The prompt version stays, because member posts and
-- runs are linked to it. The state before the restore is kept as a version.
create function public.humor_restore_prompt_chain_version(version_id uuid, actor uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  select * into v from public.humor_prompt_chain_versions where id = version_id;
  if not found then raise exception 'Unknown version'; end if;
  perform public.humor_save_prompt_chain_version(v.chain_id, 'Before restoring version ' || v.version, actor);
  update public.humor_prompt_chains set name = v.snapshot->>'name', description = v.snapshot->>'description', updated_at = now()
  where id = v.chain_id;
  delete from public.humor_prompt_chain_steps where chain_id = v.chain_id;
  insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, system_prompt, user_prompt, output_schema, include_image, output_kind)
  select v.chain_id, (s->>'position')::integer, s->>'name',
    (select m.id from public.humor_llm_models m where m.id = (s->>'llm_model_id')::uuid),
    s->>'system_prompt', s->>'user_prompt', nullif(s->'output_schema', 'null'::jsonb),
    coalesce((s->>'include_image')::boolean, true), coalesce(s->>'output_kind', 'captions')
  from jsonb_array_elements(v.snapshot->'steps') s;
  return public.humor_save_prompt_chain_version(v.chain_id, 'Restored version ' || v.version, actor);
end $$;
revoke all on function public.humor_restore_prompt_chain_version(uuid, uuid) from public, anon, authenticated;
grant execute on function public.humor_restore_prompt_chain_version(uuid, uuid) to service_role;

-- Copies a chain and its steps under a new prompt version (not given to
-- members). Returns the new chain's id.
create function public.humor_duplicate_prompt_chain(source uuid, new_version text, new_name text, actor uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare src record; copy uuid;
begin
  select * into src from public.humor_prompt_chains where id = source;
  if not found then raise exception 'Unknown prompt chain'; end if;
  insert into public.humor_prompt_chains(prompt_version, name, description)
  values (new_version, new_name, src.description) returning id into copy;
  insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, system_prompt, user_prompt, output_schema, include_image, output_kind)
  select copy, s.position, s.name, s.llm_model_id, s.system_prompt, s.user_prompt, s.output_schema, s.include_image, s.output_kind
  from public.humor_prompt_chain_steps s where s.chain_id = source;
  perform public.humor_save_prompt_chain_version(copy, 'Duplicated from ' || src.prompt_version, actor);
  return copy;
end $$;
revoke all on function public.humor_duplicate_prompt_chain(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.humor_duplicate_prompt_chain(uuid, text, text, uuid) to service_role;

-- 2. Existing chains start their history at version 1.
do $$
declare c record;
begin
  for c in select id from public.humor_prompt_chains loop
    perform public.humor_save_prompt_chain_version(c.id, 'Version before history was kept', null);
  end loop;
end $$;

commit;
