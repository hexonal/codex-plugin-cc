# Harness Engineering Architecture Design for codex-plugin-cc

**Date**: 2026-04-08
**Status**: Design
**Author**: Claude Opus 4.6

## Context

The codex-plugin-cc project is a Claude Code plugin that wraps OpenAI's Codex CLI for code review and task delegation. The current architecture is a Node.js plugin with commands, hooks, skills, and agents — functioning as a pipeline-style call chain without governance, verification loops, or observability.

Harness Engineering is the 2026 discipline of designing the systems, constraints, and feedback loops that wrap around AI agents to make them reliable in production. This design refactors the plugin into a Harness Engineering architecture using Claude Code's native hook system.

## Requirements

### Functional Requirements

1. **Pipeline Core**: 10-step Standard mode middleware chain using Claude Code hooks.json native capabilities
2. **Governance**: YAML constitution at `.codex-harness/constitution.yaml` defining risk patterns, token budgets, and permission profiles
3. **Verification Loop**: Enhanced Stop hook with review verdict enforcement (approve/needs-attention → exit code)
4. **Observability**: JSONL audit trail with trace ID propagation, token budget tracking, per-hook timing
5. **Backward Compatibility**: All existing commands (`/codex:review`, `/codex:rescue`, etc.) work unchanged; no constitution file = complete no-op
6. **Risk Classification**: Pattern-based risk detection for tool calls with configurable severity levels (critical/high/medium/low) and graduated responses (block/warn/allow)
7. **Error Resilience**: Malformed constitution, I/O failures, corrupted state all handled gracefully without blocking user sessions

### Non-Functional Requirements

1. **Performance**: PreToolUse hooks < 20ms, PostToolUse < 30ms (well within 5s timeout)
2. **Zero Dependencies**: No new npm runtime dependencies; hand-rolled YAML subset parser
3. **Security**: Risk classification is advisory (best-effort safeguards), not a security sandbox
4. **Graceful Degradation**: Hook failures default to "allow" — harness crash never blocks the user

## Rationale

### Why Hooks-first?

Claude Code's hook system natively supports the harness pipeline pattern:
- 28 event types with blocking capability (exit code 2)
- PreToolUse/PostToolUse can modify inputs/outputs
- Multiple hooks run in parallel, most restrictive decision wins
- Async hooks for non-blocking audit logging
- This eliminates the need for a custom JS middleware chain

### Why Standard Mode (10 steps)?

- Core (6 steps) lacks risk classifier and pre-execution hooks
- Enhanced (14 steps) requires swarm orchestration not justified by single codex-rescue agent
- Standard balances governance strength with complexity
- YAML constitution allows mode switching (core/standard/off)

### Why Not Modify Existing Modules?

The existing `codex-companion.mjs` dispatcher and 13 `lib/` modules are stable and tested. Inserting harness logic at the hooks layer means zero changes to the execution path for repositories without a constitution.

## Detailed Design

### 10-Step Standard Pipeline Mapping

| Step | Stage | Hook Event | Script |
|---|---|---|---|
| 1 | Session init | `SessionStart` | existing + `harness-session-start-hook.mjs` |
| 2 | Input validation | `UserPromptSubmit` | `harness-prompt-submit-hook.mjs` |
| 3 | Risk classification | `PreToolUse` | `harness-pre-tool-hook.mjs` → `risk-classify.mjs` |
| 4 | Permission gating | `PreToolUse` | same hook → `permission-gate.mjs` |
| 5 | Tool execution | (native) | unchanged |
| 6 | Output sanitisation | `PostToolUse` | `harness-post-tool-hook.mjs` → `sanitize.mjs` |
| 7 | Async audit log | `PostToolUse` | same hook → `audit-log.mjs` |
| 8 | Verification loop | `Stop` | existing `stop-review-gate-hook.mjs` (enhanced) |
| 9 | Budget enforcement | `Stop` | same hook → `budget.mjs` |
| 10 | Session teardown | `SessionEnd` | `harness-session-end-hook.mjs` + existing |

### New File Summary

**5 hook entry points** (scripts/):
- `harness-session-start-hook.mjs` — trace ID, constitution load, audit start
- `harness-session-end-hook.mjs` — audit flush, budget summary
- `harness-prompt-submit-hook.mjs` — budget headroom check
- `harness-pre-tool-hook.mjs` — risk classify → permission gate → audit
- `harness-post-tool-hook.mjs` — sanitize → audit → budget increment

**7 library modules** (scripts/lib/harness/):
- `constitution.mjs` — YAML constitution parser and validator
- `risk-classify.mjs` — Pattern-based risk classification
- `permission-gate.mjs` — Permission profile enforcement
- `sanitize.mjs` — Output credential/PII sanitisation
- `audit-log.mjs` — JSONL audit append
- `trace.mjs` — Trace ID generation and propagation
- `budget.mjs` — Token/call budget tracking

**1 config template**:
- `.codex-harness/constitution.yaml`

**2 files modified**:
- `hooks/hooks.json` — add UserPromptSubmit, PreToolUse, PostToolUse; extend SessionStart/End
- `stop-review-gate-hook.mjs` — add budget summary note (2 lines)

**0 existing lib/ modules changed**.

## Design Documents

- [BDD Specifications](./bdd-specs.md) - Behavior scenarios and testing strategy
- [Architecture](./architecture.md) - System architecture and component details
- [Best Practices](./best-practices.md) - Security, performance, and code quality guidelines
