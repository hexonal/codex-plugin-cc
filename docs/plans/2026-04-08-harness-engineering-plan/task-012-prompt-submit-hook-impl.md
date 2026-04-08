# Task 012: UserPromptSubmit Hook — Implementation (Green)

**type**: impl
**depends-on**: task-012-prompt-submit-hook-test, task-003-constitution-impl, task-008-budget-impl

## Goal

Implement `scripts/harness-prompt-submit-hook.mjs`.

## Files to Create

- `plugins/codex/scripts/harness-prompt-submit-hook.mjs`

## What to Implement

1. Read stdin JSON (prompt payload)
2. Load constitution — if null or mode "off", exit 0
3. Estimate token count: `Math.ceil(prompt.length / 4)`
4. Call `checkPromptBudget(workspaceRoot, sessionId, estimatedTokens)`
5. If not allowed → write `{"decision":"block","reason":"token budget exceeded"}` to stdout
6. If approaching limit (>80%) → write warning to stderr
7. Exit 0
8. Wrap in try/catch

## Verification

```bash
node --test tests/harness/prompt-submit-hook.test.mjs
# All tests should PASS
```
