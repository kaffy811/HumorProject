# Members run one three-step chain

Members now get their captions from a multi-step prompt chain, chosen by the admin ("Model for members" in Humor Admin).

- `lib/generation-route.ts` accepts chains of up to 4 steps. Earlier steps return text, the last one returns the four captions. Each step can use `{direction}`, `{previous}` (the step before) and `{stepN}` (step N's output).
- A chain is rejected, and the member gets the built-in Gemini prompt instead, if:
  - no step sees the photo;
  - no step uses `{direction}`;
  - a step refers to a step that has not run yet;
  - a model is inactive, or a step that sees the photo uses a model that cannot read images;
  - a provider has no key.
- `lib/chain-text.ts` runs the text steps on Gemini or OpenAI. The final step uses the existing caption calls, attaching the photo only when the step asks for it.
- The post records the final step's filled prompt and a per-step trace in its usage.

Migration `202611060001_member_three_step_chain.sql`:

- Creates `campus-captions-v4` "Campus captions (3 steps)" on gemini-3.8-flash. Its steps are: look at the photo → find comic angles → write four captions in four different styles.
- Deletes the earlier chains `caption-styles-v3`, `gpt-captions-v1` and `demo-three-step-v1`. Their runs and member posts are kept.
- Gives the new chain 100% of the member mix.

To run the same chain on GPT, switch every step's model in the Prompt Chain Tool.

Check locally:

- `npm test`
- `node tests/member-chain-database.mjs` (in-memory PGlite)
