# Task 004: Risk Classify Module — Implementation (Green)

**type**: impl
**depends-on**: task-004-risk-classify-test

## Goal

Implement `scripts/lib/harness/risk-classify.mjs` to make all risk classification tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/risk-classify.mjs`

## What to Implement

1. `classifyToolRisk(toolName, toolInput, rules)` — pure function, no I/O
2. Extract relevant string from `toolInput` based on `toolName`:
   - `Bash`: `toolInput.command`
   - `Write`/`Edit`/`MultiEdit`: `toolInput.file_path`
   - `WebFetch`/`WebSearch`: `toolInput.url ?? toolInput.query`
   - Others: `JSON.stringify(toolInput)` truncated to 4096 chars
3. Test extracted string against each rule's `pattern` (pre-compiled RegExp)
4. Rules evaluated in severity order: critical → high → medium → low; first match wins
5. If rule has `applies_to` array, skip rule if `toolName` not in that array
6. Return `{ level, matchedRule, detail }` — `level` defaults to `"low"`, `matchedRule` to `null`

## Verification

```bash
node --test tests/harness/risk-classify.test.mjs
# All tests should PASS
```
