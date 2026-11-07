begin;

-- Simple steps (Prompt Chain Tool): an admin writes one Prompt (the system
-- prompt) per step, and the user message is generated:
--   User input: {direction}
--   Step 1 output (<name>):
--   {step1}
--   … one entry for every earlier step, once.
-- The last step returns the captions, earlier ones text. Existing chains
-- are converted: instructions written in a step's user prompt move to the
-- end of its Prompt (lines with {…} and a "Label:" line right before one are
-- dropped, as lib/chain-rules.ts instructionsFrom does). Each converted chain
-- gets a version in its history. The member app is unchanged: it reads the
-- generated text as an ordinary template. Needs 202611070001. Safe to run again.
do $$
declare
  c record; s record; n integer; total integer; names text[]; tmpl text; extra text; system text;
  placeholder constant text := '\{(direction|previous|step[0-9]{1,2})\}';
begin
  for c in select id from public.humor_prompt_chains loop
    select coalesce(array_agg(regexp_replace(st.name, '[{}]', '', 'g') order by st.position), '{}') into names
    from public.humor_prompt_chain_steps st where st.chain_id = c.id;
    total := coalesce(array_length(names, 1), 0);
    n := 0;
    for s in select * from public.humor_prompt_chain_steps st where st.chain_id = c.id order by st.position loop
      n := n + 1;
      tmpl := 'User input: {direction}';
      for k in 1 .. n - 1 loop
        tmpl := tmpl || E'\n\n' || 'Step ' || k || ' output (' || names[k] || '):' || E'\n' || '{step' || k || '}';
      end loop;
      system := s.system_prompt;
      -- Hand-written user prompt (not one generated before): keep its instructions.
      if s.user_prompt !~ ('^User input: \{direction\}(\n\nStep [0-9]{1,2} output \([^\n]*\):\n\{step[0-9]{1,2}\})*$') then
        extra := s.user_prompt;
        extra := regexp_replace(extra, '^[^\n]*:[ \t]*\n(?=[^\n]*' || placeholder || ')', '', 'gn');
        extra := regexp_replace(extra, '^[^\n]*' || placeholder || '[^\n]*(\n|$)', '', 'gn');
        extra := btrim(regexp_replace(extra, '\n{3,}', E'\n\n', 'g'), E' \n\t');
        if extra <> '' and position(extra in system) = 0 then
          system := rtrim(system, E' \n\t') || E'\n\n' || extra;
        end if;
      end if;
      update public.humor_prompt_chain_steps st
      set system_prompt = system, user_prompt = tmpl, output_kind = case when n = total then 'captions' else 'text' end
      where st.id = s.id and (st.system_prompt, st.user_prompt, st.output_kind) is distinct from (system, tmpl, case when n = total then 'captions' else 'text' end);
    end loop;
    perform public.humor_save_prompt_chain_version(c.id, 'Simple steps: inputs generated, instructions moved into the Prompt', null);
  end loop;
end $$;

commit;
