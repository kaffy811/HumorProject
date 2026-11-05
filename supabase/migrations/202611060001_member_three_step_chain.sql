begin;

-- One three-step chain for every member, replacing the earlier ones:
-- 1. look at the photo → 2. find comic angles → 3. write four styled captions.
-- Steps start on Gemini; the Prompt Chain Tool can switch every step to GPT.
-- Needs 202611050001 (steps with include_image / output_kind). Safe to run again.
do $$
declare chain uuid; gemini uuid; schema jsonb; shares jsonb;
begin
  select m.id into gemini from public.humor_llm_models m join public.humor_llm_providers p on p.id = m.provider_id
  where p.slug = 'google' and m.model_id = 'gemini-3.8-flash';
  if gemini is null then raise exception 'Model gemini-3.8-flash (provider google) not found'; end if;
  -- The member app's caption format: exactly four captions in four different styles.
  schema := '{"type":"object","required":["captions"],"additionalProperties":false,"properties":{"captions":{"type":"array","minItems":4,"maxItems":4,"items":{"type":"object","required":["caption","style"],"additionalProperties":false,"properties":{"caption":{"type":"string"},"style":{"type":"string","enum":["deadpan","roast","pun","dad joke","absurd","wholesome"]}}}}}}';

  insert into public.humor_prompt_chains(prompt_version, name, description)
  values ('campus-captions-v4', 'Campus captions (3 steps)',
    'Member chain: describe the photo, find comic angles, then write four captions in four different styles.')
  on conflict (prompt_version) do update set name = excluded.name, description = excluded.description
  returning id into chain;
  delete from public.humor_prompt_chain_steps where chain_id = chain;
  insert into public.humor_prompt_chain_steps(chain_id, position, name, llm_model_id, include_image, output_kind, system_prompt, user_prompt, output_schema) values
  (chain, 1, 'Look at the photo', gemini, true, 'text',
   'You describe photos precisely for a comedy writer at Columbia University in New York. Be concrete and literal. No jokes.',
   'Describe this photo in 3 to 5 sentences: who or what is in it, where it seems to be, what is happening, and anything odd, specific or out of place. Mention Columbia or New York City details only if they are actually visible.' || chr(10) || 'The member''s direction: {direction}',
   null),
  (chain, 2, 'Find the angles', gemini, false, 'text',
   'You are a stand-up comedian writing for Columbia students living in New York City. Keep it kind: never joke about bodies, weight, race or appearance, and no sexual content, slurs or tragedies.',
   'Photo description:' || chr(10) || '{previous}' || chr(10) || chr(10) || 'The member''s direction: {direction}' || chr(10) || chr(10) || 'List 5 different comic angles on this photo, one short line each, each grounded in a specific visible detail. If the direction is not "none", every angle must center on it; otherwise lean on Columbia and NYC student life only where the photo supports it.',
   null),
  (chain, 3, 'Write four captions', gemini, false, 'captions',
   'You write captions for The Humor Project. Each caption is under 25 words with the punchline at the end. No hashtags, no emojis, no explaining the joke. Use the "When you..." / "Me pretending..." format at most once. Return JSON only: {"captions":[{"caption":"...","style":"deadpan"}, ...]}',
   'Photo description:' || chr(10) || '{step1}' || chr(10) || chr(10) || 'Comic angles:' || chr(10) || '{previous}' || chr(10) || chr(10) || 'The member''s direction: {direction}' || chr(10) || chr(10) || 'Write 4 captions from the best angles. Each uses a different style from deadpan, roast, pun, dad joke, absurd, wholesome, and a different angle. Do not write 4 versions of the same joke.',
   schema);

  -- Retire the earlier chains (their runs and member posts are kept).
  delete from public.humor_prompt_chains where prompt_version in ('caption-styles-v3', 'gpt-captions-v1', 'demo-three-step-v1');

  -- Every member generation now uses the new chain.
  select jsonb_object_agg(c.id, case when c.id = chain then 100 else 0 end) into shares from public.humor_prompt_chains c;
  perform public.humor_set_prompt_chain_mix(shares, null);
end $$;

commit;
