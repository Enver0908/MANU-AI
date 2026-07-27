import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildCommandSummary,
  buildStage4CLocalClosureReport,
  parseVitestRunSummary,
  writeStage4CLocalClosureEvidence,
} from "./lib/stage-4c-rehearsal-evidence.mjs";
import { spawnWithTimeoutSync } from "./lib/spawn-with-timeout.mjs";

const appCwd = process.cwd();
const coreCwd = resolve(appCwd, "../dietitian-ai-assistant");
const checks = [];
const evidencePath = resolve(appCwd, "../docs/PHASE_85_STAGE_4C_LOCAL_CLOSURE_REHEARSAL_EVIDENCE.md");
const isolatedUnitTestEnv = {
  MANU_DEV_FALLBACK_STORE: "true",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_URL: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  STAGE_4C_FULL_REHEARSAL: "",
};

loadEnvLocal();
loadLocalSupabaseCliEnv();

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
    summary: buildCommandSummary(name, result.output),
  });
  console.log(`\n[rehearse:stage-4c] ${name}: ${result.status} (${result.reason})`);
  if (result.status !== "pass") {
    if (result.output.trim()) {
      console.error(result.output.trim());
    }
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
    "src/lib/phase-85-stage-4c-operational-rls-reclosure-migration.test.ts",
    "src/lib/phase-85-stage-4c-core-rpc-migration.test.ts",
    "src/lib/phase-85-stage-4c-isolation.test.ts",
    "src/lib/phase-85-stage-4c-rehearsal-evidence.test.mjs",
    "--no-file-parallelism",
    "--maxWorkers=1",
  ],
  {
    env: isolatedUnitTestEnv,
  },
);
runCheck(
  "core_corpus_tests",
  "npm",
  ["test", "--", "tests/dietitian-chat-golden-corpus.test.mjs", "tests/dietitian-chat-red-team-corpus.test.mjs"],
  {
    cwd: coreCwd,
  },
);
runCheck("app_unit_tests", "npm", ["test"], {
  env: isolatedUnitTestEnv,
  timeoutMs: 2_400_000,
});
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

const report = buildStage4CLocalClosureReport({
  checks,
  rlsSummary,
});

try {
  writeStage4CLocalClosureEvidence(evidencePath, report);
} catch (error) {
  console.error(`[rehearse:stage-4c] failed to update evidence doc: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

console.log("\n[rehearse:stage-4c] remediation rehearsal report");
console.log(JSON.stringify(report, null, 2));
console.log(
  "\nStage 4C remediation rehearsal passed locally. Production pilot remains NO-GO; R-405 remains open.",
);

function loadEnvLocal() {
  try {
    for (const line of readFileSync(resolve(appCwd, ".env.local"), "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        process.env[match[1]] = unquoteEnvValue(process.env[match[1]] ?? match[2]);
      }
    }
  } catch {
    // Missing local env is handled by the fail-closed rehearsal gates.
  }
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadLocalSupabaseCliEnv() {
  const result = spawnSync("npx", ["supabase", "status", "-o", "env"], {
    cwd: appCwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) return;
  const parsed = new Map();
  for (const line of `${result.stdout || ""}`.split(/\r?\n/)) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) parsed.set(match[1], unquoteEnvValue(match[2]));
  }
  const apiUrl = parsed.get("API_URL");
  const anonKey = parsed.get("ANON_KEY");
  const serviceRoleKey = parsed.get("SERVICE_ROLE_KEY");
  if (apiUrl?.startsWith("http://127.0.0.1:") || apiUrl?.startsWith("http://localhost:")) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = apiUrl;
    if (anonKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
    if (serviceRoleKey) process.env.SUPABASE_SERVICE_ROLE_KEY = serviceRoleKey;
  }
}
