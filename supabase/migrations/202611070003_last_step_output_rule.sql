begin;

-- The last step of every chain gets the output rule at the end of its
-- generated input. With it the answer is always four styled captions as
-- JSON, whatever the step's Prompt says, which is what the member app
-- accepts. It also mentions JSON, which OpenAI's JSON mode requires.
-- Earlier steps lose the rule if they had it. Only generated inputs are
-- touched (see 202611070002); the Prompt Chain Tool keeps them in sync
-- from now on. Needs 202611070002. Safe to run again.
do $$
declare
  c record; s record; n integer; total integer; names text[]; tmpl text;
  rule constant text := 'Return JSON only, with exactly 4 captions, each in a different style from: deadpan, roast, pun, dad joke, absurd, wholesome. Format: {"captions":[{"caption":"...","style":"deadpan"}]}';
  generated constant text := '^User input: \{direction\}(\n\nStep [0-9]{1,2} output \([^\n]*\):\n\{step[0-9]{1,2}\})*(\n\nReturn JSON only, with exactly 4 captions[^\n]*)?$';
  changed boolean;
begin
  for c in select id from public.humor_prompt_chains loop
    select coalesce(array_agg(regexp_replace(st.name, '[{}]', '', 'g') order by st.position), '{}') into names
    from public.humor_prompt_chain_steps st where st.chain_id = c.id;
    total := coalesce(array_length(names, 1), 0);
    n := 0; changed := false;
    for s in select * from public.humor_prompt_chain_steps st where st.chain_id = c.id order by st.position loop
      n := n + 1;
      continue when s.user_prompt !~ generated;
      tmpl := 'User input: {direction}';
      for k in 1 .. n - 1 loop
        tmpl := tmpl || E'\n\n' || 'Step ' || k || ' output (' || names[k] || '):' || E'\n' || '{step' || k || '}';
      end loop;
      if n = total then tmpl := tmpl || E'\n\n' || rule; end if;
      if s.user_prompt is distinct from tmpl then
        update public.humor_prompt_chain_steps set user_prompt = tmpl where id = s.id;
        changed := true;
      end if;
    end loop;
    if changed then
      perform public.humor_save_prompt_chain_version(c.id, 'Last step: output rule added to its input', null);
    end if;
  end loop;
end $$;

commit;
