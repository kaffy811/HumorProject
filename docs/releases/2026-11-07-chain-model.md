# One model per prompt chain

Migration `202611070001_chain_model.sql` (after `202611060002`):

- `humor_prompt_chains.llm_model_id`: the chain's model, chosen once in the Prompt Chain Tool's Chain settings.
  - Backfilled with the model most of the chain's steps use.
  - Cleared if the model is deleted.
- Steps keep their own `llm_model_id`. The member app reads these, so it is unchanged. The tool sets every step to the chain's model whenever the chain's model is saved.
- Snapshots, restore and duplicate include the chain's model. Restoring a snapshot from before this migration keeps the current model.

Check locally: `node tests/chain-model-database.mjs` (in-memory).
