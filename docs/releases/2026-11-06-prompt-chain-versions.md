# Prompt chain history, restore and duplicate

For the Prompt Chain Tool (phase 2). Migration `202611060002_prompt_chain_versions.sql`, run after `202611060001`:

- `humor_prompt_chain_versions`: numbered snapshots of a chain's name, prompt version, description and steps.
  - The tool saves one after every change.
  - If nothing changed since the latest snapshot, no new version is added.
  - Existing chains start at version 1.
  - Service role only; deleted together with the chain.
- `humor_save_prompt_chain_version(chain, label, actor)` saves the current state.
- `humor_restore_prompt_chain_version(version_id, actor)` restores an earlier version in one transaction: name, description and steps.
  - It saves the state before the restore first.
  - The prompt version stays, because member posts and runs are linked to it.
  - A model deleted since the snapshot comes back as no model.
- `humor_duplicate_prompt_chain(source, new_version, new_name, actor)` copies a chain and its steps under a new prompt version. The copy is not given to members.

Check locally: `node tests/prompt-chain-versions-database.mjs` (in-memory).
