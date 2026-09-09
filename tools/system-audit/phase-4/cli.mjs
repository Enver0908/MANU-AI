import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PHASE_4_ID, PHASE_4_STAGES, getPhase4Stage } from "./phase-4-plan.mjs";
import {
  assertCanBeginStage,
  assertPhase3Closed,
  buildAiContractMatrix,
  buildEvidence,
  buildMediaContractMatrix,
  buildMessagingContractMatrix,
  buildWorkerContractMatrix,
  createInitialState,
  phase4EvidencePath,
  phase4OutputPath,
  readJson,
  sha256File,
  stableDigest,
  writeJson,
} from "./phase-4-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-4");
const runtimeRoot = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-4");
const statePath = path.join(runtimeRoot, "phase-4-state.json");

function now() {
  return new Date().toISOString();
}

function runCommand(command, args, options = {}) {
  const executable = process.platform === "win32" && ["npm", "npx"].includes(command) ? command + ".cmd" : command;
  const result = spawnSync(executable, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 1024 * 1024 * 12,
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

function redact(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[url-redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[number-redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ACCESS_TOKEN|password|token|secret)[^\r\n]{0,100}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1_200);
}

function gitHead() {
  const result = runCommand("git", ["rev-parse", "HEAD"]);
  if (result.status !== 0) throw new Error("git_head_failed:" + redact(result.stderr || result.error));
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

function writePhaseManifest(sourceCommit, phase3Precondition) {
  writeJson(path.join(docsRoot, "plan-manifest.json"), {
    schemaVersion: "aiya-system-audit-phase-plan-manifest-v1",
    planId: "aiya-system-compatibility-reliability-release-readiness-v1",
    planVersion: "1.0.0",
    phaseId: PHASE_4_ID,
    title: "Workerlar, Mesajlasma, AI ve Medya Baglantilari",
    sourceCommit,
    createdAt: now(),
    precondition: phase3Precondition,
    stageOrder: PHASE_4_STAGES.map((stage) => stage.id),
    stages: PHASE_4_STAGES,
    outputPolicy: "secret-free-docs-and-runtime-only-redacted-test-summaries",
    mutationPolicy: {
      production: false,
      linkedSupabase: false,
      realWhatsAppEgress: false,
      realAiProviderEgress: false,
      rawMediaTransfer: false,
    },
  });
}

function setStageState(state, stageId, patch) {
  state.stages[stageId] = { ...state.stages[stageId], ...patch };
  state.lastRun = { stageId, at: now(), status: state.stages[stageId].status };
  state.nextStage = PHASE_4_STAGES.find((stage) => state.stages[stage.id]?.status !== "VERIFIED")?.id ?? null;
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
    return {
      name,
      status: "FAIL",
      exitCode: null,
      timedOut: false,
      fileCount: files.length,
      missingFiles: missing,
      summary: { passedFiles: 0, failedFiles: 0, passedTests: 0, failedTests: 0, skippedTests: 0 },
      failure: "missing_test_files",
    };
  }
  const env = {
    ...process.env,
    MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
    MANU_ALLOW_REAL_ZAI: "false",
    MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
  };
  const result = runCommand("npm", [
    "exec",
    "--",
    "vitest",
    "run",
    ...files,
    "--no-file-parallelism",
    "--maxWorkers=1",
    "--reporter=default",
  ], { cwd: appRoot, env, timeout });
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

function runTestGroup(name, files, timeout = 600_000) {
  return runVitest(name, files, timeout);
}

function stageOperationResults(stage, status, outputPath, testResults = []) {
  const testPass = testResults.every((result) => result.status === "PASS");
  return stage.operations.map((description, index) => ({
    order: index + 1,
    description,
    status: status === "VERIFIED" && testPass ? "PASS" : index === 0 && testResults.length === 0 ? "PASS" : "BLOCKED",
    outputReferences: [outputPath],
  }));
}

function stageEvidence({ state, stageId, outputName, status, blockers = [], testResults = [], operationResults }) {
  const stage = getPhase4Stage(stageId);
  const outputPath = phase4OutputPath(repoRoot, outputName);
  const outputDigest = sha256File(outputPath);
  const evidencePath = phase4EvidencePath(repoRoot, stageId);
  const evidence = buildEvidence({
    stage,
    sourceCommit: state.sourceCommit,
    status,
    outputFiles: [{ path: "docs/system-audit/phase-4/" + outputName, sha256: outputDigest }],
    operations: operationResults ?? stageOperationResults(stage, status, "docs/system-audit/phase-4/" + outputName, testResults),
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
    evidencePath: "docs/system-audit/phase-4/stages/stage-" + stageId + ".json",
    evidenceDigest: sha256File(evidencePath),
    outputDigest,
  };
}

function attachStageVerification(matrix, stage, testResults) {
  const staticPass = matrix.status === "PASS";
  const testsPass = testResults.every((result) => result.status === "PASS");
  const blockers = [
    ...(matrix.blockers ?? []),
    ...testResults.filter((result) => result.status !== "PASS").map((result) => ({ code: "test:" + result.name, blocker: true })),
  ];
  const status = staticPass && testsPass ? "PASS" : "BLOCKED";
  const output = {
    ...matrix,
    status,
    testResults,
    operationVerification: stage.operations.map((description, index) => ({
      order: index + 1,
      description,
      status: status === "PASS" ? "PASS" : "BLOCKED",
      evidence: index < (matrix.checks?.length ?? 0) ? matrix.checks[index] : { id: "targeted_tests", pass: testsPass },
    })),
    blockers,
    matrixDigest: null,
  };
  output.matrixDigest = stableDigest({ ...output, matrixDigest: null });
  return { output, status, blockers };
}

function executeMatrixStage(state, stageId, outputName, buildMatrix, testResults) {
  assertCanBeginStage(state, stageId);
  state.stages[stageId].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const stage = getPhase4Stage(stageId);
  const matrix = buildMatrix(repoRoot);
  const verification = attachStageVerification(matrix, stage, testResults);
  const outputPath = phase4OutputPath(repoRoot, outputName);
  writeJson(outputPath, verification.output);
  const status = verification.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const operationResults = stageOperationResults(stage, status, "docs/system-audit/phase-4/" + outputName, testResults);
  const evidence = stageEvidence({
    state,
    stageId,
    outputName,
    status,
    blockers: verification.blockers,
    testResults,
    operationResults,
  });
  setStageState(state, stageId, {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers: verification.blockers,
    operationResults,
  });
  return { stageId, status, blockers: verification.blockers, testResults, outputPath: "docs/system-audit/phase-4/" + outputName };
}

function stage41Tests() {
  return [
    "src/lib/production-worker-release-contracts.test.ts",
    "src/lib/phase-85-stage-4b3-local-worker-runner.test.ts",
    "src/lib/phase-85-stage-4b3-media-lifecycle-runner.test.ts",
    "src/lib/phase-85-stage-4b3-bundle-worker-outcomes.test.ts",
    "src/lib/phase-85-stage-4b4-transcription-worker.test.ts",
    "src/lib/phase-85-stage-4b4-durable-transcript-bridge-worker.test.ts",
    "src/lib/phase-85-stage-4c-lifecycle.test.ts",
  ];
}

function stage42Tests() {
  return [
    "src/lib/phase-77ab-whatsapp-cloud-payload-normalization.test.ts",
    "src/lib/phase-77ac-whatsapp-mock-webhook.test.ts",
    "src/lib/phase-77ad-whatsapp-channel-policy-mock.test.ts",
    "src/lib/phase-77ag-channel-replay-rehearsal.test.ts",
    "src/lib/phase-77ah-whatsapp-adapter-evidence-closure.test.ts",
    "src/lib/phase-85-if-c-channel-event-ledger.test.ts",
    "src/lib/phase-85-if-c-channel-event-normalizer.test.ts",
    "src/lib/phase-85-if-c-channel-event-routing.test.ts",
    "src/lib/phase-85-stage-4b2-messaging-integration.test.ts",
    "src/lib/phase-85-stage-4b2-receipt-lifecycle.test.ts",
    "src/lib/phase-85-stage-4b2-remediation-r5-evidence.test.ts",
    "src/lib/whatsapp-real-contracts.test.ts",
    "src/lib/whatsapp-real-migration-contract.test.ts",
    "src/lib/channel-adapters.test.ts",
  ];
}

function stage43Tests() {
  return [
    "src/lib/ai-provider.test.ts",
    "src/lib/phase-75-zai-provider-gate.test.ts",
    "src/lib/phase-76i-prompt-context-guard.test.ts",
    "src/lib/scope-guard-provider.test.ts",
    "src/lib/phase-85-stage-4c-lifecycle.test.ts",
    "src/lib/phase-85-stage-4c-remediation-closure.test.ts",
    "src/lib/phase-85-stage-4c-run-event-multiplexer.test.ts",
    "src/lib/phase-85-stage-4c-service.test.ts",
    "src/lib/phase-85-stage-4c-run-service.test.ts",
    "src/lib/use-ai-chat.test.ts",
  ];
}

function stage44Tests() {
  const files = [
    "src/lib/production-ai-media-security-migration-contract.test.ts",
    "src/lib/phase-85-stage-4b-integration-verification.test.ts",
  ];
  const libRoot = path.join(appRoot, "src", "lib");
  if (existsSync(libRoot)) {
    for (const entry of readdirSync(libRoot)) {
      if (/^phase-85-stage-4b[34]-.*\.test\.ts$/.test(entry)) files.push("src/lib/" + entry);
    }
  }
  return [...new Set(files)].sort();
}

function stage45Tests() {
  return [
    "src/lib/production-worker-release-contracts.test.ts",
    "src/lib/phase-85-stage-4b3-closure.test.ts",
    "src/lib/phase-85-stage-4b4-closure.test.ts",
    "src/lib/phase-85-stage-4c-closure.test.ts",
    "src/lib/whatsapp-real-migration-contract.test.ts",
    "src/lib/production-ai-media-security-migration-contract.test.ts",
  ];
}

function digestChecks(state) {
  const checks = [];
  for (const stage of PHASE_4_STAGES.slice(0, 4)) {
    const stageState = state.stages[stage.id];
    for (const [name, digest] of Object.entries(stageState.outputDigests ?? {})) {
      const outputPath = phase4OutputPath(repoRoot, name);
      checks.push({
        stageId: stage.id,
        file: "docs/system-audit/phase-4/" + name,
        status: existsSync(outputPath) && sha256File(outputPath) === digest ? "PASS" : "FAIL",
      });
    }
    const evidencePath = stageState.evidencePath ? path.join(repoRoot, stageState.evidencePath) : null;
    checks.push({
      stageId: stage.id,
      file: stageState.evidencePath,
      status: evidencePath && existsSync(evidencePath) && sha256File(evidencePath) === stageState.evidenceDigest ? "PASS" : "FAIL",
    });
  }
  return checks;
}

function executeStage45(state) {
  assertCanBeginStage(state, "4.5");
  state.stages["4.5"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const digestResults = digestChecks(state);
  const finalTests = [runTestGroup("phase-4-final-contracts", stage45Tests())];
  const allPreviousVerified = PHASE_4_STAGES.slice(0, 4).every((stage) => state.stages[stage.id].status === "VERIFIED");
  const mutationBoundary = {
    production: false,
    linkedSupabase: false,
    realWhatsAppEgress: process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED === "true",
    realAiProviderEgress: process.env.MANU_ALLOW_REAL_ZAI === "true",
    rawMediaTransfer: false,
  };
  const blockers = [
    ...digestResults.filter((check) => check.status !== "PASS").map((check) => ({ code: "digest:" + check.stageId + ":" + check.file, blocker: true })),
    ...finalTests.filter((test) => test.status !== "PASS").map((test) => ({ code: "test:" + test.name, blocker: true })),
    ...(allPreviousVerified ? [] : [{ code: "previous_stage_not_verified", blocker: true }]),
    ...(Object.values(mutationBoundary).some((value) => value === true) ? [{ code: "mutation_boundary_not_closed", blocker: true }] : []),
  ];
  const operationResults = getPhase4Stage("4.5").operations.map((description, index) => ({
    order: index + 1,
    description,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    outputReferences: ["docs/system-audit/phase-4/worker-messaging-ai-media-closure.json"],
  }));
  const output = {
    schemaVersion: "aiya-system-audit-phase-4-worker-messaging-ai-media-closure-v1",
    planId: "aiya-system-compatibility-reliability-release-readiness-v1",
    planVersion: "1.0.0",
    phaseId: PHASE_4_ID,
    generatedAt: now(),
    sourceCommit: state.sourceCommit,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    digestChecks: digestResults,
    finalTests,
    mutationBoundary,
    operationVerification: operationResults,
    blockers,
    closureRule: "all five stages VERIFIED, all required outputs/evidence digest-valid, final worker/messaging/AI/media tests PASS and mutation boundary closed",
    closureDigest: null,
  };
  output.closureDigest = stableDigest({ ...output, closureDigest: null });
  const outputName = "worker-messaging-ai-media-closure.json";
  writeJson(phase4OutputPath(repoRoot, outputName), output);
  const status = output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({
    state,
    stageId: "4.5",
    outputName,
    status,
    blockers,
    testResults: finalTests,
    operationResults,
  });
  setStageState(state, "4.5", {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers,
    operationResults,
  });
  if (status === "VERIFIED") {
    state.phaseStatus = "CLOSED";
    state.nextStage = null;
    writeJson(statePath, state);
    writeJson(path.join(docsRoot, "phase-4-closure.json"), {
      schemaVersion: "aiya-system-audit-phase-closure-v1",
      planId: "aiya-system-compatibility-reliability-release-readiness-v1",
      planVersion: "1.0.0",
      phaseId: PHASE_4_ID,
      status: "CLOSED",
      closedAt: now(),
      sourceCommit: state.sourceCommit,
      stageEvidence: PHASE_4_STAGES.map((stage) => ({
        stageId: stage.id,
        evidencePath: state.stages[stage.id].evidencePath,
        evidenceDigest: state.stages[stage.id].evidenceDigest,
      })),
      finalOutput: {
        path: "docs/system-audit/phase-4/" + outputName,
        sha256: sha256File(phase4OutputPath(repoRoot, outputName)),
      },
      closureRule: output.closureRule,
      nextPhase: "phase-5",
      nextPhaseUnlocked: true,
    });
  } else {
    state.phaseStatus = "BLOCKED";
    state.nextStage = null;
    writeJson(statePath, state);
  }
  return { stageId: "4.5", status, blockers, finalTests, outputPath: "docs/system-audit/phase-4/" + outputName, phaseStatus: state.phaseStatus };
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  const allowed = new Set(["run-phase-4", "run-stage-4.1", "run-stage-4.2", "run-stage-4.3", "run-stage-4.4", "run-stage-4.5"]);
  if (!allowed.has(command)) throw new Error("usage: run-phase-4 [--newRun=true] | run-stage-4.1 | run-stage-4.2 | run-stage-4.3 | run-stage-4.4 | run-stage-4.5");
  const precondition = assertPhase3Closed(repoRoot);
  if (!precondition.ok) throw new Error(precondition.reason + ":" + (precondition.stageFailures ?? []).join(","));
  const sourceCommit = gitHead();
  if (command === "run-phase-4") {
    const state = loadOrCreateState(sourceCommit, options.newRun === "true");
    writePhaseManifest(sourceCommit, precondition);
    const results = [];
    if (state.phaseStatus === "CLOSED") {
      process.stdout.write(JSON.stringify({ phaseStatus: state.phaseStatus, stages: state.stages }, null, 2) + "\n");
      return;
    }
    const stageIds = ["4.1", "4.2", "4.3", "4.4", "4.5"];
    for (const stageId of stageIds) {
      if (state.stages[stageId].status === "VERIFIED") continue;
      const result = await executeStage(state, stageId);
      results.push(result);
      if (result.status !== "VERIFIED") break;
    }
    process.stdout.write(JSON.stringify({ phaseStatus: state.phaseStatus, results }, null, 2) + "\n");
    if (state.phaseStatus === "BLOCKED" || results.some((result) => result.status === "BLOCKED")) process.exitCode = 2;
    return;
  }
  const state = existsSync(statePath) ? readJson(statePath) : loadOrCreateState(sourceCommit, false);
  if (state.phaseStatus === "BLOCKED") throw new Error("phase_4_blocked_requires_new_run");
  const stageId = command.replace("run-stage-", "");
  const result = await executeStage(state, stageId);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.status === "BLOCKED") process.exitCode = 2;
}

async function executeStage(state, stageId) {
  if (stageId === "4.1") return executeMatrixStage(state, stageId, "worker-contract-matrix.json", buildWorkerContractMatrix, [runTestGroup("phase-4-worker-contracts", stage41Tests())]);
  if (stageId === "4.2") return executeMatrixStage(state, stageId, "messaging-contract-matrix.json", buildMessagingContractMatrix, [runTestGroup("phase-4-messaging-contracts", stage42Tests())]);
  if (stageId === "4.3") return executeMatrixStage(state, stageId, "ai-contract-matrix.json", buildAiContractMatrix, [runTestGroup("phase-4-ai-contracts", stage43Tests())]);
  if (stageId === "4.4") return executeMatrixStage(state, stageId, "media-contract-matrix.json", buildMediaContractMatrix, [runTestGroup("phase-4-media-contracts", stage44Tests(), 900_000)]);
  if (stageId === "4.5") return executeStage45(state);
  throw new Error("unsupported_phase_4_stage:" + stageId);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("FAIL system-audit-phase-4: " + redact(error?.message ?? error) + "\n");
    process.exitCode = 1;
  });
}
