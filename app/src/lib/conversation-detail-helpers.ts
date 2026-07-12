import type { DashboardMessageKey } from "./i18n";
import {
  CONVERSATION_UNAVAILABLE_PREVIEW,
  type ConversationMessageDto,
  type ConversationPermissions,
} from "./phase-85-stage-4b2-contracts";
import type { ClientRecord, MessageContentStatus, MessageOrigin, SenderType } from "./types";

export type ConversationTimelineItem =
  | { type: "date"; key: string; label: string }
  | { type: "message"; key: string; message: ConversationMessageDto };

export type ConversationMessageProvenancePresentation = {
  i18nKey: DashboardMessageKey;
  tone: "stone" | "emerald" | "amber";
};

export type ConversationDetailMutationVisibility = {
  showComposer: boolean;
  showDraftControls: boolean;
  showAiControls: boolean;
  showYellowDraftReview: boolean;
};

export function mergeConversationDetailMessages(
  current: ConversationMessageDto[],
  incoming: ConversationMessageDto[],
  mode: "replace" | "older" | "newer",
): ConversationMessageDto[] {
  if (mode === "replace") return incoming;
  const combined = mode === "older" ? [...incoming, ...current] : [...current, ...incoming];
  const seen = new Set<string>();
  const merged: ConversationMessageDto[] = [];
  for (const message of combined) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    merged.push(message);
  }
  return merged.sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

export function isConversationContentUnavailable(status: MessageContentStatus) {
  return status === "content_unavailable" || status === "redacted" || status === "revoked";
}

export function resolveConversationMessageBody(message: ConversationMessageDto) {
  if (isConversationContentUnavailable(message.contentStatus)) {
    return CONVERSATION_UNAVAILABLE_PREVIEW;
  }
  return message.body?.trim() ? message.body : CONVERSATION_UNAVAILABLE_PREVIEW;
}

export function resolveConversationMessageProvenance(
  message: Pick<ConversationMessageDto, "origin" | "sender">,
): ConversationMessageProvenancePresentation {
  if (message.origin === "client_inbound" || message.sender === "client") {
    return { i18nKey: "provenanceClient", tone: "stone" };
  }
  if (message.origin === "ai_generated" || message.sender === "assistant") {
    return { i18nKey: "provenanceAi", tone: "emerald" };
  }
  if (message.origin === "dietitian_manual") {
    return { i18nKey: "provenanceDietitianManual", tone: "amber" };
  }
  if (message.origin === "system_event") {
    return { i18nKey: "provenanceSystem", tone: "stone" };
  }
  if (message.origin === "imported_unknown") {
    return { i18nKey: "provenanceImportedUnknown", tone: "stone" };
  }
  return { i18nKey: "provenanceSystem", tone: "stone" };
}

export function formatConversationDateSeparator(value: string, locale = "tr-TR", timeZone = "Europe/Istanbul") {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone,
  }).format(new Date(parsed));
}

export function formatConversationMessageTime(value: string, locale = "tr-TR", timeZone = "Europe/Istanbul") {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(parsed));
}

function resolveDayKey(value: string, timeZone = "Europe/Istanbul") {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(parsed));
}

export function buildConversationTimelineItems(
  messages: ConversationMessageDto[],
  locale = "tr-TR",
): ConversationTimelineItem[] {
  const items: ConversationTimelineItem[] = [];
  let previousDayKey: string | null = null;
  for (const message of messages) {
    const dayKey = resolveDayKey(message.createdAt);
    if (dayKey !== previousDayKey) {
      items.push({
        type: "date",
        key: `date-${dayKey}`,
        label: formatConversationDateSeparator(message.createdAt, locale),
      });
      previousDayKey = dayKey;
    }
    items.push({ type: "message", key: message.id, message });
  }
  return items;
}

export function isYellowDraftReviewMessage(message: ConversationMessageDto, client: ClientRecord) {
  return message.isDraft && client.yellowRiskHold.status === "active";
}

export function isGreenDraftMessage(message: ConversationMessageDto, client: ClientRecord) {
  return message.isDraft && client.yellowRiskHold.status !== "active" && client.redRiskLock.status !== "locked";
}

export function resolveActiveYellowDraft(messages: ConversationMessageDto[], client: ClientRecord) {
  return [...messages].reverse().find((message) => isYellowDraftReviewMessage(message, client)) ?? null;
}

export function resolveConversationDetailMutationVisibility(
  permissions: ConversationPermissions | null | undefined,
  client: ClientRecord,
  options?: { canManageAiControls?: boolean },
): ConversationDetailMutationVisibility {
  const canManageAiControls = options?.canManageAiControls ?? true;
  const readOnly = permissions?.isReadOnly ?? true;
  return {
    showComposer: Boolean(permissions?.canSendManualReply) && !readOnly,
    showDraftControls: Boolean(permissions?.canReviewDraft) && !readOnly,
    showAiControls:
      Boolean(permissions?.canActivateAi || permissions?.canConfigureAi) && canManageAiControls && !readOnly,
    showYellowDraftReview:
      Boolean(permissions?.canReviewDraft) &&
      !readOnly &&
      client.yellowRiskHold.status === "active",
  };
}

export function resolveConversationBubbleAlignment(sender: SenderType) {
  return sender === "client" ? "start" : "end";
}

export function resolveConversationOriginLabel(origin: MessageOrigin) {
  return origin;
}
