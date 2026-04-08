# Task 014: Verification Loop — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Stop hook runs enhanced review gate
  Given the constitution has mode "standard" with verification enabled
  And the Stop hook is configured with stop-review-gate-hook.mjs
  When the assistant signals task completion
  Then the Stop hook fires
  And a review of the working tree diff is performed

Scenario: Review verdict "needs-attention" blocks completion
  Given the Stop hook review gate has executed
  And the review verdict is "needs-attention" with findings
  When the review gate produces its result
  Then the hook exits with code 2 (block)
  And the findings are returned as structured JSON

Scenario: Review verdict "approve" passes
  Given the Stop hook review gate has executed
  And the review verdict is "approve"
  When the review gate produces its result
  Then the hook exits with code 0
  And a JSONL audit entry records "verification_passed"

Scenario: Review gate respects max retries
  Given the constitution defines max verification retries as 3
  And the Stop hook fires for the 4th time with "needs-attention"
  When the review gate evaluates the retry count
  Then the gate forces approval with warning "max retries exceeded"
  And a JSONL audit entry records "verification_force_approved"
```

## Goal

Write failing tests for the enhanced stop-review-gate-hook with budget integration.

## Files to Create

- `tests/harness/verification-loop.test.mjs`

## Test Cases

1. Stop hook with budget summary note — budget usage is logged
2. Audit entry "verification_passed" written on approve verdict
3. Audit entry "verification_force_approved" written when max retries exceeded
4. Budget exceeded flag is logged in stop hook output

Note: The existing stop-review-gate-hook tests should continue to pass. These tests only cover the new budget integration and audit entries.

## Verification

```bash
node --test tests/harness/verification-loop.test.mjs
# All tests should FAIL
```
