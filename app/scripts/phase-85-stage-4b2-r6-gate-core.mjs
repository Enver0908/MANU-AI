export function classifyRlsGateResult({ exitCode, output }) {
  const normalized = output.toLowerCase();
  if (normalized.includes("skipped") || normalized.includes("test files 1 skipped")) {
    return { status: "blocked", reason: "rls_suite_skipped" };
  }
  if (exitCode !== 0 || normalized.includes("failed")) {
    return { status: "fail", reason: "rls_suite_failed" };
  }
  return { status: "pass", reason: "rls_suite_passed" };
}

export function collectAddedDiffViolations(diffText) {
  const addedLines = diffText
    .split(/\r?\n/)
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  const violations = [];
  const patterns = [
    ["live_stripe_key", /\bsk_live_[a-zA-Z0-9]+\b/],
    ["embedded_service_role", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][^'"]{8,}['"]/],
    ["forbidden_phase_name", /\bPhase\s+86\b/i],
  ];
  for (const [id, pattern] of patterns) {
    if (addedLines.some((line) => pattern.test(line))) violations.push(id);
  }
  return Array.from(new Set(violations));
}

export function buildR6GateReport(checks) {
  const failures = checks
    .filter((check) => check.status !== "pass")
    .map((check) => `${check.name}:${check.reason}`);
  const status = failures.length === 0
    ? "pass"
    : checks.some((check) => check.status === "blocked")
      ? "blocked"
      : "fail";
  return {
    version: "p85-stage-4b2-r6-independent-gate-v1",
    status,
    productionPilotGo: false,
    failures,
    checks: checks.map(({ name, status: checkStatus, reason, exitCode, durationMs }) => ({
      name,
      status: checkStatus,
      reason,
      exitCode,
      durationMs,
    })),
  };
}
