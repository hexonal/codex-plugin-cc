# Task 007: Audit Log Module — Implementation (Green)

**type**: impl
**depends-on**: task-007-audit-log-test, task-002-trace-impl

## Goal

Implement `scripts/lib/harness/audit-log.mjs` to make all audit log tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/audit-log.mjs`

## What to Implement

1. `resolveAuditLogFile(workspaceRoot, sessionId)` — resolve state directory (reuse existing `resolveStateDir` pattern from `state.mjs`), return `<stateDir>/audit-<sessionId>.jsonl`
2. `appendAuditEntry(logFile, entry)` — `fs.appendFileSync(logFile, JSON.stringify(entry) + '\n')`. Entry must include `ts` (new Date().toISOString()), `traceId` (from `trace.getTraceId()`), and all other required fields
3. `pruneAuditLogs(stateDir, retainSessions)` — glob `audit-*.jsonl` files, sort by mtime, remove oldest beyond retention limit
4. All functions wrapped in try/catch — errors logged to stderr, never thrown

## Verification

```bash
node --test tests/harness/audit-log.test.mjs
# All tests should PASS
```
