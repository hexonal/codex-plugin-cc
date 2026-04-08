# Task 003: Constitution Module — Implementation (Green)

**type**: impl
**depends-on**: task-003-constitution-test

## BDD Scenarios

```gherkin
Scenario: Constitution loaded on SessionStart
  Given a file ".codex-harness/constitution.yaml" exists with mode "standard"
  When the SessionStart hook fires
  Then the constitution is parsed and validated

Scenario: Missing constitution file uses sensible defaults
  Given no ".codex-harness/constitution.yaml" file exists
  When any harness hook fires
  Then the hook exits 0 immediately with no output

Scenario: Malformed constitution YAML is rejected with clear error
  Given a ".codex-harness/constitution.yaml" with invalid YAML syntax
  When the SessionStart hook attempts to load the constitution
  Then a parse error is logged to stderr with line number
  And the harness falls back to no-op mode

Scenario: Invalid constitution schema uses defaults for bad fields
  Given a constitution with mode "unknown_mode" and max_tool_calls "not_a_number"
  When the SessionStart hook validates the constitution
  Then mode defaults to "off" (safest fallback)

Scenario: Risk pattern with invalid regex is skipped
  Given the constitution defines a risk rule with pattern "[invalid("
  When the constitution parser validates risk rules
  Then the invalid rule is skipped with a warning to stderr
```

## Goal

Implement `scripts/lib/harness/constitution.mjs` to make all constitution tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/constitution.mjs`

## What to Implement

1. `loadConstitution(workspaceRoot)` — check for `.codex-harness/constitution.yaml`, parse YAML subset, validate schema, return parsed object or `null`
2. Hand-rolled YAML subset parser (~80-100 lines) — handles flat scalars, `- item` arrays, two-space nested maps. No multi-document, no anchors, no flow style.
3. Schema validation: `version` must be `1`, `mode` must be `standard|audit-only|off` (default `"off"`), risk_rules patterns compiled via `new RegExp()` with try/catch
4. `getRiskRules(workspaceRoot)` — returns array of valid risk rule objects
5. `getPermissionProfile(workspaceRoot)` — returns `{ blockOn, requireApprovalOn, alwaysAllow, alwaysBlock }` with defaults
6. `getBudgetLimits(workspaceRoot)` — returns `{ max_tool_calls, max_prompt_tokens, max_concurrent_jobs }` with `0` defaults

**Key constraint**: Zero npm runtime dependencies. Use only `node:fs` and `node:path`.

## Verification

```bash
node --test tests/harness/constitution.test.mjs
# All tests should PASS
```
