# Prompt Chain Tool database support

For the Prompt Chain Tool (kaffy811/HumorProject-PromptChains), migration `202611050001_prompt_chain_tool.sql`:

- `humor_prompt_chain_steps.include_image` (the photo is attached to this step) and `output_kind` (`text` passed on to later steps, or the final `captions` JSON). Existing steps default to image + captions, so nothing changes for them.
- `humor_reorder_prompt_chain_steps(chain, step_ids)`: atomic reorder that must list every step of the chain once; positions are renumbered 1..n. The position check widens to 1–200 for the temporary renumbering; the apps still allow 1–20.
- `humor_chain_runs` and `humor_chain_run_steps`: tool runs with a copy of each step's settings, its filled prompt, output, usage and latency. Runs survive chain deletion. Service role only. Private bucket `humor-chain-runs` for their photos.
- Seeds the assignment's example chain `demo-three-step-v1` (describe → funny → five captions), not given to members.

The member app still runs single-step chains only: a chain with several steps, or whose step returns text, falls back to the built-in Gemini prompt (`lib/generation-route.ts`).

Check locally: `node tests/prompt-chain-tool-database.mjs` (in-memory).
