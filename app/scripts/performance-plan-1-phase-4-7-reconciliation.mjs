#!/usr/bin/env node

/**
 * Phase 4.7 offline reconciliation for the v3 diagnostic observations.
 *
 * This stage reads completed evidence, maps observations to the locked
 * findings, and records the scoped diagnosis. It does not launch an app,
 * perform a measurement, or change product runtime code.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  openPhaseRun,
  readPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  redactionCheck,
  sanitizePhase4Evidence,
  sha256File,
} from "./lib/performance-plan-1-phase-4-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const PHASE_4_7_PLAN_REVISION = "plan1-final-v3";
export const PHASE_4_7_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase4-7-reconciliation-v3";
export const PHASE_4_7_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase4-7-reconciliation-v3";
export const PHASE_4_7_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const PHASE_4_7_EVIDENCE_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase4-7-reconciliation-evidence-v1";

export const PHASE_4_7_FINDING_IDS = Object.freeze([
  "PERF-F2-001",
  "PERF-F2-002",
  "PERF-F2-003",
  "PERF-F12-001",
  "PERF-F12-002",
]);

export const PHASE_4_7_JOURNEY_FINDINGS = Object.freeze({
  J1: "PERF-F2-001",
  J2: "PERF-F2-002",
  J3: "PERF-F2-003",
});

const DEFAULT_LOCAL_RUN_ID =
  "aiya-performance-plan1-phase4-4-local-v3-20260917T122335537Z-874d0bea-3ff7-4a24-a5d4-6778c44eef1a";
const DEFAULT_ENVIRONMENT_RUN_ID =
  "aiya-performance-plan1-phase4-5-4-6-v3-20260917T121116968Z-2ec41db5-f1df-4ace-8a20-b71a41f259c2";
const DEFAULT_BLOCKED_ENVIRONMENT_RUN_ID =
  "aiya-performance-plan1-phase4-5-4-6-v3-20260917T123931810Z-9b3ff41f-266d-4878-b6ea-9f686f8a90dd";
const DOC_ONLY_IDENTITY_PATH = "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md";
const CURRENT_SOURCE_PATHS = Object.freeze([
  "app/package.json",
  "app/scripts/performance-plan-1-phase-4.mjs",
  "app/scripts/performance-plan-1-phase-4-3-diagnostic.mjs",
  "app/scripts/performance-plan-1-phase-4-4-local.mjs",
    "app/scripts/performance-plan-1-phase-4-4-local.test.mjs",
    "app/scripts/performance-plan-1-phase-4-5-4-6.mjs",
    "app/scripts/performance-plan-1-phase-4-5-4-6.test.mjs",
    "app/scripts/performance-plan-1-phase-4-7-reconciliation.mjs",
  "app/scripts/performance-plan-1-phase-4-7-reconciliation.test.mjs",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
  "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_4_3_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function gitOutput(args) {
  try {
    return String(execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch {
    return null;
  }
}

function posixPath(path) {
  return String(path).replaceAll("\\", "/");
}

function check(id, status, details = {}) {
  return { id, status, ...details };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function countValues(values) {
  return values.reduce((summary, value) => {
    const key = value ?? "UNKNOWN";
    summary[key] = (summary[key] ?? 0) + 1;
    return summary;
  }, {});
}

function currentSourceIdentity() {
  return {
    worktreePath: posixPath(repoRoot),
    branchMode: gitOutput(["symbolic-ref", "--short", "-q", "HEAD"])
      ? "ATTACHED"
      : "DETACHED_HEAD",
    head: gitOutput(["rev-parse", "HEAD"]),
    branch: gitOutput(["branch", "--show-current"]),
    detachedHeadUpstream: "NOT_AVAILABLE_BECAUSE_HEAD_IS_DETACHED",
    sourceFiles: CURRENT_SOURCE_PATHS.map((path) => ({
      path,
      exists: existsSync(join(repoRoot, path)),
      sha256: sha256File(join(repoRoot, path)),
    })),
    dirtyTreePreserved: true,
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
  };
}

function compareInputIdentity(evidence, sourceIdentity) {
  const recordedFiles = evidence?.sourceIdentity?.sourceFiles ?? [];
  const currentFiles = new Map(
    (sourceIdentity?.sourceFiles ?? []).map((file) => [file.path, file]),
  );
  const mismatches = [];
  const documentationOnlyMismatches = [];
  for (const recorded of recordedFiles) {
    const current = currentFiles.get(recorded.path);
    if (!current || current.sha256 !== recorded.sha256) {
      if (recorded.path === DOC_ONLY_IDENTITY_PATH) {
        documentationOnlyMismatches.push(recorded.path);
      } else {
        mismatches.push(recorded.path);
      }
    }
  }
  const headMatches =
    evidence?.sourceIdentity?.head == null ||
    evidence.sourceIdentity.head === sourceIdentity?.head;
  return {
    status: mismatches.length === 0 && headMatches ? "PASS" : "FAIL",
    mismatches,
    documentationOnlyMismatches,
    headMatches,
    documentationOnlyEditsAllowed: true,
  };
}

function inputEvidenceCheck(id, evidence, expected) {
  const failures = [];
  if (!evidence || typeof evidence !== "object") failures.push("evidence_missing");
  if (evidence?.planRevision !== PHASE_4_7_PLAN_REVISION) failures.push("plan_revision_mismatch");
  if (expected.stageId && evidence?.stageId !== expected.stageId) failures.push("stage_id_mismatch");
  if (expected.status && evidence?.status !== expected.status) failures.push("status_mismatch");
  if (expected.outcome && evidence?.outcome !== expected.outcome) failures.push("outcome_mismatch");
  if (evidence?.evidenceIntegrity?.redactionCheck !== "PASS") failures.push("redaction_check_failed");
  if (evidence?.evidenceIntegrity?.historicalPhase4EvidenceRewritten !== false) {
    failures.push("historical_evidence_rewritten");
  }
  if (evidence?.evidenceIntegrity?.officialMeasurementStarted !== false) {
    failures.push("official_measurement_started");
  }
  if (evidence?.evidenceIntegrity?.runtimeFixAccepted === true) failures.push("runtime_fix_accepted");
  if (Array.isArray(evidence?.blockers) && evidence.blockers.length > 0) {
    failures.push("input_blockers_present");
  }
  return check(id, failures.length === 0 ? "PASS" : "FAIL", { failures });
}

function stageStatusesPass(evidence, stageIds) {
  return stageIds.every((stageId) =>
    evidence?.stageLedger?.some((stage) =>
      stage.stageId === stageId && ["PASS", "COMPLETE"].includes(stage.status),
    ),
  );
}

function normalizeObservation(sample, environment, sourceRunId) {
  const journeyId = sample?.journeyId ?? null;
  const findingId = PHASE_4_7_JOURNEY_FINDINGS[journeyId] ?? null;
  return {
    observationId: `${sourceRunId}:${environment}:${sample?.unitKey ?? "unknown"}`,
    sourceRunId,
    environment,
    journeyId,
    repetition: sample?.repetition ?? null,
    unitKey: sample?.unitKey ?? null,
    observationValidity: sample?.observationValidity ?? "INVALID",
    functionalOutcome: sample?.functionalOutcome ?? "UNKNOWN",
    performanceOutcome: sample?.performanceOutcome ?? "NOT_EVALUABLE",
    validFunctionalSample: sample?.validSample === true,
    findingId,
    failureBoundary: sample?.failureBoundary ?? null,
  };
}

export function mapPhase47Observations({ localEvidence, environmentEvidence } = {}) {
  const local = (localEvidence?.samples ?? []).map((sample) =>
    normalizeObservation(sample, "local_desktop", localEvidence?.runId ?? "local-run"),
  );
  const environments = (environmentEvidence?.samples ?? []).map((sample) =>
    normalizeObservation(
      sample,
      sample?.environment ?? "unknown_environment",
      environmentEvidence?.runId ?? "environment-run",
    ),
  );
  return [...local, ...environments];
}

function summarizeObservations(observations) {
  const byEnvironment = {};
  const byJourney = {};
  for (const observation of observations) {
    const environment = observation.environment;
    const journeyId = observation.journeyId ?? "UNKNOWN";
    byEnvironment[environment] ??= [];
    byJourney[journeyId] ??= [];
    byEnvironment[environment].push(observation);
    byJourney[journeyId].push(observation);
  }
  const summarizeGroup = (items) => ({
    attemptedCount: items.length,
    observationValidCount: items.filter((item) => item.observationValidity === "VALID").length,
    validFunctionalSampleCount: items.filter((item) => item.validFunctionalSample).length,
    functionalOutcomes: countValues(items.map((item) => item.functionalOutcome)),
    failureBoundaries: countValues(
      items
        .filter((item) => item.observationValidity === "VALID")
        .map((item) => item.failureBoundary?.reason ?? "none"),
    ),
  });
  return {
    attemptedCount: observations.length,
    observationValidCount: observations.filter((item) => item.observationValidity === "VALID").length,
    validFunctionalSampleCount: observations.filter((item) => item.validFunctionalSample).length,
    functionalOutcomes: countValues(observations.map((item) => item.functionalOutcome)),
    byEnvironment: Object.fromEntries(
      Object.entries(byEnvironment).map(([key, items]) => [key, summarizeGroup(items)]),
    ),
    byJourney: Object.fromEntries(
      Object.entries(byJourney).map(([key, items]) => [key, summarizeGroup(items)]),
    ),
  };
}

function findingReconciliation({ manifest, observations, inputPaths }) {
  const byFinding = new Map();
  for (const observation of observations) {
    if (!observation.findingId) continue;
    const list = byFinding.get(observation.findingId) ?? [];
    list.push(observation);
    byFinding.set(observation.findingId, list);
  }
  return (manifest?.findings ?? []).map((finding) => {
    const linked = byFinding.get(finding.id) ?? [];
    const mappedJourneys = unique(linked.map((item) => item.journeyId));
    const status = linked.length > 0
      ? "OBSERVED_DIAGNOSTIC_COVERAGE"
      : "NOT_EXERCISED_IN_CURRENT_JOURNEYS";
    return {
      findingId: finding.id,
      severity: finding.severity ?? null,
      phase1Status: finding.phase1Status ?? null,
      currentStatus: status,
      dispositionChanged: false,
      mappedJourneys,
      mappedObservationCount: linked.length,
      observationValidCount: linked.filter((item) => item.observationValidity === "VALID").length,
      validFunctionalSampleCount: linked.filter((item) => item.validFunctionalSample).length,
      sourceEvidence: inputPaths,
      conclusion: "No finding disposition changes from diagnostic observation alone.",
    };
  });
}

function environmentCoverage(summary) {
  const names = ["local_desktop", "hosted", "android_chrome", "android_pwa"];
  return names.map((environment) => ({
    environment,
    ...(summary.byEnvironment[environment] ?? {
      attemptedCount: 0,
      observationValidCount: 0,
      validFunctionalSampleCount: 0,
      functionalOutcomes: {},
      failureBoundaries: {},
    }),
    requiredOutcomeRecorded: (summary.byEnvironment[environment]?.attemptedCount ?? 0) > 0,
    officialAcceptance: "NOT_STARTED",
  }));
}

function recurringBoundarySummary(observations) {
  const valid = observations.filter((item) => item.observationValidity === "VALID");
  const groups = new Map();
  for (const item of valid) {
    const reason = item.failureBoundary?.reason ?? "none";
    const group = groups.get(reason) ?? {
      reason,
      count: 0,
      environments: new Set(),
      journeys: new Set(),
    };
    group.count += 1;
    group.environments.add(item.environment);
    group.journeys.add(item.journeyId);
    groups.set(reason, group);
  }
  return [...groups.values()]
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
    .map((group) => ({
      reason: group.reason,
      validObservationCount: group.count,
      environments: [...group.environments].sort(),
      journeys: [...group.journeys].sort(),
    }));
}

export function reconcilePhase47Inputs({
  localEvidence,
  environmentEvidence,
  blockedEnvironmentEvidence = null,
  findingManifest,
  sourceIdentity,
  inputPaths = [],
} = {}) {
  const observations = mapPhase47Observations({ localEvidence, environmentEvidence });
  const summary = summarizeObservations(observations);
  const checks = [
    inputEvidenceCheck("local_4_4_reconciliation", localEvidence, {
      stageId: "4.4",
      status: "IN_PROGRESS",
      outcome: "LOCAL_OBSERVATIONS_RECONCILED",
    }),
    inputEvidenceCheck("environment_4_5_4_6_capture", environmentEvidence, {
      stageId: "4.5-4.6",
      status: "COMPLETE",
      outcome: "ENVIRONMENT_OBSERVATIONS_CAPTURED",
    }),
    check(
      "local_stage_reconciliation",
      localEvidence?.reconciliation?.status === "PASS" &&
        stageStatusesPass(localEvidence, ["4.4.1", "4.4.2", "4.4.3", "4.4.4"])
        ? "PASS"
        : "FAIL",
      { failures: localEvidence?.reconciliation?.status === "PASS" ? [] : ["local_reconciliation_not_pass"] },
    ),
    check(
      "environment_stage_coverage",
      environmentEvidence?.stageLedger?.every((stage) => stage.status === "COMPLETE") &&
        ["hosted", "android_chrome", "android_pwa"].every((environment) =>
          environmentEvidence?.environmentSummary?.[environment]?.status === "COMPLETE",
        )
        ? "PASS"
        : "FAIL",
      { failures: [] },
    ),
    check(
      "observation_mapping",
      observations.length > 0 && observations.every((observation) =>
        PHASE_4_7_FINDING_IDS.includes(observation.findingId),
      )
        ? "PASS"
        : "FAIL",
      {
        observationCount: observations.length,
        unmappedObservationCount: observations.filter((observation) => !observation.findingId).length,
      },
    ),
    check(
      "current_source_identity",
      sourceIdentity?.diffCheck === "PASS" ? "PASS" : "FAIL",
      { diffCheck: sourceIdentity?.diffCheck ?? null },
    ),
    check(
      "finding_manifest_integrity",
      (findingManifest?.findings ?? []).length === PHASE_4_7_FINDING_IDS.length &&
        PHASE_4_7_FINDING_IDS.every((id) => findingManifest.findings.some((finding) => finding.id === id))
        ? "PASS"
        : "FAIL",
      { findingCount: findingManifest?.findings?.length ?? 0 },
    ),
  ];
  const failedChecks = checks.filter((item) => item.status !== "PASS");
  const linkedFindingRecords = findingReconciliation({
    manifest: findingManifest,
    observations,
    inputPaths,
  });
  const findingDispositionChanges = linkedFindingRecords.filter((finding) => finding.dispositionChanged);
  const boundarySummary = recurringBoundarySummary(observations);
  const commonLayerDelay = {
    status: "NOT_ESTABLISHED",
    repeatedValidTraceCount: 0,
    timingBoundaryKnown: false,
    performanceOutcome: "NOT_EVALUABLE",
    reason: "Observed action and readiness boundaries do not establish a repeated common-layer delay without an accepted performance boundary.",
    repeatedObservedBoundaries: boundarySummary.filter((boundary) =>
      boundary.reason !== "none" && boundary.validObservationCount >= 3,
    ),
  };
  const reconciliationStatus = failedChecks.length === 0 ? "PASS" : "BLOCKED";
  const diagnosisStatus = reconciliationStatus === "PASS"
    ? "DIAGNOSIS_BLOCKED"
    : "DIAGNOSIS_BLOCKED";
  return {
    status: reconciliationStatus,
    outcome: reconciliationStatus === "PASS"
      ? diagnosisStatus
      : "PHASE_4_7_RECONCILIATION_BLOCKED",
    checks,
    failedChecks,
    observations,
    summary,
    environmentCoverage: environmentCoverage(summary),
    journeyCoverage: Object.entries(summary.byJourney).map(([journeyId, journeySummary]) => ({
      journeyId,
      findingId: PHASE_4_7_JOURNEY_FINDINGS[journeyId] ?? null,
      ...journeySummary,
    })),
    recurringFailureBoundaries: boundarySummary,
    commonLayerDelay,
    findingReconciliation: linkedFindingRecords,
    findingDispositionChanges,
    blockedRetry: blockedEnvironmentEvidence
      ? {
          runId: blockedEnvironmentEvidence.runId ?? null,
          status: blockedEnvironmentEvidence.status ?? null,
          outcome: blockedEnvironmentEvidence.outcome ?? null,
          excludedFromCurrentCounts: true,
          reason: "Incompatible temporary runner identity and blocked Android/PWA capture; never merge into completed evidence.",
        }
      : null,
    allRequiredEnvironmentOutcomesRecorded: ["local_desktop", "hosted", "android_chrome", "android_pwa"]
      .every((environment) => summary.byEnvironment[environment]?.attemptedCount > 0),
    officialMeasurementStarted: false,
    causalExperimentStarted: false,
    runtimeFixAccepted: false,
    historicalPhase4EvidenceRewritten: false,
    nextAction: reconciliationStatus === "PASS"
      ? "Keep Plan 1 at DIAGNOSIS_BLOCKED; do not start Plan 2 or runtime remediation. A separately authorized hypothesis and accepted timing boundary are required for any follow-up."
      : "Preserve the blocked 4.7 reconciliation and repair only the declared evidence-integrity gap.",
  };
}

export function phase47V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase47_run_id_invalid");
  }
  return join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_PHASE_4_7_RECONCILIATION_EVIDENCE.json`,
  );
}

function checkpointReconciliation({ runId, reconciliation, sourceIdentity, inputPaths, newRun }) {
  const identity = {
    planRevision: PHASE_4_7_PLAN_REVISION,
    stageId: "4.7",
    sourceHead: sourceIdentity?.head ?? "unbound",
    inputEvidence: inputPaths,
    findingIds: PHASE_4_7_FINDING_IDS,
    reconciliationStatus: reconciliation.status,
  };
  const metadata = {
    identitySummary: {
      planRevision: PHASE_4_7_PLAN_REVISION,
      stageId: "4.7",
      reconciliationOnly: true,
      countedAsOfficialSample: false,
    },
    inputEvidence: inputPaths,
  };
  const opened = openPhaseRun({
    root: PHASE_4_7_CHECKPOINT_ROOT,
    phaseId: PHASE_4_7_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_7_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata,
    runId: newRun ? null : runId,
    newRun,
    redact: sanitizePhase4Evidence,
  });
  if (opened.action === "COMPLETE") {
    const existing = readPhaseRun({
      root: PHASE_4_7_CHECKPOINT_ROOT,
      phaseId: PHASE_4_7_CHECKPOINT_PHASE_ID,
      runId,
    });
    return {
      status: "ALREADY_COMPLETE",
      runId,
      eventCount: existing.events.length,
      hashChainRead: true,
      lastEventType: existing.events.at(-1)?.type ?? null,
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      status: "BLOCKED",
      runId: runId ?? null,
      action: opened.action,
      reason: opened.reason ?? "checkpoint_not_runnable",
    };
  }
  const checkpoint = opened.run;
  checkpoint.append("stage.reconciliation.evaluated", {
    stageId: "4.7",
    outcome: reconciliation.outcome,
    checkCount: reconciliation.checks.length,
    findingDispositionChanges: reconciliation.findingDispositionChanges.length,
    countedAsOfficialSample: false,
  }, { status: "RUNNING" });
  checkpoint.markStatus(reconciliation.status === "PASS" ? "COMPLETE" : "BLOCKED", {
    reason: reconciliation.status === "PASS"
      ? "phase47_reconciliation_completed_diagnosis_blocked"
      : "phase47_reconciliation_input_integrity_blocked",
    stageId: "4.7",
    countedAsOfficialSample: false,
  });
  const resolvedRunId = checkpoint.runId;
  checkpoint.close();
  const persisted = readPhaseRun({
    root: PHASE_4_7_CHECKPOINT_ROOT,
    phaseId: PHASE_4_7_CHECKPOINT_PHASE_ID,
    runId: resolvedRunId,
  });
  return {
    status: persisted.manifest.status,
    runId: resolvedRunId,
    eventCount: persisted.events.length,
    hashChainRead: true,
    lastEventType: persisted.events.at(-1)?.type ?? null,
  };
}

export function buildPhase47Evidence({
  localEvidence,
  environmentEvidence,
  blockedEnvironmentEvidence = null,
  findingManifest,
  sourceIdentity = currentSourceIdentity(),
  inputPaths = [],
  checkpoint = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const reconciliation = reconcilePhase47Inputs({
    localEvidence,
    environmentEvidence,
    blockedEnvironmentEvidence,
    findingManifest,
    sourceIdentity,
    inputPaths,
  });
  const identityChecks = [
    compareInputIdentity(localEvidence, sourceIdentity),
    compareInputIdentity(environmentEvidence, sourceIdentity),
  ];
  const identityPass = identityChecks.every((result) => result.status === "PASS");
  const integrityChecks = {
    inputEvidenceParsed: true,
    localReconciliationPass: reconciliation.checks.find((item) => item.id === "local_stage_reconciliation")?.status === "PASS",
    environmentCoverageComplete: reconciliation.checks.find((item) => item.id === "environment_stage_coverage")?.status === "PASS",
    everyObservationMapped: reconciliation.checks.find((item) => item.id === "observation_mapping")?.status === "PASS",
    findingManifestIntegrity: reconciliation.checks.find((item) => item.id === "finding_manifest_integrity")?.status === "PASS",
    sourceIdentityPass: identityPass,
    documentationOnlyIdentityMismatches: unique(identityChecks.flatMap((result) => result.documentationOnlyMismatches)),
    blockedRetryExcluded: blockedEnvironmentEvidence == null || reconciliation.blockedRetry?.excludedFromCurrentCounts === true,
    historicalPhase4EvidenceRewritten: false,
    officialMeasurementStarted: false,
    causalExperimentStarted: false,
    runtimeFixAccepted: false,
  };
  const rawEvidence = {
    schemaVersion: PHASE_4_7_EVIDENCE_SCHEMA_VERSION,
    planRevision: PHASE_4_7_PLAN_REVISION,
    phase: "4",
    stage: "4.7",
    stageId: "4.7",
    runId: checkpoint?.runId ?? null,
    generatedAt,
    status: reconciliation.status === "PASS" ? "COMPLETE" : "BLOCKED",
    outcome: reconciliation.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Reconcile v3 diagnostic observations, finding coverage, environment coverage, and evidence integrity.",
      executionMode: "phase4_7_offline_reconciliation",
      officialMeasurementStarted: false,
      diagnosticJourneyStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      countedAsOfficialSample: false,
      preservedExistingChanges: true,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_4_7_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.1 IDENTITY_LOCKED",
        "4.2 REFERENCE_SEPARATED",
        "4.3 GENERAL_DIAGNOSTIC_HARNESS_READY",
        "4.4 LOCAL_CAPTURE_AND_OBSERVATION_CONTRACT",
        "4.5 HOSTED_OBSERVATIONS_CAPTURED",
        "4.6 ANDROID_PWA_OBSERVATIONS_CAPTURED",
      ],
      currentStage: "4.7",
      nextEligibleStage: reconciliation.status === "PASS" ? "5.1 only after explicit follow-up authorization" : "4.7",
    },
    sourceIdentity,
    parentRunReferences: inputPaths,
    inputEvidence: {
      local: {
        path: inputPaths.find((path) => path.includes("phase4-4-local-v3")) ?? null,
        runId: localEvidence?.runId ?? null,
        status: localEvidence?.status ?? null,
        outcome: localEvidence?.outcome ?? null,
      },
      environments: {
        path: inputPaths.find((path) => path.includes("phase4-5-4-6-v3")) ?? null,
        runId: environmentEvidence?.runId ?? null,
        status: environmentEvidence?.status ?? null,
        outcome: environmentEvidence?.outcome ?? null,
      },
      blockedRetry: reconciliation.blockedRetry,
      findingManifest: {
        path: inputPaths.find((path) => path.includes("FINDING_MANIFEST")) ?? null,
        findingCount: findingManifest?.findings?.length ?? 0,
      },
      identityChecks,
    },
    stageLedger: [{
      stageId: "4.7",
      name: "Coverage, finding, environment, and evidence reconciliation",
      prerequisites: ["4.4", "4.5", "4.6"],
      status: reconciliation.status === "PASS" ? "COMPLETE" : "BLOCKED",
    }],
    coverage: {
      ...reconciliation.summary,
      allRequiredEnvironmentOutcomesRecorded: reconciliation.allRequiredEnvironmentOutcomesRecorded,
      environments: reconciliation.environmentCoverage,
      journeys: reconciliation.journeyCoverage,
      observationMappings: reconciliation.observations,
      recurringFailureBoundaries: reconciliation.recurringFailureBoundaries,
    },
    findingReconciliation: reconciliation.findingReconciliation,
    diagnosticConclusion: {
      status: reconciliation.outcome,
      commonLayerDelay: reconciliation.commonLayerDelay,
      observedFailuresRemainDiagnostic: true,
      performanceOutcome: "NOT_EVALUABLE",
      openGaps: [
        "No repeated common-layer delay with an accepted timing boundary was established.",
        "Observed navigation-away, click/readiness, and preloaded-data boundaries are not root-cause attribution.",
        "AI Chat-specific findings were not exercised by J1-J3 and retain their existing dispositions.",
      ],
    },
    reconciliation: {
      status: reconciliation.status,
      outcome: reconciliation.outcome,
      checks: reconciliation.checks,
      failedChecks: reconciliation.failedChecks,
      findingDispositionChanges: reconciliation.findingDispositionChanges,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
      historicalPhase4EvidenceRewritten: false,
    },
    blockers: reconciliation.status === "PASS"
      ? [
          "common_layer_delay_not_repeated_with_known_timing",
          "performance_outcome_not_evaluable",
        ]
      : unique([
          "phase4_7_reconciliation_input_integrity",
          ...reconciliation.failedChecks.flatMap((item) => item.failures ?? []),
        ]),
    constraints: [
      "No official nine-scenario x 20-valid-sample baseline was started.",
      "No runtime change is accepted as a Plan 1 fix.",
      "Finding dispositions remain unchanged.",
      "Production remains NO-GO.",
      "Historical evidence remains preserved and separate.",
      "No credentials, cookies, tokens, raw bodies, prompts, clinical data, or device serials are recorded.",
    ],
    evidenceIntegrity: {
      status: "PENDING",
      redactionCheck: "PENDING",
      redactionFailures: [],
      ...integrityChecks,
    },
    closure: {
      status: reconciliation.status === "PASS" ? "COMPLETE" : "BLOCKED",
      outcome: reconciliation.outcome,
      diagnosisStatus: reconciliation.outcome,
      phase4Closed: reconciliation.status === "PASS",
      plan1Closed: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction: reconciliation.nextAction,
    },
    checkpointReconciliation: checkpoint,
  };
  const evidence = sanitizePhase4Evidence(rawEvidence);
  const redaction = redactionCheck(evidence);
  evidence.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  evidence.evidenceIntegrity.redactionFailures = redaction.forbiddenValuesFound;
  evidence.evidenceIntegrity.status = redaction.status &&
    evidence.evidenceIntegrity.historicalPhase4EvidenceRewritten === false &&
    evidence.evidenceIntegrity.officialMeasurementStarted === false &&
    evidence.evidenceIntegrity.runtimeFixAccepted === false
    ? "PASS"
    : "FAIL";
  return evidence;
}

export function reconcilePhase47Run({
  localEvidencePath,
  environmentEvidencePath,
  blockedEnvironmentEvidencePath = null,
  findingManifestPath,
  newRun = false,
  writeEvidence = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const localEvidence = readJson(localEvidencePath);
  const environmentEvidence = readJson(environmentEvidencePath);
  const blockedEnvironmentEvidence = blockedEnvironmentEvidencePath && existsSync(blockedEnvironmentEvidencePath)
    ? readJson(blockedEnvironmentEvidencePath)
    : null;
  const findingManifest = readJson(findingManifestPath);
  const sourceIdentity = currentSourceIdentity();
  const inputPaths = [
    localEvidencePath,
    environmentEvidencePath,
    ...(blockedEnvironmentEvidencePath ? [blockedEnvironmentEvidencePath] : []),
    findingManifestPath,
  ].map(posixPath);
  const preliminary = reconcilePhase47Inputs({
    localEvidence,
    environmentEvidence,
    blockedEnvironmentEvidence,
    findingManifest,
    sourceIdentity,
    inputPaths,
  });
  const checkpoint = checkpointReconciliation({
    runId: null,
    reconciliation: preliminary,
    sourceIdentity,
    inputPaths,
    newRun,
  });
  const evidence = buildPhase47Evidence({
    localEvidence,
    environmentEvidence,
    blockedEnvironmentEvidence,
    findingManifest,
    sourceIdentity,
    inputPaths,
    checkpoint,
    generatedAt,
  });
  const evidencePath = phase47V3EvidencePath(checkpoint.runId);
  if (writeEvidence) writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return { evidence, evidencePath, reconciliation: preliminary, checkpoint };
}

function defaultPaths() {
  return {
    localEvidencePath: join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${DEFAULT_LOCAL_RUN_ID}_EVIDENCE.json`),
    environmentEvidencePath: join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${DEFAULT_ENVIRONMENT_RUN_ID}_ENVIRONMENT_EVIDENCE.json`),
    blockedEnvironmentEvidencePath: join(repoRoot, "docs", `AIYA_PERFORMANCE_PLAN_1_V3_${DEFAULT_BLOCKED_ENVIRONMENT_RUN_ID}_ENVIRONMENT_EVIDENCE.json`),
    findingManifestPath: join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json"),
  };
}

function parseArguments(argv) {
  const options = {
    run: false,
    status: false,
    newRun: false,
    writeEvidence: false,
    ...defaultPaths(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--local-evidence") options.localEvidencePath = argv[++index];
    else if (arg === "--environment-evidence") options.environmentEvidencePath = argv[++index];
    else if (arg === "--blocked-environment-evidence") options.blockedEnvironmentEvidencePath = argv[++index];
    else if (arg === "--finding-manifest") options.findingManifestPath = argv[++index];
    else throw new Error(`phase47_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify({
      phaseId: PHASE_4_7_CHECKPOINT_PHASE_ID,
      runs: (await import("../../tools/phase-execution/checkpoint-store.mjs")).inspectPhaseRuns({
        root: PHASE_4_7_CHECKPOINT_ROOT,
        phaseId: PHASE_4_7_CHECKPOINT_PHASE_ID,
      }),
    }, null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Plan 1 v3 Phase 4.7 reconciliation ready. Use --run for explicit offline reconciliation.\n");
    return;
  }
  const result = reconcilePhase47Run(options);
  process.stdout.write(`${JSON.stringify({
    runId: result.evidence.runId,
    status: result.evidence.status,
    outcome: result.evidence.outcome,
    stageLedger: result.evidence.stageLedger,
    summary: result.evidence.coverage,
    blockers: result.evidence.blockers,
    evidenceIntegrity: result.evidence.evidenceIntegrity,
    evidencePath: result.evidencePath,
    checkpoint: result.checkpoint,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
