# Task 005: Permission Gate Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Permission profile restricts tool access per command type
  Given the constitution defines alwaysAllow: [Read, Glob, Grep, LS]
  And the constitution defines blockOn: [critical]
  When a PreToolUse event fires for "Read" tool
  Then the permission gate returns "allow" immediately (bypass risk check)
  When a PreToolUse event fires for "Bash" with critical risk
  Then the permission gate returns "block"

Scenario: Risk level determines action by severity
  Given the constitution defines blockOn: [critical] and requireApprovalOn: [high]
  When a command is classified as "low" risk
  Then the decision is "allow"
  When a command is classified as "medium" risk
  Then the decision is "allow" with warning
  When a command is classified as "high" risk
  Then the decision is "block" with reason "requires approval"
  When a command is classified as "critical" risk
  Then the decision is "block" with reason "blocked by policy"
```

## Goal

Write failing tests for `scripts/lib/harness/permission-gate.mjs`.

## Files to Create

- `tests/harness/permission-gate.test.mjs`

## Test Cases

1. `checkPermission({level:"low"}, profile, "Bash")` returns `{allow: true}`
2. `checkPermission({level:"critical"}, profile, "Bash")` returns `{allow: false, reason: "blocked by policy"}`
3. `checkPermission({level:"high"}, profile, "Bash")` returns `{allow: false, reason: "requires approval"}`
4. `checkPermission({level:"medium"}, profile, "Bash")` returns `{allow: true}` (medium not in blockOn)
5. `checkPermission(anyRisk, profile, "Read")` returns `{allow: true}` when Read is in alwaysAllow
6. `checkPermission(anyRisk, profile, "Dangerous")` returns `{allow: false}` when in alwaysBlock
7. Empty `blockOn` array means nothing is blocked by severity

## Verification

```bash
node --test tests/harness/permission-gate.test.mjs
# All tests should FAIL
```
