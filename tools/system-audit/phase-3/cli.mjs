import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PHASE_3_ID, PHASE_3_STAGES, getPhase3Stage } from "./phase-3-plan.mjs";
import {
  assertCanBeginStage,
  assertPhase2Closed,
  buildApiContractMatrix,
  buildEvidence,
  buildIdentityContractMatrix,
  buildTenantSecurityMatrix,
  createInitialState,
  phase3EvidencePath,
  phase3OutputPath,
  readJson,
  sha256File,
  stableDigest,
  writeJson,
} from "./phase-3-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-3");
const runtimeRoot = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-3");
const statePath = path.join(runtimeRoot, "phase-3-state.json");

function now() {
  return new Date().toISOString();
}

function runCommand(command, args, options = {}) {
  const executable = process.platform === "win32" && ["npm", "npx"].includes(command) ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 8,
    env: options.env ?? process.env,
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error?.message ?? null,
    timedOut: Boolean(result.error?.code === "ETIMEDOUT"),
  };
}

function supabaseCommand(args) {
  const local = path.join(appRoot, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  return existsSync(local)
    ? runCommand(local, args, { cwd: appRoot, timeout: 300_000 })
    : runCommand("npx", ["supabase", ...args], { cwd: appRoot, timeout: 300_000 });
}

function redact(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[url-redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ACCESS_TOKEN|password|token|secret)[^\r\n]{0,100}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1_000);
}

function gitHead() {
  const result = runCommand("git", ["rev-parse", "HEAD"]);
  if (result.status !== 0) throw new Error(`git_head_failed:${redact(result.stderr || result.error)}`);
  return result.stdout.trim();
}

function parseArgs(args) {
  return Object.fromEntries(args.map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  }));
}

function loadOrCreateState(sourceCommit, newRun = false) {
  if (existsSync(statePath) && !newRun) return readJson(statePath);
  const state = createInitialState({ repoRoot, sourceCommit, openedAt: now() });
  writeJson(statePath, state);
  return state;
}

function writePhaseManifest(sourceCommit, phase2Precondition) {
  writeJson(path.join(docsRoot, "plan-manifest.json"), {
    schemaVersion: "aiya-system-audit-phase-plan-manifest-v1",
    planId: "aiya-system-compatibility-reliability-release-readiness-v1",
    planVersion: "1.0.0",
    phaseId: PHASE_3_ID,
    title: "Backend, Kimlik, API Sozlesmeleri ve Tenant Guvenligi",
    sourceCommit,
    createdAt: now(),
    precondition: phase2Precondition,
    stageOrder: PHASE_3_STAGES.map((stage) => stage.id),
    stages: PHASE_3_STAGES,
    outputPolicy: "secret-free-docs-and-runtime-only-raw-test-summaries",
  });
}

function setStageState(state, stageId, patch) {
  state.stages[stageId] = { ...state.stages[stageId], ...patch };
  state.lastRun = { stageId, at: now(), status: state.stages[stageId].status };
  state.nextStage = PHASE_3_STAGES.find((stage) => state.stages[stage.id]?.status !== "VERIFIED")?.id ?? null;
  writeJson(statePath, state);
}

function stageEvidence({ state, stageId, outputName, status, blockers = [], testResults = [] }) {
  const stage = getPhase3Stage(stageId);
  const outputPath = phase3OutputPath(repoRoot, outputName);
  const outputDigest = sha256File(outputPath);
  const evidencePath = phase3EvidencePath(repoRoot, stageId);
  const evidence = buildEvidence({
    stage,
    sourceCommit: state.sourceCommit,
    status,
    outputFiles: [{ path: `docs/system-audit/phase-3/${outputName}`, sha256: outputDigest }],
    operations: stage.operations.map((description, index) => ({
      order: index + 1,
      description,
      status: status === "VERIFIED" ? "PASS" : index === 0 ? "PASS" : "BLOCKED",
      outputReferences: [`docs/system-audit/phase-3/${outputName}`],
    })),
    verification: {
      rules: stage.verificationRules,
      result: status === "VERIFIED" ? "PASS" : "BLOCKED",
      outputDigest,
      testResults,
    },
    blockers,
  });
  writeJson(evidencePath, evidence);
  return {
    evidencePath: `docs/system-audit/phase-3/stages/stage-${stageId}.json`,
    evidenceDigest: sha256File(evidencePath),
    outputDigest,
  };
}

function parseVitestSummary(output) {
  const text = String(output ?? "");
  return {
    passed: Number(text.match(/(\d+)\s+passed/i)?.[1] ?? 0),
    failed: Number(text.match(/(\d+)\s+failed/i)?.[1] ?? 0),
    skipped: Number(text.match(/(\d+)\s+skipped/i)?.[1] ?? 0),
  };
}

function runVitest(name, files, env = process.env, timeout = 300_000) {
  const result = runCommand("npm", ["exec", "--", "vitest", "run", ...files, "--no-file-parallelism", "--maxWorkers=1", "--reporter=default"], {
    cwd: appRoot,
    env,
    timeout,
  });
  return {
    name,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    summary: parseVitestSummary(`${result.stdout}\n${result.stderr}`),
    output: redact(`${result.stdout}\n${result.stderr}`),
  };
}

function parseLocalSupabaseStatus(output) {
  let parsed = null;
  try { parsed = JSON.parse(String(output)); } catch { /* CLI may emit key=value output. */ }
  const values = new Map();
  const flatten = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object" && !Array.isArray(child)) flatten(child);
      else values.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), String(child ?? ""));
    }
  };
  flatten(parsed);
  if (values.size === 0) {
    for (const line of String(output).split(/\r?\n/)) {
      const index = line.indexOf("=");
      if (index > 0) values.set(line.slice(0, index).toLowerCase().replace(/[^a-z0-9]/g, ""), line.slice(index + 1).trim());
    }
  }
  const pick = (...keys) => keys.map((key) => values.get(key.toLowerCase().replace(/[^a-z0-9]/g, ""))).find(Boolean) ?? "";
  return {
    apiUrl: pick("apiUrl", "api_url", "url"),
    anonKey: pick("anonKey", "anon_key"),
    serviceRoleKey: pick("serviceRoleKey", "service_role_key"),
    projectId: pick("projectId", "project_id") || "manu-ai-local",
  };
}

function runTenantRuntimeSuite() {
  const start = supabaseCommand(["start"]);
  if (start.status !== 0) {
    return [{ name: "local-supabase-start", status: "FAIL", exitCode: start.status, output: redact(start.stderr || start.stdout || start.error) }];
  }
  const results = [];
  let local = null;
  try {
    const statusResult = supabaseCommand(["status", "-o", "json"]);
    local = parseLocalSupabaseStatus(statusResult.stdout);
    if (statusResult.status !== 0 || !local.apiUrl || !local.anonKey || !local.serviceRoleKey) {
      results.push({ name: "local-supabase-status", status: "FAIL", exitCode: statusResult.status, output: "local fixture credentials unavailable" });
      return results;
    }
    const reset = supabaseCommand(["db", "reset", "--local", "--no-seed", "--yes"]);
    const env = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: local.apiUrl,
      SUPABASE_URL: local.apiUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: local.serviceRoleKey,
      MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    };
    results.push({ name: "local-schema-reset", status: reset.status === 0 ? "PASS" : "FAIL", exitCode: reset.status, output: redact(reset.stderr || reset.stdout || reset.error) });
    if (reset.status === 0) {
      results.push(runVitest("supabase-rls-integration", ["src/lib/supabase-rls.integration.test.ts"], env, 600_000));
    }
    return results;
  } finally {
    const stop = supabaseCommand(["stop", "--project-id", local?.projectId || "manu-ai-local", "--no-backup"]);
    if (stop.status !== 0) {
      results.push({ name: "local-supabase-stop", status: "FAIL", exitCode: stop.status, output: redact(stop.stderr || stop.stdout || stop.error) });
    }
  }
  return results;
}

function executeStage31(state) {
  assertCanBeginStage(state, "3.1");
  state.stages["3.1"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const output = buildApiContractMatrix(repoRoot);
  const outputName = "api-contract-matrix.json";
  writeJson(phase3OutputPath(repoRoot, outputName), output);
  const blockers = output.blockers ?? [];
  const status = output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({ state, stageId: "3.1", outputName, status, blockers });
  setStageState(state, "3.1", {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers,
  });
  return { stageId: "3.1", status, blockers, outputPath: `docs/system-audit/phase-3/${outputName}` };
}

function executeStage32(state) {
  assertCanBeginStage(state, "3.2");
  state.stages["3.2"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const tests = [
    ["auth-context", "src/lib/auth-context.test.ts"],
    ["admin-console", "src/lib/phase-84f-admin-console.test.ts"],
    ["admin-access", "src/lib/commercial-admin-access.test.ts"],
    ["auth-server", "src/lib/phase-85-stage-4d-auth-server.test.ts"],
    ["admin-password-login-route", "src/app/api/admin/auth/password-login/route.test.ts"],
    ["admin-password-reset-route", "src/app/api/admin/auth/password-reset/route.test.ts"],
    ["customer-password-login-route", "src/app/api/auth/password-login/route.test.ts"],
    ["session-fragment-route", "src/app/api/auth/session-from-fragment/route.test.ts"],
    ["commercial-auth-boundary", "tests/commercial-auth-browser-boundary.test.ts"],
    ["trusted-proxy-boundary", "tests/trusted-proxy-boundary.test.ts"],
    ["request-id-error-contract", "tests/request-id-error-propagation.test.ts"],
  ];
  const testResults = tests.map(([name, file]) => runVitest(name, [file]));
  const apiMatrix = readJson(phase3OutputPath(repoRoot, "api-contract-matrix.json"));
  const output = buildIdentityContractMatrix(repoRoot, testResults);
  const outputName = "identity-contract-matrix.json";
  writeJson(phase3OutputPath(repoRoot, outputName), output);
  const blockers = output.blockers ?? [];
  const status = output.status === "PASS" && testResults.every((result) => result.status === "PASS") && apiMatrix.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({ state, stageId: "3.2", outputName, status, blockers, testResults });
  setStageState(state, "3.2", {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers,
  });
  return { stageId: "3.2", status, blockers, testResults, outputPath: `docs/system-audit/phase-3/${outputName}` };
}

function executeStage33(state) {
  assertCanBeginStage(state, "3.3");
  state.stages["3.3"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const apiMatrix = readJson(phase3OutputPath(repoRoot, "api-contract-matrix.json"));
  const phase2Evidence = {
    schemaDiff: readJson(path.join(repoRoot, "docs", "system-audit", "phase-2", "schema-diff-classification.json")),
    isolated: readJson(path.join(repoRoot, "docs", "system-audit", "phase-2", "isolated-reconciliation.json")),
    contract: readJson(path.join(repoRoot, "docs", "system-audit", "phase-2", "schema-contract-matrix.json")),
  };
  const runtimeResults = [
    ...runTenantRuntimeSuite(),
    runVitest("hosted-sandbox-tenant-isolation", ["src/lib/hosted-sandbox-tenant-isolation.test.ts"]),
    runVitest("shell-session-contract", ["src/lib/phase-85-stage-5-shell-session.test.ts"]),
  ];
  const output = buildTenantSecurityMatrix(repoRoot, apiMatrix, runtimeResults, phase2Evidence);
  const outputName = "tenant-security-matrix.json";
  writeJson(phase3OutputPath(repoRoot, outputName), output);
  const blockers = output.blockers ?? [];
  const status = output.status === "PASS" && runtimeResults.every((result) => result.status === "PASS") ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({ state, stageId: "3.3", outputName, status, blockers, testResults: runtimeResults });
  setStageState(state, "3.3", {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers,
  });
  return { stageId: "3.3", status, blockers, runtimeResults, outputPath: `docs/system-audit/phase-3/${outputName}` };
}

function executeStage34(state) {
  assertCanBeginStage(state, "3.4");
  state.stages["3.4"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const digestChecks = [];
  for (const stage of PHASE_3_STAGES.slice(0, 3)) {
    const stageState = state.stages[stage.id];
    for (const [name, digest] of Object.entries(stageState.outputDigests ?? {})) {
      const outputPath = phase3OutputPath(repoRoot, name);
      digestChecks.push({ stageId: stage.id, file: name, status: existsSync(outputPath) && sha256File(outputPath) === digest ? "PASS" : "FAIL" });
    }
    const evidencePath = stageState.evidencePath ? path.join(repoRoot, stageState.evidencePath) : null;
    digestChecks.push({ stageId: stage.id, file: stageState.evidencePath, status: evidencePath && existsSync(evidencePath) && sha256File(evidencePath) === stageState.evidenceDigest ? "PASS" : "FAIL" });
  }
  const finalTests = [
    runVitest("api-errors", ["src/app/api/api-errors.test.ts"]),
    runVitest("auth-context", ["src/lib/auth-context.test.ts"]),
    runVitest("admin-access", ["src/lib/commercial-admin-access.test.ts"]),
    runVitest("hosted-sandbox-tenant-isolation", ["src/lib/hosted-sandbox-tenant-isolation.test.ts"]),
    runVitest("request-id-error-contract", ["tests/request-id-error-propagation.test.ts"]),
  ];
  const blockers = [
    ...digestChecks.filter((check) => check.status !== "PASS").map((check) => ({ code: `digest:${check.stageId}:${check.file}`, blocker: true })),
    ...finalTests.filter((test) => test.status !== "PASS").map((test) => ({ code: `test:${test.name}`, blocker: true })),
  ];
  const outputName = "backend-security-closure.json";
  const output = {
    schemaVersion: "aiya-system-audit-phase-3-backend-security-closure-v1",
    planId: "aiya-system-compatibility-reliability-release-readiness-v1",
    planVersion: "1.0.0",
    phaseId: PHASE_3_ID,
    generatedAt: now(),
    sourceCommit: state.sourceCommit,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    digestChecks,
    finalTests,
    blockers,
    mutationBoundary: { production: false, linkedSupabase: false, localFixtureOnly: true },
    closureRule: "all four stages VERIFIED, all required outputs/evidence digest-valid, final backend/security tests PASS",
    closureDigest: stableDigest({ digestChecks, finalTests, blockers }),
  };
  writeJson(phase3OutputPath(repoRoot, outputName), output);
  const status = output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({ state, stageId: "3.4", outputName, status, blockers, testResults: finalTests });
  setStageState(state, "3.4", {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers,
  });
  if (status === "VERIFIED") {
    state.phaseStatus = "CLOSED";
    state.nextStage = null;
    writeJson(statePath, state);
    writeJson(path.join(docsRoot, "phase-3-closure.json"), {
      schemaVersion: "aiya-system-audit-phase-closure-v1",
      planId: "aiya-system-compatibility-reliability-release-readiness-v1",
      planVersion: "1.0.0",
      phaseId: PHASE_3_ID,
      status: "CLOSED",
      closedAt: now(),
      sourceCommit: state.sourceCommit,
      stageEvidence: PHASE_3_STAGES.map((stage) => ({ stageId: stage.id, evidencePath: state.stages[stage.id].evidencePath, evidenceDigest: state.stages[stage.id].evidenceDigest })),
      finalOutput: { path: "docs/system-audit/phase-3/backend-security-closure.json", sha256: sha256File(phase3OutputPath(repoRoot, outputName)) },
      closureRule: output.closureRule,
      nextPhase: "phase-4",
      nextPhaseUnlocked: true,
    });
  } else {
    state.phaseStatus = "BLOCKED";
    state.nextStage = null;
    writeJson(statePath, state);
  }
  return { stageId: "3.4", status, blockers, finalTests, outputPath: `docs/system-audit/phase-3/${outputName}`, phaseStatus: state.phaseStatus };
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  if (command !== "run-phase-3" && command !== "run-stage-3.1" && command !== "run-stage-3.2" && command !== "run-stage-3.3" && command !== "run-stage-3.4") {
    throw new Error("usage: run-phase-3 [--newRun=true] | run-stage-3.1 | run-stage-3.2 | run-stage-3.3 | run-stage-3.4");
  }
  const precondition = assertPhase2Closed(repoRoot);
  if (!precondition.ok) throw new Error(`${precondition.reason}:${(precondition.stageFailures ?? []).join(",")}`);
  const sourceCommit = gitHead();
  if (command === "run-phase-3") {
    const state = loadOrCreateState(sourceCommit, options.newRun === "true");
    writePhaseManifest(sourceCommit, precondition);
    const results = [];
    if (state.phaseStatus === "CLOSED") {
      process.stdout.write(JSON.stringify({ phaseStatus: state.phaseStatus, stages: state.stages }, null, 2) + "\n");
      return;
    }
    for (const stageId of ["3.1", "3.2", "3.3", "3.4"]) {
      if (state.stages[stageId].status === "VERIFIED") continue;
      const result = stageId === "3.1" ? executeStage31(state) : stageId === "3.2" ? executeStage32(state) : stageId === "3.3" ? executeStage33(state) : executeStage34(state);
      results.push(result);
      if (result.status !== "VERIFIED") break;
    }
    process.stdout.write(JSON.stringify({ phaseStatus: state.phaseStatus, results }, null, 2) + "\n");
    if (state.phaseStatus === "BLOCKED" || results.some((result) => result.status === "BLOCKED")) process.exitCode = 2;
    return;
  }
  const state = existsSync(statePath) ? readJson(statePath) : loadOrCreateState(sourceCommit, false);
  const result = command === "run-stage-3.1" ? executeStage31(state) : command === "run-stage-3.2" ? executeStage32(state) : command === "run-stage-3.3" ? executeStage33(state) : executeStage34(state);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.status === "BLOCKED") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`FAIL system-audit-phase-3: ${redact(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}
