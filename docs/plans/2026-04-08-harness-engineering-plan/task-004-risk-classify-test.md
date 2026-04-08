# Task 004: Risk Classify Module — Tests (Red)

**type**: test
**depends-on**: task-001-setup

## BDD Scenarios

```gherkin
Scenario: Built-in patterns detect file deletion commands
  Given the risk classifier with built-in patterns
  When a PreToolUse event fires for Bash with "rm -rf /home/user/project"
  Then the classifier matches pattern "rm\s+-rf?"
  And the risk level is "critical"
  And the decision is "block"

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

Scenario: Custom patterns from constitution override defaults
  Given the constitution overrides "rm -rf" to severity "medium" action "warn"
  And the built-in default for "rm -rf" is severity "critical" action "block"
  When a PreToolUse event fires for Bash with "rm -rf ./temp"
  Then the custom pattern takes precedence
  And the risk level is "medium"
```

## Goal

Write failing tests for `scripts/lib/harness/risk-classify.mjs`.

## Files to Create

- `tests/harness/risk-classify.test.mjs`

## Test Cases

1. `classifyToolRisk("Bash", {command: "rm -rf /"}, rules)` returns `{ level: "critical", matchedRule: {...} }`
2. `classifyToolRisk("Bash", {command: "ls -la"}, rules)` returns `{ level: "low", matchedRule: null }`
3. `classifyToolRisk("Bash", {command: "TRUNCATE TABLE users"}, customRules)` matches custom pattern
4. Custom rules take precedence over built-in rules for same pattern
5. `classifyToolRisk("Write", {file_path: "/etc/passwd"}, rules)` matches write-outside-workspace
6. `classifyToolRisk("Read", {file_path: "src/index.js"}, rules)` returns low (reads are safe)
7. Rules are evaluated in severity order: critical → high → medium → low; first match wins
8. Tool name filtering: rule with `applies_to: ["Bash"]` does not match `Write` tool

## Verification

```bash
node --test tests/harness/risk-classify.test.mjs
# All tests should FAIL
```
