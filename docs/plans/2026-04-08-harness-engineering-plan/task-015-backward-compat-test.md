# Task 015: Backward Compatibility — Integration Tests

**type**: test
**depends-on**: task-013-hooks-json-config

## BDD Scenarios

```gherkin
Scenario: Existing /codex:review works with harness enabled
  Given the harness is enabled with mode "standard"
  When the user runs "/codex:review"
  Then the review command delegates to codex-companion.mjs as before
  And the final review output format is identical to pre-harness

Scenario: Existing /codex:rescue works with harness enabled
  Given the harness is enabled with mode "standard"
  When the user runs "/codex:rescue fix the crash"
  Then the rescue command delegates to codex-companion.mjs

Scenario: Harness fully disabled via constitution mode off
  Given a constitution.yaml with mode "off"
  When the SessionStart hook fires
  Then all harness hooks exit immediately (no-op)
  And original SessionStart, SessionEnd, Stop hooks still fire

Scenario: Existing lifecycle hooks coexist with harness hooks
  Given the original hooks.json defines SessionStart and SessionEnd hooks
  And the harness adds additional hooks for governance initialization
  When the SessionStart event fires
  Then the original session-lifecycle-hook.mjs executes first
  And the harness governance hook executes after
  And both complete without interference
```

## Goal

Write integration tests verifying backward compatibility.

## Files to Create

- `tests/harness/backward-compat.test.mjs`

## Test Cases

1. hooks.json still contains all 3 original hook entries (SessionStart, SessionEnd, Stop)
2. Session lifecycle hook script still reads/writes expected env vars
3. All harness hooks exit 0 with no output when no constitution exists
4. All harness hooks exit 0 with no output when constitution mode is "off"
5. Existing test suite passes without modification (`node --test tests/*.test.mjs`)

## Verification

```bash
node --test tests/harness/backward-compat.test.mjs
node --test tests/*.test.mjs  # existing tests unchanged
# All tests should PASS
```

## Commit Boundary

Final commit: "test: add backward compatibility integration tests for harness"
