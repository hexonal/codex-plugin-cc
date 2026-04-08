# Harness Engineering Best Practices for codex-plugin-cc

**Date**: 2026-04-08  
**Status**: Research (no code changes)

---

## 1. Harness Engineering Patterns

**Best practices:**

- **Incremental constraint building.** Start with a Minimum Viable Harness (linting + 3-5 high-value rules), then add architectural constraints as failure patterns emerge. The OpenAI Codex team managed 1M lines via ~1,500 automated PRs using this approach. Do not design the perfect harness upfront.
- **Detectability before autonomy.** Instrument logging and observability first, then grant agent autonomy. Anthropic's 2026 report shows harness setup alone swings benchmarks by 5+ percentage points.
- **Engineer corrections permanently.** Every one-off fix should become a reusable constraint (lint rule, hook, or sub-agent). Schedule periodic "refactor agents" to prevent drift.

**Anti-patterns:**

- Designing a comprehensive governance system before running a single agent session. Start Core, graduate to Standard/Enhanced.
- Treating the harness as static config -- it must evolve with observed failure modes.

**For our codebase:** Start with Core mode (3-step: validate input, classify risk, log). Add the full 10-step Standard pipeline only after collecting real failure data from the Codex wrapper.

---

## 2. Claude Code Hook Security

**Best practices:**

- **Trust-gate all side effects.** CVE-2025-59536 and CVE-2026-21852 showed that hooks and settings in `.claude/settings.json` can execute arbitrary code or exfiltrate API keys before user approval. Never auto-execute project-level hooks without an explicit trust dialog.
- **Deterministic enforcement over prompt-based guardrails.** Use PreToolUse hooks for hard blocks (deny `curl`, `wget`, `.env` access). Prompt-based warnings are insufficient -- the Lasso Security approach (warn-but-don't-block) is a complement, not a replacement.
- **Sandbox execution.** Run hook scripts in containers or VMs. Never run as root. Audit hook definitions monthly.

**Anti-patterns:**

- Using `suppressOutput` on hooks -- attackers use this to hide malicious hook activity from chat history.
- Storing governance hooks in project-scoped settings only; always validate against user-scoped or org-scoped allow-lists.

**For our codebase:** Our `.mjs` hook scripts must be signed or checksum-verified. The `hooks.json` should live in a user-scoped config (not just project-scoped) with an explicit approval flow. Add a PreToolUse hook that blocks file writes to `hooks.json` itself.

---

## 3. YAML Constitution Design

**Best practices:**

- **Three-tier pipeline modes.** AutoHarness (aiming-lab) defines Core / Standard / Enhanced tiers in `constitution.yaml`. Each tier adds governance steps. This lets teams adopt incrementally without all-or-nothing commitment.
- **Declarative risk patterns.** Define tool-call risk classifications as regex patterns in YAML (e.g., `rm -rf` = critical, `git commit` = low). Microsoft's Agent Governance Toolkit and Aegis both use YAML-first policy with sub-millisecond evaluation.
- **Multi-agent profiles.** Define per-agent rules (which tools allowed, token budgets, risk thresholds) as named profiles in the constitution.

**Anti-patterns:**

- Embedding governance logic in imperative code instead of declarative config. This makes auditing and policy updates require code deployments.
- Overly granular rules that create hundreds of YAML entries. Keep rules at ~20-30 maximum; use pattern groups.

**For our codebase:** Create `constitution.yaml` with sections: `mode` (pipeline mode), `risk_rules` (array of pattern/severity objects), `permissions` (blockOn/alwaysAllow profiles), `budget` (token/call limits), and `audit` settings. Keep it under 100 lines. See architecture.md Section 5 for the canonical schema.

---

## 4. JSONL Audit Trail

**Best practices:**

- **Follow the IETF AAT draft schema.** Use fields: `timestamp` (ISO-8601 UTC), `agent_id`, `session_id`, `action`, `risk_level`, `outcome` (success/failure/blocked), `token_usage`, `hash_prev` (SHA-256 chain for tamper evidence). This aligns with EU AI Act and SOC 2 requirements.
- **Hot/cold tiering.** Keep 30 days of JSONL "hot" (searchable), compress older logs with gzip (5-10x ratio). A busy agent produces ~10-20 MB/day; 12 months fits in ~7 GB uncompressed.
- **Append-only with hash chaining.** Each record includes SHA-256 of the previous record. This provides tamper evidence without requiring external infrastructure.

**Anti-patterns:**

- Writing audit logs from the same process that executes tool calls -- a compromised agent can suppress its own logs. Use a separate logging sidecar or write-only file descriptor.
- Logging without a common schema -- makes cross-session querying painful.

**For our codebase:** Write to `<stateDir>/audit-<sessionId>.jsonl` (consistent with architecture.md). Each line: `{ts, traceId, sessionId, event, toolName, riskLevel, decision, durationMs}`. Retain by session count (configurable via `audit.retain_sessions`). Hash chaining (SHA-256 `hashPrev` field) is a v2 enhancement — not included in initial design to keep the audit module simple.

---

## 5. Risk Classification

**Best practices:**

- **Three-tier classification with pattern matching first.** Use regex patterns for the fast path (critical: `rm -rf`, `DROP TABLE`, `curl`; high: file writes outside project; medium: git operations; low: reads). Fall back to LLM-based classification only for ambiguous cases.
- **Action-type taxonomy.** Classify by effect: destructive > exfiltration > mutation > creation > read. This maps cleanly to approval requirements (auto-approve reads, require confirmation for destructive).
- **Graduated response.** Low = auto-approve + log. Medium = log + notify. High = require human confirmation. Critical = block + alert.

**Anti-patterns:**

- Using LLM-based classification for every tool call -- adds latency and cost, and the LLM can be manipulated to downgrade risk.
- Binary allow/deny without intermediate levels -- leads to either too many interruptions or too little safety.

**For our codebase:** Implement pattern-based classification in the PreToolUse hook. Define patterns in `constitution.yaml` under `risk_patterns`. The hook returns `{risk_level, matched_pattern, action}` to the pipeline. Reserve LLM classification for tool calls that match zero patterns.

---

## 6. Token Budget Management

**Best practices:**

- **Per-session and per-day budgets.** Track cumulative tokens at session level (stored in JSONL audit). Enforce daily caps per `constitution.yaml`. Use graduated responses: warn at 50%, throttle at 80%, block at 100%.
- **Tag every API call.** Attach `session_id` and `step_name` metadata to every LLM request for granular cost attribution. This enables identifying which pipeline steps consume the most tokens.
- **Optimize before restricting.** Prompt caching and model routing (use cheaper models for classification steps) can reduce costs 30-50% before any hard caps are needed.

**Anti-patterns:**

- Hard-blocking at budget limits without warning -- causes mid-task failures. Always degrade gracefully (model downgrade before block).
- Tracking only input tokens -- output tokens are often 2-5x more expensive and harder to predict.

**For our codebase:** Add `token_budgets` to `constitution.yaml`: `{session_max: 500000, daily_max: 2000000, warn_pct: 50, throttle_pct: 80}`. Track in the audit log per-step. The pipeline's step 1 (budget check) reads cumulative usage from the current session's audit entries before proceeding.

---

## Summary: Implementation Priority

| Priority | Item | Effort |
|----------|------|--------|
| P0 | `constitution.yaml` with risk patterns + budget config | 1 day |
| P0 | JSONL audit with hash chaining | 1 day |
| P1 | PreToolUse risk classification hook | 1 day |
| P1 | Token tracking in audit log | 0.5 day |
| P2 | Graduated budget enforcement | 1 day |
| P2 | Audit verification CLI | 0.5 day |
| P3 | LLM-based fallback classification | 2 days |
| P3 | Multi-agent profiles | 1 day |

---

## Sources

- [Martin Fowler: Harness Engineering](https://martinfowler.com/articles/harness-engineering.html)
- [AutoHarness (aiming-lab)](https://github.com/aiming-lab/AutoHarness)
- [AutoHarness (DeepMind) arXiv:2603.03329](https://arxiv.org/abs/2603.03329)
- [NxCode: Harness Engineering Complete Guide 2026](https://www.nxcode.io/resources/news/harness-engineering-complete-guide-ai-agent-codex-2026)
- [Check Point: Claude Code CVEs](https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/)
- [Claude Code Security Docs](https://code.claude.com/docs/en/security)
- [Paddo.dev: Claude Code Hooks Guardrails](https://paddo.dev/blog/claude-code-hooks-guardrails/)
- [Lasso Security Claude Hooks](https://github.com/lasso-security/claude-hooks)
- [Microsoft Agent Governance Toolkit](https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/)
- [Aegis Agent Governance](https://acacian.github.io/aegis/playground/)
- [IETF Agent Audit Trail Draft](https://datatracker.ietf.org/doc/html/draft-sharif-agent-audit-trail-00)
- [Traceloop: LLM Token Cost Tracking](https://www.traceloop.com/blog/from-bills-to-budgets-how-to-track-llm-token-usage-and-cost-per-user)
- [OneUpTime: LLMOps Cost Management](https://oneuptime.com/blog/post/2026-01-30-llmops-cost-management/view)
- [Noma Security: AI Agent Risk Management](https://noma.security/resources/risk-management-for-ai-agents/)
- [Red Hat: Harness Engineering Structured Workflows](https://developers.redhat.com/articles/2026/04/07/harness-engineering-structured-workflows-ai-assisted-development)
