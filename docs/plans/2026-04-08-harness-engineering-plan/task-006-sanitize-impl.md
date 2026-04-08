# Task 006: Sanitize Module — Implementation (Green)

**type**: impl
**depends-on**: task-006-sanitize-test

## Goal

Implement `scripts/lib/harness/sanitize.mjs` to make all sanitize tests pass.

## Files to Create

- `plugins/codex/scripts/lib/harness/sanitize.mjs`

## What to Implement

1. `sanitizeOutput(rawOutput, config)` — returns `{ modified, output, redactions }`
2. Built-in patterns (always active):
   - AWS access key: `/AKIA[0-9A-Z]{16}/`
   - Generic API key/secret: `/(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[\w\-]{8,}/gi`
   - PEM private key: `/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END/`
3. Constitution patterns from `config.patterns[]` (each has `name`, `pattern`, `replacement`)
4. Replace matched content with `[REDACTED:<rule-name>]`
5. Collect all redaction rule names in `redactions` array
6. Set `modified: true` if any replacements were made

## Verification

```bash
node --test tests/harness/sanitize.test.mjs
# All tests should PASS
```
