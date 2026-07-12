import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildR6GateReport, classifyRlsGateResult, collectAddedDiffViolations } from "./phase-85-stage-4b2-r6-gate-core.mjs";

const appCwd = process.cwd();
const coreCwd = "../dietitian-ai-assistant";
const checks = [];

function runCommand(name, command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? appCwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeoutMs ?? 600_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";
  const status = timedOut ? "blocked" : result.status === 0 ? "pass" : "fail";
  const reason = timedOut ? "command_timeout" : status === "pass" ? "completed" : `exit_${result.status ?? 1}`;
  checks.push({ name, status, reason, exitCode: result.status ?? 1, durationMs: Date.now() - startedAt });
  const tail = output.trim().split(/\r?\n/).slice(-12).join("\n");
  console.log(`\n[r6] ${name}: ${status} (${reason})`);
  if (tail) console.log(tail);
  return { output, result };
}

console.log("[r6] starting independent Stage 4B-2 full verification gate");

runCommand(
  "r6_gate_contract_tests",
  "npx",
  ["vitest", "run", "scripts/phase-85-stage-4b2-r6-gate-core.test.mjs", "--pool=forks", "--maxWorkers=1"],
);
runCommand("core_tests", "npm", ["test"], { cwd: coreCwd });
runCommand("app_full_tests", "npm", ["test"]);
runCommand("lint", "npm", ["run", "lint"]);
runCommand("production_build", "npm", ["run", "build"]);
runCommand(
  "stage_4b2_r5_full_scale",
  "npx",
  ["vitest", "run", "src/lib/phase-85-stage-4b2-remediation-r5-evidence.test.ts"],
  { env: { STAGE_4B2_R5_FULL_SCALE: "1" } },
);
runCommand(
  "phase_79g_full_scale",
  "npx",
  ["vitest", "run", "src/lib/phase-79g-unified-production-scale-rehearsal.test.ts"],
  { env: { PHASE_79G_FULL_REHEARSAL: "1" } },
);
runCommand("channel_replay_full", "npm", ["run", "rehearse:channel:replay"], {
  env: { PHASE_77AG_FULL_REPLAY: "1" },
});
runCommand(
  "messaging_visual_accessibility",
  "npx",
  ["playwright", "test", "tests/visual/messaging.visual.spec.ts", "tests/visual/messaging.accessibility.spec.ts"],
);

const rls = runCommand("rls_role_matrix", "npm", ["run", "test:rls"]);
const rlsClassification = classifyRlsGateResult({
  exitCode: rls.result.status ?? 1,
  output: rls.output,
});
checks[checks.length - 1] = {
  ...checks[checks.length - 1],
  status: rlsClassification.status,
  reason: rlsClassification.reason,
};

const audit = runCommand("production_dependency_audit", "npm", ["audit", "--omit=dev", "--json"]);
if (audit.result.status === 1) {
  try {
    const parsed = JSON.parse(audit.output.trim());
    const vulnerabilities = Object.values(parsed.vulnerabilities ?? {});
    const unknown = vulnerabilities.filter((item) => {
      const name = item.name;
      if (name === "next" && (item.via ?? []).some((via) => via === "postcss" || via?.name === "postcss")) return false;
      if (name === "postcss" && (item.via ?? []).some((via) => via?.url?.includes("GHSA-qx2v-qp2m-jg93"))) return false;
      return true;
    });
    if (unknown.length === 0) {
      checks[checks.length - 1] = { ...checks[checks.length - 1], status: "pass", reason: "known_r405_only" };
    }
  } catch {
    checks[checks.length - 1] = { ...checks[checks.length - 1], status: "fail", reason: "audit_json_parse_failed" };
  }
}

runCommand("diff_check", "git", ["diff", "--check"]);
const diffAdded = runCommand("diff_secret_and_name_scan", "git", ["diff", "HEAD", "--unified=0"]);
const untracked = runCommand("untracked_file_scan_input", "git", ["ls-files", "--others", "--exclude-standard"]);
const untrackedDiff = untracked.output
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean)
  .map((file) => {
    try {
      return readFileSync(resolve(appCwd, file), "utf8")
        .split(/\r?\n/)
        .map((line) => `+${line}`)
        .join("\n");
    } catch {
      return "";
    }
  })
  .join("\n");
const violations = collectAddedDiffViolations(`${diffAdded.output}\n${untrackedDiff}`);
if (violations.length > 0) {
  checks[checks.length - 1] = {
    ...checks[checks.length - 1],
    status: "fail",
    reason: `added_diff_violation:${violations.join(",")}`,
  };
}

const report = buildR6GateReport(checks);
console.log("\n[r6] independent gate report");
console.log(JSON.stringify(report, null, 2));
console.log("Production pilot remains NO-GO; R-405 remains open.");

if (report.status !== "pass") process.exitCode = 2;
