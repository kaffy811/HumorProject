# Simple prompt chain steps

Migration `202611070002_simple_step_inputs.sql`, run after `202611070001`, for the Prompt Chain Tool's simpler step editor.

Each step now has one Prompt (its system prompt). The user message is generated, not written:

```
User input: {direction}

Step 1 output (<step 1 name>):
{step1}
```

There is one entry for every earlier step, each once. The last step returns the captions; earlier steps return text. Whether a step sees the photo stays a per-step choice.

The migration converts existing chains:

- Instructions written in a step's user prompt move to the end of its Prompt. Lines with `{…}` are dropped, and so is a `Label:` line right before one.
- The inputs are generated as above, and output kinds are set by position.
- Each converted chain gets one version in its history, so the change can be restored.
- It is safe to run again.

The member app is unchanged: it reads the generated text as an ordinary template.

Check locally: `node tests/simple-steps-database.mjs` (in-memory).
