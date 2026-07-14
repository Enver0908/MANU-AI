import {
  bundleHasDietitianReply,
  claimReadyInboundBundle,
  promoteDueInboundBundles,
  releaseInboundBundleWork,
} from "./phase-85-stage-4b3-message-bundles";
import type { InboundMessageBundleRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  isRetryableUnderstandingFailure,
  type Stage4B3BundleWorkerOutcome,
} from "./phase-85-stage-4b3-bundle-worker-outcomes";
import {
  runMultimodalBundleInboundTurn,
  type MultimodalBundleTurnResult,
} from "./phase-85-stage-4b3-bundle-orchestration";
import {
  evaluateMultimodalBundleSafetyChain,
  type Stage4B3MultimodalSafetyChain,
} from "./phase-85-stage-4b3-multimodal-safety";
import {
  resolveMultimodalBundleUnderstanding,
  type Stage4B3MultimodalUnderstandingResult,
} from "./phase-85-stage-4b3-multimodal-understanding";
import type { ManuAppState } from "./types";

export const STAGE_4B3_MEDIA_WORKER_VERSION = "p85-stage-4b3-media-worker-v2";
export const STAGE_4B3_BUNDLE_LEASE_SECONDS = 60;

export type Stage4B3BundleWorkerResult = {
  state: ManuAppState;
  claimedBundles: InboundMessageBundleRecord[];
  understandings: Stage4B3MultimodalUnderstandingResult[];
  safetyChains: Stage4B3MultimodalSafetyChain[];
  bundleTurns: MultimodalBundleTurnResult[];
  outcomes: Array<{ bundleId: string; outcome: Stage4B3BundleWorkerOutcome; failureCode?: string | null }>;
};

function resolveBundleWorkerOutcome(input: {
  bundle: InboundMessageBundleRecord;
  understanding: Stage4B3MultimodalUnderstandingResult | null;
  turn: MultimodalBundleTurnResult | null;
  state: ManuAppState;
}): { outcome: Stage4B3BundleWorkerOutcome; failureCode?: string | null } {
  const { bundle, understanding, turn, state } = input;

  if (bundle.status === "review_required") {
    return { outcome: "review_required", failureCode: bundle.failureCode };
  }

  if (bundleHasDietitianReply(state, bundle.id)) {
    return { outcome: "human_handled", failureCode: "human_handled" };
  }

  if (understanding && !understanding.ok) {
    const failureCode = understanding.failureCode;
    if (isRetryableUnderstandingFailure(failureCode)) {
      return { outcome: "retryable_failure", failureCode };
    }
    return { outcome: "terminal_failure", failureCode };
  }

  if (turn) {
    if (turn.ok) {
      return { outcome: "success" };
    }
    if (turn.failureCode === "bundle_review_required") {
      return { outcome: "review_required", failureCode: turn.failureCode };
    }
    if (isRetryableUnderstandingFailure(turn.failureCode)) {
      return { outcome: "retryable_failure", failureCode: turn.failureCode };
    }
    return { outcome: "terminal_failure", failureCode: turn.failureCode };
  }

  return { outcome: "retryable_failure", failureCode: "bundle_turn_not_executed" };
}

export async function processStage4B3DueInboundBundles(
  state: ManuAppState,
  input: {
    workerId: string;
    now?: string;
    finalizeClaims?: boolean;
    resolveUnderstanding?: boolean;
    runOrchestration?: boolean;
  },
): Promise<Stage4B3BundleWorkerResult> {
  const now = input.now ?? new Date().toISOString();
  let workingState = promoteDueInboundBundles(state, now);
  const claimedBundles: InboundMessageBundleRecord[] = [];
  const understandings: Stage4B3MultimodalUnderstandingResult[] = [];
  const safetyChains: Stage4B3MultimodalSafetyChain[] = [];
  const bundleTurns: MultimodalBundleTurnResult[] = [];
  const outcomes: Stage4B3BundleWorkerResult["outcomes"] = [];

  while (true) {
    const claim = claimReadyInboundBundle(workingState, { workerId: input.workerId, now });
    workingState = claim.state;
    if (!claim.claimed) {
      break;
    }

    const claimed = claim.claimed;
    claimedBundles.push(claimed);

    let understanding: Stage4B3MultimodalUnderstandingResult | null = null;
    let turn: MultimodalBundleTurnResult | null = null;

    if (claimed.status === "review_required") {
      outcomes.push({ bundleId: claimed.id, outcome: "review_required", failureCode: claimed.failureCode });
      if (input.finalizeClaims !== false) {
        workingState = releaseInboundBundleWork(workingState, claimed.id, {
          workerId: input.workerId,
          now,
          outcome: "review_required",
          failureCode: claimed.failureCode,
        });
      }
      continue;
    }

    if (bundleHasDietitianReply(workingState, claimed.id)) {
      outcomes.push({ bundleId: claimed.id, outcome: "human_handled", failureCode: "human_handled" });
      if (input.finalizeClaims !== false) {
        workingState = releaseInboundBundleWork(workingState, claimed.id, {
          workerId: input.workerId,
          now,
          outcome: "human_handled",
          failureCode: "human_handled",
        });
      }
      continue;
    }

    if (input.resolveUnderstanding !== false) {
      understanding = resolveMultimodalBundleUnderstanding(workingState, claimed.id);
      understandings.push(understanding);
      if (understanding.ok) {
        safetyChains.push(
          evaluateMultimodalBundleSafetyChain({
            understanding,
            baseRiskDecision: { level: "green", reasons: [] },
          }),
        );
      }
    }

    const shouldRunOrchestration =
      input.runOrchestration === true && understanding?.ok === true && !bundleHasDietitianReply(workingState, claimed.id);

    if (shouldRunOrchestration) {
      turn = await runMultimodalBundleInboundTurn(workingState, claimed.id, {
        now,
        idempotencyKey: `bundle-turn-${claimed.id}-${claimed.bundleRevision}`,
      });
      bundleTurns.push(turn);
      if (turn.ok) {
        workingState = turn.state;
      }
    }

    const resolved = resolveBundleWorkerOutcome({
      bundle: workingState.inboundMessageBundles.find((entry) => entry.id === claimed.id) ?? claimed,
      understanding,
      turn,
      state: workingState,
    });
    outcomes.push({
      bundleId: claimed.id,
      outcome: resolved.outcome,
      failureCode: resolved.failureCode,
    });

    if (input.finalizeClaims !== false) {
      workingState = releaseInboundBundleWork(workingState, claimed.id, {
        workerId: input.workerId,
        now,
        outcome: resolved.outcome,
        failureCode: resolved.failureCode,
      });
    }
  }

  return { state: workingState, claimedBundles, understandings, safetyChains, bundleTurns, outcomes };
}
