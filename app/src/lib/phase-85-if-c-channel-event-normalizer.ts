import { createHash } from "node:crypto";
import type { ChannelEventKind } from "./types";

// Phase 85 Interstage Foundation - P85-IF-C: secure ingress, ledger, routing, and quarantine.
// This module decomposes a mock WhatsApp Cloud-style webhook payload into independent
// NormalizedChannelEvent candidates. Every entry/change/message/status/echo/history item is
// processed independently so one malformed item never discards the rest of the batch.
//
// This is a synthetic mock schema only. Real Meta payload parity and signature verification
// remain a future, unimplemented production gate (see docs/PHASE_85_INTERSTAGE_TRUSTED_CLINICAL_
// COMMUNICATION_MEMORY_SPEC.md, section 4 and section 15 P85-IF-C acceptance).

export const PHASE_85_IF_C_NORMALIZER_VERSION = "p85-if-c-channel-event-normalizer-v1";

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

export type RawChannelEventCandidate = {
  eventKind: ChannelEventKind;
  wabaId: string | null;
  businessPhoneNumberId: string | null;
  providerAccountId: string | null;
  providerEventId: string | null;
  providerMessageId: string | null;
  fromIdentity: string | null;
  toIdentity: string | null;
  counterpartyIdentity: string | null;
  body: string | null;
  messageType: string | null;
  providerTime: string | null;
  payloadDigest: string;
  malformedReason: string | null;
};

export type ChannelEventBatchNormalizationFailure = {
  ok: false;
  code: "malformed_payload";
  reason: string;
};

export type ChannelEventBatchNormalizationSuccess = {
  ok: true;
  candidates: RawChannelEventCandidate[];
};

export type ChannelEventBatchNormalizationResult =
  | ChannelEventBatchNormalizationFailure
  | ChannelEventBatchNormalizationSuccess;

export function normalizeChannelEventBatch(payload: unknown): ChannelEventBatchNormalizationResult {
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") {
    return { ok: false, code: "malformed_payload", reason: "payload must be a whatsapp_business_account webhook object" };
  }

  const entries = payload.entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, code: "malformed_payload", reason: "payload must contain at least one entry" };
  }

  const candidates: RawChannelEventCandidate[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) {
      candidates.push(buildCandidate({ eventKind: "malformed_event", wabaId: null, businessPhoneNumberId: null, raw: entry, malformedReason: "entry_not_object" }));
      continue;
    }

    const wabaId = readTrimmedString(entry.id) || null;
    const changes = entry.changes;
    if (!Array.isArray(changes) || changes.length === 0) {
      candidates.push(buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId: null, raw: entry, malformedReason: "entry_missing_changes" }));
      continue;
    }

    for (const change of changes) {
      candidates.push(...normalizeChange(change, wabaId));
    }
  }

  return { ok: true, candidates };
}

function normalizeChange(change: unknown, wabaId: string | null): RawChannelEventCandidate[] {
  if (!isRecord(change) || !isRecord(change.value)) {
    return [buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId: null, raw: change, malformedReason: "change_missing_value" })];
  }

  const value = change.value;
  if (value.messaging_product !== "whatsapp") {
    return [buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId: null, raw: change, malformedReason: "unsupported_messaging_product" })];
  }

  const businessPhoneNumberId = readTrimmedString(isRecord(value.metadata) ? value.metadata.phone_number_id : undefined) || null;
  const field = readTrimmedString(change.field);

  if (field === "history") {
    const items = Array.isArray(value.history_messages) ? value.history_messages : [];
    if (items.length === 0) {
      return [buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId, raw: change, malformedReason: "history_missing_items" })];
    }
    return items.map((item) => normalizeHistoryItem(item, wabaId, businessPhoneNumberId));
  }

  if (field !== "messages") {
    return [buildCandidate({ eventKind: "unsupported_event", wabaId, businessPhoneNumberId, raw: change, malformedReason: `unsupported_field:${field || "unknown"}` })];
  }

  const messages = Array.isArray(value.messages) ? value.messages : [];
  const statuses = Array.isArray(value.statuses) ? value.statuses : [];
  const echoes = Array.isArray(value.smb_message_echoes) ? value.smb_message_echoes : [];

  if (messages.length === 0 && statuses.length === 0 && echoes.length === 0) {
    return [buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId, raw: change, malformedReason: "messages_field_empty" })];
  }

  const candidates: RawChannelEventCandidate[] = [];
  for (const item of messages) candidates.push(normalizeMessageItem(item, wabaId, businessPhoneNumberId, false));
  for (const item of echoes) candidates.push(normalizeMessageItem(item, wabaId, businessPhoneNumberId, true));
  for (const item of statuses) candidates.push(normalizeStatusItem(item, wabaId, businessPhoneNumberId));
  return candidates;
}

function normalizeMessageItem(
  item: unknown,
  wabaId: string | null,
  businessPhoneNumberId: string | null,
  isEcho: boolean,
): RawChannelEventCandidate {
  if (!isRecord(item)) {
    return buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId, raw: item, malformedReason: "message_item_not_object" });
  }

  const providerEventId = readTrimmedString(item.id) || null;
  const from = readTrimmedString(item.from) || null;
  const to = readTrimmedString(item.to) || null;
  const type = readTrimmedString(item.type) || null;
  const editedMessageId = readTrimmedString(item.edited_message_id) || null;
  const providerTime = toIsoTimestamp(item.timestamp);

  if (!providerEventId) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      malformedReason: "missing_provider_event_id",
      fromIdentity: from,
      providerTime,
    });
  }

  if (editedMessageId) {
    if (type === "revoked") {
      return buildCandidate({
        eventKind: "message_revoke",
        wabaId,
        businessPhoneNumberId,
        raw: item,
        providerEventId,
        providerMessageId: editedMessageId,
        fromIdentity: from,
        toIdentity: to,
        counterpartyIdentity: from,
        messageType: type,
        providerTime,
      });
    }

    if (type === "text") {
      return buildCandidate({
        eventKind: "message_edit",
        wabaId,
        businessPhoneNumberId,
        raw: item,
        providerEventId,
        providerMessageId: editedMessageId,
        fromIdentity: from,
        toIdentity: to,
        counterpartyIdentity: from,
        body: readTrimmedString(item.text && isRecord(item.text) ? item.text.body : undefined) || null,
        messageType: type,
        providerTime,
      });
    }

    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      providerEventId,
      malformedReason: `unsupported_revision_type:${type || "unknown"}`,
      providerTime,
    });
  }

  if (!from) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      providerEventId,
      malformedReason: "missing_sender_identity",
      providerTime,
    });
  }

  if (type === "text") {
    const body = readTrimmedString(item.text && isRecord(item.text) ? item.text.body : undefined);
    if (!body) {
      return buildCandidate({
        eventKind: "malformed_event",
        wabaId,
        businessPhoneNumberId,
        raw: item,
        providerEventId,
        fromIdentity: from,
        malformedReason: "empty_body",
        providerTime,
      });
    }

    return buildCandidate({
      eventKind: isEcho ? "business_human_echo_text" : "client_message_text",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      providerEventId,
      fromIdentity: from,
      toIdentity: to,
      counterpartyIdentity: from,
      body,
      messageType: "text",
      providerTime,
    });
  }

  if (type && UNSUPPORTED_MEDIA_TYPES.has(type)) {
    return buildCandidate({
      eventKind: isEcho ? "business_human_echo_media_unsupported" : "client_message_media_unsupported",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      providerEventId,
      fromIdentity: from,
      toIdentity: to,
      counterpartyIdentity: from,
      messageType: type,
      providerTime,
    });
  }

  return buildCandidate({
    eventKind: "malformed_event",
    wabaId,
    businessPhoneNumberId,
    raw: item,
    providerEventId,
    fromIdentity: from,
    malformedReason: `unsupported_message_type:${type || "unknown"}`,
    providerTime,
  });
}

function normalizeStatusItem(
  item: unknown,
  wabaId: string | null,
  businessPhoneNumberId: string | null,
): RawChannelEventCandidate {
  if (!isRecord(item)) {
    return buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId, raw: item, malformedReason: "status_item_not_object" });
  }

  const providerMessageId = readTrimmedString(item.id) || null;
  const status = readTrimmedString(item.status) || null;
  const recipient = readTrimmedString(item.recipient_id) || null;
  const providerTime = toIsoTimestamp(item.timestamp);

  if (!providerMessageId || !status) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      malformedReason: "missing_status_fields",
      providerTime,
    });
  }

  return buildCandidate({
    eventKind: "outbound_status",
    wabaId,
    businessPhoneNumberId,
    raw: item,
    providerEventId: `${providerMessageId}:${status}`,
    providerMessageId,
    toIdentity: recipient,
    counterpartyIdentity: recipient,
    messageType: status,
    providerTime,
  });
}

function normalizeHistoryItem(
  item: unknown,
  wabaId: string | null,
  businessPhoneNumberId: string | null,
): RawChannelEventCandidate {
  if (!isRecord(item)) {
    return buildCandidate({ eventKind: "malformed_event", wabaId, businessPhoneNumberId, raw: item, malformedReason: "history_item_not_object" });
  }

  const providerEventId = readTrimmedString(item.id) || null;
  const from = readTrimmedString(item.from) || null;
  const type = readTrimmedString(item.type) || null;
  const isBusinessHuman = item.is_business_human === true;
  const providerTime = toIsoTimestamp(item.timestamp);

  if (!providerEventId || !from) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      malformedReason: "missing_history_identity",
      providerTime,
    });
  }

  const body = type === "text" ? readTrimmedString(item.text && isRecord(item.text) ? item.text.body : undefined) || null : null;

  return buildCandidate({
    eventKind: isBusinessHuman ? "history_business_human_message" : "history_client_message",
    wabaId,
    businessPhoneNumberId,
    raw: item,
    providerEventId,
    fromIdentity: from,
    counterpartyIdentity: from,
    body,
    messageType: type,
    providerTime,
  });
}

type BuildCandidateInput = {
  eventKind: ChannelEventKind;
  wabaId: string | null;
  businessPhoneNumberId: string | null;
  raw: unknown;
  providerEventId?: string | null;
  providerMessageId?: string | null;
  fromIdentity?: string | null;
  toIdentity?: string | null;
  counterpartyIdentity?: string | null;
  body?: string | null;
  messageType?: string | null;
  providerTime?: string | null;
  malformedReason?: string | null;
};

function buildCandidate(input: BuildCandidateInput): RawChannelEventCandidate {
  return {
    eventKind: input.eventKind,
    wabaId: input.wabaId,
    businessPhoneNumberId: input.businessPhoneNumberId,
    providerAccountId: input.businessPhoneNumberId || input.wabaId || null,
    providerEventId: input.providerEventId ?? null,
    providerMessageId: input.providerMessageId ?? null,
    fromIdentity: input.fromIdentity ?? null,
    toIdentity: input.toIdentity ?? null,
    counterpartyIdentity: input.counterpartyIdentity ?? null,
    body: input.body ?? null,
    messageType: input.messageType ?? null,
    providerTime: input.providerTime ?? null,
    payloadDigest: computeDigest(input.raw),
    malformedReason: input.malformedReason ?? null,
  };
}

function computeDigest(value: unknown): string {
  try {
    return createHash("sha256").update(JSON.stringify(value) ?? "null").digest("hex");
  } catch {
    return createHash("sha256").update("undigestible").digest("hex");
  }
}

function toIsoTimestamp(timestamp: unknown) {
  const raw = readTrimmedString(timestamp);
  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || !Number.isSafeInteger(seconds)) {
    return null;
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
