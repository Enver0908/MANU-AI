import {
  claimReadyInboundBundle,
  promoteDueInboundBundles,
  releaseInboundBundleLease,
} from "./phase-85-stage-4b3-message-bundles";
import type { InboundMessageBundleRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  resolveMultimodalBundleUnderstanding,
  type Stage4B3MultimodalUnderstandingResult,
} from "./phase-85-stage-4b3-multimodal-understanding";
import {
  evaluateMultimodalBundleSafetyChain,
  type Stage4B3MultimodalSafetyChain,
} from "./phase-85-stage-4b3-multimodal-safety";
import type { ManuAppState } from "./types";

export const STAGE_4B3_MEDIA_WORKER_VERSION = "p85-stage-4b3-media-worker-v1";
export const STAGE_4B3_BUNDLE_LEASE_SECONDS = 60;

export type Stage4B3BundleWorkerResult = {
  state: ManuAppState;
  claimedBundles: InboundMessageBundleRecord[];
  understandings: Stage4B3MultimodalUnderstandingResult[];
  safetyChains: Stage4B3MultimodalSafetyChain[];
};

export function processStage4B3DueInboundBundles(
  state: ManuAppState,
  input: { workerId: string; now?: string; releaseAfterClaim?: boolean; resolveUnderstanding?: boolean },
): Stage4B3BundleWorkerResult {
  const now = input.now ?? new Date().toISOString();
  let workingState = promoteDueInboundBundles(state, now);
  const claimedBundles: InboundMessageBundleRecord[] = [];
  const understandings: Stage4B3MultimodalUnderstandingResult[] = [];
  const safetyChains: Stage4B3MultimodalSafetyChain[] = [];

  while (true) {
    const claim = claimReadyInboundBundle(workingState, { workerId: input.workerId, now });
    workingState = claim.state;
    if (!claim.claimed) {
      break;
    }
    claimedBundles.push(claim.claimed);
    if (input.resolveUnderstanding !== false) {
      const understanding = resolveMultimodalBundleUnderstanding(workingState, claim.claimed.id);
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
    if (input.releaseAfterClaim) {
      workingState = releaseInboundBundleLease(workingState, claim.claimed.id, {
        workerId: input.workerId,
        now,
        success: true,
      });
    }
  }

  return { state: workingState, claimedBundles, understandings, safetyChains };
}
