# Task 010: PostToolUse Hook Entry Point — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Async hooks do not block main execution
  Given a hooks.json with an async PostToolUse hook "audit-logger"
  And a synchronous PostToolUse hook "sanitizer"
  When the PostToolUse hook chain fires
  Then "sanitizer" completes and returns its decision immediately
  And "audit-logger" runs in the background without blocking the next turn
```

## Goal

Write failing tests for `scripts/harness-post-tool-hook.mjs`.

## Files to Create

- `tests/harness/post-tool-hook.test.mjs`

## Test Cases

1. Hook with clean output → exits 0, no stdout, audit entry appended
2. Hook with AWS key in output → exits 0 with `{"hookSpecificOutput":{"permittedOutput":"..."}}` containing redacted output
3. Hook with no constitution → exits 0 immediately (no-op)
4. Hook increments budget tool call counter
5. Hook crash (invalid stdin) → exits 0 with error to stderr

Test approach: spawn as child process, pipe JSON stdin with `tool_response`, capture outputs.

## Verification

```bash
node --test tests/harness/post-tool-hook.test.mjs
# All tests should FAIL
```
