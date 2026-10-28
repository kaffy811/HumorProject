# Admin-chosen models for caption generation

The member app now generates captions with the model and prompt chosen in the Humor Admin console instead of always using the built-in Gemini prompt.

- Each generation reads the prompt-chain **mix** (`humor_prompt_chain_mix`), picks a chain by its share, and uses that chain's **step 1**: system prompt, user prompt (`{direction}` is replaced by the member's direction), output schema, and its LLM model and provider (`lib/generation-route.ts`).
- Connectors: `google` (Gemini, `GEMINI_API_KEY`) and `openai` (Chat Completions with image input, `OPENAI_API_KEY`, `lib/openai.ts`). Output must pass the same four-caption, four-style validation as before.
- Falls back to the built-in Gemini prompt (`lib/gemini.ts`, `caption-styles-v3`) when the catalog tables are absent (e.g. the preview schema), no chain has a share, the chosen step has no active vision model, the provider has no connector or key, or the database lacks this migration. If the chosen model fails within 25 s, the run switches to the built-in prompt, the record is updated and the original attempt is kept in `usage_metadata.fallbackFrom`.
- Every run records its real provider, model, prompts, settings and the chain's `prompt_version`, so the admin's Overview, Generation requests and LLM responses show which model and chain produced each post.

Migration `202610290001_admin_model_routing.sql`: provider check accepts any provider slug; `reserve_humor_generation` gains a `prompt_version_name` overload (the old signature still works and records `caption-styles-v3`); busy/daily limits and publishing count every provider except `mock`. Check locally with `node tests/model-routing-database.mjs` (in-memory, no deployed database).

Setup: add `OPENAI_API_KEY` to the member app's Vercel project (Production) before giving an OpenAI chain a share.
