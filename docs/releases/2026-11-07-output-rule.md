# Last step output rule and the OpenAI JSON-mode guard

- Migration `202611070003_last_step_output_rule.sql`, run after `202611070002`: the last step's generated input ends with an output rule. The rule asks for JSON only, exactly 4 captions, and each caption in a different style from deadpan, roast, pun, dad joke, absurd and wholesome, followed by the format. So the answer is what the member app accepts, whatever the step's Prompt says. Safe to run again, and it adds one version per changed chain.
- `lib/openai.ts`: OpenAI's plain JSON mode (no schema) refuses messages that never mention JSON. When neither prompt mentions JSON, the system prompt now ends with "Respond with JSON.".
