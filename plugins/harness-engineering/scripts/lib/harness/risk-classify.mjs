const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

export function classifyToolRisk(toolName, toolInput, rules) {
  let text;
  if (toolName === "Bash") text = toolInput.command;
  else if (toolName === "Write" || toolName === "Edit" || toolName === "MultiEdit") text = toolInput.file_path;
  else if (toolName === "WebFetch" || toolName === "WebSearch") text = toolInput.url || toolInput.query;
  else text = JSON.stringify(toolInput).slice(0, 4096);

  if (text == null) text = JSON.stringify(toolInput).slice(0, 4096);

  for (const severity of SEVERITY_ORDER) {
    if (severity === "low") break;
    for (const rule of rules) {
      if (rule.severity !== severity) continue;
      if (rule.applies_to && !rule.applies_to.includes(toolName)) continue;
      if (new RegExp(rule.pattern).test(text)) {
        return { level: severity, matchedRule: rule.name, detail: `matched rule ${rule.name}` };
      }
    }
  }

  return { level: "low", matchedRule: null, detail: "no pattern matched" };
}
