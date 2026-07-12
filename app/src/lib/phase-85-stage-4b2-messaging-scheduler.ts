export const STAGE_4B2_MESSAGING_LIST_POLL_INTERVAL_MS = 30_000;
export const STAGE_4B2_MESSAGING_DETAIL_POLL_INTERVAL_MS = 15_000;
export const STAGE_4B2_MESSAGING_BACKOFF_STEPS_MS = [60_000, 120_000] as const;

export function resolveStage4B2MessagingPollDelayMs(consecutiveErrors: number, detailOpen: boolean) {
  if (consecutiveErrors <= 0) {
    return detailOpen
      ? STAGE_4B2_MESSAGING_DETAIL_POLL_INTERVAL_MS
      : STAGE_4B2_MESSAGING_LIST_POLL_INTERVAL_MS;
  }
  const index = Math.min(consecutiveErrors - 1, STAGE_4B2_MESSAGING_BACKOFF_STEPS_MS.length - 1);
  return STAGE_4B2_MESSAGING_BACKOFF_STEPS_MS[index];
}

export function shouldPauseStage4B2MessagingPolling(documentVisible: boolean) {
  return !documentVisible;
}
