#!/usr/bin/env node

/**
 * Plan 1 v3 Phase 5.1 hypothesis ordering.
 *
 * This stage pre-registers causal candidates from the completed 4.7
 * reconciliation. It does not launch the app, measure a journey, or change
 * product runtime code.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectPhaseRuns,
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

export const PHASE_5_1_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_1_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3";
export const PHASE_5_1_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase5-1-hypothesis-ordering-v3";
export const PHASE_5_1_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const PHASE_5_1_EVIDENCE_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase5-1-hypothesis-evidence-v1";

export const PHASE_5_1_FINDING_IDS = Object.freeze([
  "PERF-F2-001",
  "PERF-F2-002",
  "PERF-F2-003",
  "PERF-F12-001",
  "PERF-F12-002",
]);

const PHASE_4_7_EVIDENCE_RUN_ID =
  "aiya-performance-plan1-phase4-7-reconciliation-v3-20260917T130007581Z-b5e2fa96-bdfd-4535-833d-71169d3982cf";
const PHASE_4_7_EVIDENCE_RELATIVE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_4_7_EVIDENCE_RUN_ID}_PHASE_4_7_RECONCILIATION_EVIDENCE.json`;

const SOURCE_PATHS = Object.freeze([
  "app/src/components/dashboard-app.tsx",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/components/ai-chat/ai-chat-page-client.tsx",
  "app/src/components/ai-chat/ai-chat-workspace.tsx",
  "app/src/lib/use-aiya-state.ts",
  "app/src/lib/use-stage-4b-inbox.ts",
  "app/src/lib/use-stage-4b2-messaging.ts",
  "app/src/lib/use-ai-chat.ts",
  "app/src/lib/phase-85-stage-4b-inbox-scheduler.ts",
  "app/src/lib/phase-85-stage-4b2-messaging-scheduler.ts",
  "app/src/lib/phase-85-stage-5-shell-store.ts",
  "app/src/lib/supabase-store.ts",
  "app/src/app/api/shell/bootstrap/route.ts",
  "app/src/app/api/app-state/route.ts",
  "app/src/app/api/ai-chat/conversations/route.ts",
  "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
]);

const HYPOTHESES = Object.freeze([
  Object.freeze({
    candidateId: "H-5.1-001",
    rank: 1,
    title: "Shared shell and app-state hydration fan-out",
    shortName: "shared_shell_app_state_hydration_fanout",
    status: "PROVISIONAL_UNMEASURED",
    optimizationStatus: "NOT_AUTHORIZED_UNMEASURED",
    affectedJourneys: ["J1", "J2", "J3"],
    affectedEnvironments: ["local_desktop", "hosted", "android_chrome", "android_pwa"],
    linkedFindingIds: ["PERF-F2-001", "PERF-F2-002", "PERF-F2-003"],
    evidenceBasis: [
      "4.7 recorded valid observations for all three journeys but performance was NOT_EVALUABLE.",
      "DashboardApp starts app-state hydration after mount while ShellProvider starts route bootstrap independently.",
      "The source shows separate authenticated app-state and shell-bootstrap boundaries; overlap is a hypothesis, not an observed delay.",
    ],
    exactFilesAndFunctions: [
      "app/src/components/dashboard-app.tsx:138-140 DashboardApp hydration effect",
      "app/src/components/dashboard/shell-provider.tsx:253-362 runBootstrap and route effect",
      "app/src/lib/use-aiya-state.ts:157-183 hydrate and hydrationInFlightRef",
      "app/src/app/api/shell/bootstrap/route.ts:11-29 GET timing boundary",
      "app/src/app/api/app-state/route.ts:36-60 GET timing boundary",
      "app/src/lib/phase-85-stage-5-shell-store.ts:213 loadShellBootstrap",
      "app/src/lib/supabase-store.ts:854 loadSupabaseState",
    ],
    mechanism: "Independent authenticated shell-bootstrap and full app-state reads may compete with route readiness and client hydration on a shared dashboard critical path.",
    expectedTimingBoundary: {
      start: "trusted_user_action_or_route_commit",
      end: "target_ready",
      requiredSubboundaries: [
        "route_commit",
        "shell_bootstrap_auth_store_json_body_finish",
        "app_state_auth_store_json_body_finish",
        "client_hydration_complete",
        "target_ready",
      ],
    },
    singleVariableFor52: "shared_read_start_policy: current independent shell-bootstrap/app-state starts (A) versus one approved coordination gate for the shared reads (B)",
    controlsFor52: [
      "same authenticated synthetic account and tenant",
      "same fixture, release identity, browser/device, cache mode, network, and route order",
      "same required reads, payload contracts, authorization, and target readiness selector",
      "record request overlap and body-finish for every started request",
    ],
    safetyChecks: [
      "tenant/session/role/capability and RLS identity remain unchanged",
      "full app-state completeness and freshness remain unchanged",
      "late response sequence and hydration single-flight behavior remain correct",
      "mutation conflict, dirty-state, and navigation guards remain correct",
      "PWA privacy-lock and reconnect behavior remain unchanged",
    ],
    rollback: "Revert only the shared-read scheduling gate and restore the A path; no migration, dependency, secret, or payload change.",
    nextEvidenceNeeded: "A trace with route, shell-bootstrap, app-state, hydration, and target-ready timestamps before any B change.",
  }),
  Object.freeze({
    candidateId: "H-5.1-002",
    rank: 2,
    title: "Background inbox and messaging polling overlap",
    shortName: "background_polling_overlap",
    status: "PROVISIONAL_UNMEASURED",
    optimizationStatus: "NOT_AUTHORIZED_UNMEASURED",
    affectedJourneys: ["J1", "J2", "J3"],
    affectedEnvironments: ["local_desktop", "hosted", "android_chrome", "android_pwa"],
    linkedFindingIds: ["PERF-F2-001", "PERF-F2-002", "PERF-F2-003"],
    evidenceBasis: [
      "DashboardApp mounts the inbox hook globally and enables messaging refresh after hydration.",
      "The hooks schedule foreground polling and refresh multiple operational reads with independent lifecycle gates.",
      "4.7 observed functional boundaries but did not measure polling overlap or a main-thread delay.",
    ],
    exactFilesAndFunctions: [
      "app/src/components/dashboard-app.tsx:137-138 useStage4BInbox",
      "app/src/components/dashboard-app.tsx:213-220 useStage4B2Messaging",
      "app/src/lib/use-stage-4b-inbox.ts:158-207 refresh",
      "app/src/lib/use-stage-4b-inbox.ts:297-335 polling schedule",
      "app/src/lib/use-stage-4b2-messaging.ts:292-307 refreshAll",
      "app/src/lib/use-stage-4b2-messaging.ts:378-416 polling schedule",
      "app/src/lib/phase-85-stage-4b-inbox-scheduler.ts",
      "app/src/lib/phase-85-stage-4b2-messaging-scheduler.ts",
    ],
    mechanism: "Operational inbox and conversation refreshes may overlap with foreground navigation or readiness work and contribute network, store, or render contention.",
    expectedTimingBoundary: {
      start: "trusted_user_action_or_route_commit",
      end: "target_ready",
      requiredSubboundaries: [
        "poll_start_and_end",
        "foreground_request_start_and_body_finish",
        "long_task_or_render_window",
        "target_ready",
      ],
    },
    singleVariableFor52: "foreground_polling_policy: current visible-page polling (A) versus one approved navigation-window pause/cancel policy (B)",
    controlsFor52: [
      "same operational data, filters, route order, account, and target readiness condition",
      "same polling intervals outside the measured navigation window",
      "retain request owner keys, inflight dedupe, abort, and sequence guards",
      "record notification/inbox freshness and unread counts at the end of each trace",
    ],
    safetyChecks: [
      "clinical alert and notification freshness remains within the existing contract",
      "abort and late-response guards do not apply stale data",
      "visibility/focus recovery schedules exactly one refresh per owner key",
      "tenant scope, capability checks, and mutation refreshes remain unchanged",
    ],
    rollback: "Revert only the navigation-window polling policy and restore existing scheduler behavior; no API or persistence change.",
    nextEvidenceNeeded: "A trace correlating polling request intervals with route commit, target readiness, and browser long tasks.",
  }),
  Object.freeze({
    candidateId: "H-5.1-003",
    rank: 3,
    title: "Dashboard bundle, import, and render work",
    shortName: "dashboard_bundle_import_render",
    status: "PROVISIONAL_UNMEASURED",
    optimizationStatus: "NOT_AUTHORIZED_UNMEASURED",
    affectedJourneys: ["J1", "J2", "J3"],
    affectedEnvironments: ["local_desktop", "hosted", "android_chrome", "android_pwa"],
    linkedFindingIds: ["PERF-F2-001", "PERF-F2-002", "PERF-F2-003"],
    evidenceBasis: [
      "DashboardApp imports multiple feature panels at module scope and switches the active surface in one client application.",
      "This is a plausible browser parse/compile/render candidate, but 4.7 has no bundle-size, long-task, or paint timing evidence.",
    ],
    exactFilesAndFunctions: [
      "app/src/components/dashboard-app.tsx:3-81 module imports and DashboardApp",
      "app/src/components/dashboard-app.tsx:83-140 active shell and hydration composition",
      "app/src/components/dashboard/shell-provider.tsx:999-1028 provider value and destination state",
      "app/src/components/dashboard/forms-panel.tsx",
      "app/src/components/dashboard/messaging-panel.tsx",
      "app/src/components/dashboard/overview-panel.tsx",
      "app/src/components/dashboard/client-workspace.tsx",
    ],
    mechanism: "Eager client imports or route render work may delay target interactivity after navigation, especially when the main thread is parsing, compiling, or laying out large panels.",
    expectedTimingBoundary: {
      start: "route_commit",
      end: "target_ready_and_first_interactive_paint",
      requiredSubboundaries: [
        "chunk_transfer",
        "script_parse_compile",
        "long_task_window",
        "react_render_commit",
        "target_ready_and_paint",
      ],
    },
    singleVariableFor52: "target_panel_loading: current eager panel import (A) versus one approved dynamic split for the measured target panel (B)",
    controlsFor52: [
      "same build inputs except the single selected import boundary",
      "same route, account, fixture, device, cache/service-worker mode, and network",
      "same server payloads and target readiness selector",
      "capture chunk identity and browser long-task/paint evidence",
    ],
    safetyChecks: [
      "loading and error fallback preserves target accessibility and navigation",
      "server/client boundary and authenticated route guard remain unchanged",
      "PWA cache, privacy-lock, and reconnect behavior remain unchanged",
      "no required data or safety state is skipped to improve timing",
    ],
    rollback: "Restore the single selected eager import and remove only its dynamic boundary; no data or API change.",
    nextEvidenceNeeded: "A build and browser trace identifying a specific chunk, parse/compile cost, or long-task interval on the critical path.",
  }),
  Object.freeze({
    candidateId: "H-5.1-004",
    rank: 4,
    title: "Warm AI Chat auth, store, and readiness",
    shortName: "warm_ai_chat_auth_store_readiness",
    status: "DEFERRED_NOT_EXERCISED",
    optimizationStatus: "NOT_ELIGIBLE_WITHOUT_DEDICATED_JOURNEY",
    affectedJourneys: [],
    affectedEnvironments: [],
    linkedFindingIds: ["PERF-F12-001", "PERF-F12-002"],
    evidenceBasis: [
      "4.7 explicitly records both AI Chat findings as not exercised by J1-J3.",
      "The AI Chat hooks own independent history/detail request cycles and must be measured on an AI Chat journey before ordering by contribution.",
    ],
    exactFilesAndFunctions: [
      "app/src/lib/use-ai-chat.ts:116-219 useAiChatHistory and useAiChatConversation",
      "app/src/components/ai-chat/ai-chat-page-client.tsx",
      "app/src/components/ai-chat/ai-chat-workspace.tsx",
      "app/src/app/api/ai-chat/conversations/route.ts",
      "app/src/app/api/ai-chat/conversations/[chatId]/route.ts",
    ],
    mechanism: "Warm AI Chat navigation may be delayed by independent authenticated history/detail loads or readiness state, but the current Plan 1 journeys provide no evidence for this path.",
    expectedTimingBoundary: {
      start: "ai_chat_route_commit",
      end: "history_or_conversation_ready_and_interactive",
      requiredSubboundaries: [
        "ai_chat_auth_session",
        "history_or_detail_store_body_finish",
        "client_parse_render",
        "ai_chat_ready",
      ],
    },
    singleVariableFor52: "ai_chat_readiness_policy: current independent history/detail readiness (A) versus one approved readiness coordination change (B)",
    controlsFor52: [
      "dedicated authenticated AI Chat journey and the same scoped or general chat mode",
      "same account, tenant, chat fixture, route order, build, cache, network, and device",
      "same permissions, client scope, and required data contract",
    ],
    safetyChecks: [
      "AI Chat capability and tenant/client scope remain enforced",
      "no raw prompt, clinical data, attachment, or provider egress enters evidence",
      "stream cancellation, reconnect, and draft/mutation lifecycle remain unchanged",
    ],
    rollback: "Restore the current AI Chat readiness policy; no provider, prompt, data, or persistence change.",
    nextEvidenceNeeded: "A dedicated AI Chat observation with accepted auth, body-finish, render, and ready boundaries.",
  }),
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function posixPath(path) {
  return String(path).replaceAll("\\", "/");
}

function relativeRepoPath(path) {
  return posixPath(relative(repoRoot, path));
}

function gitOutput(args) {
  try {
    return String(execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })).trim();
  } catch {
    return null;
  }
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
    sourceFiles: SOURCE_PATHS.map((path) => ({
      path,
      exists: existsSync(join(repoRoot, path)),
      sha256: sha256File(join(repoRoot, path)),
    })),
    dirtyTreePreserved: true,
    diffCheck: gitOutput(["diff", "--check"]) === "" ? "PASS" : "FAIL",
  };
}

function phase51V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(safeRunId)) {
    throw new Error("phase51_run_id_invalid");
  }
  return join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_PHASE_5_1_HYPOTHESIS_EVIDENCE.json`,
  );
}

export { phase51V3EvidencePath };

export function phase47PrerequisiteCheck(phase47Evidence) {
  const failures = [];
  if (!phase47Evidence || typeof phase47Evidence !== "object") {
    failures.push("phase4_7_evidence_missing");
  }
  if (phase47Evidence?.planRevision !== PHASE_5_1_PLAN_REVISION) {
    failures.push("plan_revision_mismatch");
  }
  if (phase47Evidence?.stageId !== "4.7") failures.push("stage_id_mismatch");
  if (phase47Evidence?.status !== "COMPLETE") failures.push("phase4_7_not_complete");
  if (phase47Evidence?.outcome !== "DIAGNOSIS_BLOCKED") {
    failures.push("phase4_7_outcome_not_reconciled");
  }
  if (phase47Evidence?.stageLedger?.some((stage) => stage.status !== "COMPLETE")) {
    failures.push("phase4_7_stage_not_complete");
  }
  if (phase47Evidence?.closure?.phase4Closed !== true) failures.push("phase4_not_closed");
  if (phase47Evidence?.closure?.plan1Closed !== false) failures.push("plan1_closure_changed");
  if (phase47Evidence?.evidenceIntegrity?.status !== "PASS") failures.push("phase4_7_integrity_failed");
  if (phase47Evidence?.evidenceIntegrity?.officialMeasurementStarted !== false) {
    failures.push("official_measurement_started");
  }
  if (phase47Evidence?.evidenceIntegrity?.causalExperimentStarted !== false) {
    failures.push("causal_experiment_started");
  }
  if (phase47Evidence?.evidenceIntegrity?.runtimeFixAccepted !== false) {
    failures.push("runtime_fix_accepted");
  }
  if (phase47Evidence?.diagnosticConclusion?.performanceOutcome !== "NOT_EVALUABLE") {
    failures.push("unexpected_performance_outcome");
  }
  if (!Array.isArray(phase47Evidence?.findingReconciliation) ||
      !PHASE_5_1_FINDING_IDS.every((id) =>
        phase47Evidence.findingReconciliation.some((finding) => finding.findingId === id))) {
    failures.push("finding_reconciliation_incomplete");
  }
  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    failures,
    sourceRunId: phase47Evidence?.runId ?? null,
    coverage: {
      attemptedCount: phase47Evidence?.coverage?.attemptedCount ?? null,
      observationValidCount: phase47Evidence?.coverage?.observationValidCount ?? null,
      validFunctionalSampleCount: phase47Evidence?.coverage?.validFunctionalSampleCount ?? null,
      performanceOutcome: phase47Evidence?.diagnosticConclusion?.performanceOutcome ?? null,
    },
  };
}

export function getPhase51Hypotheses() {
  return HYPOTHESES.map((hypothesis) => ({
    ...hypothesis,
    affectedJourneys: [...hypothesis.affectedJourneys],
    affectedEnvironments: [...hypothesis.affectedEnvironments],
    linkedFindingIds: [...hypothesis.linkedFindingIds],
    evidenceBasis: [...hypothesis.evidenceBasis],
    exactFilesAndFunctions: [...hypothesis.exactFilesAndFunctions],
    expectedTimingBoundary: {
      ...hypothesis.expectedTimingBoundary,
      requiredSubboundaries: [...hypothesis.expectedTimingBoundary.requiredSubboundaries],
    },
    controlsFor52: [...hypothesis.controlsFor52],
    safetyChecks: [...hypothesis.safetyChecks],
  }));
}

export function buildPhase51Evidence({
  phase47Evidence,
  phase47EvidencePath = PHASE_4_7_EVIDENCE_RELATIVE_PATH,
  sourceIdentity = currentSourceIdentity(),
  checkpoint = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const prerequisite = phase47PrerequisiteCheck(phase47Evidence);
  const hypotheses = getPhase51Hypotheses();
  const sourceIdentityPass = sourceIdentity?.diffCheck === "PASS" &&
    (sourceIdentity?.sourceFiles ?? []).every((file) => file.exists && file.sha256);
  const rawEvidence = {
    schemaVersion: PHASE_5_1_EVIDENCE_SCHEMA_VERSION,
    planRevision: PHASE_5_1_PLAN_REVISION,
    phase: "5",
    stage: "5.1",
    stageId: "5.1",
    runId: checkpoint?.runId ?? null,
    generatedAt,
    status: prerequisite.status === "PASS" && sourceIdentityPass ? "COMPLETE" : "BLOCKED",
    outcome: prerequisite.status === "PASS" && sourceIdentityPass
      ? "HYPOTHESES_PRE_REGISTERED"
      : "HYPOTHESIS_ORDERING_BLOCKED",
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Pre-register and order causal candidates after the completed 4.7 reconciliation.",
      executionMode: "phase5_1_offline_hypothesis_ordering",
      officialMeasurementStarted: false,
      diagnosticJourneyStarted: false,
      causalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      countedAsOfficialSample: false,
      preservedExistingChanges: true,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_5_1_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.1 IDENTITY_LOCKED",
        "4.2 REFERENCE_SEPARATED",
        "4.3 GENERAL_DIAGNOSTIC_HARNESS_READY",
        "4.4 LOCAL_CAPTURE_AND_OBSERVATION_CONTRACT",
        "4.5 HOSTED_OBSERVATIONS_CAPTURED",
        "4.6 ANDROID_PWA_OBSERVATIONS_CAPTURED",
        "4.7 DIAGNOSIS_BLOCKED",
      ],
      currentStage: "5.1",
      nextEligibleStage: prerequisite.status === "PASS" && sourceIdentityPass
        ? "5.2 only after explicit follow-up authorization"
        : "5.1",
    },
    parentEvidence: {
      path: posixPath(phase47EvidencePath),
      runId: phase47Evidence?.runId ?? null,
      status: phase47Evidence?.status ?? null,
      outcome: phase47Evidence?.outcome ?? null,
      sha256: sha256File(resolve(repoRoot, phase47EvidencePath)),
      prerequisite,
    },
    ordering: {
      method: "measured_contribution_then_journeys_affected_then_technical_dependency",
      measuredContributionAvailable: false,
      measuredContributionStatus: "NOT_AVAILABLE_PERFORMANCE_NOT_EVALUABLE",
      orderingStatus: prerequisite.status === "PASS"
        ? "PROVISIONAL_PENDING_ACCEPTED_TIMING_MEASUREMENT"
        : "BLOCKED",
      userImpactScope: "General desktop interaction slowness and freezing complaint.",
      rule: "No candidate is optimized or accepted as causal while measured contribution is unavailable.",
      orderedCandidateIds: hypotheses.map((hypothesis) => hypothesis.candidateId),
    },
    hypothesisRegister: hypotheses,
    gates: {
      firstCandidateFor52: "H-5.1-001",
      firstRequiredTrace: "Capture shared route, shell-bootstrap, app-state, hydration, and target-ready timing before changing code.",
      noRuntimeChangeIn51: true,
      noPlan2EntryIn51: true,
      aiChatRequiresDedicatedJourney: true,
    },
    evidenceIntegrity: {
      status: "PENDING",
      redactionCheck: "PENDING",
      redactionFailures: [],
      parentEvidenceParsed: prerequisite.status === "PASS",
      parentEvidenceIntegrityPass: phase47Evidence?.evidenceIntegrity?.status === "PASS",
      sourceIdentityPass,
      historicalPhase4EvidenceRewritten: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
    },
    blockers: prerequisite.status === "PASS" && sourceIdentityPass
      ? [
          "measured_contribution_unavailable",
          "accepted_timing_boundary_required_before_5_2",
        ]
      : [
          "phase5_1_prerequisite_or_identity",
          ...prerequisite.failures,
          ...(sourceIdentityPass ? [] : ["current_source_identity_invalid"]),
        ],
    constraints: [
      "No candidate is a confirmed cause or accepted contributor.",
      "No runtime change, causal experiment, Plan 2 entry, deploy, migration, or production action is performed.",
      "A 5.2 run requires explicit authorization and one accepted timing boundary.",
      "Credentials, cookies, tokens, raw bodies, prompts, clinical data, and device serials are excluded.",
      "Production remains NO-GO.",
    ],
    closure: {
      status: prerequisite.status === "PASS" && sourceIdentityPass ? "COMPLETE" : "BLOCKED",
      outcome: prerequisite.status === "PASS" && sourceIdentityPass
        ? "HYPOTHESES_PRE_REGISTERED"
        : "HYPOTHESIS_ORDERING_BLOCKED",
      phase4Closed: true,
      plan1Closed: false,
      officialMeasurementStarted: false,
      causalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction: prerequisite.status === "PASS" && sourceIdentityPass
        ? "Require an explicitly authorized 5.2 trace for H-5.1-001; measure the accepted timing boundary before any runtime variable is changed."
        : "Repair the declared prerequisite or identity gap before continuing.",
    },
    checkpointReconciliation: checkpoint,
  };
  const evidence = sanitizePhase4Evidence(rawEvidence);
  const redaction = redactionCheck(evidence);
  evidence.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  evidence.evidenceIntegrity.redactionFailures = redaction.forbiddenValuesFound;
  evidence.evidenceIntegrity.status = redaction.status &&
    evidence.evidenceIntegrity.parentEvidenceParsed &&
    evidence.evidenceIntegrity.parentEvidenceIntegrityPass &&
    evidence.evidenceIntegrity.sourceIdentityPass &&
    evidence.evidenceIntegrity.historicalPhase4EvidenceRewritten === false &&
    evidence.evidenceIntegrity.officialMeasurementStarted === false &&
    evidence.evidenceIntegrity.causalExperimentStarted === false &&
    evidence.evidenceIntegrity.runtimeFixAccepted === false
    ? "PASS"
    : "FAIL";
  return evidence;
}

function checkpointHypothesisOrdering({ sourceIdentity, parentEvidence, parentEvidencePath, newRun }) {
  const identity = {
    planRevision: PHASE_5_1_PLAN_REVISION,
    stageId: "5.1",
    sourceHead: sourceIdentity?.head ?? "unbound",
    parentEvidenceRunId: parentEvidence?.runId ?? null,
    parentEvidenceSha256: sha256File(resolve(repoRoot, parentEvidencePath)),
    candidateIds: HYPOTHESES.map((hypothesis) => hypothesis.candidateId),
  };
  const metadata = {
    identitySummary: {
      planRevision: PHASE_5_1_PLAN_REVISION,
      stageId: "5.1",
      hypothesisOrderingOnly: true,
      countedAsOfficialSample: false,
    },
    parentEvidencePath: posixPath(parentEvidencePath),
  };
  const opened = openPhaseRun({
    root: PHASE_5_1_CHECKPOINT_ROOT,
    phaseId: PHASE_5_1_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_5_1_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata,
    runId: null,
    newRun,
    redact: sanitizePhase4Evidence,
  });
  if (opened.action === "COMPLETE") {
    const existing = readPhaseRun({
      root: PHASE_5_1_CHECKPOINT_ROOT,
      phaseId: PHASE_5_1_CHECKPOINT_PHASE_ID,
      runId: opened.manifest.runId,
    });
    return {
      status: "ALREADY_COMPLETE",
      runId: opened.manifest.runId,
      eventCount: existing.events.length,
      hashChainRead: true,
      lastEventType: existing.events.at(-1)?.type ?? null,
    };
  }
  if (opened.action !== "RUN" || !opened.run) {
    return {
      status: "BLOCKED",
      runId: opened.manifest?.runId ?? null,
      action: opened.action,
      reason: opened.reason ?? "checkpoint_not_runnable",
    };
  }
  const checkpoint = opened.run;
  checkpoint.append("hypothesis.ordering.completed", {
    stageId: "5.1",
    candidateIds: HYPOTHESES.map((hypothesis) => hypothesis.candidateId),
    measuredContributionAvailable: false,
    countedAsOfficialSample: false,
  }, { status: "RUNNING" });
  checkpoint.markStatus("COMPLETE", {
    reason: "phase51_hypotheses_preregistered_without_runtime_change",
    stageId: "5.1",
    countedAsOfficialSample: false,
  });
  const resolvedRunId = checkpoint.runId;
  checkpoint.close();
  const persisted = readPhaseRun({
    root: PHASE_5_1_CHECKPOINT_ROOT,
    phaseId: PHASE_5_1_CHECKPOINT_PHASE_ID,
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

export function runPhase51HypothesisOrdering({
  phase47EvidencePath = join(repoRoot, PHASE_4_7_EVIDENCE_RELATIVE_PATH),
  newRun = false,
  writeEvidence = false,
  generatedAt = new Date().toISOString(),
} = {}) {
  const absolutePhase47EvidencePath = resolve(repoRoot, phase47EvidencePath);
  const phase47Evidence = readJson(absolutePhase47EvidencePath);
  const sourceIdentity = currentSourceIdentity();
  const prerequisite = phase47PrerequisiteCheck(phase47Evidence);
  const checkpoint = prerequisite.status === "PASS"
    ? checkpointHypothesisOrdering({
        sourceIdentity,
        parentEvidence: phase47Evidence,
        parentEvidencePath: absolutePhase47EvidencePath,
        newRun,
      })
    : {
        status: "BLOCKED",
        runId: null,
        eventCount: 0,
        hashChainRead: false,
        lastEventType: null,
      };
  const evidence = buildPhase51Evidence({
    phase47Evidence,
    phase47EvidencePath: relativeRepoPath(absolutePhase47EvidencePath),
    sourceIdentity,
    checkpoint,
    generatedAt,
  });
  const evidencePath = checkpoint.runId ? phase51V3EvidencePath(checkpoint.runId) : null;
  if (writeEvidence && evidencePath) {
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  return { evidence, evidencePath, checkpoint };
}

function parseArguments(argv) {
  const options = {
    run: false,
    status: false,
    newRun: false,
    writeEvidence: false,
    phase47EvidencePath: join(repoRoot, PHASE_4_7_EVIDENCE_RELATIVE_PATH),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--run") options.run = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--phase47-evidence") options.phase47EvidencePath = argv[++index];
    else throw new Error(`phase51_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.status) {
    process.stdout.write(`${JSON.stringify({
      phaseId: PHASE_5_1_CHECKPOINT_PHASE_ID,
      runs: inspectPhaseRuns({
        root: PHASE_5_1_CHECKPOINT_ROOT,
        phaseId: PHASE_5_1_CHECKPOINT_PHASE_ID,
      }),
    }, null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Plan 1 v3 Phase 5.1 hypothesis ordering ready. Use --run for explicit offline registration.\n");
    return;
  }
  const result = runPhase51HypothesisOrdering(options);
  process.stdout.write(`${JSON.stringify({
    runId: result.evidence.runId,
    status: result.evidence.status,
    outcome: result.evidence.outcome,
    stageId: result.evidence.stageId,
    orderedCandidateIds: result.evidence.ordering.orderedCandidateIds,
    measuredContributionAvailable: result.evidence.ordering.measuredContributionAvailable,
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
