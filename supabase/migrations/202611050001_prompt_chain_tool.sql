begin;

-- Prompt Chain Tool (kaffy811/HumorProject-PromptChains): multi-step chains,
-- step reordering and recorded runs. Server-only like the rest of the catalog.

-- 1. What each step sees and returns. Existing steps are single caption steps.
--    include_image: the photo is attached to this step's model call.
--    output_kind:   'text' is passed on to later steps ({previous}, {stepN});
--                   'captions' is the final JSON list of captions.
alter table public.humor_prompt_chain_steps
  add column include_image boolean not null default true,
  add column output_kind text not null default 'captions' check (output_kind in ('text', 'captions'));

-- 2. Reordering renumbers in two phases inside one function, so positions get
--    temporary room above the 1–20 the apps allow.
alter table public.humor_prompt_chain_steps drop constraint humor_prompt_chain_steps_position_check;
alter table public.humor_prompt_chain_steps add constraint humor_prompt_chain_steps_position_check check (position between 1 and 200);

create function public.humor_reorder_prompt_chain_steps(chain uuid, step_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare total integer := coalesce(array_length(step_ids, 1), 0);
begin
  perform 1 from public.humor_prompt_chains c where c.id = chain for update;
  if not found then raise exception 'Unknown prompt chain'; end if;
  if total <> (select count(*) from public.humor_prompt_chain_steps s where s.chain_id = chain)
    or total <> (select count(distinct x) from unnest(step_ids) x)
    or exists (select 1 from unnest(step_ids) x where not exists (
      select 1 from public.humor_prompt_chain_steps s where s.id = x and s.chain_id = chain))
  then raise exception 'The new order must list every step of this chain exactly once'; end if;
  update public.humor_prompt_chain_steps s set position = s.position + 100 where s.chain_id = chain;
  update public.humor_prompt_chain_steps s set position = o.ord
  from unnest(step_ids) with ordinality as o(id, ord) where s.id = o.id;
end $$;
revoke all on function public.humor_reorder_prompt_chain_steps(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.humor_reorder_prompt_chain_steps(uuid, uuid[]) to service_role;

-- 3. Runs started in the tool. Each run copies its steps' settings when it
--    starts, so editing the chain later never rewrites history. A deleted
--    chain keeps its runs (chain_id becomes null; name and version stay).
create table public.humor_chain_runs (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.humor_prompt_chains(id) on delete set null,
  chain_name text not null,
  prompt_version text not null,
  image_path text not null check (image_path ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$'),
  source_caption_id uuid,
  direction text check (direction is null or char_length(direction) <= 120),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  step_count integer not null check (step_count between 1 and 20),
  captions jsonb check (captions is null or jsonb_typeof(captions) = 'array'),
  final_output text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index humor_chain_runs_chain on public.humor_chain_runs (chain_id, created_at desc);

create table public.humor_chain_run_steps (
  run_id uuid not null references public.humor_chain_runs(id) on delete cascade,
  position integer not null check (position between 1 and 20),
  step_id uuid references public.humor_prompt_chain_steps(id) on delete set null,
  name text not null,
  provider text not null,
  model text not null,
  system_prompt text not null,
  user_prompt_template text not null,
  include_image boolean not null,
  output_kind text not null check (output_kind in ('text', 'captions')),
  output_schema jsonb,
  max_output_tokens integer,
  temperature numeric(3,2),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  user_prompt text,
  output text,
  error text check (error is null or char_length(error) <= 500),
  usage jsonb,
  latency_ms integer,
  completed_at timestamptz,
  primary key (run_id, position)
);

do $$
declare t text;
begin
  foreach t in array array['humor_chain_runs', 'humor_chain_run_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Photos used by tool runs: private, read through short signed URLs.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('humor-chain-runs', 'humor-chain-runs', false, 10000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 4. The assignment's example chain: describe → make it funny → five captions.
--    Demo only: members need one step returning four styled captions.
do $$
declare chain uuid; model uuid;
begin
  select id into model from public.humor_llm_models where model_id = 'gemini-3.8-flash' limit 1;
  insert into public.humor_prompt_chains(prompt_version, name, description)
  values ('demo-three-step-v1', 'Describe → funny → five captions',
    'Example three-step chain: step 1 describes the photo, step 2 writes a comedy bit about it, step 3 turns that into five short captions.')
  on conflict (prompt_version) do nothing
  returning id into chain;
  if chain is null then return; end if;
  insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, include_image, output_kind, system_prompt, user_prompt, output_schema) values
  (chain, 1, 'Describe the photo', model, true, 'text',
   'You describe photos precisely for a comedy writer. Plain, specific, no jokes.',
   'Describe this photo in 3 to 5 sentences: who or what is in it, where it seems to be, and anything odd or specific.' || chr(10) || 'The member''s direction, if any: {direction}',
   null),
  (chain, 2, 'Find the funny', model, false, 'text',
   'You are a stand-up comedian writing for Columbia students in New York. Keep it kind: never joke about bodies, race or appearance.',
   'Photo description:' || chr(10) || '{previous}' || chr(10) || chr(10) || 'Write a short observational comedy bit (3 to 4 sentences) about this photo. Direction, if any: {direction}',
   null),
  (chain, 3, 'Five short captions', model, false, 'captions',
   'You turn comedy bits into short photo captions. Return JSON only.',
   'Comedy bit:' || chr(10) || '{previous}' || chr(10) || chr(10) || 'Write five short, funny captions (under 15 words each) for the photo, each in a different style from deadpan, roast, pun, dad joke, absurd, wholesome.',
   '{"type":"object","required":["captions"],"properties":{"captions":{"type":"array","minItems":5,"maxItems":5,"items":{"type":"object","required":["caption","style"],"properties":{"caption":{"type":"string"},"style":{"type":"string","enum":["deadpan","roast","pun","dad joke","absurd","wholesome"]}},"additionalProperties":false}}},"additionalProperties":false}'::jsonb);
end $$;

commit;
