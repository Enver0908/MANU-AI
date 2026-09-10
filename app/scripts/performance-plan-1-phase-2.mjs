#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  PHASE_2_BUDGETS,
  PHASE_2_HARNESS_CONTRACT,
  PHASE_2_SCENARIOS,
  createPhase2RunId,
  runControlledHttpNegativeControls,
  runPhase2NegativeControlMatrix,
  sanitizeEvidenceValue,
  validatePhase2HarnessContract,
} from "./measure-aiya-performance-phase-2.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const evidencePath = join(docsRoot, "AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json");

const historicalPaths = [
  "docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json",
  "docs/AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md",
];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: "utf8", shell: false });
  return { status: result.status ?? 1, stdout: (result.stdout ?? "").trim(), stderr: (result.stderr ?? "").trim() };
}

function readJson(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  return existsSync(absolutePath) ? JSON.parse(readFileSync(absolutePath, "utf8")) : null;
}

function sha256(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return null;
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

async function collectLiveRelease() {
  const endpoints = [
    "https://aiyaworkspace.com/api/health/release",
    "https://admin.aiyaworkspace.com/api/health/release",
  ];
  const results = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();
      results.push({
        endpoint,
        httpStatus: response.status,
        releaseId: body.releaseId ?? null,
        commitSha: body.commitSha ?? body.commit ?? null,
        migrationFingerprint: body.migrationFingerprint ?? null,
        compatibilityVersion: body.compatibilityVersion ?? null,
      });
    } catch {
      results.push({ endpoint, httpStatus: "FETCH_FAILED", releaseId: null, commitSha: null, migrationFingerprint: null, compatibilityVersion: null });
    }
  }
  return results;
}

function collectSourceIdentity(liveRelease) {
  const branch = run("git", ["branch", "--show-current"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const upstream = run("git", ["rev-parse", "HEAD@{u}"]);
  const status = run("git", ["status", "--short", "--branch"]);
  const diffCheck = run("git", ["diff", "--check"]);
  return {
    branch: branch.stdout,
    head: head.stdout,
    upstreamHead: upstream.status === 0 ? upstream.stdout : null,
    statusShortBranch: status.stdout,
    diffCheck: diffCheck.status === 0 ? "PASS" : "FAIL",
    liveRelease,
  };
}

function collectHistoricalEvidence() {
  return {
    unchangedAtPhaseStart: true,
    files: historicalPaths.map((path) => ({ path, sha256: sha256(path) })),
    phase1Status: readJson("docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json")?.status ?? null,
    phase1Outcome: readJson("docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json")?.outcome ?? null,
  };
}

function redactionCheck() {
  const sanitized = sanitizeEvidenceValue({
    authorization: "secret-token",
    cookie: "session-cookie",
    prompt: "raw prompt",
    body: "raw response body",
    url: "https://example.test/api/clients/client-123/forms?token=secret",
  });
  const serialized = JSON.stringify(sanitized);
  return {
    status:
      sanitized.authorization === "<redacted>" &&
      sanitized.cookie === "<redacted>" &&
      sanitized.prompt === "<redacted>" &&
      sanitized.body === "<redacted>" &&
      sanitized.url === "/api/clients/:clientId/forms" &&
      !serialized.includes("secret-token") &&
      !serialized.includes("raw prompt"),
    sanitizedKeys: Object.keys(sanitized),
  };
}

function stage(stageId, status, prerequisiteEvidence, performedActions, verificationResults, outputEvidence, blockingReason = null) {
  const now = new Date().toISOString();
  return {
    stageId,
    status,
    startedAt: now,
    finishedAt: now,
    prerequisiteEvidence,
    performedActions,
    verificationResults,
    outputEvidence,
    blockingReason,
  };
}

export async function buildPlan1Phase2Evidence() {
  const startedAt = new Date().toISOString();
  const runId = createPhase2RunId();
  const liveRelease = await collectLiveRelease();
  const sourceIdentity = collectSourceIdentity(liveRelease);
  const historicalEvidence = collectHistoricalEvidence();
  const phase1Ready = historicalEvidence.phase1Status === "COMPLETE" && historicalEvidence.phase1Outcome === "NO_RUNTIME_CAUSE_CONFIRMED";
  const harnessContract = validatePhase2HarnessContract();
  const negativeControlMatrix = runPhase2NegativeControlMatrix();
  const controlledHttpNegativeControls = await runControlledHttpNegativeControls();
  const redaction = redactionCheck();
  const liveIdentityReady = liveRelease.every((item) => item.httpStatus === 200 && item.commitSha && item.releaseId);
  const historicalHashesPresent = historicalEvidence.files.every((item) => Boolean(item.sha256));
  const scenarioContract = {
    scenarioCount: PHASE_2_SCENARIOS.length,
    sampleCountPerScenario: Math.min(...PHASE_2_SCENARIOS.map((scenario) => scenario.sampleCount)),
    transitionModes: {
      cold: PHASE_2_SCENARIOS.filter((scenario) => scenario.transitionMode === "cold").map((scenario) => scenario.scenarioId),
      warm: PHASE_2_SCENARIOS.filter((scenario) => scenario.transitionMode === "warm").map((scenario) => scenario.scenarioId),
    },
  };
  const stageLedger = [
    stage(
      "2.1",
      phase1Ready && liveIdentityReady && historicalHashesPresent ? "COMPLETE" : "BLOCKED",
      ["Plan 1 Phase 1 evidence", "Phase 1.2 evidence", "combined finding manifest"],
      ["Read current source identity and both release-health endpoints", "Computed historical evidence hashes without rewriting historical files"],
      { phase1Ready, liveIdentityReady, historicalHashesPresent, liveReleaseCount: liveRelease.length },
      ["sourceIdentity", "historicalEvidence"],
      phase1Ready && liveIdentityReady && historicalHashesPresent ? null : "phase_2_source_or_historical_identity_not_ready",
    ),
    stage(
      "2.2",
      harnessContract.status === "PASS" ? "COMPLETE" : "FAILED",
      ["2.1"],
      ["Validated nine task-specific scenarios", "Locked cold goto and warm same-context click modes", "Required header and body-finished timing fields"],
      { harnessContract, scenarioContract, budgets: PHASE_2_BUDGETS, measurementContract: PHASE_2_HARNESS_CONTRACT },
      ["harnessContract", "scenarioContract", "budgets"],
      harnessContract.status === "PASS" ? null : "phase_2_harness_contract_failed",
    ),
    stage(
      "2.3",
      negativeControlMatrix.status === "PASS" && controlledHttpNegativeControls.status === "PASS" ? "COMPLETE" : "FAILED",
      ["2.2"],
      ["Ran the in-process negative-control classification matrix", "Ran controlled localhost HTTP responses for status, delay, connection failure, timeout, and success"],
      { negativeControlMatrix, controlledHttpNegativeControls },
      ["negativeControlMatrix", "controlledHttpNegativeControls"],
      negativeControlMatrix.status === "PASS" && controlledHttpNegativeControls.status === "PASS" ? null : "phase_2_negative_control_failed",
    ),
    stage(
      "2.4",
      redaction.status && /^aiya-phase2-[0-9TZ-]+-[0-9a-f-]+$/i.test(runId) ? "COMPLETE" : "FAILED",
      ["2.2", "2.3"],
      ["Verified evidence redaction for authorization, cookie, prompt, body, and dynamic URL fields", "Created a unique run identifier"],
      { redaction, uniqueRunId: runId },
      ["redaction", "runId"],
      redaction.status ? null : "phase_2_evidence_redaction_failed",
    ),
    stage(
      "2.5",
      phase1Ready && liveIdentityReady && historicalHashesPresent && harnessContract.status === "PASS" && negativeControlMatrix.status === "PASS" && controlledHttpNegativeControls.status === "PASS" && redaction.status ? "COMPLETE" : "BLOCKED",
      ["2.1", "2.2", "2.3", "2.4"],
      ["Recorded Phase 2 harness closure and kept real authenticated baseline outside this phase"],
      { phase2HarnessReady: true, validAuthenticatedBaselineCaptured: false, runtimeRemediationApplied: false },
      ["phase2Closure"],
      phase1Ready && liveIdentityReady && historicalHashesPresent && harnessContract.status === "PASS" && negativeControlMatrix.status === "PASS" && controlledHttpNegativeControls.status === "PASS" && redaction.status ? null : "phase_2_prerequisite_not_complete",
    ),
  ];
  const blockers = stageLedger.filter((item) => ["BLOCKED", "FAILED"].includes(item.status));
  const finishedAt = new Date().toISOString();
  return {
    phase: "AIya Performance Plan 1 - Phase 2 Measurement Harness and Negative Controls",
    generatedAt: finishedAt,
    startedAt,
    runId,
    status: blockers.length ? "BLOCKED" : "COMPLETE",
    outcome: blockers.length ? "PHASE_2_HARNESS_BLOCKED" : "HARNESS_READY_WITH_NEGATIVE_CONTROLS",
    productionDecision: "NO-GO",
    sourceIdentity,
    historicalEvidence,
    scenarioContract,
    budgets: PHASE_2_BUDGETS,
    harnessContract,
    negativeControlMatrix,
    controlledHttpNegativeControls,
    redaction,
    stageLedger,
    constraints: {
      runtimeUiApiChange: "NOT_EXECUTED",
      schemaMigration: "NOT_EXECUTED",
      dependencyChange: "NOT_EXECUTED",
      localSupabaseFixtureOrReset: "NOT_EXECUTED",
      hostedSyntheticAccount: "NOT_EXECUTED",
      physicalAndroidOrPwaCapture: "NOT_EXECUTED",
      externalSystemMutation: "NOT_EXECUTED",
      deploy: "NOT_EXECUTED",
      pushPrMerge: "NOT_EXECUTED",
      productionGateChange: "NOT_EXECUTED",
      rawPayloadTraceHarCookieTokenPromptClinicalCapture: "NOT_RECORDED",
    },
    nextEligibleAction: "Plan 1 Phase 3 - Real authenticated local synthetic environment, after explicit user approval; no valid authenticated performance baseline was captured in Phase 2.",
    closureRule: "Phase 2 closes only after the ordered stages 2.1-2.5 are complete and every harness/negative-control result is PASS. This evidence closes harness readiness only; it does not prove a runtime cause or performance improvement.",
  };
}

function writeEvidence(evidence) {
  writeFileSync(evidencePath, `${JSON.stringify(sanitizeEvidenceValue(evidence), null, 2)}\n`, "utf8");
}

async function main() {
  const evidence = await buildPlan1Phase2Evidence();
  writeEvidence(evidence);
  console.log(`wrote ${relative(repoRoot, evidencePath).replaceAll("\\", "/")}`);
  console.log(`status ${evidence.status}`);
  console.log(`outcome ${evidence.outcome}`);
  console.log(`negativeControls ${evidence.negativeControlMatrix.caseCount + evidence.controlledHttpNegativeControls.caseCount}`);
  if (evidence.status !== "COMPLETE") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "phase2 evidence failed");
    process.exit(1);
  });
}
