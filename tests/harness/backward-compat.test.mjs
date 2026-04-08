import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const HOOKS_JSON_PATH = path.resolve(import.meta.dirname, '../../plugins/codex/hooks/hooks.json');

describe('backward-compat / hooks.json', () => {
  const hooks = JSON.parse(fs.readFileSync(HOOKS_JSON_PATH, 'utf8'));

  it('still contains original SessionStart lifecycle hook', () => {
    const cmds = hooks.hooks.SessionStart[0].hooks.map(h => h.command);
    assert.ok(cmds.some(c => c.includes('session-lifecycle-hook.mjs')));
  });

  it('still contains original SessionEnd lifecycle hook', () => {
    const cmds = hooks.hooks.SessionEnd[0].hooks.map(h => h.command);
    assert.ok(cmds.some(c => c.includes('session-lifecycle-hook.mjs')));
  });

  it('still contains original Stop review gate hook', () => {
    const cmds = hooks.hooks.Stop[0].hooks.map(h => h.command);
    assert.ok(cmds.some(c => c.includes('stop-review-gate-hook.mjs')));
  });

  it('has all 6 hook event types registered', () => {
    const events = Object.keys(hooks.hooks).sort();
    assert.deepStrictEqual(events, [
      'PostToolUse', 'PreToolUse', 'SessionEnd', 'SessionStart', 'Stop', 'UserPromptSubmit'
    ]);
  });

  it('SessionStart runs lifecycle hook before harness hook', () => {
    const cmds = hooks.hooks.SessionStart[0].hooks.map(h => h.command);
    const lifecycleIdx = cmds.findIndex(c => c.includes('session-lifecycle-hook.mjs'));
    const harnessIdx = cmds.findIndex(c => c.includes('harness-session-start-hook.mjs'));
    assert.ok(lifecycleIdx < harnessIdx, 'lifecycle hook should run before harness hook');
  });

  it('SessionEnd runs harness hook before lifecycle hook', () => {
    const cmds = hooks.hooks.SessionEnd[0].hooks.map(h => h.command);
    const harnessIdx = cmds.findIndex(c => c.includes('harness-session-end-hook.mjs'));
    const lifecycleIdx = cmds.findIndex(c => c.includes('session-lifecycle-hook.mjs'));
    assert.ok(harnessIdx < lifecycleIdx, 'harness hook should run before lifecycle hook');
  });
});

describe('backward-compat / harness no-op without constitution', () => {
  it('all harness hook scripts exist', () => {
    const scriptsDir = path.resolve(import.meta.dirname, '../../plugins/codex/scripts');
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
    const libDir = path.resolve(import.meta.dirname, '../../plugins/codex/scripts/lib/harness');
    const modules = [
      'trace.mjs', 'constitution.mjs', 'risk-classify.mjs',
      'permission-gate.mjs', 'sanitize.mjs', 'audit-log.mjs', 'budget.mjs',
    ];
    for (const mod of modules) {
      assert.ok(fs.existsSync(path.join(libDir, mod)), `${mod} should exist`);
    }
  });
});
