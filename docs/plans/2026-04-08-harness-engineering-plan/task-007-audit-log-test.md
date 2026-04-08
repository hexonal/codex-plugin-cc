# Task 007: Audit Log Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Every hook execution produces JSONL audit entry
  Given a session with trace ID "hrns-abc123"
  And a PreToolUse hook executes for a Bash command
  When the hook completes
  Then a line is appended to "<stateDir>/audit-<sessionId>.jsonl"
  And the line is valid JSON

Scenario: Audit entry contains required fields
  Given a hook execution produces an audit entry
  Then the entry contains: traceId, ts, sessionId, event, toolName, riskLevel, decision, durationMs
  And ts is ISO 8601 format
  And durationMs is a non-negative integer

Scenario: Audit log pruning by retention policy
  Given the constitution defines retain_sessions: 10
  And the state directory contains audit logs for 15 sessions
  When the SessionStart hook triggers audit maintenance
  Then the 5 oldest audit log files are removed
  And a JSONL entry records "audit_pruned"

Scenario: Disk full during audit log write does not crash
  Given the filesystem has no free space
  When the harness-post-tool-hook attempts to append a JSONL entry
  Then the appendFileSync throws an error
  And the error is caught and logged to stderr
  And the hook exits 0 (does not block the tool execution)

Scenario: Concurrent hooks writing to same audit file
  Given two PostToolUse hooks fire nearly simultaneously
  When both attempt to append to the same audit JSONL file
  Then both entries are written (appendFileSync is atomic for small writes)
  And no entries are lost or corrupted
```

## Goal

Write failing tests for `scripts/lib/harness/audit-log.mjs`.

## Files to Create

- `tests/harness/audit-log.test.mjs`

## Test Cases

1. `resolveAuditLogFile(workspaceRoot, sessionId)` returns path matching `<stateDir>/audit-<sessionId>.jsonl`
2. `appendAuditEntry(logFile, entry)` creates file if not exists and appends one JSON line
3. `appendAuditEntry` appends a second entry on a new line (two lines in file)
4. Each entry line is valid JSON with required fields: `traceId, ts, sessionId, event, toolName, riskLevel, decision, durationMs`
5. `ts` field is ISO 8601 format
6. `durationMs` is a non-negative integer
7. `appendAuditEntry` with invalid path (simulate disk full) throws but does not crash the process
8. `pruneAuditLogs(stateDir, retainSessions)` keeps only the N most recent audit files
9. Two sequential `appendAuditEntry` calls produce two distinct lines (concurrent safety)

## Verification

```bash
node --test tests/harness/audit-log.test.mjs
# All tests should FAIL
```
