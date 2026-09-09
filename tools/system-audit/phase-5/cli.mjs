import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PHASE_5_ID, PHASE_5_STAGES, getPhase5Stage } from "./phase-5-plan.mjs";
import {
  assertCanBeginStage,
  assertPhase4Closed,
  buildAuthenticatedShellMatrix,
  buildAuthUserFlowMatrix,
  buildEvidence,
  buildFrontendBackendContractMatrix,
  buildRealBackendBrowserSmokeMatrix,
  createInitialState,
  phase5EvidencePath,
  phase5OutputPath,
  readJson,
  sha256File,
  stableDigest,
  writeJson,
} from "./phase-5-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-5");
const runtimeRoot = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-5");
const statePath = path.join(runtimeRoot, "phase-5-state.json");

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
    timeout: options.timeout ?? 120_000,
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

function loadOrCreateState(sourceCommit, newRun = false) {
  if (existsSync(statePath) && !newRun) {
    const state = readJson(statePath);
    if (state.sourceCommit !== sourceCommit) throw new Error("phase_5_state_source_commit_stale_use_newRun_true");
    if (state.phaseStatus === "BLOCKED") throw new Error("phase_5_blocked_requires_new_run");
    return state;
  }
  const state = createInitialState({ repoRoot, sourceCommit, openedAt: now() });
  writeJson(statePath, state);
  return state;
}

function writePhaseManifest(sourceCommit, precondition) {
  writeJson(path.join(docsRoot, "plan-manifest.json"), {
    schemaVersion: "aiya-system-audit-phase-plan-manifest-v1",
    planId: "aiya-system-compatibility-reliability-release-readiness-v1",
    planVersion: "1.0.0",
    phaseId: PHASE_5_ID,
    title: "Gercek Backend ile Frontend ve Kullanici Akislari",
    sourceCommit,
    createdAt: now(),
    precondition,
    stageOrder: PHASE_5_STAGES.map((stage) => stage.id),
    stages: PHASE_5_STAGES,
    outputPolicy: "secret-free-docs-and-runtime-only-redacted-test-summaries",
    mutationPolicy: {
      production: false,
      linkedSupabase: false,
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
  state.nextStage = PHASE_5_STAGES.find((stage) => state.stages[stage.id]?.status !== "VERIFIED")?.id ?? null;
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
  const env = {
    ...process.env,
    MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
    MANU_ALLOW_REAL_ZAI: "false",
    MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
    MANU_DEV_FALLBACK_STORE: "true",
  };
  const result = runCommand("npm", ["exec", "--", "vitest", "run", ...files, "--no-file-parallelism", "--maxWorkers=1", "--reporter=default"], { cwd: appRoot, env, timeout });
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

function runNodeTest(name, file, timeout = 120_000) {
  if (!existsSync(path.join(repoRoot, file))) {
    return { name, status: "FAIL", exitCode: null, timedOut: false, failure: "missing_test_file" };
  }
  const result = runCommand("node", ["--test", file], { cwd: repoRoot, timeout });
  const combined = result.stdout + "\n" + result.stderr;
  return {
    name,
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    failure: result.status === 0 ? null : redact(combined),
  };
}

function runPlaywright(name, files, timeout = 900_000) {
  const missing = files.filter((file) => !existsSync(path.join(appRoot, file)));
  if (missing.length > 0) return { name, status: "FAIL", exitCode: null, fileCount: files.length, missingFiles: missing, failure: "missing_test_files" };
  const env = {
    ...process.env,
    MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
    MANU_ALLOW_REAL_ZAI: "false",
    MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
  };
  const result = runCommand("npx", ["playwright", "test", ...files, "--config=playwright.config.ts", "--project=desktop", "--workers=1"], { cwd: appRoot, env, timeout });
  const combined = result.stdout + "\n" + result.stderr;
  const passed = Number(combined.match(/(\d+) passed/i)?.[1] ?? 0);
  const failed = Number(combined.match(/(\d+) failed/i)?.[1] ?? 0);
  return { name, status: result.status === 0 ? "PASS" : "FAIL", exitCode: result.status, fileCount: files.length, summary: { passed, failed }, failure: result.status === 0 ? null : redact(combined) };
}

function runBuild(name, command, args, timeout = 900_000) {
  const env = {
    ...process.env,
    MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
    MANU_ALLOW_REAL_ZAI: "false",
    MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
    MANU_DEV_FALLBACK_STORE: "true",
  };
  const result = runCommand(command, args, { cwd: appRoot, env, timeout });
  return { name, status: result.status === 0 ? "PASS" : "FAIL", exitCode: result.status, timedOut: result.timedOut, failure: result.status === 0 ? null : redact(result.stderr || result.stdout || result.error) };
}

function stageOperationResults(stage, status, outputPath, testResults = []) {
  const testPass = testResults.every((result) => result.status === "PASS");
  return stage.operations.map((description, index) => ({
    order: index + 1,
    description,
    status: status === "VERIFIED" && testPass ? "PASS" : "BLOCKED",
    outputReferences: [outputPath],
  }));
}

function stageEvidence({ state, stageId, outputName, status, blockers = [], testResults = [], operationResults }) {
  const stage = getPhase5Stage(stageId);
  const outputPath = phase5OutputPath(repoRoot, outputName);
  const outputDigest = sha256File(outputPath);
  const evidencePath = phase5EvidencePath(repoRoot, stageId);
  const evidence = buildEvidence({
    stage,
    sourceCommit: state.sourceCommit,
    status,
    outputFiles: [{ path: `docs/system-audit/phase-5/${outputName}`, sha256: outputDigest }],
    operations: operationResults ?? stageOperationResults(stage, status, `docs/system-audit/phase-5/${outputName}`, testResults),
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
    evidencePath: `docs/system-audit/phase-5/stages/stage-${stageId}.json`,
    evidenceDigest: sha256File(evidencePath),
    outputDigest,
  };
}

function attachVerification(matrix, stage, testResults) {
  const staticPass = matrix.status === "PASS";
  const testsPass = testResults.every((result) => result.status === "PASS");
  const blockers = [
    ...(matrix.blockers ?? []),
    ...testResults.filter((result) => result.status !== "PASS").map((result) => ({ code: `test:${result.name}`, blocker: true })),
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
  const stage = getPhase5Stage(stageId);
  const matrix = buildMatrix(repoRoot);
  const verification = attachVerification(matrix, stage, testResults);
  writeJson(phase5OutputPath(repoRoot, outputName), verification.output);
  const status = verification.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const operationResults = stageOperationResults(stage, status, `docs/system-audit/phase-5/${outputName}`, testResults);
  const evidence = stageEvidence({ state, stageId, outputName, status, blockers: verification.blockers, testResults, operationResults });
  setStageState(state, stageId, {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers: verification.blockers,
    operationResults,
  });
  return { stageId, status, blockers: verification.blockers, testResults, outputPath: `docs/system-audit/phase-5/${outputName}` };
}

function stage51Tests() {
  return [
    "src/lib/phase-85-stage-5-shell-api.test.ts",
    "src/lib/phase-85-stage-5-shell-contracts.test.ts",
    "src/lib/phase-85-stage-5-shell-migration-contract.test.ts",
    "src/lib/phase-85-stage-4b-api.test.ts",
    "src/lib/phase-85-stage-4b2-api.test.ts",
    "src/lib/phase-85-stage-4b2-read-api.test.ts",
    "src/lib/phase-85-stage-4d-account-contracts.test.ts",
    "tests/request-id-error-propagation.test.ts",
  ];
}

function stage52Tests() {
  return [
    "src/lib/phase-84d-customer-auth.test.ts",
    "src/lib/phase-84e-customer-onboarding.test.ts",
    "src/lib/phase-84f-admin-console.test.ts",
    "src/lib/commercial-admin-access.test.ts",
    "src/lib/phase-85-stage-4d-account-contracts.test.ts",
    "src/lib/phase-85-stage-4d-account-security.test.ts",
    "src/lib/phase-85-stage-4d-auth-server.test.ts",
    "src/app/auth/callback/route.test.ts",
  ];
}

function stage53Tests() {
  const shellTests = [
    "src/lib/phase-85-stage-5-shell-active-client.test.ts",
    "src/lib/phase-85-stage-5-shell-api.test.ts",
    "src/lib/phase-85-stage-5-shell-authenticated-mutation.test.ts",
    "src/lib/phase-85-stage-5-shell-branding.test.ts",
    "src/lib/phase-85-stage-5-shell-bundle-budget.test.ts",
    "src/lib/phase-85-stage-5-shell-contracts.test.ts",
    "src/lib/phase-85-stage-5-shell-dirty-registry.test.ts",
    "src/lib/phase-85-stage-5-shell-i18n.test.ts",
    "src/lib/phase-85-stage-5-shell-metric-sink.test.ts",
    "src/lib/phase-85-stage-5-shell-migration-contract.test.ts",
    "src/lib/phase-85-stage-5-shell-navigation.test.ts",
    "src/lib/phase-85-stage-5-shell-preference-coordinator.test.ts",
    "src/lib/phase-85-stage-5-shell-privacy-scan.test.ts",
    "src/lib/phase-85-stage-5-shell-provider-state.test.ts",
    "src/lib/phase-85-stage-5-shell-pwa.test.ts",
    "src/lib/phase-85-stage-5-shell-session.test.ts",
  ];
  return [...shellTests, "src/lib/phase-85-stage-4b-dashboard-routing.test.ts", "src/lib/phase-83e3-app-shell.test.ts", "src/lib/phase-83d-pwa-install-gate.test.ts"];
}

function runRealBackendSmoke() {
  const result = runCommand("node", [path.join("tools", "system-audit", "phase-5", "real-backend-smoke.mjs")], { cwd: repoRoot, timeout: 1_200_000 });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    parsed = { status: "BLOCKED", blockers: ["smoke_output_invalid"], outputTail: redact(result.stdout + "\n" + result.stderr) };
  }
  return {
    name: "phase-5-real-backend-browser-smoke",
    status: result.status === 0 && parsed.status === "PASS" ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.timedOut,
    smoke: parsed,
    failure: result.status === 0 && parsed.status === "PASS" ? null : redact(result.stderr || parsed.outputTail),
  };
}

function executeStage54(state) {
  assertCanBeginStage(state, "5.4");
  state.stages["5.4"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const stage = getPhase5Stage("5.4");
  const buildResults = [
    runBuild("phase-5-production-typecheck", "npm", ["run", "typecheck"], 600_000),
  ];
  const buildPassed = buildResults.every((result) => result.status === "PASS");
  const smokeResult = buildPassed ? runRealBackendSmoke() : { name: "phase-5-real-backend-browser-smoke", status: "FAIL", exitCode: null, smoke: { status: "BLOCKED", blockers: ["production_build_not_passed"] }, failure: "production_build_not_passed" };
  const testResults = [...buildResults, smokeResult];
  const matrix = buildRealBackendBrowserSmokeMatrix(repoRoot, smokeResult.smoke);
  const verification = attachVerification(matrix, stage, testResults);
  const outputName = "real-backend-browser-smoke.json";
  writeJson(phase5OutputPath(repoRoot, outputName), verification.output);
  const status = verification.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const operationResults = stageOperationResults(stage, status, `docs/system-audit/phase-5/${outputName}`, testResults);
  const evidence = stageEvidence({ state, stageId: "5.4", outputName, status, blockers: verification.blockers, testResults, operationResults });
  setStageState(state, "5.4", {
    status,
    evidencePath: evidence.evidencePath,
    evidenceDigest: evidence.evidenceDigest,
    outputDigests: { [outputName]: evidence.outputDigest },
    completedAt: now(),
    blockers: verification.blockers,
    operationResults,
  });
  return { stageId: "5.4", status, blockers: verification.blockers, testResults, outputPath: `docs/system-audit/phase-5/${outputName}` };
}

function digestChecks(state) {
  const checks = [];
  for (const stage of PHASE_5_STAGES.slice(0, 4)) {
    const stageState = state.stages[stage.id];
    for (const [name, digest] of Object.entries(stageState.outputDigests ?? {})) {
      const outputPath = phase5OutputPath(repoRoot, name);
      checks.push({ stageId: stage.id, file: `docs/system-audit/phase-5/${name}`, status: existsSync(outputPath) && sha256File(outputPath) === digest ? "PASS" : "FAIL" });
    }
    const evidencePath = stageState.evidencePath ? path.join(repoRoot, stageState.evidencePath) : null;
    checks.push({ stageId: stage.id, file: stageState.evidencePath, status: evidencePath && existsSync(evidencePath) && sha256File(evidencePath) === stageState.evidenceDigest ? "PASS" : "FAIL" });
  }
  return checks;
}

function executeStage55(state) {
  assertCanBeginStage(state, "5.5");
  state.stages["5.5"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const stage = getPhase5Stage("5.5");
  const digestResults = digestChecks(state);
  const finalTests = [
    runNodeTest("phase-5-final-contracts", "tools/system-audit/phase-5/phase-5.test.mjs", 120_000),
    runBuild("phase-5-final-typecheck", "npm", ["run", "typecheck"], 600_000),
    runPlaywright("phase-5-public-and-auth-browser", ["tests/visual/commercial-saas.visual.spec.ts", "tests/visual/public-surface-cta.visual.spec.ts"], 900_000),
    runPlaywright("phase-5-authenticated-shell-browser", ["tests/visual/dashboard.visual.spec.ts", "tests/visual/settings.visual.spec.ts", "tests/visual/messaging.accessibility.spec.ts", "tests/visual/ai-chat.accessibility.spec.ts", "tests/visual/stage-5-shell.accessibility.spec.ts", "tests/visual/stage-5-shell.responsive.spec.ts"], 1_200_000),
  ];
  const allPreviousVerified = PHASE_5_STAGES.slice(0, 4).every((candidate) => state.stages[candidate.id].status === "VERIFIED");
  const mutationBoundary = {
    production: false,
    linkedSupabase: false,
    realWhatsAppEgress: process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED === "true",
    realAiProviderEgress: process.env.MANU_ALLOW_REAL_ZAI === "true",
    stripeLive: process.env.STRIPE_LIVE_MODE === "true",
    rawMediaTransfer: false,
  };
  const blockers = [
    ...digestResults.filter((check) => check.status !== "PASS").map((check) => ({ code: `digest:${check.stageId}:${check.file}`, blocker: true })),
    ...finalTests.filter((test) => test.status !== "PASS").map((test) => ({ code: `test:${test.name}`, blocker: true })),
    ...(allPreviousVerified ? [] : [{ code: "previous_stage_not_verified", blocker: true }]),
    ...(Object.values(mutationBoundary).some((value) => value === true) ? [{ code: "mutation_boundary_not_closed", blocker: true }] : []),
  ];
  const outputName = "frontend-backend-user-flow-closure.json";
  const operationResults = stage.operations.map((description, index) => ({ order: index + 1, description, status: blockers.length === 0 ? "PASS" : "BLOCKED", outputReferences: [`docs/system-audit/phase-5/${outputName}`] }));
  const output = {
    schemaVersion: "aiya-system-audit-phase-5-frontend-backend-user-flow-closure-v1",
    planId: "aiya-system-compatibility-reliability-release-readiness-v1",
    planVersion: "1.0.0",
    phaseId: PHASE_5_ID,
    generatedAt: now(),
    sourceCommit: state.sourceCommit,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    digestChecks: digestResults,
    finalTests,
    mutationBoundary,
    operationVerification: operationResults,
    blockers,
    closureRule: "all five stages VERIFIED, all required output/evidence digests valid, final typecheck/contract/browser tests PASS and mutation boundary closed",
    closureDigest: null,
  };
  output.closureDigest = stableDigest({ ...output, closureDigest: null });
  writeJson(phase5OutputPath(repoRoot, outputName), output);
  const status = output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = stageEvidence({ state, stageId: "5.5", outputName, status, blockers, testResults: finalTests, operationResults });
  setStageState(state, "5.5", {
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
    writeJson(path.join(docsRoot, "phase-5-closure.json"), {
      schemaVersion: "aiya-system-audit-phase-closure-v1",
      planId: "aiya-system-compatibility-reliability-release-readiness-v1",
      planVersion: "1.0.0",
      phaseId: PHASE_5_ID,
      status: "CLOSED",
      closedAt: now(),
      sourceCommit: state.sourceCommit,
      stageEvidence: PHASE_5_STAGES.map((candidate) => ({ stageId: candidate.id, evidencePath: state.stages[candidate.id].evidencePath, evidenceDigest: state.stages[candidate.id].evidenceDigest })),
      finalOutput: { path: `docs/system-audit/phase-5/${outputName}`, sha256: sha256File(phase5OutputPath(repoRoot, outputName)) },
      closureRule: output.closureRule,
      nextPhase: "phase-6",
      nextPhaseUnlocked: true,
    });
  } else {
    state.phaseStatus = "BLOCKED";
    state.nextStage = null;
    writeJson(statePath, state);
  }
  return { stageId: "5.5", status, blockers, finalTests, outputPath: `docs/system-audit/phase-5/${outputName}`, phaseStatus: state.phaseStatus };
}

function executeStage(state, stageId) {
  if (stageId === "5.1") return executeMatrixStage(state, stageId, "frontend-backend-contract-matrix.json", buildFrontendBackendContractMatrix, [runVitest("phase-5-contract-reconciliation", stage51Tests())]);
  if (stageId === "5.2") return executeMatrixStage(state, stageId, "auth-user-flow-matrix.json", buildAuthUserFlowMatrix, [runVitest("phase-5-auth-user-flows", stage52Tests())]);
  if (stageId === "5.3") return executeMatrixStage(state, stageId, "authenticated-shell-matrix.json", buildAuthenticatedShellMatrix, [runVitest("phase-5-authenticated-shell", stage53Tests())]);
  if (stageId === "5.4") return executeStage54(state);
  if (stageId === "5.5") return executeStage55(state);
  throw new Error(`unsupported_phase_5_stage:${stageId}`);
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  const allowed = new Set(["run-phase-5", "run-stage-5.1", "run-stage-5.2", "run-stage-5.3", "run-stage-5.4", "run-stage-5.5"]);
  if (!allowed.has(command)) throw new Error("usage: run-phase-5 [--newRun=true] | run-stage-5.1 | run-stage-5.2 | run-stage-5.3 | run-stage-5.4 | run-stage-5.5");
  const precondition = assertPhase4Closed(repoRoot);
  if (!precondition.ok) throw new Error(`${precondition.reason}:${(precondition.stageFailures ?? []).join(",")}`);
  const sourceCommit = gitHead();
  if (command === "run-phase-5") {
    const state = loadOrCreateState(sourceCommit, options.newRun === "true");
    writePhaseManifest(sourceCommit, precondition);
    const results = [];
    if (state.phaseStatus === "CLOSED") {
      process.stdout.write(`${JSON.stringify({ phaseStatus: state.phaseStatus, stages: state.stages }, null, 2)}\n`);
      return;
    }
    for (const stageId of ["5.1", "5.2", "5.3", "5.4", "5.5"]) {
      if (state.stages[stageId].status === "VERIFIED") continue;
      const result = executeStage(state, stageId);
      results.push(result);
      if (result.status !== "VERIFIED") break;
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
    process.stderr.write(`FAIL system-audit-phase-5: ${redact(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}
