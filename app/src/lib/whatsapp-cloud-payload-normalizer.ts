import type { NormalizedInboundChannelEvent } from "./channel-adapters";
import type { SimulationRequest } from "./types";

const SUPPORTED_TEXT_TYPE = "text";
const UNSUPPORTED_MEDIA_TYPES = new Set([
  "image",
  "audio",
  "video",
  "document",
  "sticker",
  "location",
  "contacts",
  "interactive",
  "button",
  "reaction",
]);

export type WhatsAppCloudNormalizationCode =
  | "malformed_payload"
  | "missing_provider_event_id"
  | "empty_body"
  | "unsupported_media";

export type WhatsAppCloudNormalizationFailure = {
  ok: false;
  code: WhatsAppCloudNormalizationCode;
  reason: string;
};

export type WhatsAppCloudNormalizationSuccess = {
  ok: true;
  event: NormalizedInboundChannelEvent;
  simulationRequest: Pick<
    SimulationRequest,
    | "body"
    | "idempotencyKey"
    | "channel"
    | "sourceConversationType"
    | "sourceConversationId"
    | "sourceMessageId"
    | "senderChannelUserId"
    | "now"
  >;
};

export type WhatsAppCloudNormalizationResult = WhatsAppCloudNormalizationFailure | WhatsAppCloudNormalizationSuccess;

type WhatsAppCloudMessage = {
  id?: unknown;
  from?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
  context?: { group_id?: unknown };
};

export function normalizeWhatsAppCloudPayload(payload: unknown): WhatsAppCloudNormalizationResult {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") {
    return fail("malformed_payload", "payload must be a whatsapp_business_account webhook object");
  }

  const message = extractFirstMessage(payload);
  if (!message) {
    return fail("malformed_payload", "payload must contain exactly one inbound message");
  }

  const providerEventId = readTrimmedString(message.id);
  if (!providerEventId) {
    return fail("missing_provider_event_id", "message id is required");
  }

  const channelUserId = readTrimmedString(message.from);
  if (!channelUserId) {
    return fail("malformed_payload", "message sender id is required");
  }

  const messageType = readTrimmedString(message.type) || "unknown";
  const groupId = readTrimmedString(message.context?.group_id);
  const sourceConversationType = groupId ? ("group" as const) : ("direct" as const);
  const receivedAt = toIsoTimestamp(message.timestamp);

  if (messageType !== SUPPORTED_TEXT_TYPE) {
    if (UNSUPPORTED_MEDIA_TYPES.has(messageType)) {
      return fail("unsupported_media", `unsupported inbound message type: ${messageType}`);
    }
    return fail("malformed_payload", `unsupported inbound message type: ${messageType}`);
  }

  const rawBody = readTrimmedString(message.text?.body);
  if (!rawBody) {
    return fail("empty_body", "text message body is required");
  }

  const body = sourceConversationType === "group" ? "" : rawBody;
  const event: NormalizedInboundChannelEvent = {
    channel: "whatsapp",
    providerEventId,
    channelUserId,
    body,
    receivedAt,
    sourceConversationType,
    sourceConversationId: groupId || undefined,
    sourceMessageId: providerEventId,
    messageType: "text",
  };

  return {
    ok: true,
    event,
    simulationRequest: toInboundSimulationRequestFromNormalizedEvent(event),
  };
}

export function toInboundSimulationRequestFromNormalizedEvent(
  event: NormalizedInboundChannelEvent,
  clientId?: string,
): WhatsAppCloudNormalizationSuccess["simulationRequest"] & { clientId?: string } {
  return {
    clientId,
    body: event.body,
    idempotencyKey: event.providerEventId,
    channel: event.channel,
    sourceConversationType: event.sourceConversationType ?? "direct",
    sourceConversationId: event.sourceConversationId,
    sourceMessageId: event.sourceMessageId ?? event.providerEventId,
    senderChannelUserId: event.channelUserId,
    now: event.receivedAt,
  };
}

function extractFirstMessage(payload: Record<string, unknown>): WhatsAppCloudMessage | null {
  const entries = payload.entry;
  if (!Array.isArray(entries) || entries.length !== 1) {
    return null;
  }

  const changes = entries[0]?.changes;
  if (!Array.isArray(changes) || changes.length !== 1) {
    return null;
  }

  const value = changes[0]?.value;
  if (!isRecord(value) || value.messaging_product !== "whatsapp") {
    return null;
  }

  const messages = value.messages;
  if (!Array.isArray(messages) || messages.length !== 1 || !isRecord(messages[0])) {
    return null;
  }

  return messages[0] as WhatsAppCloudMessage;
}

function toIsoTimestamp(timestamp: unknown) {
  const raw = readTrimmedString(timestamp);
  if (!raw || !/^\d+$/.test(raw)) {
    return undefined;
  }

  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || !Number.isSafeInteger(seconds)) {
    return undefined;
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(code: WhatsAppCloudNormalizationCode, reason: string): WhatsAppCloudNormalizationFailure {
  return { ok: false, code, reason };
}
