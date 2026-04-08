# Task 005: Permission Gate Module — Implementation (Green)

**type**: impl
**depends-on**: task-005-permission-gate-test

## Goal

Implement `scripts/lib/harness/permission-gate.mjs` to make all permission gate tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/permission-gate.mjs`

## What to Implement

1. `checkPermission(riskResult, profile, toolName)` — pure function, no I/O
2. Check order: `alwaysAllow` → `alwaysBlock` → `blockOn` → `requireApprovalOn` → allow
3. If `toolName` in `profile.alwaysAllow` → return `{allow: true}`
4. If `toolName` in `profile.alwaysBlock` → return `{allow: false, reason: "tool blocked by policy"}`
5. If `riskResult.level` in `profile.blockOn` → return `{allow: false, reason: "blocked by policy"}`
6. If `riskResult.level` in `profile.requireApprovalOn` → return `{allow: false, reason: "requires approval"}`
7. Otherwise → return `{allow: true}`

## Verification

```bash
node --test tests/harness/permission-gate.test.mjs
# All tests should PASS
```
