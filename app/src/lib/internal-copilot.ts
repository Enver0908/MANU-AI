import { AppDomainError } from "./app-errors";
import type {
  AiDecisionRecord,
  ClientRecord,
  HandoffCaseRecord,
  InternalCopilotMessageRecord,
  InternalCopilotSourceRef,
  InternalCopilotToolCallRecord,
  ManuAppState,
  MessageRecord,
} from "./types";

export type InternalCopilotIntent =
  | "client_status"
  | "diet_plan"
  | "recent_messages"
  | "form_responses"
  | "handoffs"
  | "ai_decisions"
  | "unsupported";

type ToolRunResult = {
  toolCalls: InternalCopilotToolCallRecord[];
  answerBody: string;
  sourceRefs: InternalCopilotSourceRef[];
  safetyStatus: InternalCopilotMessageRecord["safetyStatus"];
};

type ResolvedClientResult =
  | { status: "ok"; client: ClientRecord; sourceRefs: InternalCopilotSourceRef[] }
  | { status: "ambiguous"; clients: ClientRecord[]; sourceRefs: InternalCopilotSourceRef[] }
  | { status: "not_found"; sourceRefs: InternalCopilotSourceRef[] };

const INTERNAL_COPILOT_MAX_BODY_CHARS = 1200;

export function classifyInternalCopilotIntent(question: string): InternalCopilotIntent {
  const normalized = normalizeSearch(question);

  if (!normalized) return "unsupported";
  if (hasAny(normalized, ["diyet plan", "diyet liste", "liste", "kahvalti", "ogle", "aksam"])) return "diet_plan";
  if (hasAny(normalized, ["son mesaj", "mesajlar", "ne sordu", "ne yazdi"])) return "recent_messages";
  if (hasAny(normalized, ["form", "cevap", "intake", "anket"])) return "form_responses";
  if (hasAny(normalized, ["handoff", "risk", "kirmizi", "sari", "acik vaka"])) return "handoffs";
  if (hasAny(normalized, ["ai karar", "karar gecmisi", "blocked", "send status", "model"])) return "ai_decisions";
  if (hasAny(normalized, ["son durum", "durumu", "ozet", "genel"])) return "client_status";

  return "unsupported";
}

export function runInternalCopilotInState(
  state: ManuAppState,
  question: string,
  createdAt = new Date().toISOString(),
): ManuAppState {
  const body = question.trim();
  if (!body) {
    throw new AppDomainError(400, "internal_copilot_body_required");
  }

  const boundedBody = body.slice(0, INTERNAL_COPILOT_MAX_BODY_CHARS);
  const userMessage: InternalCopilotMessageRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    role: "user",
    body: boundedBody,
    sourceRefs: [],
    toolCallIds: [],
    safetyStatus: "ok",
    createdAt,
  };
  const runResult = runInternalCopilotTools(state, boundedBody, createdAt);
  const assistantMessage: InternalCopilotMessageRecord = {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    role: "assistant",
    body: runResult.answerBody,
    sourceRefs: runResult.sourceRefs,
    toolCallIds: runResult.toolCalls.map((call) => call.id),
    safetyStatus: runResult.safetyStatus,
    createdAt,
  };

  return {
    ...state,
    internalCopilotMessages: [...state.internalCopilotMessages, userMessage, assistantMessage],
    internalCopilotToolCalls: [...state.internalCopilotToolCalls, ...runResult.toolCalls],
    auditEvents: [
      ...state.auditEvents,
      buildAudit(state, "internal_copilot_question_asked", "internal_copilot_message", userMessage.id, createdAt),
      ...runResult.toolCalls.map((call) =>
        buildAudit(state, "internal_copilot_tool_called", "internal_copilot_tool_call", call.id, createdAt),
      ),
      buildAudit(state, "internal_copilot_answer_created", "internal_copilot_message", assistantMessage.id, createdAt),
    ],
  };
}

export function runInternalCopilotTools(
  scopedState: ManuAppState,
  question: string,
  createdAt = new Date().toISOString(),
): ToolRunResult {
  const intent = classifyInternalCopilotIntent(question);

  if (intent === "unsupported") {
    return {
      toolCalls: [],
      answerBody:
        "Bu soru Phase 26 internal copilot kapsaminda desteklenmiyor. Musteri durumu, diyet plani, son mesajlar, form yanitlari, handoff veya AI karar gecmisi hakkinda sorabilirsiniz.",
      sourceRefs: [],
      safetyStatus: "unsupported",
    };
  }

  const query = extractClientQuery(question, scopedState.clients);
  const resolved = resolveVisibleClientByName(scopedState, query);
  const resolveCall = buildToolCall(scopedState, {
    toolName: "resolveVisibleClientByName",
    args: { query },
    status: resolved.status === "ok" ? "ok" : resolved.status,
    sourceRefs: resolved.sourceRefs,
    resultSummary: summarizeResolution(resolved),
    createdAt,
  });

  if (resolved.status === "ambiguous") {
    return {
      toolCalls: [resolveCall],
      answerBody: `Birden fazla gorunur musteri eslesti: ${resolved.clients.map((client) => client.fullName).join(", ")}. Hangi musteriyi kastettiginizi netlestirir misiniz?`,
      sourceRefs: resolved.sourceRefs,
      safetyStatus: "needs_clarification",
    };
  }

  if (resolved.status === "not_found") {
    return {
      toolCalls: [resolveCall],
      answerBody: "Bu isimle eslesen gorunur bir musteri MANU-AI kayitlarinda bulunamadi.",
      sourceRefs: [],
      safetyStatus: "not_found",
    };
  }

  const toolCalls = [resolveCall];
  if (intent === "client_status") {
    toolCalls.push(
      getClientSnapshot(scopedState, resolved.client.id, createdAt),
      getClientRecentMessages(scopedState, resolved.client.id, createdAt, 5),
      getClientFormResponses(scopedState, resolved.client.id, createdAt),
      getClientHandoffs(scopedState, resolved.client.id, createdAt),
    );
  } else if (intent === "diet_plan") {
    toolCalls.push(getClientDietPlan(scopedState, resolved.client.id, createdAt));
  } else if (intent === "recent_messages") {
    toolCalls.push(getClientRecentMessages(scopedState, resolved.client.id, createdAt, 20));
  } else if (intent === "form_responses") {
    toolCalls.push(getClientFormResponses(scopedState, resolved.client.id, createdAt));
  } else if (intent === "handoffs") {
    toolCalls.push(getClientHandoffs(scopedState, resolved.client.id, createdAt));
  } else if (intent === "ai_decisions") {
    toolCalls.push(getClientAiDecisionHistory(scopedState, resolved.client.id, createdAt));
  }

  return generateMockInternalCopilotAnswer({ intent, client: resolved.client, toolCalls });
}

export function generateMockInternalCopilotAnswer(input: {
  intent: InternalCopilotIntent;
  client: ClientRecord;
  toolCalls: InternalCopilotToolCallRecord[];
}): ToolRunResult {
  const sourceRefs = uniqueSourceRefs(input.toolCalls.flatMap((call) => call.sourceRefs));
  if (sourceRefs.length === 0) {
    return {
      toolCalls: input.toolCalls,
      answerBody: "Bu konuda MANU-AI kayitlarinda kaynaklanabilir veri bulamadim.",
      sourceRefs: [],
      safetyStatus: "no_sources",
    };
  }

  return {
    toolCalls: input.toolCalls,
    answerBody: answerForIntent(input.intent, input.client, input.toolCalls),
    sourceRefs,
    safetyStatus: "ok",
  };
}

export function resolveVisibleClientByName(state: ManuAppState, query: string): ResolvedClientResult {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return { status: "not_found", sourceRefs: [] };

  const visibleClients = state.clients.filter((client) => client.lifecycleStatus !== "removed_anonymized");
  const exact = visibleClients.filter((client) => normalizeSearch(client.fullName) === normalizedQuery);
  const partial = visibleClients.filter((client) => normalizeSearch(client.fullName).includes(normalizedQuery));
  const token = visibleClients.filter((client) =>
    normalizeSearch(client.fullName)
      .split(" ")
      .some((part) => part === normalizedQuery || part.startsWith(normalizedQuery)),
  );
  const matches = uniqueClients([...exact, ...partial, ...token]);
  const sourceRefs = matches.map(clientSourceRef);

  if (matches.length === 1) return { status: "ok", client: matches[0], sourceRefs };
  if (matches.length > 1) return { status: "ambiguous", clients: matches, sourceRefs };
  return { status: "not_found", sourceRefs: [] };
}

export function getClientSnapshot(state: ManuAppState, clientId: string, createdAt = new Date().toISOString()) {
  const client = findVisibleClient(state, clientId);
  const complete = client.mandatorySafetyComplete ? "complete" : "incomplete";
  return buildToolCall(state, {
    toolName: "getClientSnapshot",
    args: { clientId },
    status: "ok",
    sourceRefs: [clientSourceRef(client)],
    resultSummary: `${client.fullName}: AI ${client.aiStatus}/${client.aiMode}, permission ${client.channelPermission}, safety ${complete}, takeover ${client.humanTakeoverLocked ? "locked" : "open"}.`,
    createdAt,
  });
}

export function getClientDietPlan(state: ManuAppState, clientId: string, createdAt = new Date().toISOString()) {
  const client = findVisibleClient(state, clientId);
  const planParts = [
    `Summary: ${client.dietPlan.summary || "not available"}`,
    client.dietPlan.breakfast ? `Breakfast: ${client.dietPlan.breakfast}` : null,
    client.dietPlan.lunch ? `Lunch: ${client.dietPlan.lunch}` : null,
    client.dietPlan.dinner ? `Dinner: ${client.dietPlan.dinner}` : null,
  ].filter(Boolean);

  return buildToolCall(state, {
    toolName: "getClientDietPlan",
    args: { clientId },
    status: "ok",
    sourceRefs: [clientSourceRef(client)],
    resultSummary: planParts.join(" | "),
    createdAt,
  });
}

export function getClientRecentMessages(
  state: ManuAppState,
  clientId: string,
  createdAt = new Date().toISOString(),
  limit = 20,
) {
  const client = findVisibleClient(state, clientId);
  const conversationIds = conversationIdsForClient(state, clientId);
  const messages = state.messages
    .filter((message) => conversationIds.has(message.conversationId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, Math.min(limit, 20));

  return buildToolCall(state, {
    toolName: "getClientRecentMessages",
    args: { clientId, limit: Math.min(limit, 20) },
    status: "ok",
    sourceRefs: messages.map(messageSourceRef),
    resultSummary:
      messages.length > 0
        ? messages
            .map((message) => `${message.createdAt} ${message.origin}/${message.status || "stored"}: ${excerpt(message.body)}`)
            .join(" | ")
        : `${client.fullName} icin gorunur son mesaj kaydi yok.`,
    createdAt,
  });
}

export function getClientFormResponses(state: ManuAppState, clientId: string, createdAt = new Date().toISOString()) {
  const client = findVisibleClient(state, clientId);
  const responses = state.clientFormResponses.filter((response) => response.clientId === clientId);
  return buildToolCall(state, {
    toolName: "getClientFormResponses",
    args: { clientId },
    status: "ok",
    sourceRefs: responses.map((response) => ({
      entityType: "client_form_response",
      entityId: response.id,
      clientId,
      label: `Form response v${response.schemaVersion}`,
      createdAt: response.updatedAt,
    })),
    resultSummary:
      responses.length > 0
        ? responses
            .map((response) =>
              response.schemaSnapshot.fields
                .map((field) => `${field.label}: ${excerpt(formatAnswer(response.answers[field.id]))}`)
                .join("; "),
            )
            .join(" | ")
        : `${client.fullName} icin kayitli form yaniti yok.`,
    createdAt,
  });
}

export function getClientHandoffs(state: ManuAppState, clientId: string, createdAt = new Date().toISOString()) {
  findVisibleClient(state, clientId);
  const handoffs = state.handoffCases
    .filter((handoff) => handoff.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return buildToolCall(state, {
    toolName: "getClientHandoffs",
    args: { clientId },
    status: "ok",
    sourceRefs: handoffs.map(handoffSourceRef),
    resultSummary:
      handoffs.length > 0
        ? handoffs
            .map((handoff) => `${handoff.status}/${handoff.urgency}: ${handoff.reasons.join(", ") || handoff.risk}`)
            .join(" | ")
        : "Acik veya yakin handoff kaydi bulunmuyor.",
    createdAt,
  });
}

export function getClientAiDecisionHistory(state: ManuAppState, clientId: string, createdAt = new Date().toISOString()) {
  findVisibleClient(state, clientId);
  const decisions = state.aiDecisions
    .filter((decision) => decision.clientId === clientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return buildToolCall(state, {
    toolName: "getClientAiDecisionHistory",
    args: { clientId },
    status: "ok",
    sourceRefs: decisions.map(aiDecisionSourceRef),
    resultSummary:
      decisions.length > 0
        ? decisions
            .map(
              (decision) =>
                `${decision.action}/${decision.sendStatus}: risk ${decision.risk}, model ${decision.model || "none"}, block ${decision.blockedReason || "none"}`,
            )
            .join(" | ")
        : "AI karar gecmisi bulunmuyor.",
    createdAt,
  });
}

function answerForIntent(
  intent: InternalCopilotIntent,
  client: ClientRecord,
  toolCalls: InternalCopilotToolCallRecord[],
) {
  const summaries = toolCalls
    .filter((call) => call.toolName !== "resolveVisibleClientByName")
    .map((call) => call.resultSummary);

  if (intent === "client_status") {
    return `${client.fullName} icin kayit ozeti: ${summaries.join(" ")} Klinik yorum veya plan degisikligi gerekiyorsa diyetisyen kayitlari tekrar incelemeli.`;
  }

  if (intent === "diet_plan") {
    return `${client.fullName} icin MANU-AI kayitlarindaki diyet plani: ${summaries.join(" ")}`;
  }

  if (intent === "recent_messages") {
    return `${client.fullName} icin son gorunur mesaj kayitlari veri olarak sunuldu: ${summaries.join(" ")}`;
  }

  if (intent === "form_responses") {
    return `${client.fullName} icin kayitli form yanitlari: ${summaries.join(" ")}`;
  }

  if (intent === "handoffs") {
    return `${client.fullName} icin handoff/risk kayitlari: ${summaries.join(" ")} Bu ozet klinik karar yerine gecmez; gerekirse diyetisyen degerlendirmesi gerekir.`;
  }

  if (intent === "ai_decisions") {
    return `${client.fullName} icin son AI karar kayitlari: ${summaries.join(" ")}`;
  }

  return "Bu soru desteklenmiyor.";
}

function extractClientQuery(question: string, clients: ClientRecord[]) {
  const normalizedQuestion = normalizeSearch(question);
  const matched = clients
    .map((client) => ({
      client,
      normalizedName: normalizeSearch(client.fullName),
    }))
    .find(({ normalizedName }) =>
      normalizedName
        .split(" ")
        .some((part) => part.length >= 2 && normalizedQuestion.includes(part)),
    );

  if (matched) {
    const firstName = matched.normalizedName.split(" ")[0];
    return firstName || matched.client.fullName;
  }

  const candidate = question.match(/\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/u)?.[0] || "";
  return candidate;
}

function buildToolCall(
  state: ManuAppState,
  input: {
    toolName: InternalCopilotToolCallRecord["toolName"];
    args: Record<string, unknown>;
    status: InternalCopilotToolCallRecord["status"];
    sourceRefs: InternalCopilotSourceRef[];
    resultSummary: string;
    createdAt: string;
  },
): InternalCopilotToolCallRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    dietitianId: state.dietitian.id,
    toolName: input.toolName,
    arguments: input.args,
    status: input.status,
    sourceRefs: input.sourceRefs,
    resultSummary: input.resultSummary,
    createdAt: input.createdAt,
  };
}

function buildAudit(
  state: ManuAppState,
  eventType: string,
  entityType: string,
  entityId: string,
  createdAt: string,
) {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    eventType,
    entityType,
    entityId,
    metadata: { source: "internal_copilot", minimized: true },
    createdAt,
  };
}

function findVisibleClient(state: ManuAppState, clientId: string) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "internal_copilot_client_not_found");
  if (client.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(409, "client_removed_anonymized");
  }
  return client;
}

function conversationIdsForClient(state: ManuAppState, clientId: string) {
  return new Set(state.conversations.filter((conversation) => conversation.clientId === clientId).map((item) => item.id));
}

function summarizeResolution(resolved: ResolvedClientResult) {
  if (resolved.status === "ok") return `Resolved ${resolved.client.fullName}`;
  if (resolved.status === "ambiguous") return `Ambiguous: ${resolved.clients.map((client) => client.fullName).join(", ")}`;
  return "No visible matching client";
}

function normalizeSearch(value: string) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(normalizeSearch(needle)));
}

function uniqueClients(clients: ClientRecord[]) {
  return [...new Map(clients.map((client) => [client.id, client])).values()];
}

function uniqueSourceRefs(refs: InternalCopilotSourceRef[]) {
  return [...new Map(refs.map((ref) => [`${ref.entityType}:${ref.entityId}`, ref])).values()];
}

function clientSourceRef(client: ClientRecord): InternalCopilotSourceRef {
  return {
    entityType: "client",
    entityId: client.id,
    clientId: client.id,
    label: `Client: ${client.fullName}`,
    createdAt: client.createdAt,
  };
}

function messageSourceRef(message: MessageRecord): InternalCopilotSourceRef {
  return {
    entityType: "message",
    entityId: message.id,
    clientId: null,
    label: `Message: ${excerpt(message.body)}`,
    createdAt: message.createdAt,
  };
}

function handoffSourceRef(handoff: HandoffCaseRecord): InternalCopilotSourceRef {
  return {
    entityType: "handoff_case",
    entityId: handoff.id,
    clientId: handoff.clientId,
    label: `Handoff: ${handoff.status}/${handoff.urgency}`,
    createdAt: handoff.createdAt,
  };
}

function aiDecisionSourceRef(decision: AiDecisionRecord): InternalCopilotSourceRef {
  return {
    entityType: "ai_decision",
    entityId: decision.id,
    clientId: decision.clientId,
    label: `AI decision: ${decision.action}/${decision.sendStatus}`,
    createdAt: decision.createdAt,
  };
}

function excerpt(value: unknown, max = 180) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatAnswer(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
