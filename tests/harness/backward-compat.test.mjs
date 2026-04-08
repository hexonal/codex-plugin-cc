import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CODEX_HOOKS_PATH = path.resolve(import.meta.dirname, '../../plugins/codex/hooks/hooks.json');
const HARNESS_HOOKS_PATH = path.resolve(import.meta.dirname, '../../plugins/harness-engineering/hooks/hooks.json');

describe('backward-compat / codex plugin hooks.json (original)', () => {
  const hooks = JSON.parse(fs.readFileSync(CODEX_HOOKS_PATH, 'utf8'));

  it('contains only original 3 hook events', () => {
    const events = Object.keys(hooks.hooks).sort();
    assert.deepStrictEqual(events, ['SessionEnd', 'SessionStart', 'Stop']);
  });

  it('contains SessionStart lifecycle hook', () => {
    const cmds = hooks.hooks.SessionStart[0].hooks.map(h => h.command);
    assert.ok(cmds.some(c => c.includes('session-lifecycle-hook.mjs')));
  });

  it('contains SessionEnd lifecycle hook', () => {
    const cmds = hooks.hooks.SessionEnd[0].hooks.map(h => h.command);
    assert.ok(cmds.some(c => c.includes('session-lifecycle-hook.mjs')));
  });

  it('contains Stop review gate hook', () => {
    const cmds = hooks.hooks.Stop[0].hooks.map(h => h.command);
    assert.ok(cmds.some(c => c.includes('stop-review-gate-hook.mjs')));
  });

  it('does NOT contain harness hooks (PreToolUse, PostToolUse, UserPromptSubmit)', () => {
    assert.ok(!hooks.hooks.PreToolUse, 'PreToolUse should not be in codex plugin');
    assert.ok(!hooks.hooks.PostToolUse, 'PostToolUse should not be in codex plugin');
    assert.ok(!hooks.hooks.UserPromptSubmit, 'UserPromptSubmit should not be in codex plugin');
  });
});

describe('backward-compat / harness-engineering plugin', () => {
  const hooks = JSON.parse(fs.readFileSync(HARNESS_HOOKS_PATH, 'utf8'));

  it('has harness hook events', () => {
    const events = Object.keys(hooks.hooks).sort();
    assert.deepStrictEqual(events, [
      'PostToolUse', 'PreToolUse', 'SessionEnd', 'SessionStart', 'UserPromptSubmit'
    ]);
  });

  it('all harness hook scripts exist', () => {
    const scriptsDir = path.resolve(import.meta.dirname, '../../plugins/harness-engineering/scripts');
    const harnessScripts = [
      'harness-session-start-hook.mjs',
      'harness-session-end-hook.mjs',
      'harness-pre-tool-hook.mjs',
      'harness-post-tool-hook.mjs',
      'harness-prompt-submit-hook.mjs',
    ];
    for (const script of harnessScripts) {
      assert.ok(fs.existsSync(path.join(scriptsDir, script)), `${script} should exist`);
    }
  });

  it('all harness library modules exist', () => {
    const libDir = path.resolve(import.meta.dirname, '../../plugins/harness-engineering/scripts/lib/harness');
    const modules = [
      'trace.mjs', 'constitution.mjs', 'risk-classify.mjs',
      'permission-gate.mjs', 'sanitize.mjs', 'audit-log.mjs', 'budget.mjs',
    ];
    for (const mod of modules) {
      assert.ok(fs.existsSync(path.join(libDir, mod)), `${mod} should exist`);
    }
  });
});
