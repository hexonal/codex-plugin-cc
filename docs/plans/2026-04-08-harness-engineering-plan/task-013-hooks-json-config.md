# Task 013: Update hooks.json Configuration

**type**: config
**depends-on**: task-009-pre-tool-hook-impl, task-010-post-tool-hook-impl, task-011-session-hooks-impl, task-012-prompt-submit-hook-impl

## Goal

Update `plugins/codex/hooks/hooks.json` to register all new harness hook entry points.

## Files to Modify

- `plugins/codex/hooks/hooks.json`

## Steps

1. Add `harness-session-start-hook.mjs` as second command in `SessionStart` array (after existing lifecycle hook)
2. Add `harness-session-end-hook.mjs` as first command in `SessionEnd` array (before existing lifecycle hook — audit flush before broker teardown)
3. Add new `UserPromptSubmit` section with `harness-prompt-submit-hook.mjs` (timeout: 5)
4. Add new `PreToolUse` section with `harness-pre-tool-hook.mjs` (timeout: 5)
5. Add new `PostToolUse` section with `harness-post-tool-hook.mjs` (timeout: 10)
6. Preserve existing `Stop` section unchanged

## Verification

```bash
node -e "const h = JSON.parse(require('fs').readFileSync('plugins/codex/hooks/hooks.json','utf8')); console.log(Object.keys(h.hooks).sort())"
# Should output: PreToolUse, PostToolUse, SessionEnd, SessionStart, Stop, UserPromptSubmit
```

## Commit Boundary

Single commit: "feat: register harness hooks in hooks.json"
