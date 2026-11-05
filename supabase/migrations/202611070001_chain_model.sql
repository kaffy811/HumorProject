begin;

-- One model per prompt chain (Prompt Chain Tool: the model is chosen for the
-- whole chain, not per step). Steps keep their own llm_model_id, which the
-- member app reads; the tool keeps every step equal to the chain's model.
-- Needs 202611060002. Safe to run again.
alter table public.humor_prompt_chains
  add column if not exists llm_model_id uuid references public.humor_llm_models(id) on delete set null;

-- Backfill: the model most steps of the chain use (step order breaks ties).
update public.humor_prompt_chains c set llm_model_id = (
  select s.llm_model_id from public.humor_prompt_chain_steps s
  where s.chain_id = c.id and s.llm_model_id is not null
  group by s.llm_model_id order by count(*) desc, min(s.position) limit 1)
where c.llm_model_id is null;

-- Snapshots, restore and duplicate now carry the chain's model too.
create or replace function public.humor_prompt_chain_snapshot(chain uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', c.name, 'prompt_version', c.prompt_version, 'description', c.description, 'llm_model_id', c.llm_model_id,
    'steps', coalesce((select jsonb_agg(jsonb_build_object(
        'position', s.position, 'name', s.name, 'llm_model_id', s.llm_model_id,
        'system_prompt', s.system_prompt, 'user_prompt', s.user_prompt, 'output_schema', s.output_schema,
        'include_image', s.include_image, 'output_kind', s.output_kind) order by s.position)
      from public.humor_prompt_chain_steps s where s.chain_id = c.id), '[]'::jsonb))
  from public.humor_prompt_chains c where c.id = chain
$$;

create or replace function public.humor_restore_prompt_chain_version(version_id uuid, actor uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  select * into v from public.humor_prompt_chain_versions where id = version_id;
  if not found then raise exception 'Unknown version'; end if;
  perform public.humor_save_prompt_chain_version(v.chain_id, 'Before restoring version ' || v.version, actor);
  update public.humor_prompt_chains set name = v.snapshot->>'name', description = v.snapshot->>'description',
    -- Older snapshots have no chain model: keep the current one.
    llm_model_id = case when v.snapshot ? 'llm_model_id'
      then (select m.id from public.humor_llm_models m where m.id = (v.snapshot->>'llm_model_id')::uuid) else llm_model_id end,
    updated_at = now()
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

create or replace function public.humor_duplicate_prompt_chain(source uuid, new_version text, new_name text, actor uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare src record; copy uuid;
begin
  select * into src from public.humor_prompt_chains where id = source;
  if not found then raise exception 'Unknown prompt chain'; end if;
  insert into public.humor_prompt_chains(prompt_version, name, description, llm_model_id)
  values (new_version, new_name, src.description, src.llm_model_id) returning id into copy;
  insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, system_prompt, user_prompt, output_schema, include_image, output_kind)
  select copy, s.position, s.name, s.llm_model_id, s.system_prompt, s.user_prompt, s.output_schema, s.include_image, s.output_kind
  from public.humor_prompt_chain_steps s where s.chain_id = source;
  perform public.humor_save_prompt_chain_version(copy, 'Duplicated from ' || src.prompt_version, actor);
  return copy;
end $$;

commit;
