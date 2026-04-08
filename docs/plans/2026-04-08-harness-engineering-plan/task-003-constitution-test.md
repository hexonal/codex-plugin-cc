# Task 003: Constitution Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Constitution loaded on SessionStart
  Given a file ".codex-harness/constitution.yaml" exists with mode "standard"
  When the SessionStart hook fires
  Then the constitution is parsed and validated
  And the governance context is initialized

Scenario: Missing constitution file uses sensible defaults
  Given no ".codex-harness/constitution.yaml" file exists
  When any harness hook fires
  Then the hook exits 0 immediately with no output
  And the existing plugin behavior is completely unchanged

Scenario: Constitution mode switch changes active pipeline steps
  Given a constitution with mode "audit-only"
  When the PreToolUse hook fires for a critical-risk command
  Then the risk is classified and logged
  But the decision is "allow" (audit-only mode never blocks)

Scenario: Malformed constitution YAML is rejected with clear error
  Given a ".codex-harness/constitution.yaml" with invalid YAML syntax
  When the SessionStart hook attempts to load the constitution
  Then a parse error is logged to stderr with line number
  And the harness falls back to no-op mode (all hooks exit 0)

Scenario: Invalid constitution schema uses defaults for bad fields
  Given a constitution with mode "unknown_mode" and max_tool_calls "not_a_number"
  When the SessionStart hook validates the constitution
  Then mode defaults to "off" (safest fallback)
  And max_tool_calls defaults to 0 (unlimited)

Scenario: Risk pattern with invalid regex is skipped
  Given the constitution defines a risk rule with pattern "[invalid("
  When the constitution parser validates risk rules
  Then the invalid rule is skipped with a warning to stderr
  And all other valid rules are loaded normally
```

## Goal

Write failing tests for `scripts/lib/harness/constitution.mjs`.

## Files to Create

- `tests/harness/constitution.test.mjs`

## Test Cases

1. `loadConstitution(dir)` returns parsed object when valid YAML exists
2. `loadConstitution(dir)` returns `null` when file is missing
3. `loadConstitution(dir)` returns `null` and logs warning when YAML is malformed
4. `loadConstitution(dir)` defaults invalid `mode` to `"off"`
5. `loadConstitution(dir)` defaults non-numeric `max_tool_calls` to `0`
6. `getRiskRules(dir)` skips rules with invalid regex patterns and logs warning
7. `getRiskRules(dir)` returns valid rules in order
8. `getPermissionProfile(dir)` returns correct blockOn/alwaysAllow arrays
9. `getBudgetLimits(dir)` returns budget object with defaults for missing fields
10. Mode `"audit-only"` is recognized and returned correctly
11. Mode `"standard"` / `"off"` are recognized

## Verification

```bash
node --test tests/harness/constitution.test.mjs
# All tests should FAIL
```
