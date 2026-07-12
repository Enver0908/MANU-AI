export const STAGE_4B_INBOX_POLL_INTERVAL_MS = 30_000;
export const STAGE_4B_INBOX_BACKOFF_STEPS_MS = [60_000, 120_000] as const;

export function resolveStage4BInboxPollDelayMs(consecutiveErrors: number) {
  if (consecutiveErrors <= 0) return STAGE_4B_INBOX_POLL_INTERVAL_MS;
  const index = Math.min(consecutiveErrors - 1, STAGE_4B_INBOX_BACKOFF_STEPS_MS.length - 1);
  return STAGE_4B_INBOX_BACKOFF_STEPS_MS[index];
}

export function shouldPauseStage4BInboxPolling(documentVisible: boolean) {
  return !documentVisible;
}

export async function fetchWithInflightDedupe<T>(
  inflight: Map<string, Promise<T>>,
  key: string,
  run: () => Promise<T>,
) {
  const existing = inflight.get(key);
  if (existing) return existing;
  const promise = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}
