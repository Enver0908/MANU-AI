#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  assertCanBeginStage,
  assertPhase6Closed,
  buildCiReleaseGateMatrix,
  buildPhase7ClosureMatrix,
  buildReleaseGateMatrix,
  buildStageEvidence,
  buildTargetEnvironmentReconciliationMatrix,
  createInitialState,
  deriveAuditReleaseIdentity,
  gitHead,
  mutationPolicySnapshot,
  readJson,
  sha256File,
  stableDigest,
  writeJson,
} from "./phase-7-contract.mjs";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_7_ID, PHASE_7_STAGES, getPhase7Stage } from "./phase-7-plan.mjs";
import {
  assertReleaseArtifactManifest,
} from "../../hosted-sandbox/deploy/lib/deploy-contract.mjs";
import { assertServiceWorkerSourceUsesPlaceholder } from "../../../app/scripts/lib/release-identity.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-7");
const runtimeRoot = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-7");
const statePath = path.join(runtimeRoot, "phase-7-state.json");
const planManifestPath = path.join(docsRoot, "plan-manifest.json");
const phase7TestPath = "tools/system-audit/phase-7/phase-7.test.mjs";
const filteredDeployTestPattern = "forbidden deploy flags|fingerprint mismatch|hosted schema contract|release artifact manifest validation|dry-run atomic deploy|artifact-required dry-run|nginx template verify";

function now() {
  return new Date().toISOString();
}

function commandName(command) {
  if (process.platform === "win32" && command === "npm") return "npm.cmd";
  return command;
}

function redact(value) {
  return String(value ?? "")
    .replace(/https?:\/\/[^\s]+/gi, "[url-redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email-redacted]")
    .replace(/(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ACCESS_TOKEN|password|token|secret)[^\r\n]{0,160}/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(-1_500);
}

function safeLocalEnv(identity = null, extra = {}) {
  const env = {
    ...process.env,
    MANU_CI_NO_PRODUCTION_EFFECTS: "true",
    MANU_ALLOW_REMOTE_RLS_TESTS: "false",
    MANU_WHATSAPP_REAL_WEBHOOK_ENABLED: "false",
    MANU_ALLOW_REAL_ZAI: "false",
    MANU_MEDIA_REAL_PROVIDER_ENABLED: "false",
    MANU_PRODUCTION_PILOT_STARTED: "false",
    MANU_ENABLE_PROVIDER_EGRESS: "false",
    MANU_ENABLE_CHANNEL_EGRESS: "false",
    MANU_ENABLE_LIVE_BILLING: "false",
    MANU_ENABLE_PRODUCTION_SCHEMA: "false",
    MANU_HOSTED_SANDBOX_BACKUP_APPROVED: "false",
    MANU_HOSTED_SANDBOX_RESTORE_APPROVED: "false",
    MANU_HOSTED_ACTIVATION_APPROVED: "false",
    MANU_DEPLOY_SKIP_LINUX_OPTIONAL_DEPS: "true",
    ...extra,
  };
  delete env.MANU_SMOKE_BASE_URL;
  delete env.MANU_HOSTED_DEPLOY_APPROVED;
  delete env.MANU_SSH_HOST_KEY_PIN;
  delete env.MANU_RELEASE_ARTIFACT_MANIFEST;
  delete env.MANU_RELEASE_ARTIFACT_DIR;
  delete env.MANU_DEPLOY_WORK_ROOT;
  delete env.MANU_DEPLOY_TEXT_POINTER;
  delete env.MANU_RELEASE_ARTIFACT_REQUIRED;
  if (identity) {
    env.NODE_ENV = "production";
    env.MANU_RELEASE_ID = identity.releaseId;
    env.MANU_RELEASE_COMMIT_SHA = identity.commitSha;
    env.MANU_RELEASE_BUILT_AT = identity.builtAt;
    env.MANU_RELEASE_ENVIRONMENT = identity.environment;
    env.MANU_RELEASE_MIGRATION_FINGERPRINT = identity.migrationFingerprint;
    env.MANU_RELEASE_COMPATIBILITY_VERSION = identity.compatibilityVersion;
    env.MANU_EXPECTED_MIGRATION_FINGERPRINT = identity.migrationFingerprint;
  }
  return env;
}

function runCommand(command, args, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(commandName(command), args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32" && command === "npm",
    timeout: options.timeout ?? 900_000,
    maxBuffer: 1024 * 1024 * 60,
    env: options.env ?? safeLocalEnv(),
    windowsHide: true,
  });
  return {
    status: result.status === 0 ? "PASS" : "FAIL",
    exitCode: result.status,
    timedOut: result.error?.code === "ETIMEDOUT",
    durationMs: Date.now() - startedAt,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error?.message ?? null,
  };
}

function commandSummary(name, command, args, result, extra = {}) {
  return {
    name,
    command: [commandName(command), ...args].join(" "),
    status: result.status,
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    durationMs: result.durationMs,
    outputTail: result.status === "PASS" ? null : redact(result.stderr || result.stdout || result.error),
    ...extra,
  };
}

function runNode(name, relativeScript, args = [], options = {}) {
  const result = runCommand(process.execPath, [path.join(repoRoot, relativeScript), ...args], options);
  return commandSummary(name, process.execPath, [relativeScript, ...args], result);
}

function runNodeTest(name, relativeFile, options = {}) {
  const result = runCommand(process.execPath, ["--test", relativeFile], options);
  return commandSummary(name, process.execPath, ["--test", relativeFile], result);
}

function runFilteredDeployTests(identity) {
  const env = safeLocalEnv(identity);
  const args = ["--test", `--test-name-pattern=${filteredDeployTestPattern}`, "tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs"];
  const result = runCommand(process.execPath, args, { env, timeout: 300_000 });
  return commandSummary("filtered-deploy-machinery-tests", process.execPath, args, result, { filter: filteredDeployTestPattern });
}

function runNpm(name, script, cwd, identity, timeout = 900_000) {
  const args = ["run", script];
  const result = runCommand("npm", args, { cwd, env: safeLocalEnv(identity), timeout });
  return commandSummary(name, "npm", args, result, { workingDirectory: path.relative(repoRoot, cwd) || "." });
}

function runOracleTests(identity) {
  const args = [
    "exec",
    "--",
    "vitest",
    "run",
    "src/lib/hosted-sandbox-release-identity.test.ts",
    "src/lib/hosted-sandbox-security-headers.test.ts",
    "--no-file-parallelism",
    "--maxWorkers=1",
    "--reporter=default",
  ];
  const result = runCommand("npm", args, { cwd: appRoot, env: safeLocalEnv(identity), timeout: 600_000 });
  return commandSummary("hosted-oracle-tests", "npm", args, result, { workingDirectory: "app" });
}

function allPass(results) {
  return results.length > 0 && results.every((result) => result.status === "PASS");
}

function parseJsonOutput(output) {
  const lines = String(output ?? "").trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    try {
      return JSON.parse(line);
    } catch {
      continue;
    }
  }
  return null;
}

function readState() {
  if (!existsSync(statePath)) throw new Error("phase_7_state_missing");
  return readJson(statePath);
}

function writeState(state) {
  writeJson(statePath, state);
}

function writePlanManifest(sourceCommit, phase6Precondition) {
  writeJson(planManifestPath, {
    schemaVersion: "aiya-system-audit-phase-plan-manifest-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    title: "CI, Hedef Ortam Uzlastirmasi ve Nihai Yayin Kapanisi",
    sourceCommit,
    createdAt: now(),
    precondition: phase6Precondition,
    stageOrder: PHASE_7_STAGES.map((stage) => stage.id),
    stages: PHASE_7_STAGES,
    outputPolicy: "secret-free-docs-and-runtime-only-redacted-test-summaries",
    mutationPolicy: {
      production: false,
      linkedSupabase: false,
      remoteRestore: false,
      remoteWorkerStart: false,
      remoteWorkflowDispatch: false,
      realWhatsAppEgress: false,
      realTelegramEgress: false,
      realEmailEgress: false,
      realAiProviderEgress: false,
      stripeLive: false,
      rawMediaTransfer: false,
      commit: false,
      push: false,
    },
    localOnlyBoundary: [
      "workflow and target files are read locally; no dispatch",
      "no production, Supabase, SSH, provider, channel or billing mutation",
      "only local build, isolated temp dry-run and secret-free evidence writes",
      "technical closure does not imply production GO",
    ],
  });
}

function setStageState(state, stageId, patch) {
  state.stages[stageId] = { ...state.stages[stageId], ...patch };
  state.lastRun = { stageId, at: now(), status: state.stages[stageId].status };
  state.nextStage = PHASE_7_STAGES.find((stage) => state.stages[stage.id]?.status !== "VERIFIED")?.id ?? null;
  writeState(state);
}

function orderedOperationResults(stageId, checks) {
  const stage = getPhase7Stage(stageId);
  let blocked = false;
  return stage.operations.map((description, index) => {
    const check = checks[index] ?? { id: `operation_${index + 1}`, pass: false };
    if (blocked) return { order: index + 1, description, id: check.id, status: "SKIPPED", reason: "previous_operation_blocked" };
    const pass = check.pass === true;
    if (!pass) blocked = true;
    return { order: index + 1, description, id: check.id, status: pass ? "PASS" : "BLOCKED", details: check.details ?? null };
  });
}

function stageOutputPath(name) {
  return path.join(docsRoot, name);
}

function stageEvidencePath(stageId) {
  return path.join(docsRoot, "stages", `stage-${stageId}.json`);
}

function persistStage(state, stageId, outputName, matrix, testResults, operations) {
  const outputPath = stageOutputPath(outputName);
  writeJson(outputPath, { ...matrix, testResults, operationResults: operations, blockers: [...(matrix.blockers ?? []), ...operations.filter((operation) => operation.status === "BLOCKED").map((operation) => ({ code: `operation:${operation.order}`, blocker: true }))], matrixDigest: null });
  const output = readJson(outputPath);
  output.matrixDigest = stableDigest({ ...output, matrixDigest: null, generatedAt: null });
  writeJson(outputPath, output);
  const status = operations.every((operation) => operation.status === "PASS") && output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = buildStageEvidence({
    stageId,
    sourceCommit: state.sourceCommit,
    status,
    outputFiles: [{ path: `docs/system-audit/phase-7/${outputName}`, sha256: sha256File(outputPath) }],
    operations,
    verification: { rules: getPhase7Stage(stageId).verificationCriteria, result: status === "VERIFIED" ? "PASS" : "BLOCKED", outputDigest: sha256File(outputPath), testResults },
    blockers: output.blockers,
  });
  const evidencePath = stageEvidencePath(stageId);
  writeJson(evidencePath, evidence);
  if (status === "BLOCKED") state.phaseStatus = "BLOCKED";
  setStageState(state, stageId, {
    status,
    evidencePath: path.relative(repoRoot, evidencePath).replace(/\\/g, "/"),
    evidenceDigest: sha256File(evidencePath),
    outputDigests: { [outputName]: sha256File(outputPath) },
    completedAt: now(),
    blockers: output.blockers,
    operationResults: operations,
    sourceCommit: state.sourceCommit,
  });
  return { status, blockers: output.blockers, outputPath: path.relative(repoRoot, outputPath).replace(/\\/g, "/"), operations, testResults };
}

function beginStage(state, stageId) {
  assertCanBeginStage(state, stageId);
  state.stages[stageId].status = "IN_PROGRESS";
  state.stages[stageId].sourceCommit = state.sourceCommit;
  writeState(state);
}

function runStage71(state) {
  const stageId = "7.1";
  beginStage(state, stageId);
  const phase6Precondition = assertPhase6Closed(repoRoot, state.sourceCommit);
  const preMatrix = buildCiReleaseGateMatrix(repoRoot, state.sourceCommit, { phase6Precondition });
  const preChecksPass = preMatrix.operationChecks.slice(0, 7).every((check) => check.pass === true);
  const testResults = preChecksPass
    ? [
        runNode("workflow-hardening-verifier", "tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs", [], { env: safeLocalEnv(), timeout: 180_000 }),
        runNodeTest("phase-7-contract", phase7TestPath, { env: safeLocalEnv(), timeout: 180_000 }),
      ]
    : [{ name: "phase-7.1-gates", status: "SKIPPED", reason: "previous_operation_blocked" }];
  const finalGate = { pass: allPass(testResults), tests: testResults };
  const matrix = buildCiReleaseGateMatrix(repoRoot, state.sourceCommit, { phase6Precondition, finalGate });
  const operations = orderedOperationResults(stageId, matrix.operationChecks);
  return persistStage(state, stageId, "ci-release-gate-matrix.json", matrix, testResults, operations);
}

function readStageMatrix(stageId, name) {
  const stageState = readState().stages[stageId];
  const outputPath = path.join(docsRoot, name);
  if (!stageState || stageState.status !== "VERIFIED" || !existsSync(outputPath) || sha256File(outputPath) !== stageState.outputDigests?.[name]) {
    throw new Error(`phase_7_stage_output_not_verified:${stageId}`);
  }
  return readJson(outputPath);
}

function runStage72(state) {
  const stageId = "7.2";
  beginStage(state, stageId);
  const ciMatrix = readStageMatrix("7.1", "ci-release-gate-matrix.json");
  const identity = deriveAuditReleaseIdentity(repoRoot, state.sourceCommit);
  const targetProbe = { status: "NOT_RUN_BY_POLICY", httpCalls: 0, supabaseCalls: 0, sshCalls: 0, providerCalls: 0, channelCalls: 0, reason: "local_phase_boundary" };
  const mutationPolicy = mutationPolicySnapshot(safeLocalEnv(identity));
  const preMatrix = buildTargetEnvironmentReconciliationMatrix(repoRoot, state.sourceCommit, {
    identity,
    ciStageVerified: ciMatrix.status === "PASS",
    ciStageDetails: { status: ciMatrix.status, matrixDigest: ciMatrix.matrixDigest },
    targetProbe,
    mutationPolicy,
  });
  const preChecksPass = preMatrix.operationChecks.slice(0, 7).every((check) => check.pass === true);
  const testResults = preChecksPass ? [runNodeTest("phase-7-contract", phase7TestPath, { env: safeLocalEnv(identity), timeout: 180_000 })] : [{ name: "phase-7.2-gates", status: "SKIPPED", reason: "previous_operation_blocked" }];
  const finalGate = { pass: allPass(testResults), tests: testResults };
  const matrix = buildTargetEnvironmentReconciliationMatrix(repoRoot, state.sourceCommit, {
    identity,
    ciStageVerified: ciMatrix.status === "PASS",
    ciStageDetails: { status: ciMatrix.status, matrixDigest: ciMatrix.matrixDigest },
    targetProbe,
    mutationPolicy,
    finalGate,
  });
  const operations = orderedOperationResults(stageId, matrix.operationChecks);
  return persistStage(state, stageId, "target-environment-reconciliation-matrix.json", matrix, testResults, operations);
}

function artifactSummary(repoRoot, identity, rawOutput) {
  const payload = parseJsonOutput(rawOutput);
  const manifestPath = payload?.manifestPath ? path.resolve(payload.manifestPath) : path.join(repoRoot, ".manu-runtime", "hosted-sandbox", "artifacts", identity.commitSha, "release-manifest.json");
  if (!existsSync(manifestPath)) return { pass: false, reason: "release_manifest_missing", manifestPath: path.relative(repoRoot, manifestPath).replace(/\\/g, "/") };
  try {
    const manifest = readJson(manifestPath);
    assertReleaseArtifactManifest(manifest, { requireArchive: true });
    const pass = manifest.commitSha === identity.commitSha && manifest.migrationFingerprint === identity.migrationFingerprint && manifest.releaseId === identity.releaseId && manifest.compatibilityVersion === identity.compatibilityVersion;
    return {
      pass,
      manifestPath: path.relative(repoRoot, manifestPath).replace(/\\/g, "/"),
      mode: manifest.mode,
      commitSha: manifest.commitSha,
      migrationFingerprint: manifest.migrationFingerprint,
      releaseId: manifest.releaseId,
      compatibilityVersion: manifest.compatibilityVersion,
      archiveSha256: manifest.releaseArtifact?.archiveSha256 ?? null,
      archivePath: manifest.releaseArtifact?.archivePath ? path.relative(repoRoot, manifest.releaseArtifact.archivePath).replace(/\\/g, "/") : null,
      reason: pass ? null : "release_manifest_identity_mismatch",
    };
  } catch (error) {
    return { pass: false, reason: redact(error?.message ?? error), manifestPath: path.relative(repoRoot, manifestPath).replace(/\\/g, "/") };
  }
}

function runAtomicDryRun(identity, manifestPath) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "aiya-phase-7-deploy-"));
  let command;
  let cleanup = "PASS";
  try {
    const args = ["--dry-run"];
    const result = runCommand(process.execPath, [path.join(repoRoot, "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs"), ...args], {
      env: safeLocalEnv(identity, {
        MANU_DEPLOY_WORK_ROOT: tempRoot,
        MANU_DEPLOY_TEXT_POINTER: "true",
        MANU_RELEASE_ARTIFACT_REQUIRED: "true",
        MANU_RELEASE_ARTIFACT_MANIFEST: manifestPath,
      }),
      timeout: 300_000,
    });
    command = commandSummary("atomic-deploy-dry-run", process.execPath, ["deploy-hosted-release.mjs", ...args], result, { isolatedTempRoot: true });
  } finally {
    try {
      rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      cleanup = "FAIL";
    }
  }
  return { ...command, status: command?.status === "PASS" && cleanup === "PASS" ? "PASS" : "FAIL", cleanup };
}

function runStage73(state) {
  const stageId = "7.3";
  beginStage(state, stageId);
  const targetMatrix = readStageMatrix("7.2", "target-environment-reconciliation-matrix.json");
  const identity = deriveAuditReleaseIdentity(repoRoot, state.sourceCommit);
  const commandResults = [];
  const localCiResults = [];
  let canContinue = targetMatrix.status === "PASS";
  if (canContinue) {
    for (const command of [
      runNpm("lint", "lint", appRoot, identity),
      runNpm("production-typecheck", "typecheck", appRoot, identity),
      runOracleTests(identity),
    ]) {
      commandResults.push(command);
      localCiResults.push(command);
      if (command.status !== "PASS") {
        canContinue = false;
        break;
      }
    }
  }
  const localCiPass = canContinue && allPass(localCiResults);
  let buildResult = null;
  let artifact = null;
  let verifierResults = [];
  let smokeResult = null;
  let atomicResult = null;
  if (canContinue) {
    buildResult = runNpm("production-build", "build", appRoot, identity, 1_200_000);
    commandResults.push(buildResult);
    if (buildResult.status === "PASS") {
      try {
        assertServiceWorkerSourceUsesPlaceholder(repoRoot);
        buildResult = { ...buildResult, identityBoundary: { pass: existsSync(path.join(appRoot, ".next", "standalone")), trackedServiceWorkerPlaceholder: true }, status: existsSync(path.join(appRoot, ".next", "standalone")) ? "PASS" : "FAIL" };
      } catch (error) {
        buildResult = { ...buildResult, status: "FAIL", identityBoundary: { pass: false, reason: redact(error?.message ?? error) } };
      }
    }
    if (buildResult.status !== "PASS") canContinue = false;
  }
  if (canContinue) {
    const artifactScript = "tools/hosted-sandbox/deploy/build-release-artifact.mjs";
    const artifactRaw = runCommand(process.execPath, [path.join(repoRoot, artifactScript)], { env: safeLocalEnv(identity), timeout: 1_200_000 });
    const artifactCommand = commandSummary("build-hosted-release-artifact", process.execPath, [artifactScript], artifactRaw);
    commandResults.push(artifactCommand);
    if (artifactCommand.status === "PASS") {
      artifact = artifactSummary(repoRoot, identity, artifactRaw.stdout);
      if (!artifact.pass) canContinue = false;
    } else {
      canContinue = false;
    }
  }
  if (canContinue) {
    const deployTests = runFilteredDeployTests(identity);
    const hardening = runNode("workflow-hardening-verifier", "tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs", [], { env: safeLocalEnv(identity), timeout: 180_000 });
    const nginx = runNode("nginx-template-verifier", "tools/hosted-sandbox/deploy/verify-nginx-template.mjs", [], { env: safeLocalEnv(identity), timeout: 180_000 });
    const hosted = runNode("hosted-sandbox-contract-verifier", "app/scripts/verify-hosted-sandbox-contracts.mjs", [], { env: safeLocalEnv(identity), timeout: 180_000 });
    verifierResults = [deployTests, hardening, nginx, hosted];
    commandResults.push(...verifierResults);
    if (!allPass(verifierResults)) canContinue = false;
  }
  if (canContinue) {
    const smoke = runNode("smoke-dry-run", "tools/hosted-sandbox/deploy/run-smoke-check.mjs", ["--dry-run"], { env: safeLocalEnv(identity), timeout: 60_000 });
    smokeResult = smoke;
    commandResults.push(smoke);
    if (smoke.status !== "PASS") canContinue = false;
  }
  if (canContinue && artifact?.manifestPath) {
    atomicResult = runAtomicDryRun(identity, path.join(repoRoot, artifact.manifestPath));
    commandResults.push(atomicResult);
    if (atomicResult.status !== "PASS") canContinue = false;
  }
  const matrix = buildReleaseGateMatrix(repoRoot, state.sourceCommit, {
    identity,
    targetStageVerified: targetMatrix.status === "PASS",
    targetStageDetails: { status: targetMatrix.status, matrixDigest: targetMatrix.matrixDigest },
    localCiPass,
    localCiResults,
    buildPass: buildResult?.status === "PASS",
    buildResult,
    artifact,
    verifierPass: verifierResults.length === 4 && allPass(verifierResults),
    verifierResults,
    smokePass: smokeResult?.status === "PASS",
    smokeResult,
    atomicPass: atomicResult?.status === "PASS",
    atomicResult,
    commandResults,
  });
  const operations = orderedOperationResults(stageId, matrix.operationChecks);
  return persistStage(state, stageId, "release-gate-matrix.json", matrix, commandResults, operations);
}

function runFinalContract(identity = null) {
  return runNodeTest("phase-7-contract-final", phase7TestPath, { env: safeLocalEnv(identity), timeout: 180_000 });
}

function closureOperations(closureMatrix, finalTest) {
  const stage = getPhase7Stage("7.4");
  const checks = closureMatrix.checks.map((check) => ({ ...check }));
  let blocked = false;
  const operations = checks.map((check, index) => {
    if (blocked) return { order: index + 1, description: stage.operations[index], id: check.id, status: "SKIPPED", reason: "previous_operation_blocked" };
    if (check.id === "phase7_contract_test") check.pass = finalTest.status === "PASS";
    const pass = check.pass === true;
    if (!pass) blocked = true;
    return { order: index + 1, description: stage.operations[index], id: check.id, status: pass ? "PASS" : "BLOCKED", details: check.details ?? null };
  });
  const allPriorPass = operations.length === 7 && operations.every((operation) => operation.status === "PASS");
  operations.push({ order: 8, description: stage.operations[7], id: "closure_write", status: allPriorPass && closureMatrix.status === "PASS" ? "PASS" : "BLOCKED", details: allPriorPass ? "closure files are written after operations 1-7" : "previous_operation_blocked" });
  return operations;
}

function runStage74(state) {
  const stageId = "7.4";
  beginStage(state, stageId);
  const ciMatrix = readStageMatrix("7.1", "ci-release-gate-matrix.json");
  const targetMatrix = readStageMatrix("7.2", "target-environment-reconciliation-matrix.json");
  const releaseMatrix = readStageMatrix("7.3", "release-gate-matrix.json");
  const identity = deriveAuditReleaseIdentity(repoRoot, state.sourceCommit);
  const finalTest = runFinalContract(identity);
  const planManifest = existsSync(planManifestPath) ? readJson(planManifestPath) : null;
  const closureMatrix = buildPhase7ClosureMatrix(repoRoot, state, state.sourceCommit, {
    targetMatrix,
    releaseMatrix,
    finalContractTest: finalTest,
    mutationPolicy: mutationPolicySnapshot(safeLocalEnv(identity)),
    planManifestSourceCommit: planManifest?.sourceCommit ?? null,
  });
  const operations = closureOperations(closureMatrix, finalTest);
  const closureStatus = operations.every((operation) => operation.status === "PASS") ? "CLOSED" : "BLOCKED";
  const closureEvidence = {
    ...closureMatrix,
    status: closureStatus === "CLOSED" ? "PASS" : "BLOCKED",
    operationResults: operations,
    finalTestResults: [finalTest],
    releaseIdentity: identity,
    upstreamStageDigests: {
      "7.1": ciMatrix.matrixDigest,
      "7.2": targetMatrix.matrixDigest,
      "7.3": releaseMatrix.matrixDigest,
    },
    closureDigest: null,
  };
  closureEvidence.closureDigest = stableDigest({ ...closureEvidence, closureDigest: null, generatedAt: null });
  const closureEvidencePath = stageOutputPath("phase-7-closure-evidence.json");
  writeJson(closureEvidencePath, closureEvidence);
  if (closureStatus !== "CLOSED") {
    const evidence = buildStageEvidence({
      stageId,
      sourceCommit: state.sourceCommit,
      status: "BLOCKED",
      outputFiles: [{ path: "docs/system-audit/phase-7/phase-7-closure-evidence.json", sha256: sha256File(closureEvidencePath) }],
      operations,
      verification: { rules: getPhase7Stage(stageId).verificationCriteria, result: "BLOCKED", outputDigest: sha256File(closureEvidencePath), testResults: [finalTest] },
      blockers: closureEvidence.blockers,
    });
    const evidencePath = stageEvidencePath(stageId);
    writeJson(evidencePath, evidence);
    setStageState(state, stageId, {
      status: "BLOCKED",
      evidencePath: path.relative(repoRoot, evidencePath).replace(/\\/g, "/"),
      evidenceDigest: sha256File(evidencePath),
      outputDigests: { "phase-7-closure-evidence.json": sha256File(closureEvidencePath) },
      completedAt: now(),
      blockers: closureEvidence.blockers,
      operationResults: operations,
      sourceCommit: state.sourceCommit,
    });
    state.phaseStatus = "BLOCKED";
    writeState(state);
    return { status: "BLOCKED", blockers: closureEvidence.blockers, operations, finalTestResults: [finalTest], outputPath: "docs/system-audit/phase-7/phase-7-closure-evidence.json" };
  }
  const closurePath = path.join(docsRoot, "phase-7-closure.json");
  const closureRecord = {
    schemaVersion: "aiya-system-audit-phase-closure-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    status: "CLOSED",
    closedAt: now(),
    sourceCommit: state.sourceCommit,
    stageEvidence: [{ stageId: "7.4", evidencePath: "docs/system-audit/phase-7/stages/stage-7.4.json" }],
    finalOutput: { path: "docs/system-audit/phase-7/phase-7-closure-evidence.json", sha256: sha256File(closureEvidencePath) },
    productionDecision: "NO-GO",
    deferredReleaseBlockers: closureMatrix.deferredReleaseBlockers,
    liveActionsExecuted: [],
    closureRule: closureMatrix.closureRule,
    nextPhase: null,
    nextPhaseUnlocked: false,
  };
  writeJson(closurePath, closureRecord);
  const evidence = buildStageEvidence({
    stageId,
    sourceCommit: state.sourceCommit,
    status: "VERIFIED",
    outputFiles: [
      { path: "docs/system-audit/phase-7/phase-7-closure-evidence.json", sha256: sha256File(closureEvidencePath) },
      { path: "docs/system-audit/phase-7/phase-7-closure.json", sha256: sha256File(closurePath) },
    ],
    operations,
    verification: { rules: getPhase7Stage(stageId).verificationCriteria, result: "PASS", outputDigest: sha256File(closureEvidencePath), testResults: [finalTest] },
    blockers: closureEvidence.deferredReleaseBlockers,
  });
  const evidencePath = stageEvidencePath(stageId);
  writeJson(evidencePath, evidence);
  state.phaseStatus = "CLOSED";
  state.nextStage = null;
  setStageState(state, stageId, {
    status: "VERIFIED",
    evidencePath: path.relative(repoRoot, evidencePath).replace(/\\/g, "/"),
    evidenceDigest: sha256File(evidencePath),
    outputDigests: { "phase-7-closure-evidence.json": sha256File(closureEvidencePath), "phase-7-closure.json": sha256File(closurePath) },
    completedAt: now(),
    blockers: closureEvidence.deferredReleaseBlockers,
    operationResults: operations,
    sourceCommit: state.sourceCommit,
  });
  return { status: "CLOSED", blockers: closureEvidence.deferredReleaseBlockers, operations, finalTestResults: [finalTest], outputPath: "docs/system-audit/phase-7/phase-7-closure-evidence.json" };
}

function runStage(state, stageId) {
  if (stageId === "7.1") return runStage71(state);
  if (stageId === "7.2") return runStage72(state);
  if (stageId === "7.3") return runStage73(state);
  if (stageId === "7.4") return runStage74(state);
  throw new Error(`unsupported_phase_7_stage:${stageId}`);
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
    if (state.sourceCommit !== sourceCommit) throw new Error("phase_7_state_source_commit_stale_use_newRun_true");
    if (state.phaseStatus === "BLOCKED") throw new Error("phase_7_blocked_requires_new_run");
    return state;
  }
  const state = createInitialState(sourceCommit, now());
  writeState(state);
  return state;
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  const allowed = new Set(["run-phase-7", "run-stage-7.1", "run-stage-7.2", "run-stage-7.3", "run-stage-7.4"]);
  if (!allowed.has(command)) throw new Error("usage: run-phase-7 [--newRun=true] | run-stage-7.1 | run-stage-7.2 | run-stage-7.3 | run-stage-7.4");
  const sourceCommit = gitHead(repoRoot);
  const phase6Precondition = assertPhase6Closed(repoRoot, sourceCommit);
  if (!phase6Precondition.ok) throw new Error(`phase_6_transition_gate_locked:${phase6Precondition.stageFailures.join(",")}`);
  writePlanManifest(sourceCommit, phase6Precondition);
  if (command === "run-phase-7") {
    const state = loadOrCreateState(sourceCommit, options.newRun === "true");
    if (state.phaseStatus === "CLOSED") {
      process.stdout.write(`${JSON.stringify({ phaseStatus: state.phaseStatus, stages: state.stages }, null, 2)}\n`);
      return;
    }
    const results = [];
    for (const stageId of PHASE_7_STAGES.map((stage) => stage.id)) {
      if (state.stages[stageId].status === "VERIFIED") continue;
      const result = runStage(state, stageId);
      results.push(result);
      if (result.status === "BLOCKED") break;
    }
    process.stdout.write(`${JSON.stringify({ phaseStatus: state.phaseStatus, results }, null, 2)}\n`);
    if (state.phaseStatus === "BLOCKED" || results.some((result) => result.status === "BLOCKED")) process.exitCode = 2;
    return;
  }
  const state = loadOrCreateState(sourceCommit, false);
  const result = runStage(state, command.replace("run-stage-", ""));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === "BLOCKED") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write(`FAIL system-audit-phase-7: ${redact(error?.message ?? error)}\n`);
    process.exitCode = 1;
  });
}
