#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_1_ID, PHASE_1_STAGES, getPhaseDefinition, getStageDefinition } from "./lib/audit-plan.mjs";
import { assertPhaseCanVerify, buildEvidence, createInitialState, finalizeEvidence, loadState, markStageImplemented, markStageInProgress, markStageVerified, readJson, saveState, sha256File, stableDigest, writeJson } from "./lib/audit-contract.mjs";
import { readGitSnapshot } from "./lib/git.mjs";
import { buildCoverageMatrix, buildSystemInventory } from "./lib/inventory.mjs";
import { buildEnvironmentMap } from "./lib/environment.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-1");
const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-1-state.json");
const phaseEntryPath = path.join(docsRoot, "phase-entry.json");

function now() { return new Date().toISOString(); }
function argsMap(argv) { return Object.fromEntries(argv.slice(3).filter((arg) => arg.startsWith("--")).map((arg) => { const [key, ...rest] = arg.slice(2).split("="); return [key, rest.join("=") || "true"]; })); }
function outputPath(fileName) { return path.join(docsRoot, fileName); }
function evidencePath(stageId) { return path.join(docsRoot, "stages", `stage-${stageId}.json`); }
function stateContext() { return { repoRoot, observedAt: now(), sourceCommit: readGitSnapshot(repoRoot).head }; }

function currentState() { return loadState(statePath, stateContext()); }

function buildBaseline() {
  const git = readGitSnapshot(repoRoot);
  const phaseEntry = readJson(phaseEntryPath);
  const authorityPaths = [
    "README.md",
    "HANDOFF_FOR_NEXT_CODEX.md",
    "docs/PRODUCTION_READINESS_STAGE_1_FINAL_DECISION.json",
    "docs/PRODUCTION_READINESS_STAGE_1_OWNER_HANDOFF.md",
    "docs/RISK_REGISTER.md",
    "docs/OWNER_IOS_VALIDATION_WAIVER_DECISION.md",
  ];
  const authorityDocuments = authorityPaths.map((relative) => {
    const absolute = path.join(repoRoot, relative);
    return { path: relative, exists: existsSync(absolute), contentSha256: existsSync(absolute) ? sha256File(absolute) : null };
  });
  const historicalConflicts = [];
  for (const document of authorityPaths) {
    const absolute = path.join(repoRoot, document);
    if (!existsSync(absolute)) continue;
    readFileSync(absolute, "utf8").split(/\r?\n/).forEach((line, index) => {
      const match = line.match(/(?:live|hosted)[^`\n]{0,90}(?:commit|HEAD)[^`\n]{0,20}`([a-f0-9]{40})`/i);
      if (match && match[1] !== git.head) {
        historicalConflicts.push({
          type: "authority_document_live_commit_drift",
          path: document,
          line: index + 1,
          claimedCommit: match[1],
          currentSourceCommit: git.head,
          classification: "document_claim_requires_runtime_reconciliation",
          verificationScenario: "phase-1.1.authority-conflict-review",
        });
      }
    });
  }
  return {
    schemaVersion: "aiya-system-audit-baseline-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    capturedAt: now(),
    sourceCommit: git.head,
    phaseEntryObservation: phaseEntry,
    currentGitSnapshot: git,
    authorityDocuments,
    authorityPrecedence: ["user_decision", "current_product_contract", "api_data_contract", "historical_evidence"],
    conflictPolicy: "conflicts remain explicit findings and do not get silently resolved in Phase 1",
    historicalConflicts,
    conflictScan: {
      scannedDocuments: authorityPaths,
      rule: "explicit live/hosted commit claims are compared with the phase-entry source commit; historical labels are retained as findings until runtime evidence reconciles them",
      unresolvedCount: historicalConflicts.length,
    },
  };
}

function buildPlanManifest() {
  return {
    schemaVersion: "aiya-system-audit-plan-manifest-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phase: getPhaseDefinition(PHASE_1_ID),
    stageTransition: {
      allowed: ["LOCKED->IN_PROGRESS", "IN_PROGRESS->IMPLEMENTED", "IMPLEMENTED->VERIFIED", "VERIFIED->STALE"],
      forbidden: ["LOCKED->IMPLEMENTED", "LOCKED->VERIFIED", "IN_PROGRESS->VERIFIED", "any->CLOSED without phase verification"],
      staleTriggers: ["source file changes", "plan digest changes", "output digest changes", "environment identity changes"],
    },
    evidenceContract: { requiredFields: ["runId", "planId", "planVersion", "phaseId", "stageId", "sourceCommit", "operations", "outputFiles", "verification", "evidenceDigest"], secretPolicy: "values of environment keys, tokens, passwords, cookies, and personal data are forbidden" },
    stageDefinitions: PHASE_1_STAGES,
  };
}

async function materializeStage(stageId) {
  if (stageId === "1.1") writeJson(outputPath("baseline.json"), buildBaseline());
  else if (stageId === "1.2") writeJson(outputPath("plan-manifest.json"), buildPlanManifest());
  else if (stageId === "1.3") {
    const inventory = buildSystemInventory(repoRoot);
    writeJson(outputPath("system-inventory.json"), inventory);
    writeJson(outputPath("coverage-matrix.json"), buildCoverageMatrix(inventory));
  } else if (stageId === "1.4") writeJson(outputPath("environment-map.json"), await buildEnvironmentMap(repoRoot, readGitSnapshot(repoRoot)));
  else throw new Error(`unsupported_stage:${stageId}`);
}

function outputDigests(stage) {
  const outputFiles = Object.fromEntries(stage.requiredOutputFiles.map((fileName) => [fileName, sha256File(outputPath(fileName))]));
  return outputFiles;
}

function validateStageOutputs(stage) {
  const outputFiles = outputDigests(stage);
  const failures = [];
  for (const fileName of stage.requiredOutputFiles) {
    const data = readJson(outputPath(fileName));
    if (data.planId !== AUDIT_PLAN_ID || data.planVersion !== AUDIT_PLAN_VERSION) failures.push(`${fileName}:plan_identity_mismatch`);
    if (stage.id === "1.1" && fileName === "baseline.json") {
      if (data.phaseEntryObservation?.workingTree !== "clean") failures.push("baseline:phase_entry_not_clean");
      if (data.authorityDocuments?.some((doc) => !doc.exists || !doc.contentSha256)) failures.push("baseline:authority_document_missing");
      if (!data.conflictScan || !Array.isArray(data.historicalConflicts)) failures.push("baseline:conflict_scan_missing");
    }
    if (stage.id === "1.2" && fileName === "plan-manifest.json") {
      const ids = data.stageDefinitions?.map((candidate) => candidate.id).join(",");
      if (ids !== "1.1,1.2,1.3,1.4") failures.push("plan:stage_sequence_mismatch");
      if (!data.stageTransition?.forbidden?.includes("LOCKED->VERIFIED")) failures.push("plan:skip_transition_not_forbidden");
    }
    if (stage.id === "1.3" && fileName === "system-inventory.json") {
      if (!data.counts || data.counts.files < 1) failures.push("inventory:no_files");
      if (data.inventoryDigest !== stableDigest({ ...data, inventoryDigest: null })) failures.push("inventory:digest_mismatch");
      const matrix = readJson(outputPath("coverage-matrix.json"));
      const expected = data.counts.apiRoutes + data.counts.databaseCalls + data.counts.externalCalls + data.counts.environmentReferences + data.counts.workerEntries + data.counts.unresolvedReferences;
      if (matrix.inventoryDigest !== data.inventoryDigest || matrix.coveredRecordCount !== expected || matrix.entries.length !== expected) failures.push("coverage:incomplete");
    }
    if (stage.id === "1.4" && fileName === "environment-map.json") {
      if (!data.profiles?.local || !data.profiles?.hosted_sandbox || !data.profiles?.production) failures.push("environment:profiles_incomplete");
      if (data.environmentKeys?.some((item) => item.valueRecorded !== false)) failures.push("environment:secret_value_recorded");
      if (data.environmentDigest !== stableDigest({ ...data, environmentDigest: null })) failures.push("environment:digest_mismatch");
    }
  }
  if (failures.length) throw new Error(`stage_output_verification_failed:${failures.join(",")}`);
  return outputFiles;
}

async function beginStage(stageId) {
  const state = currentState();
  const stage = getStageDefinition(stageId);
  markStageInProgress(state, stageId, now());
  saveState(statePath, state);
  await materializeStage(stageId);
  const updated = currentState();
  markStageImplemented(updated, stageId, now(), outputDigests(stage));
  saveState(statePath, updated);
  return { stageId, status: "IMPLEMENTED", outputs: updated.stages[stageId].outputDigests };
}

function verifyStage(stageId) {
  const state = currentState();
  const stage = getStageDefinition(stageId);
  const outputFileDigests = validateStageOutputs(stage);
  const outputFiles = Object.entries(outputFileDigests).map(([fileName, sha256]) => ({ path: `docs/system-audit/phase-1/${fileName}`, sha256 }));
  const evidence = finalizeEvidence(buildEvidence({ stage, now: now(), sourceCommit: state.sourceCommit, outputFiles, operations: stage.operations.map((description, index) => ({ order: index + 1, description, status: "PASS", outputReferences: outputFiles.map((file) => file.path) })), verification: { rules: stage.verificationRules, result: "PASS", outputDigest: stableDigest(outputFileDigests) } }));
  const target = evidencePath(stageId);
  writeJson(target, evidence);
  const verifiedState = currentState();
  markStageVerified(verifiedState, stageId, now(), `docs/system-audit/phase-1/stages/stage-${stageId}.json`, sha256File(target), outputFileDigests);
  saveState(statePath, verifiedState);
  return { stageId, status: "VERIFIED", evidencePath: `docs/system-audit/phase-1/stages/stage-${stageId}.json`, evidenceDigest: evidence.evidenceDigest };
}

function verifyPhase() {
  const state = currentState();
  if (state.phaseStatus === "CLOSED") throw new Error("phase_already_closed");
  assertPhaseCanVerify(state, { repoRoot });
  state.phaseStatus = "VERIFYING";
  state.phaseVerification = { verifiedAt: now(), stages: PHASE_1_STAGES.map((stage) => ({ stageId: stage.id, status: state.stages[stage.id].status, evidenceDigest: state.stages[stage.id].evidenceDigest })) };
  saveState(statePath, state);
  return state.phaseVerification;
}

function closePhase() {
  const state = currentState();
  assertPhaseCanVerify(state, { repoRoot });
  if (state.phaseStatus !== "VERIFYING") throw new Error("phase_not_verified");
  const closure = { schemaVersion: "aiya-system-audit-phase-closure-v1", planId: AUDIT_PLAN_ID, planVersion: AUDIT_PLAN_VERSION, phaseId: PHASE_1_ID, status: "CLOSED", closedAt: now(), sourceCommit: state.sourceCommit, stageEvidence: PHASE_1_STAGES.map((stage) => ({ stageId: stage.id, evidencePath: state.stages[stage.id].evidencePath, evidenceDigest: state.stages[stage.id].evidenceDigest })), closureRule: "all four stages VERIFIED, all required outputs present and digest-valid, phase verification PASS", nextPhase: "phase-2", nextPhaseUnlocked: true };
  writeJson(outputPath("phase-1-closure.json"), closure);
  state.phaseStatus = "CLOSED";
  state.closedAt = closure.closedAt;
  saveState(statePath, state);
  return closure;
}

async function runPhase1({ newRun = false } = {}) {
  if (newRun) saveState(statePath, createInitialState(stateContext()));
  const results = [];
  for (const stage of PHASE_1_STAGES) {
    results.push(await beginStage(stage.id));
    results.push(verifyStage(stage.id));
  }
  results.push({ phaseVerification: verifyPhase() });
  results.push({ closure: closePhase() });
  return results;
}

async function main() {
  const command = process.argv[2];
  const options = argsMap(process.argv);
  if (command === "run-phase-1") process.stdout.write(JSON.stringify(await runPhase1({ newRun: options.newRun === "true" }), null, 2) + "\n");
  else if (command === "begin-stage") process.stdout.write(JSON.stringify(await beginStage(options.stage), null, 2) + "\n");
  else if (command === "verify-stage") process.stdout.write(JSON.stringify(verifyStage(options.stage), null, 2) + "\n");
  else if (command === "verify-phase") process.stdout.write(JSON.stringify(verifyPhase(), null, 2) + "\n");
  else if (command === "close-phase") process.stdout.write(JSON.stringify(closePhase(), null, 2) + "\n");
  else throw new Error("usage: run-phase-1 [--newRun=true] | begin-stage --stage=1.1 | verify-stage --stage=1.1 | verify-phase | close-phase");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`FAIL system-audit: ${error.message}\n`); process.exit(1); });
}
