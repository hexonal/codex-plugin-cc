# Task 002: Trace Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenario

```gherkin
Scenario: Trace ID generated at session start and propagated
  Given a new session starts
  When the harness SessionStart hook fires
  Then a unique trace ID (hrns-<hex16>) is generated
  And it is stored in CODEX_HARNESS_TRACE_ID environment variable
  And all subsequent hooks receive the same trace ID
```

## Goal

Write failing tests for the trace module (`scripts/lib/harness/trace.mjs`).

## Files to Create

- `tests/harness/trace.test.mjs`

## Test Cases

1. `generateTraceId()` returns a string matching pattern `hrns-` followed by 16 hex characters
2. `generateTraceId()` returns unique values on successive calls
3. `getTraceId()` returns `null` when `CODEX_HARNESS_TRACE_ID` is not set
4. `getTraceId()` returns the value of `CODEX_HARNESS_TRACE_ID` when set
5. `propagateTraceId(traceId)` appends an export line to the file at `CLAUDE_ENV_FILE`

## Verification

```bash
node --test tests/harness/trace.test.mjs
# All tests should FAIL (module does not exist yet)
```
