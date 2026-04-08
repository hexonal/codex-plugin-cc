# BDD Specifications: Harness Engineering for codex-plugin-cc

**Date**: 2026-04-08

---

## Feature 1: Pipeline Core - Middleware Chain via Hooks

```gherkin
Feature: Pipeline Core - Middleware Chain via Hooks
  The harness pipeline executes a chain of hooks defined in hooks.json
  for each lifecycle event. Hooks produce decisions (allow/warn/block).

  Scenario: Hook chain executes in correct order for PreToolUse
    Given a hooks.json with PreToolUse hooks: "risk-classifier" and "permission-gate"
    And a tool invocation event for "Bash" with command "ls -la"
    When the PreToolUse hook chain fires
    Then "risk-classifier" executes and classifies the risk level
    And "permission-gate" checks the risk level against the constitution
    And each hook receives the event payload on stdin as JSON

  Scenario: Most restrictive hook decision wins when multiple hooks fire
    Given a hooks.json with two PreToolUse hooks
    And the first hook returns decision "allow"
    And the second hook returns decision "block" with reason "prohibited pattern"
    When the PreToolUse hook chain fires
    Then the final decision is "block"
    And the block reason includes "prohibited pattern"

  Scenario: Async hooks do not block main execution
    Given a hooks.json with an async PostToolUse hook "audit-logger"
    And a synchronous PostToolUse hook "sanitizer"
    When the PostToolUse hook chain fires
    Then "sanitizer" completes and returns its decision immediately
    And "audit-logger" runs in the background without blocking the next turn

  Scenario: Hook failure gracefully degrades without blocking
    Given a hooks.json with PreToolUse hook "risk-classifier"
    And the "risk-classifier" script crashes with exit code 1
    When the PreToolUse hook chain fires
    Then an error is logged to stderr
    And the final decision defaults to "allow"
    And a warning is emitted indicating degraded governance
```

---

## Feature 2: Governance - YAML Constitution

```gherkin
Feature: Governance - YAML Constitution
  A constitution.yaml defines risk patterns, token budgets,
  permission profiles, and pipeline mode.

  Scenario: Constitution loaded on SessionStart
    Given a file ".codex-harness/constitution.yaml" exists with mode "standard"
    When the SessionStart hook fires
    Then the constitution is parsed and validated
    And the governance context is initialized
    And a JSONL audit entry records "constitution_loaded"

  Scenario: Risk pattern matches block dangerous commands
    Given the constitution defines pattern "rm\s+-rf" with severity "critical"
    And a PreToolUse event fires for Bash with command "rm -rf /"
    When the risk-classifier evaluates the command
    Then the risk level is "critical"
    And the hook returns decision "block"

  Scenario: Custom risk patterns from constitution are applied
    Given the constitution defines a custom pattern:
      | pattern          | severity | applies_to |
      | TRUNCATE\s+TABLE | high     | [Bash]     |
    And a PreToolUse event fires for Bash with command "TRUNCATE TABLE users"
    When the risk-classifier evaluates the command
    Then the command matches the custom pattern
    And the hook returns decision "block"

  Scenario: Token budget exceeded triggers warning then block
    Given the constitution defines max_prompt_tokens: 10000
    And the current session has consumed 8500 tokens
    When a UserPromptSubmit hook fires
    Then a warning is emitted: "Token usage approaching limit"
    And the decision is "allow"
    When the session token count reaches 10100
    And a UserPromptSubmit hook fires
    Then the decision is "block" with reason "token budget exceeded"

  Scenario: Permission profile restricts tool access per command type
    Given the constitution defines alwaysAllow: [Read, Glob, Grep, LS]
    And the constitution defines blockOn: [critical]
    When a PreToolUse event fires for "Read" tool
    Then the permission gate returns "allow" immediately (bypass risk check)
    When a PreToolUse event fires for "Bash" with critical risk
    Then the permission gate returns "block"

  Scenario: Constitution mode switch changes active pipeline steps
    Given a constitution with mode "audit-only"
    When the PreToolUse hook fires for a critical-risk command
    Then the risk is classified and logged
    But the decision is "allow" (audit-only mode never blocks)

  Scenario: Missing constitution file uses sensible defaults
    Given no ".codex-harness/constitution.yaml" file exists
    When any harness hook fires
    Then the hook exits 0 immediately with no output
    And no JSONL audit entries are produced
    And the existing plugin behavior is completely unchanged
```

---

## Feature 3: Verification Loop

```gherkin
Feature: Verification Loop
  The Stop hook runs a verification gate checking review verdict.

  Scenario: Stop hook runs enhanced review gate
    Given the constitution has mode "standard" with verification enabled
    And the Stop hook is configured with stop-review-gate-hook.mjs
    When the assistant signals task completion
    Then the Stop hook fires
    And a review of the working tree diff is performed

  Scenario: Review verdict "needs-attention" blocks completion
    Given the Stop hook review gate has executed
    And the review verdict is "needs-attention" with findings
    When the review gate produces its result
    Then the hook exits with code 2 (block)
    And the findings are returned as structured JSON
    And the assistant is instructed to address findings

  Scenario: Review verdict "approve" passes
    Given the Stop hook review gate has executed
    And the review verdict is "approve"
    When the review gate produces its result
    Then the hook exits with code 0
    And a JSONL audit entry records "verification_passed"

  Scenario: Verification results feed back as context
    Given the Stop hook returned verdict "needs-attention"
    When the assistant receives the hook output
    Then the findings are injected as context for the next turn
    And the assistant addresses the findings

  Scenario: Review gate respects max retries
    Given the constitution defines max verification retries as 3
    And the Stop hook fires for the 4th time with "needs-attention"
    When the review gate evaluates the retry count
    Then the gate forces approval with warning "max retries exceeded"
    And a JSONL audit entry records "verification_force_approved"
```

---

## Feature 4: Observability - Audit & Tracing

```gherkin
Feature: Observability - Audit and Tracing
  Every hook execution produces a JSONL audit entry with trace ID.

  Scenario: Trace ID generated at session start and propagated
    Given a new session starts
    When the harness SessionStart hook fires
    Then a unique trace ID (hrns-<hex16>) is generated
    And it is stored in CODEX_HARNESS_TRACE_ID environment variable
    And all subsequent hooks receive the same trace ID

  Scenario: Every hook execution produces JSONL audit entry
    Given a session with trace ID "hrns-abc123"
    And a PreToolUse hook executes for a Bash command
    When the hook completes
    Then a line is appended to "<stateDir>/audit-<sessionId>.jsonl"
    And the line is valid JSON

  Scenario: Audit entry contains required fields
    Given a hook execution produces an audit entry
    Then the entry contains: traceId, ts, sessionId, event, toolName, riskLevel, decision, durationMs
    And ts is ISO 8601 format
    And durationMs is a non-negative integer

  Scenario: Token usage tracked per job against budget
    Given a session with token budget 10000
    And 3 tool invocations consumed 1200, 800, and 2000 tokens
    When the budget tracker updates
    Then cumulative token count is 4000
    And a JSONL entry records token_usage with cumulative and budget

  Scenario: Audit log pruning by retention policy
    Given the constitution defines retain_sessions: 10
    And the state directory contains audit logs for 15 sessions
    When the SessionStart hook triggers audit maintenance
    Then the 5 oldest audit log files are removed
    And a JSONL entry records "audit_pruned"

  Scenario: Budget summary at session end
    Given a session consumed 45000 tokens across 120 tool calls
    When the SessionEnd harness hook fires
    Then a JSONL entry records "session_end" with:
      | field        | value |
      | totalTokens  | 45000 |
      | totalCalls   | 120   |
      | budgetUsedPct | 45   |
```

---

## Feature 5: Backward Compatibility

```gherkin
Feature: Backward Compatibility
  Existing commands and hooks work unchanged with harness enabled.

  Scenario: Existing /codex:review works with harness enabled
    Given the harness is enabled with mode "standard"
    When the user runs "/codex:review"
    Then the review command delegates to codex-companion.mjs as before
    And harness PreToolUse hooks fire for tool invocations during review
    And the final review output format is identical to pre-harness

  Scenario: Existing /codex:rescue works with harness enabled
    Given the harness is enabled with mode "standard"
    When the user runs "/codex:rescue fix the crash"
    Then the rescue command delegates to codex-companion.mjs
    And the AskUserQuestion contract is preserved

  Scenario: Harness fully disabled via constitution mode off
    Given a constitution.yaml with mode "off"
    When the SessionStart hook fires
    Then all harness hooks exit immediately (no-op)
    And original SessionStart, SessionEnd, Stop hooks still fire
    And no JSONL audit entries are produced by harness

  Scenario: Existing lifecycle hooks coexist with harness hooks
    Given the original hooks.json defines SessionStart and SessionEnd hooks
    And the harness adds additional hooks for governance initialization
    When the SessionStart event fires
    Then the original session-lifecycle-hook.mjs executes first
    And the harness governance hook executes after
    And both complete without interference
```

---

## Feature 6: Risk Classification

```gherkin
Feature: Risk Classification
  Commands are classified by risk level using pattern matching.

  Scenario: Built-in patterns detect file deletion commands
    Given the risk classifier with built-in patterns
    When a PreToolUse event fires for Bash with "rm -rf /home/user/project"
    Then the classifier matches pattern "rm\s+-rf?"
    And the risk level is "critical"
    And the decision is "block"

  Scenario: Built-in patterns detect credential exposure in output
    Given the risk classifier with built-in patterns
    And a PostToolUse event with output containing "AWS_SECRET_ACCESS_KEY=AKIA..."
    When the output sanitizer evaluates the result
    Then the classifier matches the AWS key pattern
    And the output is redacted as "[REDACTED:aws-key]"
    And a warning is emitted

  Scenario: Risk level determines action by severity
    Given the constitution defines blockOn: [critical] and requireApprovalOn: [high]
    When a command is classified as "low" risk
    Then the decision is "allow"
    When a command is classified as "medium" risk
    Then the decision is "allow" with warning
    When a command is classified as "high" risk
    Then the decision is "block" with reason "requires approval"
    When a command is classified as "critical" risk
    Then the decision is "block" with reason "blocked by policy"

  Scenario: Custom patterns from constitution override defaults
    Given the constitution overrides "rm -rf" to severity "medium" action "warn"
    And the built-in default for "rm -rf" is severity "critical" action "block"
    When a PreToolUse event fires for Bash with "rm -rf ./temp"
    Then the custom pattern takes precedence
    And the risk level is "medium"
    And the decision is "warn" (not "block")
```

---

## Feature 7: Error Handling and Edge Cases

```gherkin
Feature: Error Handling and Edge Cases
  The harness handles malformed input, I/O failures, and corrupted state gracefully.

  Scenario: Malformed constitution YAML is rejected with clear error
    Given a ".codex-harness/constitution.yaml" with invalid YAML syntax
    When the SessionStart hook attempts to load the constitution
    Then a parse error is logged to stderr with line number
    And the harness falls back to no-op mode (all hooks exit 0)
    And a warning is emitted: "constitution parse error, harness disabled"

  Scenario: Invalid constitution schema uses defaults for bad fields
    Given a constitution with mode "unknown_mode" and max_tool_calls "not_a_number"
    When the SessionStart hook validates the constitution
    Then mode defaults to "off" (safest fallback)
    And max_tool_calls defaults to 0 (unlimited)
    And warnings are logged for each invalid field

  Scenario: Disk full during audit log write does not crash
    Given the filesystem has no free space
    When the harness-post-tool-hook attempts to append a JSONL entry
    Then the appendFileSync throws an error
    And the error is caught and logged to stderr
    And the hook exits 0 (does not block the tool execution)

  Scenario: Budget state file corrupted mid-session
    Given the budget-<sessionId>.json file contains invalid JSON
    When the harness-prompt-submit-hook reads budget state
    Then the error is caught
    And budget state is re-initialized to zero counters
    And a warning is logged: "budget state reset due to corruption"
    And the hook continues with the fresh budget state

  Scenario: Concurrent hooks writing to same audit file
    Given two PostToolUse hooks fire nearly simultaneously
    When both attempt to append to the same audit JSONL file
    Then both entries are written (appendFileSync is atomic for small writes)
    And no entries are lost or corrupted

  Scenario: Risk pattern with invalid regex is skipped
    Given the constitution defines a risk rule with pattern "[invalid("
    When the constitution parser validates risk rules
    Then the invalid rule is skipped with a warning to stderr
    And all other valid rules are loaded normally
```
