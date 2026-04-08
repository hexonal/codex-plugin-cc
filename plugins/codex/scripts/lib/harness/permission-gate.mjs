export function checkPermission(riskResult, profile, toolName) {
  if (profile.alwaysAllow && profile.alwaysAllow.includes(toolName)) {
    return { allow: true, reason: null };
  }
  if (profile.alwaysBlock && profile.alwaysBlock.includes(toolName)) {
    return { allow: false, reason: "tool is blocked" };
  }
  if (profile.blockOn && profile.blockOn.includes(riskResult.level)) {
    return { allow: false, reason: `risk level ${riskResult.level} is blocked` };
  }
  if (profile.requireApprovalOn && profile.requireApprovalOn.includes(riskResult.level)) {
    return { allow: false, reason: `risk level ${riskResult.level} requires approval` };
  }
  return { allow: true, reason: null };
}
