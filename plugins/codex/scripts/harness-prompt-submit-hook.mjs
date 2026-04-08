#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadConstitution } from "./lib/harness/constitution.mjs";

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const constitution = loadConstitution(input.cwd);

  if (!constitution || constitution.mode === "off") {
    process.exit(0);
  }

  const estimatedTokens = Math.ceil(input.prompt.length / 4);

  // Read budget file
  const budgetFile = path.join(input.cwd, ".codex-harness", "budget.json");
  let blocked = false;
  let nearLimit = false;

  try {
    const budget = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
    const total = (budget.totalTokens || 0) + estimatedTokens;
    const max = budget.maxTokens || 0;
    if (max > 0) {
      if (total >= max) {
        blocked = true;
      } else if (total > max * 0.8) {
        nearLimit = true;
      }
    }
  } catch {
    // No budget file, allow
  }

  if (blocked) {
    process.stdout.write(JSON.stringify({ decision: "block", reason: "token budget exceeded" }));
  }

  if (nearLimit) {
    process.stderr.write("[harness] warning: approaching token budget limit\n");
  }

  process.exit(0);
} catch (err) {
  process.stderr.write("harness-prompt-submit-hook: " + err.message + "\n");
  process.exit(0);
}
