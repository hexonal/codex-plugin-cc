# Task 011: Session Start/End Hooks — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Constitution loaded on SessionStart
  Given a file ".codex-harness/constitution.yaml" exists with mode "standard"
  When the SessionStart hook fires
  Then the constitution is parsed and validated
  And the governance context is initialized
  And a JSONL audit entry records "constitution_loaded"

Scenario: Trace ID generated at session start and propagated
  Given a new session starts
  When the harness SessionStart hook fires
  Then a unique trace ID (hrns-<hex16>) is generated
  And it is stored in CODEX_HARNESS_TRACE_ID environment variable

Scenario: Existing lifecycle hooks coexist with harness hooks
  Given the original hooks.json defines SessionStart and SessionEnd hooks
  And the harness adds additional hooks for governance initialization
  When the SessionStart event fires
  Then the original session-lifecycle-hook.mjs executes first
  And the harness governance hook executes after

Scenario: Budget summary at session end
  Given a session consumed 45000 tokens across 120 tool calls
  When the SessionEnd harness hook fires
  Then a JSONL entry records "session_end" with totalTokens, totalCalls, budgetUsedPct
```

## Goal

Write failing tests for `scripts/harness-session-start-hook.mjs` and `scripts/harness-session-end-hook.mjs`.

## Files to Create

- `tests/harness/session-hooks.test.mjs`

## Test Cases

### SessionStart
1. With valid constitution → audit entry "constitution_loaded" + trace ID in CLAUDE_ENV_FILE
2. Without constitution → exits 0 immediately, no env file writes
3. With mode "off" → exits 0 immediately
4. Audit log pruning triggered when retain_sessions exceeded

### SessionEnd
1. With active session → audit entry "session_end" with budget summary
2. Without constitution → exits 0 immediately

## Verification

```bash
node --test tests/harness/session-hooks.test.mjs
# All tests should FAIL
```
