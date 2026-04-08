# Task 008: Budget Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Token budget exceeded triggers warning then block
  Given the constitution defines max_prompt_tokens: 10000
  And the current session has consumed 8500 tokens
  When a UserPromptSubmit hook fires
  Then a warning is emitted: "Token usage approaching limit"
  And the decision is "allow"
  When the session token count reaches 10100
  And a UserPromptSubmit hook fires
  Then the decision is "block" with reason "token budget exceeded"

Scenario: Token usage tracked per job against budget
  Given a session with token budget 10000
  And 3 tool invocations consumed 1200, 800, and 2000 tokens
  When the budget tracker updates
  Then cumulative token count is 4000
  And a JSONL entry records token_usage with cumulative and budget

Scenario: Budget summary at session end
  Given a session consumed 45000 tokens across 120 tool calls
  When the SessionEnd harness hook fires
  Then a JSONL entry records "session_end" with totalTokens, totalCalls, budgetUsedPct

Scenario: Budget state file corrupted mid-session
  Given the budget-<sessionId>.json file contains invalid JSON
  When the harness-prompt-submit-hook reads budget state
  Then the error is caught
  And budget state is re-initialized to zero counters
  And a warning is logged: "budget state reset due to corruption"
```

## Goal

Write failing tests for `scripts/lib/harness/budget.mjs`.

## Files to Create

- `tests/harness/budget.test.mjs`

## Test Cases

1. `initBudget(dir, sessionId, limits)` creates budget state file with zero counters
2. `recordToolCall(dir, sessionId, "Bash")` increments call counter
3. `recordToolCall` x3 produces cumulative count of 3
4. `checkPromptBudget(dir, sessionId, 500)` returns `{allowed: true}` when under limit
5. `checkPromptBudget` returns `{allowed: false, reason: "token budget exceeded"}` when over limit
6. `getBudgetUsage(dir, sessionId)` returns correct `{totalTokens, totalCalls, budgetUsedPct}`
7. Corrupted budget file (invalid JSON) → `getBudgetUsage` returns zeroed state and logs warning
8. Budget with `max_prompt_tokens: 0` (unlimited) → always allowed

## Verification

```bash
node --test tests/harness/budget.test.mjs
# All tests should FAIL
```
