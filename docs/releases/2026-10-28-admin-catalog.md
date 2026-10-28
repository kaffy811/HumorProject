# Admin catalog tables (Week 7)

Migration `supabase/migrations/202610280001_admin_catalog.sql` adds the server-only tables the Humor Admin console (kaffy811/HumorProject-Admin) manages: `humor_llm_providers`, `humor_llm_models`, `humor_prompt_chains`, `humor_prompt_chain_steps`, `humor_prompt_chain_mix`, `humor_terms`, `humor_generation_examples`, `humor_allowed_signup_domains` and `humor_whitelisted_emails`.

- RLS on, no member grants; only the service role reads or writes them.
- `humor_set_prompt_chain_mix(shares, actor)` replaces the whole mix and rejects totals other than 100.
- Seeds what production runs today: the Google Gemini provider and `gemini-3.8-flash`, one chain per recorded `prompt_version` (with that version's newest prompts), `caption-styles-v3` at 100%, campus terms, columbia.edu and barnard.edu.
- Changes are written to the activity log when it exists; logging never blocks a change.

The member app does not read these tables yet: generation still uses the prompt in `lib/gemini.ts`, and sign-in is not limited by the domain or email lists.

Check locally (in-memory, no deployed database): `node tests/admin-catalog-database.mjs`.
