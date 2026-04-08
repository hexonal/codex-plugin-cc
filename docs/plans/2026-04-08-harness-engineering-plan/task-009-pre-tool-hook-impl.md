# Task 009: PreToolUse Hook Entry Point — Implementation (Green)

**type**: impl
**depends-on**: task-009-pre-tool-hook-test, task-003-constitution-impl, task-004-risk-classify-impl, task-005-permission-gate-impl, task-007-audit-log-impl

## Goal

Implement `scripts/harness-pre-tool-hook.mjs` to make all PreToolUse hook tests pass.

## Files to Create

- `plugins/codex/scripts/harness-pre-tool-hook.mjs`

## What to Implement

1. Read stdin as JSON (hook event payload)
2. Resolve workspace root from `input.cwd`
3. Load constitution — if null or mode "off", exit 0 immediately
4. Call `classifyToolRisk(toolName, toolInput, getRiskRules(...))`
5. Call `checkPermission(riskResult, getPermissionProfile(...), toolName)`
6. Append JSONL audit entry with risk level and decision
7. If mode "audit-only" → always allow regardless of permission result
8. If permission blocked → write `{"decision":"block","reason":"..."}` to stdout
9. Otherwise → exit 0 with no stdout
10. Wrap entire `main()` in try/catch — on error, log to stderr, exit 0

## Verification

```bash
node --test tests/harness/pre-tool-hook.test.mjs
# All tests should PASS
```
