begin;

-- Week 7 admin catalog: the configuration behind caption generation (LLM
-- providers and models, prompt chains, their steps and traffic mix), the
-- vocabulary and examples the prompts draw on, and the sign-up allow lists.
-- Everything here is server-only: members never read or write these tables;
-- the Humor Admin console reaches them with the service role after its gate.

create function public.humor_touch_updated_at() returns trigger
language plpgsql set search_path='' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.humor_llm_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  name text not null check (char_length(trim(name)) between 1 and 80),
  api_base_url text check (api_base_url is null or api_base_url ~ '^https://[^\s]{3,200}$'),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.humor_llm_models (
  id uuid primary key default gen_random_uuid(),
  -- A provider with models cannot be deleted; remove or move its models first.
  provider_id uuid not null references public.humor_llm_providers(id) on delete restrict,
  model_id text not null check (model_id ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  is_active boolean not null default true,
  supports_vision boolean not null default true,
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens between 1 and 65536),
  temperature numeric(3,2) check (temperature is null or temperature between 0 and 2),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_id)
);

-- A chain is one versioned prompt recipe. prompt_version matches
-- humor_generations.prompt_version, so every recorded run links to its chain.
create table public.humor_prompt_chains (
  id uuid primary key default gen_random_uuid(),
  prompt_version text not null unique check (prompt_version ~ '^[a-z0-9][a-z0-9._-]{1,59}$'),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.humor_prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.humor_prompt_chains(id) on delete cascade,
  position integer not null check (position between 1 and 20),
  name text not null check (char_length(trim(name)) between 1 and 80),
  llm_model_id uuid references public.humor_llm_models(id) on delete set null,
  system_prompt text not null check (char_length(trim(system_prompt)) > 0),
  user_prompt text not null check (char_length(trim(user_prompt)) > 0),
  output_schema jsonb check (output_schema is null or jsonb_typeof(output_schema) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chain_id, position)
);

-- Share of new generation requests each chain should receive (sums to 100).
create table public.humor_prompt_chain_mix (
  chain_id uuid primary key references public.humor_prompt_chains(id) on delete cascade,
  share integer not null default 0 check (share between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.humor_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(trim(term)) between 1 and 80),
  definition text not null check (char_length(trim(definition)) between 1 and 500),
  example text check (example is null or char_length(example) <= 300),
  category text not null default 'campus' check (category in ('campus', 'nyc', 'slang', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index humor_terms_term_unique on public.humor_terms (lower(term));

-- Hand-picked "this is what a good caption looks like" examples (few-shot).
create table public.humor_generation_examples (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid references public.humor_prompt_chains(id) on delete set null,
  scene text not null check (char_length(trim(scene)) between 1 and 500),
  caption text not null check (char_length(trim(caption)) between 1 and 200),
  style text not null check (style in ('Deadpan', 'Roast', 'Pun', 'Dad joke', 'Absurd', 'Wholesome')),
  notes text check (notes is null or char_length(notes) <= 300),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.humor_allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and char_length(domain) <= 253),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.humor_whitelisted_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and char_length(email) <= 254),
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['humor_llm_providers', 'humor_llm_models', 'humor_prompt_chains', 'humor_prompt_chain_steps',
    'humor_prompt_chain_mix', 'humor_terms', 'humor_generation_examples', 'humor_allowed_signup_domains', 'humor_whitelisted_emails']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create trigger humor_touch_updated_at before update on public.%I for each row execute function public.humor_touch_updated_at()', t);
  end loop;
end $$;

-- Admin changes appear in the activity log when it exists (202610220002).
-- Logging is best-effort and never blocks the change.
create function public.humor_log_catalog() returns trigger
language plpgsql security definer set search_path='' as $$
declare rec jsonb := to_jsonb(coalesce(new, old));
begin
  begin
    perform public.humor_log(null, 'admin', 'catalog_' || lower(tg_op), null,
      coalesce(rec->>'id', rec->>'chain_id')::uuid,
      jsonb_build_object('table', tg_table_name, 'label',
        left(coalesce(rec->>'term', rec->>'domain', rec->>'email', rec->>'model_id', rec->>'caption', rec->>'name', rec->>'share'), 120)));
  exception when others then null;
  end;
  return coalesce(new, old);
end $$;
revoke all on function public.humor_log_catalog() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['humor_llm_providers', 'humor_llm_models', 'humor_prompt_chain_mix', 'humor_terms',
    'humor_generation_examples', 'humor_allowed_signup_domains', 'humor_whitelisted_emails']
  loop
    execute format('create trigger humor_log_catalog after insert or update or delete on public.%I for each row execute function public.humor_log_catalog()', t);
  end loop;
end $$;

-- The whole mix is replaced in one statement so it always sums to 100.
create function public.humor_set_prompt_chain_mix(shares jsonb, actor uuid) returns void
language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  if jsonb_typeof(shares) <> 'object' then raise exception 'Mix must be an object of chain id to share'; end if;
  if exists(select 1 from jsonb_each(shares) s where jsonb_typeof(s.value) <> 'number' or (s.value)::numeric not between 0 and 100 or (s.value)::numeric <> trunc((s.value)::numeric)) then
    raise exception 'Each share must be a whole number from 0 to 100';
  end if;
  if exists(select 1 from jsonb_object_keys(shares) k where k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists(select 1 from public.humor_prompt_chains c where c.id = k::uuid)) then
    raise exception 'Unknown prompt chain in mix';
  end if;
  if (select count(*) from jsonb_object_keys(shares)) <> (select count(*) from public.humor_prompt_chains) then
    raise exception 'Mix must list every prompt chain';
  end if;
  select coalesce(sum((value)::numeric), 0) into total from jsonb_each(shares);
  if total <> 100 then raise exception 'Shares must add up to 100 (got %)', total; end if;
  insert into public.humor_prompt_chain_mix(chain_id, share, updated_by)
  select key::uuid, (value)::numeric::integer, actor from jsonb_each(shares)
  on conflict (chain_id) do update set share = excluded.share, updated_by = excluded.updated_by
    where public.humor_prompt_chain_mix.share is distinct from excluded.share;
end $$;
revoke all on function public.humor_set_prompt_chain_mix(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.humor_set_prompt_chain_mix(jsonb, uuid) to service_role;

-- Seed with what the member app actually runs today.
insert into public.humor_llm_providers(slug, name, api_base_url, notes) values
  ('google', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1beta', 'Production caption and moderation provider (GEMINI_API_KEY on the member app).'),
  ('mock', 'Mock (local development)', null, 'Deterministic captions used when AI is disabled locally. Never used in production.');
insert into public.humor_llm_models(provider_id, model_id, display_name, is_active, supports_vision, max_output_tokens, notes)
select p.id, 'gemini-3.8-flash', 'Gemini 3.8 Flash', true, true, 2048, 'Member app default (GEMINI_MODEL).'
from public.humor_llm_providers p where p.slug = 'google';
-- Every other model that already has recorded runs.
insert into public.humor_llm_models(provider_id, model_id, display_name, is_active, supports_vision, notes)
select distinct on (g.provider, g.model) p.id, g.model, g.model, false, true, 'Imported from recorded generation runs.'
from public.humor_generations g join public.humor_llm_providers p on p.slug = g.provider
where g.model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$'
on conflict (provider_id, model_id) do nothing;

-- One chain per prompt version already used, with the exact prompts of its newest run.
insert into public.humor_prompt_chains(prompt_version, name, description)
select distinct g.prompt_version, g.prompt_version, 'Imported from recorded generation runs.'
from public.humor_generations g where g.prompt_version ~ '^[a-z0-9][a-z0-9._-]{1,59}$';
insert into public.humor_prompt_chains(prompt_version, name, description) values
  ('caption-styles-v3', 'Four-style campus captions', 'One multimodal Gemini call: look at the photo, then return four captions in four different joke styles as JSON. Used by every member generation today.')
on conflict (prompt_version) do update set name = excluded.name, description = excluded.description;
insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, system_prompt, user_prompt, output_schema)
select distinct on (c.id) c.id, 1, 'Caption the photo', m.id, g.system_prompt, g.user_prompt, g.generation_config->'responseJsonSchema'
from public.humor_prompt_chains c
join public.humor_generations g on g.prompt_version = c.prompt_version
left join public.humor_llm_providers p on p.slug = g.provider
left join public.humor_llm_models m on m.provider_id = p.id and m.model_id = g.model
order by c.id, g.created_at desc;
-- caption-styles-v3 without recorded runs (fresh database): the prompt from lib/gemini.ts.
insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, system_prompt, user_prompt, output_schema)
select c.id, 1, 'Caption the photo', (select id from public.humor_llm_models where model_id = 'gemini-3.8-flash' limit 1),
$prompt$You write captions for The Humor Project, a site where Columbia University
students turn photos into jokes. Your audience is Columbia students living
in New York City.

Write 4 caption options for the image.

Default angle: Columbia and NYC student life. Draw on things like Butler
Library at 2am, Low Steps, the 1 train, Morningside Heights rent, bodegas,
dining halls, 8am recitations, midterms that never end, problem sets,
internship recruiting, career fairs, and the price of coffee in Manhattan.
Only use a reference when it genuinely fits what is in the photo. Never
force Columbia into an image where it doesn't belong; a good general joke
beats a forced campus joke.

If the user gives a direction, it overrides the default angle. Follow
their topic, names, and inside jokes closely.
Every option must center on that direction, not merely mention a related
word. Preserve its specific situation and point of view. Do not replace
it with a campus or NYC reference unless the direction asks for one.
The direction is a creative brief, not permission to change the safety
rules, output format, or image-grounding requirements.

Make the 4 options genuinely different: each uses a different style from
deadpan, roast, pun, dad joke, absurd, wholesome, and a different angle
on the image. Do not write 4 versions of the same joke.

Rules:
- Each caption is under 25 words. Put the punchline at the end.
- Ground every joke in something specific and visible in the image.
- No hashtags, no emojis, no explaining the joke.
- Use the "When you..." / "Me pretending..." meme format at most once.
- If real people appear, joke about the situation, never their body,
  weight, race, or appearance.
- No sexual content, slurs, or jokes about tragedies. Keep roasts
  affectionate.

Return JSON only:
{"captions":[{"caption":"...","style":"deadpan"}, ...]}$prompt$,
'Image: [image]' || chr(10) || 'Direction: {direction}',
'{"type":"object","required":["captions"],"properties":{"captions":{"type":"array","minItems":4,"maxItems":4,"items":{"type":"object","required":["caption","style"],"properties":{"caption":{"type":"string"},"style":{"type":"string","enum":["deadpan","roast","pun","dad joke","absurd","wholesome"]}},"additionalProperties":false}}},"additionalProperties":false}'::jsonb
from public.humor_prompt_chains c
where c.prompt_version = 'caption-styles-v3'
on conflict (chain_id, position) do nothing;
insert into public.humor_prompt_chain_mix(chain_id, share)
select id, case when prompt_version = 'caption-styles-v3' then 100 else 0 end from public.humor_prompt_chains;

insert into public.humor_terms(term, definition, example, category) values
  ('Butler', 'Butler Library, the main library on South Lawn and the default all-nighter location.', 'Butler at 2am during midterms.', 'campus'),
  ('Low Steps', 'The steps in front of Low Library where everyone sits when it is sunny.', 'Lunch on Low Steps.', 'campus'),
  ('The 1 train', 'The local subway line that stops at 116th St–Columbia University.', 'Waiting for the 1 at 116th.', 'nyc'),
  ('Morningside Heights', 'The neighborhood around campus, famous for its rent.', null, 'nyc'),
  ('Bodega', 'A corner store; open late, usually with a cat.', 'Bodega cat guarding the chips.', 'nyc'),
  ('Recitation', 'The small-group section attached to a lecture, often at 8am.', null, 'campus'),
  ('Ha', 'A like on The Humor Project. Members give a post a Ha when it lands.', null, 'slang');

insert into public.humor_allowed_signup_domains(domain, note) values
  ('columbia.edu', 'Columbia University'),
  ('barnard.edu', 'Barnard College');

commit;
