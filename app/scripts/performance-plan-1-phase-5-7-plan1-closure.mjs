#!/usr/bin/env node

/**
 * Plan 1 v3 Phase 5.7 closure and Plan 2 input preparation.
 *
 * This stage is evidence-only. It closes the scoped diagnosis, records a
 * structured Plan 2 input, and keeps every unproven change unauthorized.
 */

import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  PHASE_5_6_FINDING_IDS,
  PHASE_5_6_INPUT_PATHS,
} from "./performance-plan-1-phase-5-6-finding-disposition.mjs";
import {
  redactionCheck,
  sanitizePhase4Evidence,
  sha256File,
} from "./lib/performance-plan-1-phase-4-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const PHASE_5_7_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_7_STAGE_ID = "5.7";
export const PHASE_5_7_EVIDENCE_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase5-7-plan1-closure-evidence-v1";
export const PHASE_5_7_PHASE_5_6_EVIDENCE_PATH =
  "docs/AIYA_PERFORMANCE_PLAN_1_V3_aiya-performance-plan1-phase5-6-finding-disposition-review-v3-20260918T123600Z-aae55ab8-db06-40b5-9d56-8c2de6bbb5e7_EVIDENCE.json";
export const PHASE_5_7_MANIFEST_PATH = PHASE_5_6_INPUT_PATHS.manifest;

const PRIORITY_ORDER = Object.freeze([
  "PERF-F2-001",
  "PERF-F2-002",
  "PERF-F2-003",
  "PERF-F12-001",
  "PERF-F12-002",
]);

const REGRESSION_TESTS = Object.freeze({
  "PERF-F2-001": [
    "app/src/lib/app-state-store.test.ts",
    "app/src/lib/supabase-store.test.ts",
    "app/src/lib/phase-85-stage-5-shell-provider-state.test.ts",
    "app/src/lib/phase-85-stage-5-shell-migration-contract.test.ts",
  ],
  "PERF-F2-002": [
    "app/src/lib/phase-55-polling-diagnostic.test.ts",
    "app/src/lib/phase-85-stage-4b2-state-merge.test.ts",
    "app/src/lib/phase-85-stage-4b2-messaging-scheduler.test.ts",
    "app/src/lib/phase-85-stage-5-shell-navigation.test.ts",
  ],
  "PERF-F2-003": [
    "app/src/lib/phase-55-bundle-diagnostic.test.ts",
    "app/src/lib/phase-85-stage-5-shell-bundle-budget.test.ts",
    "app/src/lib/phase-85-stage-5-shell-navigation.test.ts",
  ],
  "PERF-F12-001": [
    "app/src/lib/auth-context.test.ts",
    "app/src/lib/use-ai-chat.test.ts",
    "app/src/lib/phase-85-stage-4c-context-gateway.test.ts",
  ],
  "PERF-F12-002": [
    "app/src/lib/auth-context.test.ts",
    "app/src/lib/use-ai-chat.test.ts",
    "app/src/lib/phase-85-stage-4c-run-service.test.ts",
  ],
});

const BEHAVIOR_RISKS = Object.freeze({
  "PERF-F2-001": [
    "Tenant/session/capability scope and full app-state completeness must remain unchanged.",
    "Hydration single-flight, late-response ordering, freshness, and mutation guards must remain unchanged.",
  ],
  "PERF-F2-002": [
    "Notification and conversation freshness must not be reduced to improve navigation timing.",
    "Abort, dedupe, visibility recovery, and late-response protections must remain active.",
  ],
  "PERF-F2-003": [
    "Loading/error fallback, authenticated route guards, PWA cache, and reconnect behavior must remain intact.",
    "No required data or safety state may be skipped to improve target readiness.",
  ],
  "PERF-F12-001": [
    "AI Chat tenant/client capability and authenticated conversation scope must remain enforced.",
    "No raw prompt, clinical content, attachment, or provider egress may enter evidence.",
  ],
  "PERF-F12-002": [
    "Warm-session auth, store, stream cancellation, reconnect, and draft lifecycle must remain unchanged.",
    "A future probe must separate auth/store/network/render failures without enabling real provider traffic.",
  ],
});

function posixPath(path) {
  return path.replaceAll("\\", "/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function absoluteRepoPath(relativePath) {
  return join(repoRoot, ...relativePath.split("/"));
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function phase57V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^aiya-performance-plan1-phase5-7-plan1-closure-v3-[A-Za-z0-9._-]+$/.test(safeRunId)) {
    throw new Error("phase57_v3_run_id_invalid");
  }
  return absoluteRepoPath(`docs/AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_EVIDENCE.json`);
}

export function createPhase57RunId(now = new Date()) {
  const timestamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `aiya-performance-plan1-phase5-7-plan1-closure-v3-${timestamp}-${randomUUID()}`;
}

export function phase57PrerequisiteCheck({ phase56, manifest }) {
  const failures = [];
  if (phase56?.status !== "COMPLETE" || phase56?.outcome !== "FINDING_DISPOSITIONS_REVIEWED") {
    failures.push("phase56_not_complete");
  }
  if (phase56?.evidenceIntegrity?.status !== "PASS" ||
      phase56?.evidenceIntegrity?.historicalEvidenceRewritten !== false ||
      phase56?.evidenceIntegrity?.runtimeFixAccepted !== false) {
    failures.push("phase56_integrity_or_scope_invalid");
  }
  if (phase56?.closure?.plan1Closed !== false || phase56?.closure?.plan2EntryAuthorized !== false) {
    failures.push("phase56_closure_already_closed_or_plan2_authorized");
  }
  const ids = (manifest?.findings ?? []).map((finding) => finding.id);
  if (ids.length !== PHASE_5_6_FINDING_IDS.length ||
      PHASE_5_6_FINDING_IDS.some((id, index) => ids[index] !== id)) {
    failures.push("finding_manifest_ids_not_locked");
  }
  const dispositionIds = (phase56?.findingDispositions ?? []).map((item) => item.findingId);
  if (JSON.stringify(dispositionIds) !== JSON.stringify(PHASE_5_6_FINDING_IDS)) {
    failures.push("phase56_disposition_set_incomplete");
  }
  for (const item of phase56?.findingDispositions ?? []) {
    if (item.plan2Eligibility !== "NOT_ELIGIBLE") failures.push(`plan2_eligibility_not_locked:${item.findingId}`);
    if (!["INCONCLUSIVE", "OPEN_BLOCKED"].includes(item.disposition)) {
      failures.push(`unsupported_phase56_disposition:${item.findingId}`);
    }
    const manifestFinding = manifest?.findings?.find((finding) => finding.id === item.findingId);
    if (manifestFinding?.disposition !== item.disposition) {
      failures.push(`manifest_disposition_mismatch:${item.findingId}`);
    }
  }
  return {
    status: failures.length === 0 ? "PASS" : "BLOCKED",
    failures: [...new Set(failures)],
    dispositionCount: phase56?.findingDispositions?.length ?? 0,
  };
}

export function determinePlan1Closure(findings) {
  const counts = Object.fromEntries(
    ["CAUSE_CONFIRMED", "CONTRIBUTING_FACTOR_CONFIRMED", "INCONCLUSIVE", "OPEN_BLOCKED"]
      .map((disposition) => [disposition, findings.filter((item) => item.disposition === disposition).length]),
  );
  let outcome = "NO_RUNTIME_CAUSE_CONFIRMED";
  if (counts.CAUSE_CONFIRMED > 0 || counts.CONTRIBUTING_FACTOR_CONFIRMED > 0) {
    outcome = "ROOT_CAUSE_EVIDENCE_READY";
  } else if (counts.OPEN_BLOCKED > 0) {
    outcome = "DIAGNOSIS_BLOCKED";
  }
  return {
    outcome,
    counts,
    plan2EntryAuthorized: outcome === "ROOT_CAUSE_EVIDENCE_READY",
    reasonCodes: [
      ...(counts.OPEN_BLOCKED > 0 ? ["required_finding_evidence_unavailable"] : []),
      ...(counts.INCONCLUSIVE > 0 ? ["no_exact_cause_or_contributor_for_inconclusive_findings"] : []),
      ...(counts.CAUSE_CONFIRMED === 0 && counts.CONTRIBUTING_FACTOR_CONFIRMED === 0
        ? ["no_causal_disposition_supports_plan2"]
        : []),
    ],
  };
}

function plan2Entry(item, manifestFinding, priority) {
  const blockedByAIChat = item.findingId.startsWith("PERF-F12-");
  return {
    priority,
    priorityBasis: blockedByAIChat
      ? "deferred_AI_Chat_finding_requires_dedicated_journey"
      : "pre_registered_general_desktop_candidate_order",
    findingId: item.findingId,
    severity: manifestFinding?.severity ?? null,
    disposition: item.disposition,
    affectedJourneys: item.affectedJourneys,
    affectedEnvironments: item.affectedEnvironments,
    exactCauseEvidence: item.exactCauseEvidence,
    measuredEffect: item.measuredEffect,
    proposedLimitedChange: "NONE_AUTHORIZED_UNTIL_CAUSAL_DISPOSITION",
    behaviorRisks: BEHAVIOR_RISKS[item.findingId],
    regressionTests: REGRESSION_TESTS[item.findingId],
    rollback: "No runtime change was authorized. Keep the current runtime; any future single-variable change must have explicit Plan 2 authorization and be reverted by removing only that variable.",
    unresolvedDependencies: [
      item.nextEvidence,
      "A separate explicit Plan 2 or diagnostic-continuation authorization is required.",
      ...(blockedByAIChat ? ["Dedicated authenticated AI Chat journey with accepted 2xx/body-finish and ready boundaries."] : []),
    ],
    plan2Eligibility: "NOT_ELIGIBLE",
  };
}

export function buildPlan2Input({ phase56, manifest }) {
  const byId = new Map(phase56.findingDispositions.map((item) => [item.findingId, item]));
  const manifestById = new Map(manifest.findings.map((finding) => [finding.id, finding]));
  const entries = PRIORITY_ORDER.map((findingId, index) =>
    plan2Entry(byId.get(findingId), manifestById.get(findingId), index + 1));
  return {
    status: "BLOCKED_NO_ELIGIBLE_FINDING",
    eligibleFindingIds: [],
    entries,
    requiredAuthorization: "No Plan 2 implementation is authorized by this closure. A new evidence-backed authorization is required.",
  };
}

export function applyPhase57ManifestClosure(manifest, { runId, evidencePath, closedAt, closure }) {
  return {
    ...manifest,
    currentPlan1Closure: {
      planRevision: PHASE_5_7_PLAN_REVISION,
      phase: "5",
      stage: PHASE_5_7_STAGE_ID,
      runId,
      evidencePath,
      closedAt,
      status: "COMPLETE",
      outcome: closure.outcome,
      plan2EntryAuthorized: closure.plan2EntryAuthorized,
      plan2EligibleFindingCount: 0,
    },
  };
}

function gitOutput(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: String(result.stdout ?? "") };
}

function collectSourceIdentity() {
  const status = gitOutput(["status", "--short"]);
  const diffCheck = gitOutput(["diff", "--check"]);
  const head = gitOutput(["rev-parse", "HEAD"]);
  const branch = gitOutput(["symbolic-ref", "--short", "-q", "HEAD"]);
  const statusText = status.stdout.trim();
  const paths = [
    "app/scripts/performance-plan-1-phase-5-7-plan1-closure.mjs",
    "app/scripts/performance-plan-1-phase-5-7-plan1-closure.test.mjs",
    "app/package.json",
    "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
    PHASE_5_7_PHASE_5_6_EVIDENCE_PATH,
    PHASE_5_7_MANIFEST_PATH,
  ];
  const files = [...new Set(paths)].map((path) => ({
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

function writeJsonPreservingNewline(path, value, newline = "\n") {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(path, newline === "\r\n" ? serialized.replaceAll("\n", "\r\n") : serialized, "utf8");
}

export function buildPhase57Evidence({
  phase56,
  manifest,
  prerequisite,
  closure,
  plan2Input,
  runId,
  closedAt,
  evidencePath,
  sourceIdentity,
  manifestBeforeSha256,
  manifestAfterSha256,
}) {
  const evidence = {
    schemaVersion: PHASE_5_7_EVIDENCE_SCHEMA_VERSION,
    planRevision: PHASE_5_7_PLAN_REVISION,
    phase: "5",
    stage: PHASE_5_7_STAGE_ID,
    stageId: PHASE_5_7_STAGE_ID,
    runId,
    generatedAt: closedAt,
    status: "COMPLETE",
    outcome: closure.outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Close the scoped Plan 1 diagnosis and prepare a non-authorizing Plan 2 input from the five reviewed findings.",
      environment: "offline_evidence_review",
      documentationOnly: true,
      diagnosticJourneyStarted: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      plan1Closed: true,
      plan2EntryAuthorized: false,
      countedAsOfficialSample: false,
      externalOperations: [],
      preservedExistingChanges: true,
      historicalEvidenceRewritten: false,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_5_7_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "5.6 COMPLETE / FINDING_DISPOSITIONS_REVIEWED",
      ],
      currentStage: PHASE_5_7_STAGE_ID,
      nextEligibleStage: "No Plan 2 implementation; dedicated diagnostic continuation requires separate authorization",
    },
    sourceIdentity,
    prerequisite,
    inputEvidence: {
      path: PHASE_5_7_PHASE_5_6_EVIDENCE_PATH,
      runId: phase56.runId,
      status: phase56.status,
      outcome: phase56.outcome,
      sha256: sha256File(absoluteRepoPath(PHASE_5_7_PHASE_5_6_EVIDENCE_PATH)),
      integrity: phase56.evidenceIntegrity,
    },
    manifestTransition: {
      path: PHASE_5_7_MANIFEST_PATH,
      beforeSha256: manifestBeforeSha256,
      afterSha256: manifestAfterSha256,
      dispositionsPreserved: true,
    },
    closureDecision: closure,
    stageLedger: [
      {
        stageId: "5.7.1",
        name: "Validate Phase 5.6 disposition evidence",
        status: "COMPLETE",
        evidence: "5.6 integrity PASS; five locked findings present; no Plan 2 eligibility",
      },
      {
        stageId: "5.7.2",
        name: "Prepare prioritized Plan 2 input",
        status: "COMPLETE",
        evidence: "Five structured entries created with changes unauthorized",
      },
      {
        stageId: "5.7.3",
        name: "Select Plan 1 closure outcome",
        status: "COMPLETE",
        evidence: closure.outcome,
      },
      {
        stageId: "5.7.4",
        name: "Reconcile closure evidence and continuation pointers",
        status: "COMPLETE",
        evidence: "Documentation-only reconciliation recorded after evidence generation",
      },
    ],
    plan2Input,
    blockers: closure.reasonCodes,
    constraints: [
      "Plan 2 is not started or authorized by this closure.",
      "No runtime, database, migration, dependency, provider, channel, deploy, or secret change was performed.",
      "The official nine-scenario x 20-valid-sample contract remains unchanged and was not started.",
      "The two AI Chat findings remain blocked until a dedicated authenticated journey is authorized and captured.",
      "Production remains NO-GO.",
    ],
    evidenceIntegrity: {
      status: "PENDING",
      redactionCheck: "PENDING",
      sourceIdentityPass: sourceIdentity.diffCheck === "PASS",
      prerequisiteEvidenceParsed: prerequisite.status === "PASS",
      findingIdsLocked: PHASE_5_6_FINDING_IDS.length === 5,
      plan2InputComplete: plan2Input.entries.length === 5,
      historicalEvidenceRewritten: false,
      runtimeFixAccepted: false,
      officialMeasurementStarted: false,
      newCheckpointCreated: false,
    },
    checkpointReconciliation: {
      status: "NOT_APPLICABLE",
      source: "offline closure; no diagnostic observation or experiment boundary was created",
      newCheckpointCreated: false,
      reusedInputCheckpointEvidence: true,
    },
    closure: {
      status: "COMPLETE",
      outcome: closure.outcome,
      phase4Closed: true,
      plan1Closed: true,
      plan2EntryAuthorized: false,
      runtimeFixAccepted: false,
      officialMeasurementStarted: false,
      nextAction: "Keep Plan 2 locked; separately authorize a dedicated AI Chat diagnostic continuation if more evidence is required.",
    },
    output: {
      evidencePath: posixPath(relative(repoRoot, evidencePath)),
      manifestPath: PHASE_5_7_MANIFEST_PATH,
    },
  };
  const sanitized = sanitizePhase4Evidence(evidence);
  const redaction = redactionCheck(sanitized);
  sanitized.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  sanitized.evidenceIntegrity.status =
    sanitized.evidenceIntegrity.redactionCheck === "PASS" &&
    sanitized.evidenceIntegrity.sourceIdentityPass &&
    sanitized.evidenceIntegrity.prerequisiteEvidenceParsed &&
    sanitized.evidenceIntegrity.findingIdsLocked &&
    sanitized.evidenceIntegrity.plan2InputComplete
      ? "PASS"
      : "BLOCKED";
  sanitized.redactionCheck = redaction;
  return sanitized;
}

function loadInputs() {
  const phase56 = readJson(absoluteRepoPath(PHASE_5_7_PHASE_5_6_EVIDENCE_PATH));
  const manifest = readJson(absoluteRepoPath(PHASE_5_7_MANIFEST_PATH));
  if (!phase56 || !manifest) throw new Error("phase57_input_missing");
  return { phase56, manifest };
}

export function runPhase57Closure({ runId = createPhase57RunId(), writeEvidence = false } = {}) {
  const inputs = loadInputs();
  const prerequisite = phase57PrerequisiteCheck(inputs);
  if (prerequisite.status !== "PASS") {
    return {
      runId,
      status: "BLOCKED",
      outcome: "PLAN1_CLOSURE_BLOCKED",
      prerequisite,
      evidencePath: null,
    };
  }
  const closedAt = new Date().toISOString();
  const evidencePath = phase57V3EvidencePath(runId);
  const evidenceRelativePath = posixPath(relative(repoRoot, evidencePath));
  const manifestRaw = readFileSync(absoluteRepoPath(PHASE_5_7_MANIFEST_PATH), "utf8");
  const manifestBeforeSha256 = sha256(manifestRaw);
  const closure = determinePlan1Closure(inputs.phase56.findingDispositions);
  const plan2Input = buildPlan2Input(inputs);
  const updatedManifest = applyPhase57ManifestClosure(inputs.manifest, {
    runId,
    evidencePath: evidenceRelativePath,
    closedAt,
    closure,
  });
  const newline = manifestRaw.includes("\r\n") ? "\r\n" : "\n";
  if (writeEvidence) {
    writeJsonPreservingNewline(absoluteRepoPath(PHASE_5_7_MANIFEST_PATH), updatedManifest, newline);
  }
  const sourceIdentity = collectSourceIdentity();
  const evidence = buildPhase57Evidence({
    phase56: inputs.phase56,
    manifest: updatedManifest,
    prerequisite,
    closure,
    plan2Input,
    runId,
    closedAt,
    evidencePath,
    sourceIdentity,
    manifestBeforeSha256,
    manifestAfterSha256: sha256File(absoluteRepoPath(PHASE_5_7_MANIFEST_PATH)),
  });
  if (writeEvidence) writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  return {
    runId,
    status: evidence.status,
    outcome: evidence.outcome,
    plan1Closed: evidence.closure.plan1Closed,
    plan2EntryAuthorized: evidence.closure.plan2EntryAuthorized,
    evidencePath: writeEvidence ? posixPath(relative(repoRoot, evidencePath)) : null,
    manifestPath: writeEvidence ? PHASE_5_7_MANIFEST_PATH : null,
    evidenceIntegrity: evidence.evidenceIntegrity,
    eligibleFindingIds: plan2Input.eligibleFindingIds,
    closureCounts: closure.counts,
  };
}

function parseArguments(argv) {
  const options = { descriptor: false, status: false, run: false, writeEvidence: false, runId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--run-id") options.runId = argv[++index];
    else throw new Error(`phase57_argument_invalid:${arg}`);
  }
  return options;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify({
      phase: "5",
      stage: PHASE_5_7_STAGE_ID,
      planRevision: PHASE_5_7_PLAN_REVISION,
      inputEvidence: PHASE_5_7_PHASE_5_6_EVIDENCE_PATH,
      outputContract: "docs/AIYA_PERFORMANCE_PLAN_1_V3_<runId>_EVIDENCE.json",
      closureOutcomes: ["ROOT_CAUSE_EVIDENCE_READY", "NO_RUNTIME_CAUSE_CONFIRMED", "DIAGNOSIS_BLOCKED"],
      mode: "offline_evidence_review_only",
    }, null, 2)}\n`);
    return;
  }
  if (options.status) {
    const manifest = readJson(absoluteRepoPath(PHASE_5_7_MANIFEST_PATH));
    process.stdout.write(`${JSON.stringify({
      phase: "5",
      stage: PHASE_5_7_STAGE_ID,
      currentPlan1Closure: manifest?.currentPlan1Closure ?? null,
    }, null, 2)}\n`);
    return;
  }
  if (!options.run) throw new Error("phase57_run_or_descriptor_or_status_required");
  process.stdout.write(`${JSON.stringify(runPhase57Closure({
    runId: options.runId ?? createPhase57RunId(),
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
