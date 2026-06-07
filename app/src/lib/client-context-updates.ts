import { AppDomainError } from "./app-errors";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import type {
  ClientContextUpdateImportance,
  ClientContextUpdateRecord,
  ClientContextUpdateSource,
  ManuAppState,
} from "./types";

export type CreateClientContextUpdateInput = {
  source: ClientContextUpdateSource;
  occurredAt?: string | null;
  title: string;
  summary: string;
  details?: string;
  importance: ClientContextUpdateImportance;
};

const MAX_CONTEXT_UPDATE_CHARS = 3000;

export function createClientContextUpdateInState(
  state: ManuAppState,
  clientId: string,
  input: CreateClientContextUpdateInput,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");

  const title = input.title.trim();
  const summary = input.summary.trim();
  const details = (input.details || "").trim();

  if (!title) throw new AppDomainError(400, "context_update_title_required");
  if (!summary) throw new AppDomainError(400, "context_update_summary_required");
  if (!isValidSource(input.source)) throw new AppDomainError(400, "context_update_source_invalid");
  if (!isValidImportance(input.importance)) throw new AppDomainError(400, "context_update_importance_invalid");
  if (title.length + summary.length + details.length > MAX_CONTEXT_UPDATE_CHARS) {
    throw new AppDomainError(400, "context_update_too_long");
  }

  const update: ClientContextUpdateRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: client.id,
    dietitianId: state.dietitian.id,
    source: input.source,
    occurredAt: normalizeOccurredAt(input.occurredAt, createdAt),
    title,
    summary,
    details,
    importance: input.importance,
    status: "active",
    supersedesUpdateId: null,
    createdAt,
  };

  const nextState: ManuAppState = {
    ...state,
    clientContextUpdates: [...state.clientContextUpdates, update],
    clients: state.clients.map((item) =>
      item.id === client.id ? { ...item, contextRevision: item.contextRevision + 1 } : item,
    ),
    messages: [
      ...state.messages,
      ...buildSystemMessagesForClient(state, client.id, `Dietitian context update added: ${update.title}`, createdAt),
    ],
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "client_context_update_created",
        entityType: "client_context_update",
        entityId: update.id,
        metadata: {
          source: "local_app",
          clientId: client.id,
          updateSource: update.source,
          importance: update.importance,
          minimized: true,
        },
        createdAt,
      },
    ],
  };

  return invalidatePendingDraftsForContextUpdate(nextState, client.id, createdAt);
}

export function buildClientContextUpdateSummary(state: ManuAppState, clientId: string) {
  return state.clientContextUpdates
    .filter((update) => update.clientId === clientId && update.status === "active")
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    .slice(0, 5);
}

export function redactClientContextUpdatesForAnonymization(state: ManuAppState, clientId: string): ManuAppState {
  return {
    ...state,
    clientContextUpdates: state.clientContextUpdates.map((update) =>
      update.clientId === clientId
        ? {
            ...update,
            title: PHASE_74_REDACTION_MARKER,
            summary: PHASE_74_REDACTION_MARKER,
            details: "",
            status: "superseded" as const,
          }
        : update,
    ),
  };
}

function normalizeOccurredAt(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function isValidSource(value: string): value is ClientContextUpdateSource {
  return ["phone", "zoom", "in_person", "other"].includes(value);
}

function isValidImportance(value: string): value is ClientContextUpdateImportance {
  return ["routine", "important", "critical"].includes(value);
}

function buildSystemMessagesForClient(state: ManuAppState, clientId: string, body: string, createdAt: string) {
  const conversation = state.conversations.find((item) => item.clientId === clientId);
  if (!conversation) return [];

  return [
    {
      id: crypto.randomUUID(),
      tenantId: state.tenant.id,
      conversationId: conversation.id,
      sender: "system" as const,
      origin: "system_event" as const,
      body,
      status: "stored" as const,
      createdAt,
    },
  ];
}

function invalidatePendingDraftsForContextUpdate(
  state: ManuAppState,
  clientId: string,
  createdAt: string,
): ManuAppState {
  const conversationIds = new Set(
    state.conversations.filter((conversation) => conversation.clientId === clientId).map((conversation) => conversation.id),
  );
  const draftMessages = state.messages.filter(
    (message) =>
      message.origin === "ai_generated" &&
      message.status === "draft" &&
      conversationIds.has(message.conversationId),
  );

  if (draftMessages.length === 0) return state;

  const decisionIds = new Set(draftMessages.map((message) => message.generatedByAiDecisionId).filter(Boolean));
  return {
    ...state,
    messages: state.messages.map((message) =>
      draftMessages.some((draft) => draft.id === message.id) ? { ...message, status: "blocked" as const } : message,
    ),
    aiDecisions: state.aiDecisions.map((decision) =>
      decisionIds.has(decision.id)
        ? { ...decision, sendStatus: "draft_invalidated" as const, blockedReason: "client_context_update_added" }
        : decision,
    ),
    auditEvents: [
      ...state.auditEvents,
      {
        id: crypto.randomUUID(),
        tenantId: state.tenant.id,
        eventType: "draft_context_invalidated",
        entityType: "client",
        entityId: clientId,
        metadata: { source: "client_context_update", minimized: true },
        createdAt,
      },
    ],
  };
}
