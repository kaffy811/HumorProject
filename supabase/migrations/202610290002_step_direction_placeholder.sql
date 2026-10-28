begin;

-- Steps imported from recorded runs (202610280001) hold that run's literal user
-- prompt, e.g. "Image: [image]\nDirection: Butler at midnight". Routed through the
-- mix they would drop every member's own direction, so restore the placeholder.
-- Only prompts in the member app's exact two-line format are changed.
update public.humor_prompt_chain_steps
set user_prompt = 'Image: [image]' || chr(10) || 'Direction: {direction}'
where position('{direction}' in user_prompt) = 0
  and user_prompt ~ '^Image: \[image\]\nDirection: ';

commit;
