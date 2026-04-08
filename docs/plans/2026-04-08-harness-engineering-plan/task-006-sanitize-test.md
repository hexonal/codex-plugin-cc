# Task 006: Sanitize Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenario

```gherkin
Scenario: Built-in patterns detect credential exposure in output
  Given the risk classifier with built-in patterns
  And a PostToolUse event with output containing "AWS_SECRET_ACCESS_KEY=AKIA..."
  When the output sanitizer evaluates the result
  Then the classifier matches the AWS key pattern
  And the output is redacted as "[REDACTED:aws-key]"
  And a warning is emitted
```

## Goal

Write failing tests for `scripts/lib/harness/sanitize.mjs`.

## Files to Create

- `tests/harness/sanitize.test.mjs`

## Test Cases

1. AWS key pattern: input with `AKIAIOSFODNN7EXAMPLE` → redacted as `[REDACTED:aws-key]`
2. Generic API key: input with `api_key=sk-abc123def456ghi789` → redacted
3. PEM private key block: input with `-----BEGIN RSA PRIVATE KEY-----...` → redacted
4. No sensitive content: input "Hello world" → `{ modified: false, output: "Hello world", redactions: [] }`
5. Multiple matches: input with both AWS key and API key → both redacted, both in `redactions` array
6. Custom patterns from constitution: additional pattern `internal\.corp\.example` → redacted
7. Surrounding context preserved: only the matched content is replaced, not the entire line

## Verification

```bash
node --test tests/harness/sanitize.test.mjs
# All tests should FAIL
```
