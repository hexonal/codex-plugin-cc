# Harness Engineering Architecture

## codex-plugin-cc — 10-Step Standard Mode Pipeline

**Date**: 2026-04-08
**Status**: Design

---

## 1. Current Architecture Mapping

### 1.1 Existing Module Inventory

| File | Primary Role | Harness Layer |
|---|---|---|
| `scripts/codex-companion.mjs` | CLI dispatcher; 9 subcommands | Pipeline Core — orchestration |
| `scripts/app-server-broker.mjs` | Unix socket proxy to Codex App Server | Pipeline Core — transport |
| `scripts/session-lifecycle-hook.mjs` | SessionStart/End lifecycle | Lifecycle Management |
| `scripts/stop-review-gate-hook.mjs` | Stop hook: blocks unless review passes | Verification / Stop gate |
| `scripts/lib/app-server.mjs` | JSON-RPC client factory | Pipeline Core — transport client |
| `scripts/lib/broker-lifecycle.mjs` | Broker process spawn/teardown | Pipeline Core — transport lifecycle |
| `scripts/lib/broker-endpoint.mjs` | Unix socket/named pipe path resolution | Pipeline Core — transport |
| `scripts/lib/codex.mjs` | High-level Codex operations: turn, review | Pipeline Core — execution engine |
| `scripts/lib/state.mjs` | state.json + per-job JSON persistence | Observability — state storage |
| `scripts/lib/tracked-jobs.mjs` | Job lifecycle tracking, log management | Observability — job telemetry |
| `scripts/lib/job-control.mjs` | Job snapshot, enrichment, phase inference | Observability — reporting |
| `scripts/lib/workspace.mjs` | Workspace root resolution (git/cwd) | Pipeline Core — workspace |
| `scripts/lib/git.mjs` | Git ops: branch, diff, review context | Verification — context |
| `scripts/lib/render.mjs` | Markdown rendering for outputs | Observability — formatting |
| `scripts/lib/prompts.mjs` | Prompt template loading/interpolation | Pipeline Core — prompts |
| `scripts/lib/process.mjs` | spawnSync, binary checks, process kill | Pipeline Core — process utils |
| `scripts/lib/args.mjs` | Argument parsing (zero deps) | Pipeline Core — input parsing |
| `scripts/lib/fs.mjs` | File utilities: JSON I/O, stdin read | Pipeline Core — I/O utils |

### 1.2 Existing Hook Events

| Hook Event | Handler | Behaviour |
|---|---|---|
| `SessionStart` | `session-lifecycle-hook.mjs` | Injects `CODEX_COMPANION_SESSION_ID` + `CLAUDE_PLUGIN_DATA` into env |
| `SessionEnd` | `session-lifecycle-hook.mjs` | Shuts down broker, kills orphan jobs, removes broker state |
| `Stop` | `stop-review-gate-hook.mjs` | Optional blocking gate via Codex adversarial review |

No `PreToolUse`, `PostToolUse`, or `UserPromptSubmit` hooks currently registered.

### 1.3 Key Constraints

1. State directory: `$CLAUDE_PLUGIN_DATA/state/<slug>-<sha256>/` — all new state must follow this convention
2. No YAML parsing exists today — constitution introduces a new parser need
3. Hook scripts read stdin as JSON via `fs.readFileSync(0, "utf8")`
4. Hook decisions emit JSON to stdout; exit code 2 = block
5. Session ID flows through `CODEX_COMPANION_SESSION_ID` env var
6. PreToolUse hooks must complete in < 5s (synchronous on main thread)
7. Project has zero npm runtime dependencies — keep it that way

---

## 2. Architecture Decision

### Layered Hook Interception with Declarative Constitution

The harness wraps the existing execution layer without modifying it. A `.codex-harness/constitution.yaml` at workspace root provides declarative policy. New scripts under `scripts/lib/harness/` implement atomic harness operations. New hook entries in `hooks.json` intercept tool use events via Claude Code's native hook model.

**Constitution absence = complete no-op.** Every new hook script exits 0 immediately when no constitution is found.

### The 10-Step Standard Pipeline

| Step | Stage | Hook Event | Script |
|---|---|---|---|
| 1 | Session init | `SessionStart` | existing + `harness-session-start-hook.mjs` |
| 2 | Input validation | `UserPromptSubmit` | `harness-prompt-submit-hook.mjs` → `budget.mjs` |
| 3 | Risk classification | `PreToolUse` | `harness-pre-tool-hook.mjs` → `risk-classify.mjs` |
| 4 | Permission gating | `PreToolUse` | same hook → `permission-gate.mjs` |
| 5 | Tool execution | (native) | unchanged |
| 6 | Output sanitisation | `PostToolUse` | `harness-post-tool-hook.mjs` → `sanitize.mjs` |
| 7 | Async audit log | `PostToolUse` | same hook → `audit-log.mjs` |
| 8 | Verification loop | `Stop` | existing `stop-review-gate-hook.mjs` (enhanced) |
| 9 | Budget enforcement | `Stop` | same hook → `budget.mjs` |
| 10 | Session teardown | `SessionEnd` | `harness-session-end-hook.mjs` + existing |

---

## 3. New hooks.json Design

```json
{
  "description": "Codex Companion with Harness Engineering pipeline.",
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs\" SessionStart",
            "timeout": 5
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/harness-session-start-hook.mjs\"",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/harness-session-end-hook.mjs\"",
            "timeout": 10
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs\" SessionEnd",
            "timeout": 5
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/harness-prompt-submit-hook.mjs\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/harness-pre-tool-hook.mjs\"",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/harness-post-tool-hook.mjs\"",
            "timeout": 10
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/stop-review-gate-hook.mjs\"",
            "timeout": 900
          }
        ]
      }
    ]
  }
}
```

**Ordering rationale:**
- `SessionStart`: existing lifecycle hook runs first (sets session ID), then harness hook reads it
- `SessionEnd`: harness flush runs first (audit log), then lifecycle hook tears down broker
- `Stop`: single entry — budget check added internally to existing script

### Hook Input/Output Contract

**PreToolUse** stdin:
```json
{
  "session_id": "...",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf ..." }
}
```

Block response (stdout): `{ "decision": "block", "reason": "..." }`
Allow: exit 0 with no stdout.

**PostToolUse** stdin includes `tool_response`. Sanitised output: `{ "hookSpecificOutput": { "permittedOutput": "..." } }`

---

## 4. New Script Modules

### 4.1 Hook Entry Points (scripts/)

| Script | Responsibility |
|---|---|
| `harness-session-start-hook.mjs` | Generate trace ID, load constitution, init budget, audit `session_start` |
| `harness-session-end-hook.mjs` | Audit `session_end` with budget summary, flush |
| `harness-prompt-submit-hook.mjs` | Check token budget headroom; block if exhausted |
| `harness-pre-tool-hook.mjs` | Risk classify → permission gate → audit `pre_tool_use` |
| `harness-post-tool-hook.mjs` | Sanitize output → audit `post_tool_use` → budget increment |

### 4.2 Library Modules (scripts/lib/harness/)

#### `constitution.mjs`
- Load, parse, validate `.codex-harness/constitution.yaml`
- Returns `null` if file missing (backward compat no-op)
- Hand-rolled YAML subset parser (~100 lines); schema is flat scalars + arrays + nested maps
- Exports: `loadConstitution()`, `getRiskRules()`, `getPermissionProfile()`, `getBudgetLimits()`

#### `risk-classify.mjs`
- Pure function: `classifyToolRisk(toolName, toolInput, rules) → { level, matchedRule, detail }`
- Extracts relevant string from toolInput based on toolName
- Tests against rules ordered by severity (critical → low)
- No I/O — fully unit-testable

#### `permission-gate.mjs`
- Pure function: `checkPermission(riskResult, profile, toolName) → { allow, reason }`
- Checks `blockOn`, `requireApprovalOn`, `alwaysAllow`, `alwaysBlock` from constitution

#### `sanitize.mjs`
- `sanitizeOutput(rawOutput, config) → { modified, output, redactions }`
- Built-in patterns: AWS keys, API keys, PEM blocks
- Constitution-defined additional patterns
- Replaces with `[REDACTED:<rule-name>]`

#### `audit-log.mjs`
- `appendAuditEntry(logFile, entry)` — synchronous JSONL append
- Schema: `{ ts, traceId, sessionId, event, toolName, riskLevel, decision, detail, durationMs }`
- Storage: `<stateDir>/audit-<sessionId>.jsonl`

#### `trace.mjs`
- `generateTraceId()` → `"hrns-" + crypto.randomBytes(8).toString('hex')`
- `getTraceId()` — reads `CODEX_HARNESS_TRACE_ID` from env
- `propagateTraceId(traceId)` — appends to `CLAUDE_ENV_FILE`

#### `budget.mjs`
- `initBudget()`, `recordToolCall()`, `checkPromptBudget()`, `getBudgetUsage()`
- Persists in `<stateDir>/budget-<sessionId>.json`
- Token estimation: `Math.ceil(prompt.length / 4)`

---

## 5. YAML Constitution Schema

```yaml
version: 1

mode: standard  # standard | audit-only | off

budget:
  max_tool_calls: 500
  max_prompt_tokens: 100000
  max_concurrent_jobs: 3

risk_rules:
  - name: no-destructive-rm
    pattern: "rm\\s+-rf?\\s+/"
    severity: critical
    applies_to: [Bash]
  - name: credential-env-write
    pattern: "(?:AWS_SECRET|OPENAI_API_KEY|GITHUB_TOKEN)\\s*="
    severity: high
    applies_to: [Bash, Write, Edit]
  - name: network-exfil
    pattern: "curl.*\\|\\s*bash|wget.*\\|\\s*sh"
    severity: high
    applies_to: [Bash]
  - name: sudo-escalation
    pattern: "\\bsudo\\b"
    severity: medium
    applies_to: [Bash]

permissions:
  blockOn: [critical]
  requireApprovalOn: [high]
  alwaysAllow: [Read, Glob, Grep, LS]
  alwaysBlock: []

sanitize:
  enabled: true
  patterns:
    - name: internal-endpoint
      pattern: "https://internal\\.corp\\.example\\.com"
      replacement: "[REDACTED:internal-endpoint]"

audit:
  enabled: true
  retain_sessions: 10
```

---

## 6. State Directory Layout

```
$CLAUDE_PLUGIN_DATA/state/<slug>-<hash>/
  state.json                     ← existing
  broker.json                    ← existing
  jobs/
    task-<id>.json               ← existing
    task-<id>.log                ← existing
  audit-<sessionId>.jsonl        ← NEW
  budget-<sessionId>.json        ← NEW
```

---

## 7. Error Handling Contract

All harness hook scripts:
- Top-level `try/catch`
- On error: write to stderr, exit 0 (never block user session on harness crash)
- PreToolUse may emit block decision but never exits non-zero

Pattern:
```javascript
const constitution = loadConstitution(workspaceRoot);
if (!constitution || constitution.mode === 'off') {
  process.exit(0);
}
```

---

## 8. Performance Targets

| Hook | Target | Notes |
|---|---|---|
| SessionStart harness | < 50ms | File stat + YAML parse + crypto + appendFileSync |
| UserPromptSubmit | < 20ms | Token estimate + budget read |
| PreToolUse | < 20ms | Regex match + appendFileSync |
| PostToolUse | < 30ms | Regex scan (up to 64KB) + appendFileSync |
| SessionEnd harness | < 50ms | appendFileSync + JSON write |

---

## 9. File Change Summary

### Files to Create (14)

| Path | Description |
|---|---|
| `scripts/harness-session-start-hook.mjs` | SessionStart: trace, constitution, audit |
| `scripts/harness-session-end-hook.mjs` | SessionEnd: audit flush, budget summary |
| `scripts/harness-prompt-submit-hook.mjs` | UserPromptSubmit: budget check |
| `scripts/harness-pre-tool-hook.mjs` | PreToolUse: risk + permission + audit |
| `scripts/harness-post-tool-hook.mjs` | PostToolUse: sanitize + audit + budget |
| `scripts/lib/harness/constitution.mjs` | YAML constitution parser |
| `scripts/lib/harness/risk-classify.mjs` | Risk classification engine |
| `scripts/lib/harness/permission-gate.mjs` | Permission enforcement |
| `scripts/lib/harness/sanitize.mjs` | Output sanitisation |
| `scripts/lib/harness/audit-log.mjs` | JSONL audit append |
| `scripts/lib/harness/trace.mjs` | Trace ID generation |
| `scripts/lib/harness/budget.mjs` | Budget tracking |
| `.codex-harness/constitution.yaml` | Template constitution |
| `tests/harness-*.test.mjs` | Unit + integration tests |

### Files to Modify (2)

| Path | Change |
|---|---|
| `hooks/hooks.json` | Add UserPromptSubmit, PreToolUse, PostToolUse; extend SessionStart/End |
| `scripts/stop-review-gate-hook.mjs` | Add 2-line budget summary note |
