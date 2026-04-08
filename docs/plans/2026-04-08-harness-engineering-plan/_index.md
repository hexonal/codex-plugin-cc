# Harness Engineering Implementation Plan

**Date**: 2026-04-08
**Design**: [../2026-04-08-harness-engineering-design/](./../2026-04-08-harness-engineering-design/)

## Goal

Implement a Harness Engineering architecture for codex-plugin-cc using Claude Code's native hook system. 10-step Standard mode pipeline with YAML constitution governance, JSONL audit trail, trace ID propagation, and token budget management — all backward compatible with existing plugin functionality.

## Constraints

- Zero npm runtime dependencies (hand-rolled YAML parser)
- All existing tests must continue to pass
- No modifications to existing `scripts/lib/` modules
- Constitution absence = complete no-op (backward compatibility guarantee)
- PreToolUse hooks < 20ms, PostToolUse < 30ms

## Execution Plan

### Phase 1: Foundation
- [Task 001: Project Setup](./task-001-setup.md) — scaffold directories and constitution template

### Phase 2: Core Library Modules (parallelizable)
- [Task 002: Trace Module Test](./task-002-trace-test.md) — trace ID generation tests
- [Task 002: Trace Module Impl](./task-002-trace-impl.md) — trace ID implementation
- [Task 003: Constitution Module Test](./task-003-constitution-test.md) — YAML parser tests
- [Task 003: Constitution Module Impl](./task-003-constitution-impl.md) — YAML parser implementation
- [Task 004: Risk Classify Test](./task-004-risk-classify-test.md) — risk classification tests
- [Task 004: Risk Classify Impl](./task-004-risk-classify-impl.md) — risk classification implementation
- [Task 005: Permission Gate Test](./task-005-permission-gate-test.md) — permission enforcement tests
- [Task 005: Permission Gate Impl](./task-005-permission-gate-impl.md) — permission enforcement implementation
- [Task 006: Sanitize Test](./task-006-sanitize-test.md) — output sanitisation tests
- [Task 006: Sanitize Impl](./task-006-sanitize-impl.md) — output sanitisation implementation
- [Task 008: Budget Test](./task-008-budget-test.md) — token budget tests
- [Task 008: Budget Impl](./task-008-budget-impl.md) — token budget implementation

### Phase 3: Dependent Library Module
- [Task 007: Audit Log Test](./task-007-audit-log-test.md) — JSONL audit log tests
- [Task 007: Audit Log Impl](./task-007-audit-log-impl.md) — JSONL audit log implementation (depends on trace)

### Phase 4: Hook Entry Points (parallelizable after Phase 2-3)
- [Task 009: PreToolUse Hook Test](./task-009-pre-tool-hook-test.md) — PreToolUse hook tests
- [Task 009: PreToolUse Hook Impl](./task-009-pre-tool-hook-impl.md) — PreToolUse hook (depends on constitution, risk-classify, permission-gate, audit-log)
- [Task 010: PostToolUse Hook Test](./task-010-post-tool-hook-test.md) — PostToolUse hook tests
- [Task 010: PostToolUse Hook Impl](./task-010-post-tool-hook-impl.md) — PostToolUse hook (depends on sanitize, audit-log, budget)
- [Task 011: Session Hooks Test](./task-011-session-hooks-test.md) — session lifecycle hook tests
- [Task 011: Session Hooks Impl](./task-011-session-hooks-impl.md) — session hooks (depends on trace, constitution, audit-log, budget)
- [Task 012: Prompt Submit Hook Test](./task-012-prompt-submit-hook-test.md) — UserPromptSubmit hook tests
- [Task 012: Prompt Submit Hook Impl](./task-012-prompt-submit-hook-impl.md) — UserPromptSubmit hook (depends on constitution, budget)

### Phase 5: Integration
- [Task 013: Update hooks.json](./task-013-hooks-json-config.md) — register all harness hooks
- [Task 014: Verification Loop Test](./task-014-verification-loop-test.md) — verification loop tests
- [Task 014: Verification Loop Impl](./task-014-verification-loop-impl.md) — enhance stop-review-gate with budget/audit
- [Task 015: Backward Compatibility](./task-015-backward-compat-test.md) — integration tests

## BDD Coverage

| Feature | Scenarios | Task Coverage |
|---|---|---|
| F1: Pipeline Core | 4 | 009 (hook chain, restrictive wins, graceful degrade), 010 (async) |
| F2: Governance | 7 | 003 (constitution load, missing, mode switch, malformed, invalid), 004 (risk patterns), 005 (permissions), 008 (budget), 012 (budget block) |
| F3: Verification Loop | 5 | 014 (review gate, verdicts, retries) |
| F4: Observability | 6 | 002 (trace), 007 (audit entries, fields, pruning), 008 (token tracking, budget summary) |
| F5: Backward Compat | 4 | 015 (existing commands, mode off, coexistence) |
| F6: Risk Classification | 4 | 004 (built-in, custom, severity, override), 006 (credential sanitize) |
| F7: Error Handling | 6 | 003 (YAML errors, invalid schema, invalid regex), 007 (disk full, concurrent writes), 008 (budget corruption) |

**Total**: 7 Features, 36 Scenarios — all covered.

## Dependency Chain

```
task-001-setup
├── task-002-trace-test ──→ task-002-trace-impl ─┐
├── task-003-constitution-test → task-003-constitution-impl ─┤
├── task-004-risk-classify-test → task-004-risk-classify-impl ┤
├── task-005-permission-gate-test → task-005-permission-gate-impl
├── task-006-sanitize-test ──→ task-006-sanitize-impl ───┐
├── task-008-budget-test ──→ task-008-budget-impl ───────┤
│                                                        │
│   task-007-audit-log-test → task-007-audit-log-impl ◄──┤ (needs trace)
│                                    │                   │
│   ┌────────────────────────────────┼───────────────────┘
│   │                                │
├── task-009-pre-tool-hook-test      │
│   └→ task-009-pre-tool-hook-impl ◄─┤ (needs constitution, risk, permission, audit)
├── task-010-post-tool-hook-test     │
│   └→ task-010-post-tool-hook-impl ◄┤ (needs sanitize, audit, budget)
├── task-011-session-hooks-test      │
│   └→ task-011-session-hooks-impl ◄─┤ (needs trace, constitution, audit, budget)
├── task-012-prompt-submit-hook-test │
│   └→ task-012-prompt-submit-hook-impl ◄ (needs constitution, budget)
│                                    │
├── task-013-hooks-json-config ◄─────┘ (needs all hook impls)
├── task-014-verification-loop-test → task-014-verification-loop-impl (needs audit, budget)
└── task-015-backward-compat-test ◄── (needs hooks.json)
```

**Maximum parallelism**: After task-001, tasks 002-006 and 008 can all run in parallel (6 independent streams). Tasks 009-012 tests can also run in parallel. This enables significant speedup with agent teams.
