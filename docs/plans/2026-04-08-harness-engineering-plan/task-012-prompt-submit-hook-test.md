# Task 012: UserPromptSubmit Hook — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenario

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
```

## Goal

Write failing tests for `scripts/harness-prompt-submit-hook.mjs`.

## Files to Create

- `tests/harness/prompt-submit-hook.test.mjs`

## Test Cases

1. Under budget → exits 0 with no stdout (allow)
2. Near budget (>80%) → exits 0 with warning to stderr
3. Over budget → exits 0 with `{"decision":"block","reason":"token budget exceeded"}` on stdout
4. Unlimited budget (max_prompt_tokens: 0) → always allow
5. No constitution → exits 0 (no-op)

## Verification

```bash
node --test tests/harness/prompt-submit-hook.test.mjs
# All tests should FAIL
```
