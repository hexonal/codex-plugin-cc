# Task 011: Session Start/End Hooks — Implementation (Green)

**type**: impl
**depends-on**: task-011-session-hooks-test, task-002-trace-impl, task-003-constitution-impl, task-007-audit-log-impl, task-008-budget-impl

## Goal

Implement session lifecycle hook scripts.

## Files to Create

- `plugins/codex/scripts/harness-session-start-hook.mjs`
- `plugins/codex/scripts/harness-session-end-hook.mjs`

## What to Implement

### harness-session-start-hook.mjs
1. Read stdin JSON
2. Load constitution — if null or mode "off", exit 0
3. Generate trace ID via `generateTraceId()`
4. Propagate trace ID to `CLAUDE_ENV_FILE`
5. Init budget via `initBudget()`
6. Prune old audit logs via `pruneAuditLogs()` if retention exceeded
7. Append audit entry "session_start" / "constitution_loaded"
8. Exit 0

### harness-session-end-hook.mjs
1. Read stdin JSON
2. Load constitution — if null or mode "off", exit 0
3. Read budget usage via `getBudgetUsage()`
4. Append audit entry "session_end" with budget summary
5. Exit 0

## Verification

```bash
node --test tests/harness/session-hooks.test.mjs
# All tests should PASS
```
