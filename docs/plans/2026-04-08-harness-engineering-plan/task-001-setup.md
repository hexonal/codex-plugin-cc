# Task 001: Project Setup and Directory Structure

**type**: config
**depends-on**: none

## Goal

Create the harness directory structure, constitution template, and test infrastructure.

## Files to Create

- `plugins/codex/scripts/lib/harness/` — directory for harness library modules
- `.codex-harness/constitution.yaml` — template constitution with Standard mode defaults
- `tests/harness/` — directory for harness unit tests

## Steps

1. Create `plugins/codex/scripts/lib/harness/` directory
2. Create `.codex-harness/constitution.yaml` with the full schema from architecture.md Section 5 (version, mode, budget, risk_rules, permissions, sanitize, audit)
3. Create `tests/harness/` directory for test files
4. Verify the test runner (`node --test`) can discover test files in the new directory

## Verification

```bash
test -d plugins/codex/scripts/lib/harness && echo "harness dir exists"
test -f .codex-harness/constitution.yaml && echo "constitution exists"
node --test tests/harness/ 2>&1 | head -5  # should run with 0 tests
```

## Commit Boundary

Single commit: "chore: scaffold harness directory and constitution template"
