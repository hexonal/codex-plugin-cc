# Task 008: Budget Module — Implementation (Green)

**type**: impl
**depends-on**: task-008-budget-test

## Goal

Implement `scripts/lib/harness/budget.mjs` to make all budget tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/budget.mjs`

## What to Implement

1. `initBudget(workspaceRoot, sessionId, limits)` — create `<stateDir>/budget-<sessionId>.json` with `{totalTokens:0, totalCalls:0, limits}`
2. `recordToolCall(workspaceRoot, sessionId, toolName)` — read state, increment `totalCalls`, estimate tokens as `Math.ceil(toolName.length / 4)` (placeholder), write back
3. `checkPromptBudget(workspaceRoot, sessionId, estimatedTokens)` — read state, check `totalTokens + estimatedTokens` against `limits.max_prompt_tokens`. If `max_prompt_tokens === 0`, always allow.
4. `getBudgetUsage(workspaceRoot, sessionId)` — read state, compute `budgetUsedPct`. If file corrupted, return zeroed state and log warning.
5. All file reads wrapped in try/catch — corrupted JSON resets to zero state.

## Verification

```bash
node --test tests/harness/budget.test.mjs
# All tests should PASS
```
