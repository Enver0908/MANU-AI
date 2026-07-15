import type { InboundMessageBundleStatus } from "./phase-85-stage-4b3-media-contracts";

export const STAGE_4B3_BUNDLE_WORKER_OUTCOMES_VERSION = "p85-stage-4b3-bundle-worker-outcomes-v1";

export const STAGE_4B3_BUNDLE_WORKER_OUTCOMES = [
  "success",
  "review_required",
  "retryable_failure",
  "terminal_failure",
  "human_handled",
] as const;

export type Stage4B3BundleWorkerOutcome = (typeof STAGE_4B3_BUNDLE_WORKER_OUTCOMES)[number];

export function isStage4B3BundleWorkerOutcome(value: unknown): value is Stage4B3BundleWorkerOutcome {
  return typeof value === "string" && (STAGE_4B3_BUNDLE_WORKER_OUTCOMES as readonly string[]).includes(value);
}

export function mapBundleWorkerOutcomeToStatus(
  outcome: Stage4B3BundleWorkerOutcome,
  input: { retryCount: number },
): InboundMessageBundleStatus {
  switch (outcome) {
    case "success":
      return "decided";
    case "review_required":
      return "review_required";
    case "human_handled":
      return "cancelled";
    case "terminal_failure":
      return "failed";
    case "retryable_failure":
      return input.retryCount + 1 >= 3 ? "failed" : "ready";
    default:
      return "ready";
  }
}

export function defaultFailureCodeForBundleWorkerOutcome(
  outcome: Stage4B3BundleWorkerOutcome,
  failureCode?: string | null,
): string | null {
  if (failureCode) {
    return failureCode;
  }
  if (outcome === "human_handled") {
    return "human_handled";
  }
  return null;
}

export function isRetryableUnderstandingFailure(failureCode: string): boolean {
  return (
    failureCode === "bundle_not_processable" ||
    failureCode === "stale_bundle_revision" ||
    failureCode === "stale_conversation_revision" ||
    failureCode === "bundle_context_missing" ||
    failureCode === "media_asset_not_analysis_ready" ||
    failureCode === "visual_analysis_not_ready" ||
    failureCode === "voice_transcript_not_bridged" ||
    failureCode === "voice_transcript_pending"
  );
}
