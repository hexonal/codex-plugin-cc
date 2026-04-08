# Task 010: PostToolUse Hook Entry Point — Implementation (Green)

**type**: impl
**depends-on**: task-010-post-tool-hook-test, task-006-sanitize-impl, task-007-audit-log-impl, task-008-budget-impl

## Goal

Implement `scripts/harness-post-tool-hook.mjs` to make all PostToolUse hook tests pass.

## Files to Create

- `plugins/codex/scripts/harness-post-tool-hook.mjs`

## What to Implement

1. Read stdin as JSON
2. Load constitution — if null or mode "off", exit 0
3. Call `sanitizeOutput(toolResponse.output, constitution.sanitize)`
4. Append JSONL audit entry (post_tool_use)
5. Call `recordToolCall(workspaceRoot, sessionId, toolName)` for budget tracking
6. If sanitizer modified output → write `{"hookSpecificOutput":{"permittedOutput":"<sanitized>"}}` to stdout
7. Otherwise → exit 0 with no stdout
8. Wrap in try/catch — errors to stderr, exit 0

## Verification

```bash
node --test tests/harness/post-tool-hook.test.mjs
# All tests should PASS
```
