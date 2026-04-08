# Task 014: Verification Loop — Implementation (Green)

**type**: impl
**depends-on**: task-014-verification-loop-test, task-007-audit-log-impl, task-008-budget-impl

## Goal

Enhance `scripts/stop-review-gate-hook.mjs` with budget summary and audit entries.

## Files to Modify

- `plugins/codex/scripts/stop-review-gate-hook.mjs` (minimal 2-line addition)

## What to Implement

1. At the top of `main()`, after loading config, read budget usage via `getBudgetUsage()`
2. If budget data exists, log a note with budget summary
3. After review verdict, append JSONL audit entry:
   - "verification_passed" for approve
   - "verification_force_approved" for max retries exceeded
4. Existing review gate logic remains completely unchanged

## Verification

```bash
node --test tests/harness/verification-loop.test.mjs
node --test tests/  # Ensure existing tests still pass
# All tests should PASS
```
