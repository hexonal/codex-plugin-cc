# Task 002: Trace Module — Implementation (Green)

**type**: impl
**depends-on**: task-002-trace-test

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

Implement `scripts/lib/harness/trace.mjs` to make all trace tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/trace.mjs`

## What to Implement

1. `generateTraceId()` — use `node:crypto` `randomBytes(8).toString('hex')` prefixed with `"hrns-"`
2. `getTraceId()` — read `process.env.CODEX_HARNESS_TRACE_ID`, return string or `null`
3. `propagateTraceId(traceId)` — append `export CODEX_HARNESS_TRACE_ID='<traceId>'` to the file path in `process.env.CLAUDE_ENV_FILE`

## Verification

```bash
node --test tests/harness/trace.test.mjs
# All tests should PASS
```
