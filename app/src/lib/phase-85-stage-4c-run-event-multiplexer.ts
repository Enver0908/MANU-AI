import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiChatRunEventDto } from "./phase-85-stage-4c-contracts";

export const STAGE_4C_RUN_EVENT_MULTIPLEXER_VERSION = "p85-stage-4c-run-event-multiplexer-v1";

export const RUN_EVENT_POLL_INITIAL_MS = 1_000;
export const RUN_EVENT_POLL_MAX_MS = 4_000;
export const RUN_EVENT_CATCH_UP_LIMIT = 200;

export type RunEventSubscriber = {
  id: string;
  afterSequence: number;
  onEvent: (event: AiChatRunEventDto) => void;
  signal?: AbortSignal;
};

export type RunEventMultiplexerDeps = {
  listRunEvents: (afterSequence: number) => Promise<AiChatRunEventDto[]>;
  catchUpRunEvents?: (afterSequence: number, limit: number) => Promise<AiChatRunEventDto[]>;
  subscribeRealtime?: (onInsert: (event: AiChatRunEventDto) => void) => {
    unsubscribe: () => void;
    onStatus?: (handler: (status: string) => void) => void;
  };
};

type RunChannelState = {
  key: string;
  tenantId: string;
  runId: string;
  subscribers: Map<string, RunEventSubscriber>;
  lastSequence: number;
  realtimeUnsubscribe: (() => void) | null;
  pollTimer: ReturnType<typeof setTimeout> | null;
  pollDelayMs: number;
  realtimeHealthy: boolean;
  disposed: boolean;
  deps: RunEventMultiplexerDeps;
};

const channels = new Map<string, RunChannelState>();

function channelKey(tenantId: string, runId: string) {
  return `${tenantId}:${runId}`;
}

function mapRunEventRow(row: Record<string, unknown>): AiChatRunEventDto {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id ?? row.tenantId),
    runId: String(row.run_id ?? row.runId),
    conversationId: String(row.conversation_id ?? row.conversationId),
    sequenceNumber: Number(row.sequence_number ?? row.sequenceNumber),
    eventType: String(row.event_type ?? row.eventType),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
  };
}

function isSubscriberActive(subscriber: RunEventSubscriber) {
  return !subscriber.signal?.aborted;
}

function fanOutEvent(state: RunChannelState, event: AiChatRunEventDto) {
  state.lastSequence = Math.max(state.lastSequence, event.sequenceNumber);
  for (const subscriber of state.subscribers.values()) {
    if (!isSubscriberActive(subscriber)) continue;
    if (event.sequenceNumber <= subscriber.afterSequence) continue;
    subscriber.afterSequence = event.sequenceNumber;
    subscriber.onEvent(event);
  }
}

function resolvePollAfterSequence(state: RunChannelState) {
  pruneInactiveSubscribers(state);
  const active = [...state.subscribers.values()].filter(isSubscriberActive);
  if (active.length === 0) return state.lastSequence;
  return Math.min(...active.map((subscriber) => subscriber.afterSequence));
}

async function pollOnce(state: RunChannelState) {
  if (state.disposed) return;
  try {
    const events = await state.deps.listRunEvents(resolvePollAfterSequence(state));
    for (const event of events) {
      fanOutEvent(state, event);
    }
    if (!state.realtimeHealthy) {
      state.pollDelayMs = Math.min(state.pollDelayMs * 2, RUN_EVENT_POLL_MAX_MS);
    } else {
      state.pollDelayMs = RUN_EVENT_POLL_INITIAL_MS;
    }
  } catch {
    state.pollDelayMs = Math.min(state.pollDelayMs * 2, RUN_EVENT_POLL_MAX_MS);
  }
  schedulePoll(state);
}

function schedulePoll(state: RunChannelState) {
  if (state.disposed) return;
  if (state.pollTimer) clearTimeout(state.pollTimer);
  state.pollTimer = setTimeout(() => {
    state.pollTimer = null;
    void pollOnce(state);
  }, state.pollDelayMs);
}

function stopPoll(state: RunChannelState) {
  if (state.pollTimer) {
    clearTimeout(state.pollTimer);
    state.pollTimer = null;
  }
}

function teardownChannel(state: RunChannelState) {
  if (state.disposed) return;
  state.disposed = true;
  stopPoll(state);
  if (state.realtimeUnsubscribe) {
    state.realtimeUnsubscribe();
    state.realtimeUnsubscribe = null;
  }
  channels.delete(state.key);
}

function pruneInactiveSubscribers(state: RunChannelState) {
  for (const [id, subscriber] of state.subscribers.entries()) {
    if (!isSubscriberActive(subscriber)) {
      state.subscribers.delete(id);
    }
  }
}

function ensureRealtime(state: RunChannelState) {
  if (state.disposed || state.realtimeUnsubscribe || !state.deps.subscribeRealtime) {
    schedulePoll(state);
    return;
  }
  const subscription = state.deps.subscribeRealtime((event) => {
    state.realtimeHealthy = true;
    state.pollDelayMs = RUN_EVENT_POLL_INITIAL_MS;
    fanOutEvent(state, event);
  });
  state.realtimeUnsubscribe = () => subscription.unsubscribe();
  subscription.onStatus?.((status) => {
    if (status === "SUBSCRIBED") {
      state.realtimeHealthy = true;
      state.pollDelayMs = RUN_EVENT_POLL_INITIAL_MS;
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      state.realtimeHealthy = false;
      schedulePoll(state);
    }
  });
  schedulePoll(state);
}

function getOrCreateChannel(tenantId: string, runId: string, deps: RunEventMultiplexerDeps) {
  const key = channelKey(tenantId, runId);
  const existing = channels.get(key);
  if (existing) return existing;
  const state: RunChannelState = {
    key,
    tenantId,
    runId,
    subscribers: new Map(),
    lastSequence: 0,
    realtimeUnsubscribe: null,
    pollTimer: null,
    pollDelayMs: RUN_EVENT_POLL_INITIAL_MS,
    realtimeHealthy: false,
    disposed: false,
    deps,
  };
  channels.set(key, state);
  ensureRealtime(state);
  return state;
}

export async function catchUpRunEventsForSubscriber(
  state: RunChannelState,
  subscriber: RunEventSubscriber,
) {
  const catchUp = state.deps.catchUpRunEvents ?? state.deps.listRunEvents;
  const events = await catchUp(subscriber.afterSequence, RUN_EVENT_CATCH_UP_LIMIT);
  for (const event of events) {
    if (event.sequenceNumber <= subscriber.afterSequence) continue;
    subscriber.afterSequence = event.sequenceNumber;
    subscriber.onEvent(event);
    state.lastSequence = Math.max(state.lastSequence, event.sequenceNumber);
  }
}

export function subscribeRunEventChannel(input: {
  tenantId: string;
  runId: string;
  subscriber: RunEventSubscriber;
  deps: RunEventMultiplexerDeps;
}) {
  const state = getOrCreateChannel(input.tenantId, input.runId, input.deps);
  state.subscribers.set(input.subscriber.id, input.subscriber);

  const abortHandler = () => {
    unsubscribe();
  };
  input.subscriber.signal?.addEventListener("abort", abortHandler, { once: true });

  function unsubscribe() {
    input.subscriber.signal?.removeEventListener("abort", abortHandler);
    state.subscribers.delete(input.subscriber.id);
    pruneInactiveSubscribers(state);
    if (state.subscribers.size === 0) {
      teardownChannel(state);
    }
  }

  return {
    async catchUp() {
      await catchUpRunEventsForSubscriber(state, input.subscriber);
    },
    unsubscribe,
    getSubscriberCount: () => state.subscribers.size,
    getLastSequence: () => state.lastSequence,
  };
}

export function createInMemoryRunEventMultiplexerDeps(
  listRunEvents: (afterSequence: number) => Promise<AiChatRunEventDto[]>,
): RunEventMultiplexerDeps {
  return {
    listRunEvents,
    catchUpRunEvents: listRunEvents,
  };
}

export function createSupabaseRunEventMultiplexerDeps(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    userId: string;
    dietitianId: string;
    role: string;
    runId: string;
  },
): RunEventMultiplexerDeps {
  return {
    async listRunEvents(afterSequence: number) {
      const { data, error } = await supabase.rpc("p85_stage_4c_list_run_events_v1", {
        p_tenant_id: input.tenantId,
        p_user_id: input.userId,
        p_dietitian_id: input.dietitianId,
        p_role: input.role,
        p_run_id: input.runId,
        p_after_sequence: afterSequence,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapRunEventRow);
    },
    async catchUpRunEvents(afterSequence: number, limit: number) {
      const { data, error } = await supabase.rpc("p85_stage_4c_catch_up_run_events_v1", {
        p_tenant_id: input.tenantId,
        p_user_id: input.userId,
        p_dietitian_id: input.dietitianId,
        p_role: input.role,
        p_run_id: input.runId,
        p_after_sequence: afterSequence,
        p_limit: limit,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapRunEventRow);
    },
    subscribeRealtime(onInsert) {
      const statusHandlers: Array<(status: string) => void> = [];
      const channel = supabase
        .channel(`p85-stage-4c-run:${input.tenantId}:${input.runId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "ai_chat_run_events",
            filter: `run_id=eq.${input.runId}`,
          },
          (payload) => {
            if (!payload.new || typeof payload.new !== "object") return;
            const row = payload.new as Record<string, unknown>;
            if (String(row.tenant_id) !== input.tenantId) return;
            onInsert(mapRunEventRow(row));
          },
        )
        .subscribe((status) => {
          for (const handler of statusHandlers) handler(status);
        });
      return {
        unsubscribe: () => {
          void supabase.removeChannel(channel);
        },
        onStatus(handler: (status: string) => void) {
          statusHandlers.push(handler);
        },
      };
    },
  };
}

export function resetRunEventMultiplexersForTests() {
  for (const state of channels.values()) {
    teardownChannel(state);
  }
  channels.clear();
}

export function getRunEventMultiplexerCountForTests() {
  return channels.size;
}

export function getRunEventSubscriberCountForTests(tenantId: string, runId: string) {
  return channels.get(channelKey(tenantId, runId))?.subscribers.size ?? 0;
}
