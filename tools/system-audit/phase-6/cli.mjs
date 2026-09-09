import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PHASE_6_ID, PHASE_6_STAGES, getPhase6Stage } from "./phase-6-plan.mjs";
import {
  assertCanBeginStage,
  assertPhase5Closed,
  buildFailureInjectionMatrix,
  buildLoadCapacityMatrix,
  buildObservabilityMatrix,
  buildPhase6ClosureMatrix,
  buildRecoveryMatrix,
  buildEvidence,
  createInitialState,
  phase6EvidencePath,
  phase6OutputPath,
  readJson,
  sha256File,
  stableDigest,
  writeJson,
} from "./phase-6-contract.mjs";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION } from "./phase-6-plan.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-6");
const runtimeRoot = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-6");
const statePath = path.join(runtimeRoot, "phase-6-state.json");

function now() {
  return new Date().toISOString();
}

function commandName(command) {
  return process.platform === "win32" && ["npm", "npx"].includes(command) ? `${command}.cmd` : command;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(commandName(command), args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeout ?? 600_000,
    maxBuffer: 1024 * 1024 * 50,
    env: options.env ?? process.env,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error?.message ?? null,
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function redact(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[url-redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ACCESS_TOKEN|password|token|secret)[^\r\n]{0,120}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1_200);
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

function localTestEnv() {
  return {
    ...process.env,
    MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
    MANU_ALLOW_REAL_ZAI: "false",
    MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
    MANU_DEV_FALLBACK_STORE: "true",
  };
}

function loadOrCreateState(sourceCommit, newRun = false) {
  if (existsSync(statePath) && !newRun) {
    const state = readJson(statePath);
    if (state.sourceCommit !== sourceCommit) throw new Error("phase_6_state_source_commit_stale_use_newRun_true");
    if (state.phaseStatus === "BLOCKED") throw new Error("phase_6_blocked_requires_new_run");
    return state;
  }
  const state = createInitialState({ repoRoot, sourceCommit, openedAt: now() });
  writeJson(statePath, state);
  return state;
}

function writePhaseManifest(sourceCommit, precondition) {
  writeJson(path.join(docsRoot, "plan-manifest.json"), {
    schemaVersion: "aiya-system-audit-phase-plan-manifest-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    title: "Yuk, Ariza, Gozlemlenebilirlik ve Kurtarma",
    sourceCommit,
    createdAt: now(),
    precondition,
    stageOrder: PHASE_6_STAGES.map((stage) => stage.id),
    stages: PHASE_6_STAGES,
    outputPolicy: "secret-free-docs-and-runtime-only-redacted-test-summaries",
    mutationPolicy: {
      production: false,
      linkedSupabase: false,
      remoteRestore: false,
      remoteWorkerStart: false,
      destructiveChaos: false,
      realWhatsAppEgress: false,
      realAiProviderEgress: false,
      stripeLive: false,
      rawMediaTransfer: false,
    },
  });
}

function setStageState(state, stageId, patch) {
  state.stages[stageId] = { ...state.stages[stageId], ...patch };
  state.lastRun = { stageId, at: now(), status: state.stages[stageId].status };
  state.nextStage = PHASE_6_STAGES.find((stage) => state.stages[stage.id]?.status !== "VERIFIED")?.id ?? null;
  writeJson(statePath, state);
}

function parseVitestSummary(output) {
  const text = String(output ?? "");
  const first = (pattern) => Number(text.match(pattern)?.[1] ?? 0);
  return {
    passedFiles: first(/Test Files\s+(\d+)\s+passed/i),
    failedFiles: first(/Test Files\s+(\d+)\s+failed/i),
    passedTests: first(/Tests\s+(\d+)\s+passed/i),
    failedTests: first(/Tests\s+(\d+)\s+failed/i),
    skippedTests: first(/Tests\s+(\d+)\s+skipped/i),
  };
}

function runVitest(name, files, timeout = 600_000) {
  const missing = files.filter((file) => !existsSync(path.join(appRoot, file)));
  if (missing.length > 0) {
    return { name, status: "FAIL", exitCode: null, timedOut: false, fileCount: files.length, missingFiles: missing, summary: { passedFiles: 0, failedFiles: 0, passedTests: 0, failedTests: 0, skippedTests: 0 }, failure: "missing_test_files" };
  }
  const result = runCommand("npm", ["exec", "--", "vitest", "run", ...files, "--no-file-parallelism", "--maxWorkers=1", "--reporter=default"], {
    cwd: appRoot,
    env: localTestEnv(),
    timeout,
  });
  const combined = result.stdout + "\n" + result.stderr;
  return {
    name,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    fileCount: files.length,
    summary: parseVitestSummary(combined),
    failure: result.status === 0 ? null : redact(combined),
  };
}

function runNodeTest(name, relativeFile, timeout = 180_000) {
  const filePath = path.join(repoRoot, relativeFile);
  if (!existsSync(filePath)) return { name, status: "FAIL", exitCode: null, timedOut: false, failure: "missing_test_file" };
  const result = runCommand("node", ["--test", relativeFile], { cwd: repoRoot, timeout, env: localTestEnv() });
  const combined = result.stdout + "\n" + result.stderr;
  return {
    name,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    failure: result.status === 0 ? null : redact(combined),
  };
}

function runTypecheck() {
  const result = runCommand("npm", ["run", "typecheck"], { cwd: appRoot, env: localTestEnv(), timeout: 900_000 });
  return {
    name: "typecheck",
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    failure: result.status === 0 ? null : redact(result.stderr || result.stdout || result.error),
  };
}

function stageTests(stageId) {
  if (stageId === "6.1") {
    return [runVitest("phase-6-load-rehearsal", ["src/lib/phase-79g-unified-production-scale-rehearsal.test.ts"] )];
  }
  if (stageId === "6.2") {
    return [runVitest("phase-6-failure-injection", [
      "src/lib/phase-85-stage-4b3-local-worker-runner.test.ts",
      "src/lib/phase-85-stage-4b4-durable-transcript-bridge-worker.test.ts",
      "src/lib/phase-85-stage-4c-run-service.test.ts",
      "src/lib/rate-limit.test.ts",
      "../app/tests/request-id-error-propagation.test.ts",
    ])];
  }
  if (stageId === "6.3") {
    return [runVitest("phase-6-observability", [
      "src/lib/operational-health.test.ts",
      "src/lib/phase-85-stage-5-shell-metric-sink.test.ts",
      "src/lib/phase-77af-adapter-operational-health-rollback.test.ts",
      "src/lib/production-worker-release-contracts.test.ts",
    ])];
  }
  if (stageId === "6.4") {
    return [
      runNodeTest("phase-6-backup-restore", "app/scripts/hosted-sandbox-backup-restore.test.mjs"),
      runVitest("phase-6-worker-recovery", ["src/lib/production-worker-release-contracts.test.ts"]),
    ];
  }
  return [];
}

function allTestsPass(testResults) {
  return testResults.length > 0 && testResults.every((result) => result.status === "PASS");
}

function operationResults(stage, operationChecks, testResults, allowTests) {
  const results = [];
  let blocked = false;
  for (let index = 0; index < stage.operations.length; index += 1) {
    const check = operationChecks[index] ?? { id: `operation_${index + 1}`, pass: false };
    if (blocked) {
      results.push({ order: index + 1, description: stage.operations[index], id: check.id, status: "SKIPPED", reason: "previous_operation_blocked" });
      continue;
    }
    const passed = index === stage.operations.length - 1 ? allowTests && allTestsPass(testResults) : check.pass === true;
    if (!passed) blocked = true;
    results.push({
      order: index + 1,
      description: stage.operations[index],
      id: check.id,
      status: passed ? "PASS" : "BLOCKED",
      details: index === stage.operations.length - 1 ? testResults : check.details ?? null,
    });
  }
  return results;
}

function closureOperationResults(stage, closure, finalTestResults) {
  const byId = new Map(closure.checks.map((check) => [check.id, check]));
  const ordered = [
    byId.get("technical_stages_verified"),
    byId.get("stage_digests_valid"),
    {
      id: "manifest_source_and_boundary",
      pass: byId.get("source_commit_consistent")?.pass === true && byId.get("mutation_boundary_closed")?.pass === true,
      details: [byId.get("source_commit_consistent"), byId.get("mutation_boundary_closed")],
    },
    byId.get("phase6_contract_tests"),
    byId.get("reliability_recovery_tests"),
    byId.get("typecheck"),
    byId.get("no_blockers"),
    { id: "closure_write", pass: closure.status === "PASS", details: "closure file is written only after operations 1-7 pass" },
  ];
  const results = [];
  let blocked = false;
  for (let index = 0; index < stage.operations.length; index += 1) {
    const check = ordered[index] ?? { id: `operation_${index + 1}`, pass: false };
    if (blocked) {
      results.push({ order: index + 1, description: stage.operations[index], id: check.id, status: "SKIPPED", reason: "previous_operation_blocked" });
      continue;
    }
    const passed = check.pass === true;
    if (!passed) blocked = true;
    results.push({ order: index + 1, description: stage.operations[index], id: check.id, status: passed ? "PASS" : "BLOCKED", details: check.details ?? finalTestResults });
  }
  return results;
}

function attachStageVerification(matrix, stage, testResults, testsWereAllowed) {
  const operations = operationResults(stage, matrix.operationChecks, testResults, testsWereAllowed);
  const testsPass = testsWereAllowed && allTestsPass(testResults);
  const blockers = [
    ...(matrix.blockers ?? []),
    ...testResults.filter((result) => result.status !== "PASS").map((result) => ({ code: `test:${result.name}`, blocker: true, details: result.failure ?? result.status })),
    ...operations.filter((operation) => operation.status === "BLOCKED").map((operation) => ({ code: `operation:${operation.order}`, blocker: true })),
  ];
  const status = operations.every((operation) => operation.status === "PASS") && testsPass ? "PASS" : "BLOCKED";
  const output = {
    ...matrix,
    status,
    testResults,
    testsWereAllowed,
    operationChecks: matrix.operationChecks.map((check, index) => index === matrix.operationChecks.length - 1 ? { ...check, pass: testsPass, details: testResults } : check),
    operationResults: operations,
    blockers,
    matrixDigest: null,
  };
  output.matrixDigest = stableDigest({ ...output, matrixDigest: null });
  return { output, status, blockers, operations };
}

function stageEvidence({ state, stageId, outputName, status, blockers, testResults, operations }) {
  const stage = getPhase6Stage(stageId);
  const outputPath = phase6OutputPath(repoRoot, outputName);
  const outputDigest = sha256File(outputPath);
  const evidencePath = phase6EvidencePath(repoRoot, stageId);
  const evidence = buildEvidence({
    stage,
    sourceCommit: state.sourceCommit,
    status,
    outputFiles: [{ path: `docs/system-audit/phase-6/${outputName}`, sha256: outputDigest }],
    operations,
    verification: {
      rules: stage.verificationCriteria,
      result: status === "VERIFIED" ? "PASS" : "BLOCKED",
      outputDigest,
      testResults,
    },
    blockers,
  });
  writeJson(evidencePath, evidence);
  return {
    evidencePath: `docs/system-audit/phase-6/stages/stage-${stageId}.json`,
    evidenceDigest: sha256File(evidencePath),
    outputDigest,
  };
}

function executeMatrixStage(state, stageId, outputName, buildMatrix) {
  assertCanBeginStage(state, stageId);
  state.stages[stageId].status = "IN_PROGRESS";
  state.stages[stageId].sourceCommit = state.sourceCommit;
  writeJson(statePath, state);

  const stage = getPhase6Stage(stageId);
  const matrix = buildMatrix(repoRoot, state.sourceCommit);
  const preTestChecksPass = matrix.operationChecks.slice(0, -1).every((check) => check.pass === true);
  const testResults = preTestChecksPass ? stageTests(stageId) : [{ name: "not_run_after_operation_block", status: "SKIPPED", reason: "previous_operation_blocked" }];
  const verification = attachStageVerification(matrix, stage, testResults, preTestChecksPass);
  writeJson(phase6OutputPath(repoRoot, outputName), verification.output);
  const status = verification.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({
    state,
    stageId,
    outputName,
    status,
    blockers: verification.blockers,
    testResults,
    operations: verification.operations,
  });
  setStageState(state, stageId, {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers: verification.blockers,
    operationResults: verification.operations,
    sourceCommit: state.sourceCommit,
  });
  return { stageId, status, blockers: verification.blockers, testResults, operations: verification.operations, outputPath: `docs/system-audit/phase-6/${outputName}` };
}

function closurePreflight(state, sourceCommit) {
  const failures = [];
  for (const stageId of ["6.1", "6.2", "6.3", "6.4"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") failures.push(`stage_${stageId}_not_verified`);
    if (stage?.sourceCommit && stage.sourceCommit !== sourceCommit) failures.push(`stage_${stageId}_source_commit_drift`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-6", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) failures.push(`stage_${stageId}_output_stale:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) failures.push(`stage_${stageId}_evidence_stale`);
    }
  }
  if (process.env.MANU_ALLOW_REAL_ZAI === "true") failures.push("real_zai_egress_enabled");
  if (process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED === "true") failures.push("real_whatsapp_egress_enabled");
  if (process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED === "true") failures.push("real_media_provider_enabled");
  if (process.env.MANU_ALLOW_REMOTE_RLS_TESTS === "true") failures.push("remote_rls_tests_enabled");
  return { pass: failures.length === 0, failures };
}

function executeClosureStage(state) {
  const stageId = "6.5";
  assertCanBeginStage(state, stageId);
  const stage = getPhase6Stage(stageId);
  state.stages[stageId].status = "IN_PROGRESS";
  state.stages[stageId].sourceCommit = state.sourceCommit;
  writeJson(statePath, state);

  const preflight = closurePreflight(state, state.sourceCommit);
  let finalTestResults;
  if (!preflight.pass) {
    finalTestResults = [{ name: "closure_preflight", status: "FAIL", failure: preflight.failures.join(",") }];
  } else {
    const phaseContract = runNodeTest("phase-6-contract", "tools/system-audit/phase-6/phase-6.test.mjs");
    if (phaseContract.status !== "PASS") {
      finalTestResults = [phaseContract];
    } else {
      const reliability = runVitest("final-reliability", [
        "src/lib/phase-79g-unified-production-scale-rehearsal.test.ts",
        "src/lib/operational-health.test.ts",
        "src/lib/phase-85-stage-5-shell-metric-sink.test.ts",
        "src/lib/phase-77af-adapter-operational-health-rollback.test.ts",
        "src/lib/production-worker-release-contracts.test.ts",
        "src/lib/rate-limit.test.ts",
        "../app/tests/request-id-error-propagation.test.ts",
      ]);
      if (reliability.status !== "PASS") {
        finalTestResults = [phaseContract, reliability];
      } else {
        const recovery = runNodeTest("final-recovery", "app/scripts/hosted-sandbox-backup-restore.test.mjs");
        if (recovery.status !== "PASS") {
          finalTestResults = [phaseContract, reliability, recovery];
        } else {
          finalTestResults = [phaseContract, reliability, recovery, runTypecheck()];
        }
      }
    }
  }

  const closure = buildPhase6ClosureMatrix(repoRoot, state, state.sourceCommit, finalTestResults);
  const operations = closureOperationResults(stage, closure, finalTestResults);
  const blockers = [
    ...closure.blockers,
    ...operations.filter((operation) => operation.status === "BLOCKED").map((operation) => ({ code: `operation:${operation.order}`, blocker: true })),
  ];
  const status = operations.every((operation) => operation.status === "PASS") && closure.status === "PASS" ? "PASS" : "BLOCKED";
  const output = {
    ...closure,
    status,
    operationResults: operations,
    blockers,
    closureDigest: null,
  };
  output.closureDigest = stableDigest({ ...output, closureDigest: null });
  writeJson(phase6OutputPath(repoRoot, "phase-6-closure-evidence.json"), output);
  const evidence = stageEvidence({
    state,
    stageId,
    outputName: "phase-6-closure-evidence.json",
    status: status === "PASS" ? "VERIFIED" : "BLOCKED",
    blockers,
    testResults: finalTestResults,
    operations,
  });
  setStageState(state, stageId, {
    status: status === "PASS" ? "VERIFIED" : "BLOCKED",
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { "phase-6-closure-evidence.json": evidence.outputDigest },
    completedAt: now(),
    blockers,
    operationResults: operations,
    sourceCommit: state.sourceCommit,
  });

  if (status === "PASS") {
    state.phaseStatus = "CLOSED";
    state.nextStage = null;
    writeJson(statePath, state);
    writeJson(path.join(docsRoot, "phase-6-closure.json"), {
      schemaVersion: "aiya-system-audit-phase-closure-v1",
      planId: AUDIT_PLAN_ID,
      planVersion: AUDIT_PLAN_VERSION,
      phaseId: PHASE_6_ID,
      status: "CLOSED",
      closedAt: now(),
      sourceCommit: state.sourceCommit,
      stageEvidence: PHASE_6_STAGES.map((candidate) => ({ stageId: candidate.id, evidencePath: state.stages[candidate.id].evidencePath, evidenceDigest: state.stages[candidate.id].evidenceDigest })),
      finalOutput: { path: "docs/system-audit/phase-6/phase-6-closure-evidence.json", sha256: sha256File(phase6OutputPath(repoRoot, "phase-6-closure-evidence.json")) },
      closureRule: closure.closureRule,
      nextPhase: "phase-7",
      nextPhaseUnlocked: true,
    });
  } else {
    state.phaseStatus = "BLOCKED";
    state.nextStage = null;
    writeJson(statePath, state);
  }
  return { stageId, status: status === "PASS" ? "VERIFIED" : "BLOCKED", blockers, finalTestResults, operations, outputPath: "docs/system-audit/phase-6/phase-6-closure-evidence.json", phaseStatus: state.phaseStatus };
}

function executeStage(state, stageId) {
  if (stageId === "6.1") return executeMatrixStage(state, stageId, "load-capacity-matrix.json", buildLoadCapacityMatrix);
  if (stageId === "6.2") return executeMatrixStage(state, stageId, "failure-injection-matrix.json", buildFailureInjectionMatrix);
  if (stageId === "6.3") return executeMatrixStage(state, stageId, "observability-contract-matrix.json", buildObservabilityMatrix);
  if (stageId === "6.4") return executeMatrixStage(state, stageId, "recovery-operations-matrix.json", buildRecoveryMatrix);
  if (stageId === "6.5") return executeClosureStage(state);
  throw new Error(`unsupported_phase_6_stage:${stageId}`);
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  const allowed = new Set(["run-phase-6", "run-stage-6.1", "run-stage-6.2", "run-stage-6.3", "run-stage-6.4", "run-stage-6.5"]);
  if (!allowed.has(command)) throw new Error("usage: run-phase-6 [--newRun=true] | run-stage-6.1 | run-stage-6.2 | run-stage-6.3 | run-stage-6.4 | run-stage-6.5");

  const precondition = assertPhase5Closed(repoRoot);
  if (!precondition.ok) throw new Error(`${precondition.reason}:${(precondition.stageFailures ?? []).join(",")}`);
  const sourceCommit = gitHead();
  if (command === "run-phase-6") {
    const state = loadOrCreateState(sourceCommit, options.newRun === "true");
    writePhaseManifest(sourceCommit, precondition);
    const results = [];
    if (state.phaseStatus === "CLOSED") {
      process.stdout.write(`${JSON.stringify({ phaseStatus: state.phaseStatus, stages: state.stages }, null, 2)}\n`);
      return;
    }
    for (const stageId of ["6.1", "6.2", "6.3", "6.4", "6.5"]) {
      if (state.stages[stageId].status === "VERIFIED") continue;
      const result = executeStage(state, stageId);
      results.push(result);
      if (result.status === "BLOCKED") break;
    }
    process.stdout.write(`${JSON.stringify({ phaseStatus: state.phaseStatus, results }, null, 2)}\n`);
    if (state.phaseStatus === "BLOCKED" || results.some((result) => result.status === "BLOCKED")) process.exitCode = 2;
    return;
  }

  const state = existsSync(statePath) ? readJson(statePath) : loadOrCreateState(sourceCommit, false);
  const result = executeStage(state, command.replace("run-stage-", ""));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "BLOCKED") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`FAIL system-audit-phase-6: ${redact(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}
