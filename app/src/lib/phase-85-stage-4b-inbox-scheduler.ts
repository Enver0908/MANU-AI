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

export type Stage4BInboxRequestToken = {
  ownerKey: string;
  sequence: number;
  mutationVersion: number;
};

export function createStage4BInboxRequestGate(initialOwnerKey: string) {
  let ownerKey = initialOwnerKey;
  let sequence = 0;
  let mutationVersion = 0;

  return {
    setOwner(nextOwnerKey: string) {
      if (nextOwnerKey === ownerKey) return false;
      ownerKey = nextOwnerKey;
      sequence += 1;
      return true;
    },
    begin(nextOwnerKey: string): Stage4BInboxRequestToken {
      if (nextOwnerKey !== ownerKey) {
        ownerKey = nextOwnerKey;
        sequence += 1;
      }
      sequence += 1;
      return { ownerKey, sequence, mutationVersion };
    },
    invalidateForMutation() {
      mutationVersion += 1;
      sequence += 1;
    },
    canApply(token: Stage4BInboxRequestToken) {
      return (
        token.ownerKey === ownerKey &&
        token.sequence === sequence &&
        token.mutationVersion === mutationVersion
      );
    },
  };
}

export function mergeStage4BInboxPageItems<T extends { id: string }>(current: readonly T[], incoming: readonly T[]) {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => incomingById.get(item.id) ?? item);
  const existingIds = new Set(current.map((item) => item.id));
  for (const item of incoming) {
    if (!existingIds.has(item.id)) merged.push(item);
  }
  return merged;
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
