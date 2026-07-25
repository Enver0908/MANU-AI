import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnWithTimeoutSync } from "./lib/spawn-with-timeout.mjs";

const appCwd = process.cwd();
const coreCwd = resolve(appCwd, "../dietitian-ai-assistant");
const checks = [];
const evidencePath = resolve(appCwd, "../docs/PHASE_85_STAGE_4C_REMEDIATION_EVIDENCE.md");

function parseVitestRunSummary(output) {
  const summaryLine =
    output.split(/\r?\n/).find((line) => /Tests\s+\d+\s+passed/i.test(line)) ??
    output.split(/\r?\n/).find((line) => /Test Files\s+\d+/i.test(line) && /passed|failed|skipped/i.test(line));
  if (!summaryLine) {
    return { skipped: 0, failed: 0, parseable: false };
  }
  return {
    skipped: Number(summaryLine.match(/(\d+)\s+skipped/i)?.[1] ?? 0),
    failed: Number(summaryLine.match(/(\d+)\s+failed/i)?.[1] ?? 0),
    parseable: true,
  };
}

function runCheck(name, command, args, options = {}) {
  const result = spawnWithTimeoutSync({
    label: name,
    command,
    args,
    cwd: options.cwd ?? appCwd,
    env: options.env,
    timeoutMs: options.timeoutMs ?? 900_000,
  });
  checks.push({
    name,
    status: result.status,
    reason: result.reason,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
  });
  console.log(`\n[rehearse:stage-4c] ${name}: ${result.status} (${result.reason})`);
  if (result.status !== "pass") {
    process.exit(result.exitCode ?? 1);
  }
  return result;
}

console.log("[rehearse:stage-4c] starting Stage 4C remediation fail-fast rehearsal chain");

runCheck("typecheck", "npm", ["run", "typecheck"]);
runCheck("lint", "npm", ["run", "lint"]);
runCheck(
  "stage_4c_targeted_tests",
  "npx",
  [
    "vitest",
    "run",
    "src/lib/phase-85-stage-4c-closure.test.ts",
    "src/lib/phase-85-stage-4c-corpus-chain.test.ts",
    "src/lib/phase-85-stage-4c-concurrency-rehearsal.test.ts",
    "src/lib/phase-85-stage-4c-postgres-scale.test.ts",
    "src/lib/phase-85-stage-4c-core-rpc-migration.test.ts",
    "src/lib/phase-85-stage-4c-isolation.test.ts",
  ],
);
runCheck("core_corpus_tests", "npm", ["test", "--", "tests/dietitian-chat-golden-corpus.test.mjs", "tests/dietitian-chat-red-team-corpus.test.mjs"], {
  cwd: coreCwd,
});
runCheck("app_unit_tests", "npm", ["test"]);
runCheck("local_supabase_reset", "npx", ["supabase", "db", "reset", "--local"], { timeoutMs: 1_800_000 });

const rls = runCheck("rls_integration_suite", "npm", ["run", "test:rls"], { timeoutMs: 1_800_000 });
const rlsSummary = parseVitestRunSummary(rls.output);
if (rlsSummary.skipped > 0) {
  console.error(`[rehearse:stage-4c] RLS suite had ${rlsSummary.skipped} skipped tests`);
  process.exit(1);
}

runCheck(
  "visual_acceptance",
  "npx",
  ["playwright", "test", "tests/visual/ai-chat.visual.spec.ts", "tests/visual/ai-chat.accessibility.spec.ts"],
  { timeoutMs: 1_800_000 },
);
runCheck(
  "stage_4c_full_rehearsal",
  "npx",
  ["vitest", "run", "src/lib/phase-85-stage-4c-remediation-closure.test.ts"],
  { env: { STAGE_4C_FULL_REHEARSAL: "1" }, timeoutMs: 1_800_000 },
);
runCheck("production_build", "npm", ["run", "build"], { timeoutMs: 1_800_000 });
runCheck("release_verification", "npm", ["run", "release:verify"], { timeoutMs: 1_800_000 });
runCheck("git_diff_check", "git", ["diff", "--check"], { cwd: resolve(appCwd, "..") });

const report = {
  version: "p85-stage-4c-remediation-rehearsal-v1",
  status: "pass",
  verdict: "PASS_LOCAL_STAGE_4C_REMEDIATED",
  productionPilotGo: false,
  r405Open: true,
  rlsSkippedCount: rlsSummary.skipped,
  checks,
  recordedAt: new Date().toISOString(),
};

const evidenceMarker = "## Faz 8: Gerçek PostgreSQL Ölçek Rehearsal’ı, Hard-Zero Kapısı ve Nihai Kapanış";
const evidenceBody = `${evidenceMarker}

Status: **complete locally with measured rehearsal evidence**

### Verification chain

${checks.map((check) => `- ${check.name}: ${check.status} (${check.reason}, ${check.durationMs}ms)`).join("\n")}

### Closure authority

- Verdict: \`PASS_LOCAL_STAGE_4C_REMEDIATED\` (repo-local only; not production GO)
- RLS skipped count: ${rlsSummary.skipped}
- Production pilot remains \`NO-GO\`
- R-405 remains open
- Real provider and external gates remain closed

`;

try {
  const existing = readFileSync(evidencePath, "utf8");
  const withoutFaz8 = existing.includes(evidenceMarker)
    ? existing.slice(0, existing.indexOf(evidenceMarker))
    : existing;
  writeFileSync(evidencePath, `${withoutFaz8}${evidenceBody}`);
} catch (error) {
  console.error(`[rehearse:stage-4c] failed to update evidence doc: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

console.log("\n[rehearse:stage-4c] remediation rehearsal report");
console.log(JSON.stringify(report, null, 2));
console.log(
  "\nStage 4C remediation rehearsal passed locally. Production pilot remains NO-GO; R-405 remains open.",
);
