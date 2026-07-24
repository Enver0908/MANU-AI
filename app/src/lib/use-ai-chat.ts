"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppRequestError } from "./app-errors";
import type {
  AiChatApiErrorBody,
  AiChatClientSearchItem,
  AiChatConversationDetail,
  AiChatConversationListItem,
  AiChatConversationListResponse,
  AiChatConversationSummary,
  AiChatListScopeFilter,
  AiChatScopeType,
} from "./phase-85-stage-4c-contracts";

// Independent from `useManuState`/internal-copilot state per Stage 4C Faz 4
// architecture decisions: AI Chat owns its own bounded request/response cycle.

async function requestAiChatJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let code = `ai_chat_request_failed_${response.status}`;
    let field: string | undefined;
    let revision: number | undefined;
    try {
      const body = (await response.json()) as AiChatApiErrorBody;
      code = body.error?.code || code;
      field = body.error?.field;
      revision = body.error?.revision;
    } catch {
      // ignore parse errors — fall back to the generic status code above
    }
    throw new AppRequestError(response.status, code, field, revision);
  }

  return response.json() as Promise<T>;
}

export function generateAiChatRequestId() {
  return crypto.randomUUID();
}

export type AiChatDateGroupKey = "today" | "last7Days" | "last30Days" | "older";

export const AI_CHAT_DATE_GROUP_ORDER: readonly AiChatDateGroupKey[] = [
  "today",
  "last7Days",
  "last30Days",
  "older",
];

/** Client-side date bucketing; the bounded API never groups by date. */
export function resolveAiChatDateGroup(isoDate: string, now: Date = new Date()): AiChatDateGroupKey {
  const value = new Date(isoDate).getTime();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  if (Number.isNaN(value)) return "older";
  if (value >= startOfToday) return "today";
  if (value >= startOfToday - 7 * dayMs) return "last7Days";
  if (value >= startOfToday - 30 * dayMs) return "last30Days";
  return "older";
}

export type AiChatHistoryGroup = {
  group: AiChatDateGroupKey;
  items: AiChatConversationListItem[];
};

export function groupAiChatHistoryByDate(
  items: readonly AiChatConversationListItem[],
  now: Date = new Date(),
): AiChatHistoryGroup[] {
  const buckets = new Map<AiChatDateGroupKey, AiChatConversationListItem[]>();
  for (const item of items) {
    const sortAt = item.lastMessageAt ?? item.createdAt;
    const group = resolveAiChatDateGroup(sortAt, now);
    if (!buckets.has(group)) buckets.set(group, []);
    buckets.get(group)!.push(item);
  }
  return AI_CHAT_DATE_GROUP_ORDER.filter((group) => buckets.has(group)).map((group) => ({
    group,
    items: buckets.get(group)!,
  }));
}

function buildAiChatHistoryUrl(scope: AiChatListScopeFilter, query: string, cursor?: string | null) {
  const params = new URLSearchParams();
  if (scope !== "all") params.set("scope", scope);
  if (query) params.set("query", query);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return search ? `/api/ai-chat/conversations?${search}` : "/api/ai-chat/conversations";
}

export type AiChatHistoryFilters = { scope: AiChatListScopeFilter; query: string };

export function useAiChatHistory({ scope, query }: AiChatHistoryFilters) {
  const [items, setItems] = useState<AiChatConversationListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await requestAiChatJson<AiChatConversationListResponse>(
        buildAiChatHistoryUrl(scope, query, null),
      );
      if (seq !== requestSeq.current) return;
      setItems(response.items);
      setNextCursor(response.nextCursor);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof AppRequestError ? err.code : "ai_chat_history_error");
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [query, scope]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const response = await requestAiChatJson<AiChatConversationListResponse>(
        buildAiChatHistoryUrl(scope, query, nextCursor),
      );
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setError(null);
    } catch (err) {
      setError(err instanceof AppRequestError ? err.code : "ai_chat_history_error");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, nextCursor, query, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return { items, nextCursor, isLoading, isLoadingMore, error, refresh, loadMore };
}

export function useAiChatConversation(chatId: string | null) {
  const [detail, setDetail] = useState<AiChatConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!chatId) {
      setDetail(null);
      setNotFound(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const response = await requestAiChatJson<AiChatConversationDetail>(
        `/api/ai-chat/conversations/${encodeURIComponent(chatId)}`,
      );
      setDetail(response);
    } catch (err) {
      if (err instanceof AppRequestError && err.status === 404) {
        setNotFound(true);
        setDetail(null);
      } else {
        setError(err instanceof AppRequestError ? err.code : "ai_chat_history_error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const rename = useCallback(
    async (input: { requestId: string; expectedRevision: number; title: string }) => {
      if (!chatId) throw new Error("no_active_chat");
      const summary = await requestAiChatJson<AiChatConversationSummary>(
        `/api/ai-chat/conversations/${encodeURIComponent(chatId)}`,
        { method: "PATCH", body: JSON.stringify(input) },
      );
      setDetail((current) => (current ? { ...current, ...summary } : current));
      return summary;
    },
    [chatId],
  );

  return { detail, isLoading, error, notFound, refresh, rename };
}

export function useAiChatClientSearch(query: string, debounceMs = 250) {
  const [results, setResults] = useState<AiChatClientSearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestSeq.current += 1;
      const resetTimer = window.setTimeout(() => {
        setResults([]);
        setError(null);
        setIsLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    const seq = ++requestSeq.current;
    const timer = window.setTimeout(() => {
      setIsLoading(true);
      const params = new URLSearchParams({ query: trimmed });
      requestAiChatJson<AiChatClientSearchItem[]>(`/api/ai-chat/clients?${params.toString()}`)
        .then((response) => {
          if (seq !== requestSeq.current) return;
          setResults(response);
          setError(null);
        })
        .catch((err: unknown) => {
          if (seq !== requestSeq.current) return;
          setError(err instanceof AppRequestError ? err.code : "aiChatActionFailed");
        })
        .finally(() => {
          if (seq === requestSeq.current) setIsLoading(false);
        });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, query]);

  return { results, isLoading, error };
}

export async function createAiChatConversation(input: {
  requestId: string;
  scopeType: AiChatScopeType;
  clientId?: string | null;
  title: string;
}) {
  return requestAiChatJson<AiChatConversationSummary>("/api/ai-chat/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type AiChatStreamingState = {
  runId: string | null;
  status: string | null;
  streamingText: string;
  completionState: "complete" | "incomplete" | null;
  lastSequence: number;
  isStreaming: boolean;
  error: string | null;
};

export const INITIAL_AI_CHAT_STREAMING_STATE: AiChatStreamingState = {
  runId: null,
  status: null,
  streamingText: "",
  completionState: null,
  lastSequence: 0,
  isStreaming: false,
  error: null,
};

export function reduceAiChatRunEvent(
  state: AiChatStreamingState,
  event: { sequenceNumber: number; eventType: string; payload: Record<string, unknown> },
): AiChatStreamingState {
  if (event.sequenceNumber <= state.lastSequence) {
    return state;
  }

  const next: AiChatStreamingState = {
    ...state,
    lastSequence: event.sequenceNumber,
  };

  if (event.eventType === "run.status" && typeof event.payload.status === "string") {
    next.status = event.payload.status;
    next.isStreaming = !["completed", "stopped", "failed", "superseded"].includes(event.payload.status);
  }

  if (event.eventType === "response.delta" && typeof event.payload.text === "string") {
    next.streamingText += event.payload.text;
    next.isStreaming = true;
  }

  if (event.eventType === "response.completed") {
    next.completionState = "complete";
    next.isStreaming = false;
  }

  if (event.eventType === "response.stopped") {
    next.completionState =
      event.payload.completionState === "complete" ? "complete" : "incomplete";
    next.isStreaming = false;
  }

  if (event.eventType === "run.failed") {
    next.isStreaming = false;
    next.error = typeof event.payload.errorCode === "string" ? event.payload.errorCode : "ai_chat_run_failed";
  }

  return next;
}

async function consumeAiChatRunSse(runId: string, afterSequence: number, onEvent: (event: {
  sequenceNumber: number;
  eventType: string;
  payload: Record<string, unknown>;
}) => void) {
  const params = new URLSearchParams();
  if (afterSequence > 0) params.set("after", String(afterSequence));
  const response = await fetch(
    `/api/ai-chat/runs/${encodeURIComponent(runId)}/events?${params.toString()}`,
    { headers: { accept: "text/event-stream" } },
  );
  if (!response.ok || !response.body) {
    throw new AppRequestError(response.status, "ai_chat_stream_failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      if (lines.every((line) => line.startsWith(":") || line.trim() === "")) {
        continue;
      }
      let eventType = "message";
      let sequenceNumber = 0;
      let data = "{}";
      for (const line of lines) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        if (line.startsWith("id:")) sequenceNumber = Number(line.slice(3).trim());
        if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      try {
        const payload = JSON.parse(data) as Record<string, unknown>;
        onEvent({
          sequenceNumber: Number(payload.sequenceNumber ?? sequenceNumber),
          eventType: String(payload.eventType ?? eventType),
          payload,
        });
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

export async function subscribeToAiChatRun(input: {
  runId: string;
  afterSequence?: number;
  onEvent: (event: {
    sequenceNumber: number;
    eventType: string;
    payload: Record<string, unknown>;
  }) => void;
  maxReconnects?: number;
}) {
  let sequence = input.afterSequence ?? 0;
  const maxReconnects = input.maxReconnects ?? 2;

  for (let attempt = 0; attempt <= maxReconnects; attempt += 1) {
    try {
      await consumeAiChatRunSse(input.runId, sequence, (event) => {
        sequence = Math.max(sequence, event.sequenceNumber);
        input.onEvent(event);
      });
      return;
    } catch (error) {
      if (attempt === maxReconnects) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export function useAiChatRunStream(_chatId: string | null, onTerminal?: () => void) {
  const [state, setState] = useState<AiChatStreamingState>(INITIAL_AI_CHAT_STREAMING_STATE);

  const subscribe = useCallback(
    async (runId: string, afterSequence = 0) => {
      setState({
        runId,
        status: "queued",
        streamingText: "",
        completionState: null,
        lastSequence: afterSequence,
        isStreaming: true,
        error: null,
      });

      try {
        await subscribeToAiChatRun({
          runId,
          afterSequence,
          onEvent: (event) => {
            setState((current) => reduceAiChatRunEvent(current, event));
          },
        });
        onTerminal?.();
      } catch (error) {
        const code = error instanceof AppRequestError ? error.code : "ai_chat_stream_failed";
        setState((current) => ({ ...current, isStreaming: false, error: code }));
      }
    },
    [onTerminal],
  );

  const reset = useCallback(() => {
    setState(INITIAL_AI_CHAT_STREAMING_STATE);
  }, []);

  return { state, subscribe, reset };
}

export async function sendAiChatMessage(input: {
  chatId: string;
  requestId: string;
  expectedRevision: number;
  body: string;
  attachmentIds?: string[];
}) {
  const response = await fetch(`/api/ai-chat/conversations/${encodeURIComponent(input.chatId)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestId: input.requestId,
      expectedRevision: input.expectedRevision,
      body: input.body,
      attachmentIds: input.attachmentIds ?? [],
    }),
  });
  if (!response.ok) {
    let code = `ai_chat_request_failed_${response.status}`;
    try {
      const body = (await response.json()) as AiChatApiErrorBody;
      code = body.error?.code || code;
    } catch {
      // ignore
    }
    throw new AppRequestError(response.status, code);
  }
  return response.json() as Promise<{
    runId: string;
    messageId: string;
    messageVersionId: string;
    conversationRevision: number;
  }>;
}

export async function editAiChatMessage(input: {
  messageId: string;
  requestId: string;
  expectedRevision: number;
  body: string;
}) {
  const response = await fetch(`/api/ai-chat/messages/${encodeURIComponent(input.messageId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestId: input.requestId,
      expectedRevision: input.expectedRevision,
      body: input.body,
    }),
  });
  if (!response.ok) {
    throw new AppRequestError(response.status, "ai_chat_edit_failed");
  }
  return response.json() as Promise<{ runId: string; conversationRevision: number }>;
}

export async function regenerateAiChatMessage(input: {
  messageId: string;
  requestId: string;
  expectedRevision: number;
}) {
  const response = await fetch(
    `/api/ai-chat/messages/${encodeURIComponent(input.messageId)}/regenerate`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new AppRequestError(response.status, "ai_chat_regenerate_failed");
  }
  return response.json() as Promise<{ runId: string; conversationRevision: number }>;
}

export async function stopAiChatRun(input: { runId: string; requestId: string }) {
  return requestAiChatJson<{ runId: string; status: string }>(
    `/api/ai-chat/runs/${encodeURIComponent(input.runId)}/stop`,
    {
      method: "POST",
      body: JSON.stringify({ requestId: input.requestId }),
    },
  );
}

export async function copyAiChatText(text: string) {
  if (!text.trim()) return false;
  if (!navigator.clipboard?.writeText) return false;
  await navigator.clipboard.writeText(text);
  return true;
}

export type AiChatRunRiskView = {
  runId: string;
  riskLevel: "green" | "yellow" | "red";
  reasons: string[];
  confidenceClass: string;
  recommendedHumanAction: string;
  hypotheticalRed: boolean;
  safeDraft: { body: string; riskLevel: string | null; sourceRefIds: string[] } | null;
  handoffConfirmationToken: string | null;
  canTransferDraft: boolean;
  canCreateHandoff: boolean;
  destinations: Array<{ conversationId: string; clientId: string; channel: string; revision: number }>;
  clientContextRevision: number | null;
};

export async function fetchAiChatRunRisk(runId: string) {
  return requestAiChatJson<AiChatRunRiskView>(`/api/ai-chat/runs/${encodeURIComponent(runId)}/risk`);
}

export async function transferAiChatRunDraft(input: {
  runId: string;
  requestId: string;
  destinationConversationId: string;
  destinationRevision: number;
  clientContextRevision: number;
}) {
  return requestAiChatJson<{ transfer: { id: string; transferMode: string } }>(
    `/api/ai-chat/runs/${encodeURIComponent(input.runId)}/transfer-draft`,
    {
      method: "POST",
      body: JSON.stringify({
        requestId: input.requestId,
        destinationConversationId: input.destinationConversationId,
        destinationRevision: input.destinationRevision,
        clientContextRevision: input.clientContextRevision,
      }),
    },
  );
}

export async function createAiChatRunHandoff(input: {
  runId: string;
  requestId: string;
  confirmationToken: string;
  expectedClientContextRevision: number;
}) {
  return requestAiChatJson<{ handoffId: string }>(
    `/api/ai-chat/runs/${encodeURIComponent(input.runId)}/create-handoff`,
    {
      method: "POST",
      body: JSON.stringify({
        requestId: input.requestId,
        confirmationToken: input.confirmationToken,
        expectedClientContextRevision: input.expectedClientContextRevision,
      }),
    },
  );
}

export async function deleteAiChatConversation(input: {
  chatId: string;
  requestId: string;
  expectedRevision: number;
}) {
  return requestAiChatJson<{ chatId: string; deletionJobId: string; status: "deleting"; conversationRevision: number }>(
    `/api/ai-chat/conversations/${encodeURIComponent(input.chatId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({
        requestId: input.requestId,
        expectedRevision: input.expectedRevision,
      }),
    },
  );
}

export async function deleteAiChatMessage(input: {
  messageId: string;
  requestId: string;
  expectedRevision: number;
}) {
  return requestAiChatJson<{
    messageId: string;
    deletionJobId: string;
    conversationId: string;
    conversationRevision: number;
  }>(`/api/ai-chat/messages/${encodeURIComponent(input.messageId)}`, {
    method: "DELETE",
    body: JSON.stringify({
      requestId: input.requestId,
      expectedRevision: input.expectedRevision,
    }),
  });
}
