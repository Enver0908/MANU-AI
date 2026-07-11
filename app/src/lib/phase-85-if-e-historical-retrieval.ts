import { AppDomainError } from "./app-errors";
import type { ManuAppState, MessageRecord, NotificationRecord } from "./types";
import { resolveLegacyRetrievalEligibility } from "./phase-85-if-b-provenance-model";

export const PHASE_85_IF_E_HISTORICAL_RETRIEVAL_VERSION = "p85-if-e-historical-retrieval-v1";

export type RetrievalCandidateMessage = {
  id: string;
  tenantId: string;
  conversationId: string;
  sender?: MessageRecord["sender"];
  body: string;
  origin: MessageRecord["origin"];
  status: MessageRecord["status"];
  actorType?: MessageRecord["actorType"];
  actorResolutionBasis?: MessageRecord["actorResolutionBasis"];
  providerSentAt?: string | null;
  createdAt: string;
  conversationSequence?: number | null;
  contentStatus?: MessageRecord["contentStatus"];
  retrievalEligibility?: MessageRecord["retrievalEligibility"];
};

export type StructuredRecordUpdateSignal = {
  kind: "structured_record_update_required";
  targetPanel: "menu" | "active_nutrition_plan" | "client_form" | "diet_plan";
  sourceMessageId: string;
  baselineRevision: number;
  reason: string;
};

export type AmbiguousCompetingSourceSignal = {
  kind: "ambiguous_competing_authoritative_source";
  sourceMessageIds: string[];
  reason: string;
};

export function mapMessageRecordToRetrievalCandidate(message: MessageRecord): RetrievalCandidateMessage {
  return {
    id: message.id,
    tenantId: message.tenantId,
    conversationId: message.conversationId,
    sender: message.sender,
    body: message.body,
    origin: message.origin,
    status: message.status,
    actorType: message.actorType,
    actorResolutionBasis: message.actorResolutionBasis,
    providerSentAt: message.providerSentAt,
    createdAt: message.createdAt,
    conversationSequence: message.conversationSequence,
    contentStatus: message.contentStatus,
    retrievalEligibility: message.retrievalEligibility ?? resolveLegacyRetrievalEligibility(message),
  };
}

export function mapConversationMessagesForRetrieval(
  messages: MessageRecord[],
  tenantId: string,
  conversationId: string,
): RetrievalCandidateMessage[] {
  return messages
    .filter((message) => message.tenantId === tenantId && message.conversationId === conversationId)
    .map(mapMessageRecordToRetrievalCandidate);
}

export function buildStructuredRecordUpdateNotification(
  tenantId: string,
  clientId: string,
  signal: StructuredRecordUpdateSignal,
  createdAt: string,
): NotificationRecord {
  const panelLabel = structuredPanelLabel(signal.targetPanel);
  return {
    id: crypto.randomUUID(),
    tenantId,
    type: "system",
    entityType: "client",
    entityId: clientId,
    title: "Structured record update required",
    body: `WhatsApp instruction ${signal.sourceMessageId} requires a ${panelLabel} update before related AI intents can proceed.`,
    read: false,
    acknowledgedAt: null,
    dedupeKey: `p85-if-e:structured:${clientId}:${signal.targetPanel}:${signal.sourceMessageId}`,
    sourceMessageId: signal.sourceMessageId,
    targetPanel: signal.targetPanel,
    baselineRevision: signal.baselineRevision,
    resolvedAt: null,
    resolvedByDietitianId: null,
    createdAt,
  };
}

export function buildAmbiguousSourceReviewNotification(
  tenantId: string,
  clientId: string,
  signal: AmbiguousCompetingSourceSignal,
  createdAt: string,
): NotificationRecord {
  return {
    id: crypto.randomUUID(),
    tenantId,
    type: "system",
    entityType: "client",
    entityId: clientId,
    title: "Competing dietitian instructions require review",
    body: `Ambiguous authoritative sources ${signal.sourceMessageIds.join(", ")} block affected intent resolution.`,
    read: false,
    acknowledgedAt: null,
    createdAt,
  };
}

export function extractP85IfEContextManifestSignals(contextManifest: Record<string, unknown> | null | undefined) {
  const structuredRecordUpdates = Array.isArray(contextManifest?.structuredRecordUpdates)
    ? (contextManifest?.structuredRecordUpdates as StructuredRecordUpdateSignal[])
    : [];
  const ambiguousCompetingSources = Array.isArray(contextManifest?.ambiguousCompetingSources)
    ? (contextManifest?.ambiguousCompetingSources as AmbiguousCompetingSourceSignal[])
    : [];
  return { structuredRecordUpdates, ambiguousCompetingSources };
}

export function appendP85IfEHistoricalRetrievalNotifications(input: {
  notifications: NotificationRecord[];
  tenantId: string;
  clientId: string;
  contextManifest?: Record<string, unknown> | null;
  createdAt: string;
}): NotificationRecord[] {
  const { structuredRecordUpdates, ambiguousCompetingSources } = extractP85IfEContextManifestSignals(
    input.contextManifest,
  );
  const next = [...input.notifications];

  for (const signal of structuredRecordUpdates) {
    const candidate = buildStructuredRecordUpdateNotification(
      input.tenantId,
      input.clientId,
      signal,
      input.createdAt,
    );
    const alreadyOpen = next.some(
      (notification) => notification.dedupeKey === candidate.dedupeKey && notification.resolvedAt == null,
    );
    if (!alreadyOpen) next.push(candidate);
  }
  for (const signal of ambiguousCompetingSources) {
    next.push(buildAmbiguousSourceReviewNotification(input.tenantId, input.clientId, signal, input.createdAt));
  }

  return next;
}

export function resolveStructuredRecordUpdateNotificationInState(
  state: ManuAppState,
  notificationId: string,
  dietitianId: string,
  now = new Date().toISOString(),
): ManuAppState {
  const notification = state.notifications.find((item) => item.id === notificationId);
  if (!notification) throw new AppDomainError(404, "notification_not_found");
  if (!notification.dedupeKey?.startsWith("p85-if-e:structured:") || notification.resolvedAt) {
    throw new AppDomainError(409, "structured_update_notification_not_resolvable");
  }
  const currentTargetRevision = resolveStructuredTargetRevision(
    state,
    notification.entityId,
    notification.targetPanel,
  );
  if (notification.baselineRevision == null || currentTargetRevision <= notification.baselineRevision) {
    throw new AppDomainError(409, "structured_update_revision_pending");
  }

  return {
    ...state,
    notifications: state.notifications.map((item) =>
      item.id === notificationId
        ? { ...item, acknowledgedAt: item.acknowledgedAt || now, resolvedAt: now, resolvedByDietitianId: dietitianId }
        : item,
    ),
  };
}

export function resolveStructuredTargetRevision(
  state: ManuAppState,
  clientId: string,
  targetPanel: string | null | undefined,
) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppDomainError(404, "client_not_found");

  if (targetPanel === "menu") {
    return maxRevision(state.clientMenuPlans.filter((plan) => plan.clientId === clientId).map((plan) => plan.revision));
  }
  if (targetPanel === "active_nutrition_plan") {
    return maxRevision(
      state.clientFoodRuleProfiles.filter((profile) => profile.clientId === clientId).map((profile) => profile.revision),
    );
  }
  if (targetPanel === "client_form") {
    return maxRevision(
      state.clientFormResponses
        .filter((response) => response.clientId === clientId)
        .map((response) => timestampRevision(response.updatedAt)),
    );
  }
  if (targetPanel === "diet_plan") return client.contextRevision;
  throw new AppDomainError(409, "structured_update_target_panel_invalid");
}

function maxRevision(revisions: number[]) {
  return revisions.length > 0 ? Math.max(...revisions) : 0;
}

function timestampRevision(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : 0;
}

function structuredPanelLabel(targetPanel: StructuredRecordUpdateSignal["targetPanel"]) {
  switch (targetPanel) {
    case "menu":
      return "menu plan";
    case "active_nutrition_plan":
      return "active nutrition plan";
    case "client_form":
      return "client form";
    case "diet_plan":
      return "diet plan";
    default:
      return "structured record";
  }
}
