# Task 009: PreToolUse Hook Entry Point — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Hook chain executes in correct order for PreToolUse
  Given a hooks.json with PreToolUse hooks: "risk-classifier" and "permission-gate"
  And a tool invocation event for "Bash" with command "ls -la"
  When the PreToolUse hook chain fires
  Then "risk-classifier" executes and classifies the risk level
  And "permission-gate" checks the risk level against the constitution
  And each hook receives the event payload on stdin as JSON

Scenario: Most restrictive hook decision wins when multiple hooks fire
  Given a hooks.json with two PreToolUse hooks
  And the first hook returns decision "allow"
  And the second hook returns decision "block" with reason "prohibited pattern"
  When the PreToolUse hook chain fires
  Then the final decision is "block"

Scenario: Hook failure gracefully degrades without blocking
  Given a hooks.json with PreToolUse hook "risk-classifier"
  And the "risk-classifier" script crashes with exit code 1
  When the PreToolUse hook chain fires
  Then an error is logged to stderr
  And the final decision defaults to "allow"
```

## Goal

Write failing tests for `scripts/harness-pre-tool-hook.mjs`.

## Files to Create

- `tests/harness/pre-tool-hook.test.mjs`

## Test Cases

1. Hook with valid constitution and safe command → exits 0 with no stdout (allow)
2. Hook with critical-risk command → exits 0 with `{"decision":"block","reason":"..."}` on stdout
3. Hook with high-risk command → exits 0 with block decision (requireApprovalOn)
4. Hook with no constitution file → exits 0 immediately (no-op)
5. Hook with mode "off" → exits 0 immediately
6. Hook with mode "audit-only" → logs risk but exits 0 with no block decision
7. Hook with alwaysAllow tool (Read) → exits 0 regardless of risk
8. Each invocation appends a JSONL audit entry
9. Hook crash (simulate by invalid stdin) → exits 0 with error to stderr

Test approach: spawn `harness-pre-tool-hook.mjs` as child process, pipe JSON stdin, capture stdout/stderr/exit code.

## Verification

```bash
node --test tests/harness/pre-tool-hook.test.mjs
# All tests should FAIL
```
