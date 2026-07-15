import { runMultimodalBundleInboundTurn } from "./phase-85-stage-4b3-bundle-orchestration";
import { commitAtomicTranscriptCorrectionV2 } from "./phase-85-stage-4b4-atomic-transcript-correction";
import type { TranscriptCorrectionRequest } from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B4_TRANSCRIPT_CORRECTIONS_VERSION = "p85-stage-4b4-transcript-corrections-v2";

export type TranscriptCorrectionSubmitResult =
  | { ok: true; state: ManuAppState; correctionId: string; resultAction: string; rerunDecisionId?: string | null }
  | { ok: false; failureCode: string; state: ManuAppState };

async function attachTranscriptCorrectionBundleRerun(
  state: ManuAppState,
  correctionId: string,
  now: string,
): Promise<ManuAppState> {
  const correction = state.audioTranscriptCorrections.find((entry) => entry.id === correctionId);
  if (!correction) {
    return state;
  }
  if (correction.resultAction === "manual_follow_up" || correction.resultAction === "closed_without_send") {
    return state;
  }

  const correctedTranscription = state.audioTranscriptionRecords.find(
    (entry) => entry.id === correction.correctedTranscriptionId,
  );
  const bundleId = correctedTranscription?.bundleId;
  if (!bundleId) {
    return state;
  }

  const bundle = state.inboundMessageBundles.find(
    (entry) => entry.tenantId === state.tenant.id && entry.id === bundleId,
  );
  if (!bundle || (bundle.status !== "ready" && bundle.status !== "processing")) {
    return state;
  }

  const workingState: ManuAppState =
    bundle.status === "ready"
      ? {
          ...state,
          inboundMessageBundles: state.inboundMessageBundles.map((entry) =>
            entry.id === bundleId
              ? {
                  ...entry,
                  status: "processing",
                  updatedAt: now,
                }
              : entry,
          ),
        }
      : state;

  const turn = await runMultimodalBundleInboundTurn(workingState, bundleId, { now });
  if (!turn.ok) {
    return workingState;
  }

  return {
    ...turn.state,
    audioTranscriptCorrections: turn.state.audioTranscriptCorrections.map((entry) =>
      entry.id === correctionId
        ? {
            ...entry,
            rerunDecisionId: turn.decisionId,
            status: "applied_to_pending",
            updatedAt: now,
          }
        : entry,
    ),
  };
}

export async function submitTranscriptCorrection(
  state: ManuAppState,
  request: TranscriptCorrectionRequest & { dietitianId: string },
  options?: { now?: string; skipBundleRerun?: boolean },
): Promise<TranscriptCorrectionSubmitResult> {
  const result = commitAtomicTranscriptCorrectionV2(state, request);
  if (!result.ok) {
    return result;
  }

  if (result.replay || options?.skipBundleRerun) {
    const correction = result.state.audioTranscriptCorrections.find((entry) => entry.id === result.correctionId);
    return {
      ok: true,
      state: result.state,
      correctionId: result.correctionId,
      resultAction: result.resultAction,
      rerunDecisionId: correction?.rerunDecisionId ?? null,
    };
  }

  const now = options?.now ?? new Date().toISOString();
  const rerunState = await attachTranscriptCorrectionBundleRerun(result.state, result.correctionId, now);
  const correction = rerunState.audioTranscriptCorrections.find((entry) => entry.id === result.correctionId);

  return {
    ok: true,
    state: rerunState,
    correctionId: result.correctionId,
    resultAction: result.resultAction,
    rerunDecisionId: correction?.rerunDecisionId ?? null,
  };
}
