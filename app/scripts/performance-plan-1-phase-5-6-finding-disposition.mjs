#!/usr/bin/env node

/**
 * Plan 1 v3 Phase 5.6 finding-disposition review.
 *
 * This stage is an offline evidence review. It does not launch the app,
 * create measurements, change runtime behavior, touch the database, or start
 * Plan 2. It updates only the active finding manifest and writes a separate
 * v3 review record when explicitly requested.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  redactionCheck,
  sanitizePhase4Evidence,
  sha256File,
} from "./lib/performance-plan-1-phase-4-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const PHASE_5_6_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_6_STAGE_ID = "5.6";
export const PHASE_5_6_EVIDENCE_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase5-6-finding-disposition-evidence-v1";
export const PHASE_5_6_MANIFEST_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json";
export const PHASE_5_6_ALLOWED_DISPOSITIONS = Object.freeze([
  "CAUSE_CONFIRMED",
  "CONTRIBUTING_FACTOR_CONFIRMED",
  "MEASUREMENT_GAP_RESOLVED",
  "NOT_REPRODUCED",
  "INCONCLUSIVE",
  "OPEN_BLOCKED",
]);
export const PHASE_5_6_FINDING_IDS = Object.freeze([
  "PERF-F2-001",
  "PERF-F2-002",
  "PERF-F2-003",
  "PERF-F12-001",
  "PERF-F12-002",
]);

export const PHASE_5_6_INPUT_PATHS = Object.freeze({
  manifest: PHASE_5_6_MANIFEST_PATH,
  phase47:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase4-7-reconciliation-v3-20260917T130007581Z-b5e2fa96-bdfd-4535-833d-71169d3982cf_PHASE_4_7_RECONCILIATION_EVIDENCE.json",
  phase51:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-1-hypothesis-ordering-v3-20260917T131152166Z-9ddcc5f6-1e16-4ced-83e0-8d028cf17d6f_PHASE_5_1_HYPOTHESIS_EVIDENCE.json",
  phase52:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-2-single-variable-experiment-v3-20260917T134123969Z-21e8c635-0129-4a48-aca8-45831367a057_PHASE_5_2_SINGLE_VARIABLE_EVIDENCE.json",
  phase53:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-3-layer-attribution-v3-20260917T190703732Z-380aeab1-c2ff-4dd5-a42c-54988706de3b_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json",
  phase54:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-4-safety-behavior-v3-20260917T192500000Z-7e539b27-1e6f-4c7c-91ac-1e5d6cf83ca4_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json",
  h002:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-candidate-loop-v3-20260918T075150094Z-57b04620-bf53-4c9b-a368-aadc829272b2_EVIDENCE.json",
  h003:
    "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-h003-candidate-loop-v3-20260918T094941316Z-2e94ad8b-d576-4fa5-9bc0-ddf5c62f673d_EVIDENCE.json",
});

export const PHASE_5_6_EXCLUDED_RUNS = Object.freeze([
  {
    runId:
      "aiya-performance-plan1-phase5-5-h003-candidate-loop-v3-20260918T084748566Z-a53e3436-8d2f-4543-85d4-ba19d95ace99",
    path:
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-h003-candidate-loop-v3-20260918T084748566Z-a53e3436-8d2f-4543-85d4-ba19d95ace99_EVIDENCE.json",
    status: "COMPLETE",
    outcome: "INCONCLUSIVE",
    exclusionReason: "The B build still mounted the eager wrapper; dynamic import was not observed.",
  },
  {
    runId:
      "aiya-performance-plan1-phase5-5-h003-candidate-loop-v3-20260918T091252282Z-ac75bc96-48e8-45fe-8fbe-52b722d31575",
    path:
      "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-5-h003-candidate-loop-v3-20260918T091252282Z-ac75bc96-48e8-45fe-8fbe-52b722d31575_EVIDENCE.json",
    status: "BLOCKED",
    outcome: "CANDIDATE_LOOP_BLOCKED",
    exclusionReason: "The corrected dynamic build exposed a runner boundary issue; only 6/9 traces were valid.",
  },
]);

const EXPECTED = Object.freeze({
  "PERF-F2-001": {
    disposition: "INCONCLUSIVE",
    linkedEvidenceKeys: ["phase47", "phase52", "phase53"],
    affectedJourneys: ["J1", "J2", "J3"],
    affectedEnvironments: ["local_desktop"],
    measuredEffect: {
      status: "REPEATABLE_PROVISIONAL_EFFECT",
      boundary: "route_commit_to_target_ready",
      deltasMs: [28.5, 292.5, 89],
      direction: "bootstrap_gate_B_SLOWER_IN_ALL_THREE_CYCLES",
    },
    exactCauseEvidence: "NOT_ESTABLISHED",
    rationale:
      "The shared-read gate changed the measured boundary in three valid cycles, but Phase 5.3 did not isolate an exact layer or prove that the current independent policy causes the reported delay.",
    plan2Eligibility: "NOT_ELIGIBLE",
    nextEvidence:
      "A new authorized experiment must isolate the current shared loader/consumer path with an accepted timing boundary before a cause or contributor can be claimed.",
  },
  "PERF-F2-002": {
    disposition: "INCONCLUSIVE",
    linkedEvidenceKeys: ["phase47", "h002"],
    affectedJourneys: ["J2"],
    affectedEnvironments: ["local_desktop"],
    measuredEffect: {
      status: "INCONCLUSIVE",
      boundary: "route_commit_to_target_ready",
      cycleDirections: ["B_SLOWER", "B_FASTER", "B_SLOWER"],
      validTraceCount: 9,
    },
    exactCauseEvidence: "NOT_ESTABLISHED",
    rationale:
      "All nine polling-loop traces were observation-valid, but the three matched cycles did not repeat one direction; cancellation was observed without proving a product delay or contributor.",
    plan2Eligibility: "NOT_ELIGIBLE",
    nextEvidence:
      "A supported repeatable polling/request overlap effect with a known timing boundary and freshness checks is required.",
  },
  "PERF-F2-003": {
    disposition: "INCONCLUSIVE",
    linkedEvidenceKeys: ["phase47", "h003"],
    affectedJourneys: ["J2"],
    affectedEnvironments: ["local_desktop"],
    measuredEffect: {
      status: "REPEATABLE_PROVISIONAL_EFFECT",
      boundary: "route_commit_to_target_ready",
      deltasMs: [842, 297, 356],
      direction: "dynamic_B_SLOWER_IN_ALL_THREE_CYCLES",
      dynamicImportObservedInAllB: true,
    },
    exactCauseEvidence: "NOT_ESTABLISHED",
    rationale:
      "The diagnostic dynamic split was consistently slower than the current eager path, so the probe demonstrates a candidate-specific effect but does not prove that the existing eager graph is a cause or contributor to the user complaint.",
    plan2Eligibility: "NOT_ELIGIBLE",
    nextEvidence:
      "A trace must identify a current eager chunk, parse/compile interval, long task, or render boundary that contributes to the reported delay across the required scope.",
  },
  "PERF-F12-001": {
    disposition: "OPEN_BLOCKED",
    linkedEvidenceKeys: ["phase47", "phase51"],
    affectedJourneys: ["ai_chat"],
    affectedEnvironments: [],
    measuredEffect: { status: "NOT_MEASURED", requiredBoundary: "2xx_conversation_list_and_ai_chat_workspace" },
    exactCauseEvidence: "UNAVAILABLE",
    rationale:
      "The current J1-J3 journeys did not exercise AI Chat, so the required authenticated conversation-list response and workspace readiness boundary remain unavailable.",
    plan2Eligibility: "NOT_ELIGIBLE",
    nextEvidence:
      "Run a dedicated authenticated AI Chat journey and keep auth, store, network, parse, render, and readiness failures separate.",
  },
  "PERF-F12-002": {
    disposition: "OPEN_BLOCKED",
    linkedEvidenceKeys: ["phase47", "phase51"],
    affectedJourneys: ["ai_chat"],
    affectedEnvironments: [],
    measuredEffect: { status: "NOT_MEASURED", requiredBoundary: "ai_chat_ready" },
    exactCauseEvidence: "UNAVAILABLE",
    rationale:
      "The warm AI Chat path was explicitly deferred and no dedicated authenticated journey produced the three valid traces needed to distinguish auth, store, network, parse, render, or polling behavior.",
    plan2Eligibility: "NOT_ELIGIBLE",
    nextEvidence:
      "Capture a dedicated warm AI Chat journey with accepted auth, body-finish, render, and ready boundaries before disposition can be narrowed.",
  },
});

function posixPath(path) {
  return path.replaceAll("\\", "/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function absoluteRepoPath(relativePath) {
  return join(repoRoot, ...relativePath.split("/"));
}

function evidenceRef(key, evidence) {
  const path = PHASE_5_6_INPUT_PATHS[key];
  return {
    key,
    path,
    runId: evidence?.runId ?? null,
    status: evidence?.status ?? null,
    outcome: evidence?.outcome ?? null,
    sha256: sha256File(absoluteRepoPath(path)),
  };
}

export function phase56V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^aiya-performance-plan1-phase5-6-finding-disposition-review-v3-[A-Za-z0-9._-]+$/.test(safeRunId)) {
    throw new Error("phase56_v3_run_id_invalid");
  }
  return absoluteRepoPath(`docs/AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_EVIDENCE.json`);
}

export function createPhase56RunId(now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `aiya-performance-plan1-phase5-6-finding-disposition-review-v3-${timestamp}-${randomUUID()}`;
}

export function phase56PrerequisiteCheck({ manifest, phase47, phase51, phase52, phase53, phase54, h002, h003 }) {
  const failures = [];
  const ids = (manifest?.findings ?? []).map((finding) => finding.id);
  if (ids.length !== PHASE_5_6_FINDING_IDS.length ||
      PHASE_5_6_FINDING_IDS.some((id, index) => ids[index] !== id)) {
    failures.push("finding_manifest_ids_not_locked");
  }
  const requiredStatuses = [
    ["phase47", phase47, "COMPLETE", "DIAGNOSIS_BLOCKED"],
    ["phase51", phase51, "COMPLETE", "HYPOTHESES_PRE_REGISTERED"],
    ["phase52", phase52, "COMPLETE", "REPEATABLE_PROVISIONAL_EFFECT"],
    ["phase53", phase53, "COMPLETE", "LAYER_ATTRIBUTION_INCONCLUSIVE"],
    ["phase54", phase54, "COMPLETE", "SAFETY_BEHAVIOR_CHECKS_COMPLETE"],
    ["h002", h002, "COMPLETE", "INCONCLUSIVE"],
    ["h003", h003, "COMPLETE", "REPEATABLE_PROVISIONAL_EFFECT"],
  ];
  for (const [key, evidence, status, outcome] of requiredStatuses) {
    if (evidence?.status !== status || evidence?.outcome !== outcome) {
      failures.push(`${key}_status_or_outcome_invalid`);
    }
  }
  if ((phase52?.sampleSummary?.observationValidTraces ?? 0) !== 9 ||
      (h002?.sampleSummary?.observationValidTraces ?? 0) !== 9 ||
      (h003?.sampleSummary?.observationValidTraces ?? 0) !== 9) {
    failures.push("required_candidate_valid_trace_count_not_nine");
  }
  if (phase53?.attribution?.causeConfirmed === true ||
      h002?.cycleSummary?.findingDispositionChanged === true ||
      h003?.cycleSummary?.findingDispositionChanged === true ||
      h003?.executionScope?.runtimeChangeAcceptedAsFix === true) {
    failures.push("input_evidence_already_claims_unauthorized_cause_or_fix");
  }
  return {
    status: failures.length === 0 ? "PASS" : "BLOCKED",
    failures: [...new Set(failures)],
    requiredInputCount: requiredStatuses.length,
  };
}

function decisionForFinding(findingId, inputs) {
  const definition = EXPECTED[findingId];
  if (!definition) throw new Error(`phase56_unknown_finding:${findingId}`);
  const linkedEvidence = definition.linkedEvidenceKeys.map((key) => evidenceRef(key, inputs[key]));
  return {
    findingId,
    previousDisposition: inputs.manifest.findings.find((finding) => finding.id === findingId)?.disposition ?? null,
    disposition: definition.disposition,
    dispositionChanged: (inputs.manifest.findings.find((finding) => finding.id === findingId)?.disposition ?? null) !== definition.disposition,
    linkedEvidence,
    affectedJourneys: definition.affectedJourneys,
    affectedEnvironments: definition.affectedEnvironments,
    measuredEffect: definition.measuredEffect,
    exactCauseEvidence: definition.exactCauseEvidence,
    rationale: definition.rationale,
    plan2Eligibility: definition.plan2Eligibility,
    nextEvidence: definition.nextEvidence,
  };
}

export function buildPhase56Dispositions(inputs) {
  const prerequisite = phase56PrerequisiteCheck(inputs);
  if (prerequisite.status !== "PASS") {
    throw new Error(`phase56_prerequisite_blocked:${prerequisite.failures.join(",")}`);
  }
  return PHASE_5_6_FINDING_IDS.map((findingId) => decisionForFinding(findingId, inputs));
}

export function applyPhase56ManifestReview(manifest, { runId, evidencePath, reviewedAt, dispositions }) {
  const dispositionById = new Map(dispositions.map((item) => [item.findingId, item]));
  const updated = {
    ...manifest,
    currentDispositionReview: {
      planRevision: PHASE_5_6_PLAN_REVISION,
      phase: "5",
      stage: PHASE_5_6_STAGE_ID,
      runId,
      evidencePath,
      reviewedAt,
      status: "COMPLETE",
      outcome: "FINDING_DISPOSITIONS_REVIEWED",
      plan2EligibleFindingCount: dispositions.filter((item) =>
        item.plan2Eligibility !== "NOT_ELIGIBLE").length,
    },
    findings: (manifest.findings ?? []).map((finding) => {
      const review = dispositionById.get(finding.id);
      if (!review) return finding;
      return {
        ...finding,
        disposition: review.disposition,
        dispositionReview: {
          planRevision: PHASE_5_6_PLAN_REVISION,
          stage: PHASE_5_6_STAGE_ID,
          runId,
          evidencePath,
          reviewedAt,
        },
      };
    }),
  };
  return updated;
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
  };
}

function collectSourceIdentity() {
  const status = gitOutput(["status", "--short"]);
  const diffCheck = gitOutput(["diff", "--check"]);
  const head = gitOutput(["rev-parse", "HEAD"]);
  const branch = gitOutput(["symbolic-ref", "--short", "-q", "HEAD"]);
  const statusText = status.stdout.trim();
  const sourcePaths = [
    "app/scripts/performance-plan-1-phase-5-6-finding-disposition.mjs",
    "app/scripts/performance-plan-1-phase-5-6-finding-disposition.test.mjs",
    "app/package.json",
    "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
    ...Object.values(PHASE_5_6_INPUT_PATHS),
  ];
  const files = [...new Set(sourcePaths)].map((path) => ({
    path,
    exists: existsSync(absoluteRepoPath(path)),
    sha256: sha256File(absoluteRepoPath(path)),
  }));
  const presentFiles = files.filter((file) => file.sha256);
  return {
    head: head.stdout.trim() || null,
    branchMode: branch.stdout.trim() ? "ATTACHED" : "DETACHED_HEAD",
    branch: branch.stdout.trim(),
    statusLineCount: statusText ? statusText.split(/\r?\n/).filter(Boolean).length : 0,
    statusHash: sha256(statusText),
    diffCheck: diffCheck.status === 0 ? "PASS" : "FAIL",
    sourceFiles: files,
    sourceFingerprint: sha256(JSON.stringify(presentFiles)),
  };
}

function inputSummary(inputs) {
  return Object.fromEntries(
    Object.entries(PHASE_5_6_INPUT_PATHS).map(([key]) => [key, evidenceRef(key, inputs[key])]),
  );
}

export function buildPhase56Evidence({
  inputs,
  dispositions,
  prerequisite,
  runId,
  generatedAt,
  evidencePath,
  sourceIdentity,
  manifestBeforeSha256,
  manifestAfterSha256,
}) {
  const openFindingIds = dispositions
    .filter((item) => item.disposition === "OPEN_BLOCKED")
    .map((item) => item.findingId);
  const evidence = {
    schemaVersion: PHASE_5_6_EVIDENCE_SCHEMA_VERSION,
    planRevision: PHASE_5_6_PLAN_REVISION,
    phase: "5",
    stage: PHASE_5_6_STAGE_ID,
    stageId: PHASE_5_6_STAGE_ID,
    runId,
    generatedAt,
    status: "COMPLETE",
    outcome: "FINDING_DISPOSITIONS_REVIEWED",
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Review the five locked findings against completed Plan 1 evidence and assign a bounded disposition.",
      environment: "offline_evidence_review",
      documentationOnly: true,
      diagnosticJourneyStarted: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      preservedExistingChanges: true,
      historicalEvidenceRewritten: false,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_5_6_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.7 COMPLETE / DIAGNOSIS_BLOCKED",
        "5.1 COMPLETE / HYPOTHESES_PRE_REGISTERED",
        "5.2 COMPLETE / REPEATABLE_PROVISIONAL_EFFECT",
        "5.3 COMPLETE / LAYER_ATTRIBUTION_INCONCLUSIVE",
        "5.4 COMPLETE / SAFETY_BEHAVIOR_CHECKS_COMPLETE",
        "5.5 H-5.1-002 COMPLETE / INCONCLUSIVE",
        "5.5 H-5.1-003 COMPLETE / REPEATABLE_PROVISIONAL_EFFECT",
      ],
      currentStage: PHASE_5_6_STAGE_ID,
      nextEligibleStage: "5.7 Plan 1 closure",
    },
    sourceIdentity,
    prerequisite,
    reviewedInputs: inputSummary(inputs),
    manifestTransition: {
      path: PHASE_5_6_MANIFEST_PATH,
      beforeSha256: manifestBeforeSha256,
      afterSha256: manifestAfterSha256,
      historicalPhase1StatusPreserved: true,
    },
    findingDispositions: dispositions,
    findingDispositionChanges: dispositions.filter((item) => item.dispositionChanged),
    excludedRuns: PHASE_5_6_EXCLUDED_RUNS,
    openFindingBlockers: openFindingIds,
    deferredToLaterStages: [
      "5.7 must determine the scoped Plan 1 closure result and prepare any Plan 2 input.",
      "No finding is eligible for Plan 2 because no exact current code/function cause or contributor was established.",
      "AI Chat findings remain open-blocked until a dedicated authenticated journey is captured.",
    ],
    constraints: [
      "This review does not promote provisional effects to causes.",
      "This review does not treat a speed-budget failure as a root cause.",
      "No runtime, database, migration, dependency, provider, channel, deploy, or secret change was performed.",
      "The official nine-scenario x 20-valid-sample contract remains unchanged and was not started.",
      "Historical v2 and earlier v3 evidence files remain preserved and excluded runs are not merged.",
      "Production remains NO-GO.",
    ],
    evidenceIntegrity: {
      status: "PENDING",
      redactionCheck: "PENDING",
      sourceIdentityPass: sourceIdentity.diffCheck === "PASS",
      prerequisiteEvidenceParsed: prerequisite.status === "PASS",
      findingManifestUpdated: true,
      findingIdsLocked: dispositions.length === PHASE_5_6_FINDING_IDS.length,
      historicalEvidenceRewritten: false,
      runtimeFixAccepted: false,
      officialMeasurementStarted: false,
      newCheckpointCreated: false,
    },
    checkpointReconciliation: {
      status: "NOT_APPLICABLE",
      source: "offline review; no diagnostic observation or experiment boundary was created",
      newCheckpointCreated: false,
      reusedInputCheckpointEvidence: true,
    },
    closure: {
      status: "COMPLETE",
      outcome: "FINDING_DISPOSITIONS_REVIEWED",
      phase4Closed: true,
      plan1Closed: false,
      plan2EntryAuthorized: false,
      runtimeFixAccepted: false,
      officialMeasurementStarted: false,
      nextAction: "Proceed to 5.7 Plan 1 closure; keep Plan 2 and production work locked.",
    },
    output: {
      evidencePath: posixPath(relative(repoRoot, evidencePath)),
      manifestPath: PHASE_5_6_MANIFEST_PATH,
    },
  };
  const sanitized = sanitizePhase4Evidence(evidence);
  const redaction = redactionCheck(sanitized);
  sanitized.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  sanitized.evidenceIntegrity.status =
    sanitized.evidenceIntegrity.redactionCheck === "PASS" &&
    sanitized.evidenceIntegrity.sourceIdentityPass &&
    sanitized.evidenceIntegrity.prerequisiteEvidenceParsed &&
    sanitized.evidenceIntegrity.findingIdsLocked
      ? "PASS"
      : "BLOCKED";
  sanitized.redactionCheck = redaction;
  return sanitized;
}

function loadInputs() {
  const inputs = Object.fromEntries(
    Object.entries(PHASE_5_6_INPUT_PATHS).map(([key, path]) => [key, readJson(absoluteRepoPath(path))]),
  );
  if (Object.entries(inputs).some(([, value]) => value === null)) {
    const missing = Object.entries(inputs)
      .filter(([, value]) => value === null)
      .map(([key]) => key);
    throw new Error(`phase56_input_missing:${missing.join(",")}`);
  }
  return inputs;
}

function writeJsonPreservingNewline(path, value, newline = "\n") {
  const serialized = JSON.stringify(value, null, 2) + "\n";
  writeFileSync(path, newline === "\r\n" ? serialized.replaceAll("\n", "\r\n") : serialized, "utf8");
}

export function runPhase56Review({ runId = createPhase56RunId(), writeEvidence = false } = {}) {
  const inputs = loadInputs();
  const prerequisite = phase56PrerequisiteCheck(inputs);
  if (prerequisite.status !== "PASS") {
    return {
      runId,
      status: "BLOCKED",
      outcome: "FINDING_DISPOSITION_REVIEW_BLOCKED",
      prerequisite,
      evidencePath: null,
    };
  }
  const generatedAt = new Date().toISOString();
  const evidencePath = phase56V3EvidencePath(runId);
  const evidenceRelativePath = posixPath(relative(repoRoot, evidencePath));
  const manifestRaw = readFileSync(absoluteRepoPath(PHASE_5_6_MANIFEST_PATH), "utf8");
  const manifestBeforeSha256 = sha256(manifestRaw);
  const dispositions = buildPhase56Dispositions(inputs);
  const updatedManifest = applyPhase56ManifestReview(inputs.manifest, {
    runId,
    evidencePath: evidenceRelativePath,
    reviewedAt: generatedAt,
    dispositions,
  });
  const manifestNewline = manifestRaw.includes("\r\n") ? "\r\n" : "\n";
  if (writeEvidence) {
    writeJsonPreservingNewline(absoluteRepoPath(PHASE_5_6_MANIFEST_PATH), updatedManifest, manifestNewline);
  }
  const sourceIdentity = collectSourceIdentity();
  const evidence = buildPhase56Evidence({
    inputs: { ...inputs, manifest: updatedManifest },
    dispositions,
    prerequisite,
    runId,
    generatedAt,
    evidencePath,
    sourceIdentity,
    manifestBeforeSha256,
    manifestAfterSha256: sha256File(absoluteRepoPath(PHASE_5_6_MANIFEST_PATH)),
  });
  if (writeEvidence) {
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  return {
    runId,
    status: evidence.status,
    outcome: evidence.outcome,
    dispositionCount: dispositions.length,
    changedCount: evidence.findingDispositionChanges.length,
    evidencePath: writeEvidence ? posixPath(relative(repoRoot, evidencePath)) : null,
    manifestPath: writeEvidence ? PHASE_5_6_MANIFEST_PATH : null,
    evidenceIntegrity: evidence.evidenceIntegrity,
    dispositions: dispositions.map(({ findingId, disposition, dispositionChanged }) => ({
      findingId,
      disposition,
      dispositionChanged,
    })),
  };
}

function parseArguments(argv) {
  const options = { descriptor: false, run: false, writeEvidence: false, status: false, runId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--run-id") options.runId = argv[++index];
    else throw new Error(`phase56_argument_invalid:${arg}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify({
      phase: "5",
      stage: PHASE_5_6_STAGE_ID,
      planRevision: PHASE_5_6_PLAN_REVISION,
      allowedDispositions: PHASE_5_6_ALLOWED_DISPOSITIONS,
      findingIds: PHASE_5_6_FINDING_IDS,
      inputPaths: PHASE_5_6_INPUT_PATHS,
      outputContract: "docs/AIYA_PERFORMANCE_PLAN_1_V3_<runId>_EVIDENCE.json",
      mode: "offline_evidence_review_only",
    }, null, 2)}\n`);
    return;
  }
  if (options.status) {
    const manifest = readJson(absoluteRepoPath(PHASE_5_6_MANIFEST_PATH));
    process.stdout.write(`${JSON.stringify({
      phase: "5",
      stage: PHASE_5_6_STAGE_ID,
      currentDispositionReview: manifest?.currentDispositionReview ?? null,
      findings: (manifest?.findings ?? []).map((finding) => ({
        id: finding.id,
        phase1Status: finding.phase1Status,
        disposition: finding.disposition ?? null,
      })),
    }, null, 2)}\n`);
    return;
  }
  if (!options.run) throw new Error("phase56_run_or_descriptor_or_status_required");
  process.stdout.write(`${JSON.stringify(runPhase56Review({
    runId: options.runId ?? createPhase56RunId(),
    writeEvidence: options.writeEvidence,
  }), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  }
}
