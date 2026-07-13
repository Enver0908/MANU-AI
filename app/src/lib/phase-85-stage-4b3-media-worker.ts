import {
  claimReadyInboundBundle,
  promoteDueInboundBundles,
  releaseInboundBundleLease,
} from "./phase-85-stage-4b3-message-bundles";
import type { InboundMessageBundleRecord } from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState } from "./types";

export const STAGE_4B3_MEDIA_WORKER_VERSION = "p85-stage-4b3-media-worker-v1";
export const STAGE_4B3_BUNDLE_LEASE_SECONDS = 60;

export type Stage4B3BundleWorkerResult = {
  state: ManuAppState;
  claimedBundles: InboundMessageBundleRecord[];
};

export function processStage4B3DueInboundBundles(
  state: ManuAppState,
  input: { workerId: string; now?: string; releaseAfterClaim?: boolean },
): Stage4B3BundleWorkerResult {
  const now = input.now ?? new Date().toISOString();
  let workingState = promoteDueInboundBundles(state, now);
  const claimedBundles: InboundMessageBundleRecord[] = [];

  while (true) {
    const claim = claimReadyInboundBundle(workingState, { workerId: input.workerId, now });
    workingState = claim.state;
    if (!claim.claimed) {
      break;
    }
    claimedBundles.push(claim.claimed);
    if (input.releaseAfterClaim) {
      workingState = releaseInboundBundleLease(workingState, claim.claimed.id, {
        workerId: input.workerId,
        now,
        success: true,
      });
    }
  }

  return { state: workingState, claimedBundles };
}
