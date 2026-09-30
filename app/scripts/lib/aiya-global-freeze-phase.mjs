import { defineResumablePhase } from "../../../tools/phase-execution/phase-definition.template.mjs";

export const GLOBAL_FREEZE_PHASE_ID = "aiya-global-freeze-diagnostic-v1";
export const GLOBAL_FREEZE_SCHEMA_VERSION = "aiya-global-freeze-diagnostic-v1";
export const GLOBAL_FREEZE_WAIT_STATE_PHASE_ID = "aiya-global-freeze-wait-state";
export const GLOBAL_FREEZE_WAIT_STATE_SCHEMA_VERSION = "aiya-global-freeze-wait-state-v1";
export const GLOBAL_FREEZE_MAX_ATTEMPTS = 5;
export const GLOBAL_FREEZE_REQUIRED_RECORDS = 3;
export const GLOBAL_FREEZE_PHASE1_BLOCK_REASONS = new Set([
  "authenticated_session_unavailable",
  "host_access_blocked",
  "browser_trace_harness_blocked",
  "attempt_budget_exhausted",
]);

export function validatePhaseOneBlockReason(value) {
  if (!GLOBAL_FREEZE_PHASE1_BLOCK_REASONS.has(value)) throw new Error("phase1_block_reason_invalid");
  return value;
}

export function assertPhaseOneAttemptBudget(existingRuns) {
  if (!Array.isArray(existingRuns) || existingRuns.length >= GLOBAL_FREEZE_MAX_ATTEMPTS) {
    throw new Error("phase1_attempt_limit_reached");
  }
  if (existingRuns.some((run) => ["RUNNING", "PAUSE_REQUESTED"].includes(run.status))) {
    throw new Error("phase1_attempt_already_running");
  }
  if (existingRuns.filter((run) => run.status === "COMPLETE").length >= GLOBAL_FREEZE_REQUIRED_RECORDS) {
    throw new Error("phase1_required_records_already_complete");
  }
  return existingRuns.length + 1;
}

export function assertPhaseOneRunHistory(runSummaries) {
  if (!Array.isArray(runSummaries) || runSummaries.some((run) =>
    typeof run?.runId !== "string" || run.runId.length === 0)) {
    throw new Error("phase1_checkpoint_history_corrupt");
  }
}

function validCapture(record) {
  return record?.observationValidity === "VALID" &&
    record?.clockAlignment === "ALIGNED" &&
    record?.alignedTraceDurationMs >= 80_000 &&
    record?.alignedHostSampleCount >= 80 &&
    record?.hostClockUncertaintyMs <= 500 &&
    record?.checkpointStatus === "COMPLETE" &&
    typeof record?.checkpointRunId === "string" &&
    /^[a-f0-9]{64}$/.test(String(record?.browserTraceSha256 ?? "")) &&
    /^[a-f0-9]{64}$/.test(String(record?.hostSamplesSha256 ?? "")) &&
    ["observed", "not_observed"].includes(record?.interactionObservation?.freeze) &&
    ["responsive", "unresponsive", "not_tested"].includes(record?.interactionObservation?.keyboard) &&
    ["responsive", "unresponsive", "not_tested"].includes(record?.interactionObservation?.navigation) &&
    ["responsive", "delayed", "not_tested"].includes(record?.interactionObservation?.reload);
}

export const GLOBAL_FREEZE_PHASE_DEFINITION = defineResumablePhase({
  phaseId: GLOBAL_FREEZE_PHASE_ID,
  phaseSchemaVersion: GLOBAL_FREEZE_SCHEMA_VERSION,
  stages: [
    {
      stageId: "phase-1-aligned-live-capture",
      prerequisites: [],
      verify: (evidence) => {
        const records = evidence?.phase1?.records;
        return Array.isArray(records) && records.length <= 5 &&
          records.filter(validCapture).length === 3;
      },
    },
    {
      stageId: "phase-2-causal-layer-attribution",
      prerequisites: ["phase-1-aligned-live-capture"],
      verify: (evidence) => {
        const result = evidence?.phase2;
        return evidence?.phase1?.records?.filter(validCapture).length === 3 &&
          evidence.phase1.records.filter((record) => validCapture(record) &&
            record.interactionObservation.freeze === "observed").length >= 2 &&
          result?.status === "CAUSAL_CANDIDATE_CONFIRMED" &&
          result?.repetitions?.a1 === 3 && result?.repetitions?.b === 3 && result?.repetitions?.a2 === 3 &&
          result?.freezeCounts?.a1 === 3 && result?.freezeCounts?.b === 0 && result?.freezeCounts?.a2 === 3 &&
          typeof result?.ownerFile === "string" &&
          typeof result?.ownerFunction === "string" &&
          result?.singleVariableControl === "PASS";
      },
    },
    {
      stageId: "phase-3-local-fix-and-regression-proof",
      prerequisites: ["phase-2-causal-layer-attribution"],
      verify: (evidence) => {
        const result = evidence?.phase3;
        return evidence?.phase2?.status === "CAUSAL_CANDIDATE_CONFIRMED" &&
          result?.status === "LOCAL_FIX_VERIFIED" &&
          result?.focusedTests === "PASS" &&
          result?.typecheck === "PASS" &&
          result?.productionBuild === "PASS" &&
          result?.lintErrors === 0 &&
          /^[a-f0-9]{64}$/.test(String(result?.sourceFixSha256 ?? "")) &&
          result?.desktopInteractionFlow === "PASS" &&
          ["PASS", "NOT_AVAILABLE"].includes(result?.androidPhysicalOutcome) &&
          result?.matchedReproductions?.beforeRecords === 3 &&
          result?.matchedReproductions?.beforeFreezeCount === 3 &&
          result?.matchedReproductions?.afterRecords === 3 &&
          result?.matchedReproductions?.afterFreezeCount === 0;
      },
    },
  ],
});

export const GLOBAL_FREEZE_WAIT_STATE_PHASE_DEFINITION = defineResumablePhase({
  phaseId: GLOBAL_FREEZE_WAIT_STATE_PHASE_ID,
  phaseSchemaVersion: GLOBAL_FREEZE_WAIT_STATE_SCHEMA_VERSION,
  stages: [
    {
      stageId: "phase-2-local-capture-preflight",
      prerequisites: [],
      verify: (evidence) => {
        const result = evidence?.phase2;
        return result?.status === "COMPLETE" &&
          result?.traceComplete === true &&
          /^[a-f0-9]{64}$/.test(String(result?.rawTraceSha256 ?? "")) &&
          /^[a-f0-9]{64}$/.test(String(result?.sanitizedTraceSha256 ?? "")) &&
          typeof result?.checkpointRunId === "string" &&
          result?.input?.expectedCount === 12 &&
          result?.input?.requestedCount === 12 &&
          result?.input?.pressedCount === 12 &&
          result?.input?.delivery === "DELIVERED" &&
          Number.isFinite(result?.input?.medianPressedGapMs) &&
          result.input.medianPressedGapMs >= 250 &&
          result.input.medianPressedGapMs <= 500 &&
          ["request_in_flight", "response_body_not_complete", "main_thread_busy", "visible_loading_after_work"]
            .every((classification) => result.waitClasses?.includes(classification)) &&
          result?.redactionStatus === "PASS";
      },
    },
  ],
});
