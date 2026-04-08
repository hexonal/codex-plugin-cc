const BUILTIN_PATTERNS = [
  { name: "aws-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { name: "api-key", pattern: /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[\w\-]{8,}/gi },
  { name: "pem", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+?-----END/ },
];

export function sanitizeOutput(rawOutput, config) {
  let output = rawOutput;
  const redactions = [];

  for (const { name, pattern } of BUILTIN_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags || "g");
    if (re.test(output)) {
      redactions.push(name);
      output = output.replace(new RegExp(pattern.source, pattern.flags || "g"), `[REDACTED:${name}]`);
    }
  }

  if (config && config.patterns) {
    for (const { name, pattern, replacement } of config.patterns) {
      const re = new RegExp(pattern, "g");
      if (re.test(output)) {
        redactions.push(name);
        output = output.replace(new RegExp(pattern, "g"), replacement);
      }
    }
  }

  return { modified: output !== rawOutput, output, redactions };
}
