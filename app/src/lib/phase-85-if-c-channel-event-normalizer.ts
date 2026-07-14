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
  "video",
  "document",
  "sticker",
  "location",
  "contacts",
  "interactive",
  "button",
  "reaction",
]);

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

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
  providerTimeInvalid: boolean;
  payloadDigest: string;
  malformedReason: string | null;
  providerMediaId: string | null;
  declaredMimeType: string | null;
  payloadSha256: string | null;
  caption: string | null;
  replyToProviderMessageId: string | null;
  byteSize: number | null;
  voiceFlag: boolean | null;
  durationMs: number | null;
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
  const { providerTime, providerTimeInvalid } = parseProviderTimestamp(item.timestamp);

  if (!providerEventId) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      malformedReason: "missing_provider_event_id",
      fromIdentity: from,
      providerTime,
      providerTimeInvalid,
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
        counterpartyIdentity: isEcho ? to : from,
        messageType: type,
        providerTime,
        providerTimeInvalid,
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
        counterpartyIdentity: isEcho ? to : from,
        body: readTrimmedString(item.text && isRecord(item.text) ? item.text.body : undefined) || null,
        messageType: type,
        providerTime,
        providerTimeInvalid,
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
      providerTimeInvalid,
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
      providerTimeInvalid,
    });
  }

  if (type === "text") {
    const groupId = readTrimmedString(
      isRecord(item.context) ? (item.context as Record<string, unknown>).group_id : undefined,
    );
    if (groupId && !isEcho) {
      return buildCandidate({
        eventKind: "unsupported_event",
        wabaId,
        businessPhoneNumberId,
        raw: item,
        providerEventId,
        fromIdentity: from,
        malformedReason: "whatsapp_group_unsupported",
        providerTime,
        providerTimeInvalid,
      });
    }

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
        providerTimeInvalid,
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
      counterpartyIdentity: isEcho ? to : from,
      body,
      messageType: "text",
      providerTime,
      providerTimeInvalid,
    });
  }

  if (type === "image") {
    const imageObject = item.image && isRecord(item.image) ? item.image : null;
    const providerMediaId = imageObject ? readTrimmedString(imageObject.id) || null : null;
    const declaredMimeType = imageObject ? readTrimmedString(imageObject.mime_type) || null : null;
    const payloadSha256 = imageObject ? readTrimmedString(imageObject.sha256) || null : null;
    const caption = imageObject ? readTrimmedString(imageObject.caption) || null : null;
    const byteSize =
      imageObject && typeof imageObject.file_size === "number" && Number.isFinite(imageObject.file_size)
        ? Math.max(0, Math.trunc(imageObject.file_size))
        : null;
    const replyToProviderMessageId = readReplyToProviderMessageId(item);

    if (!isEcho && declaredMimeType && SUPPORTED_IMAGE_MIME_TYPES.has(declaredMimeType)) {
      return buildCandidate({
        eventKind: "client_message_image",
        wabaId,
        businessPhoneNumberId,
        raw: item,
        providerEventId,
        fromIdentity: from,
        toIdentity: to,
        counterpartyIdentity: isEcho ? to : from,
        messageType: type,
        providerTime,
        providerTimeInvalid,
        providerMediaId,
        declaredMimeType,
        payloadSha256,
        caption,
        replyToProviderMessageId,
        byteSize,
      });
    }

    return buildCandidate({
      eventKind: isEcho ? "business_human_echo_media_unsupported" : "client_message_media_unsupported",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      providerEventId,
      fromIdentity: from,
      toIdentity: to,
      counterpartyIdentity: isEcho ? to : from,
      messageType: type,
      providerTime,
      providerTimeInvalid,
      providerMediaId,
      declaredMimeType,
      payloadSha256,
      caption,
      replyToProviderMessageId,
      byteSize,
    });
  }

  if (type === "audio") {
    const audioObject = item.audio && isRecord(item.audio) ? item.audio : null;
    const providerMediaId = audioObject ? readTrimmedString(audioObject.id) || null : null;
    const declaredMimeType = audioObject ? readTrimmedString(audioObject.mime_type) || null : null;
    const payloadSha256 = audioObject ? readTrimmedString(audioObject.sha256) || null : null;
    const voiceFlag = audioObject?.voice === true;
    const byteSize =
      audioObject && typeof audioObject.file_size === "number" && Number.isFinite(audioObject.file_size)
        ? Math.max(0, Math.trunc(audioObject.file_size))
        : null;
    const durationMs =
      audioObject && typeof audioObject.duration === "number" && Number.isFinite(audioObject.duration)
        ? Math.max(0, Math.trunc(audioObject.duration * 1000))
        : null;
    const replyToProviderMessageId = readReplyToProviderMessageId(item);

    if (
      !isEcho &&
      voiceFlag &&
      declaredMimeType &&
      (declaredMimeType.toLowerCase() === "audio/ogg" || declaredMimeType.toLowerCase().startsWith("audio/ogg;"))
    ) {
      return buildCandidate({
        eventKind: "client_message_audio",
        wabaId,
        businessPhoneNumberId,
        raw: item,
        providerEventId,
        fromIdentity: from,
        toIdentity: to,
        counterpartyIdentity: isEcho ? to : from,
        messageType: type,
        providerTime,
        providerTimeInvalid,
        providerMediaId,
        declaredMimeType,
        payloadSha256,
        replyToProviderMessageId,
        byteSize,
        voiceFlag,
        durationMs,
      });
    }

    return buildCandidate({
      eventKind: isEcho ? "business_human_echo_media_unsupported" : "client_message_media_unsupported",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      providerEventId,
      fromIdentity: from,
      toIdentity: to,
      counterpartyIdentity: isEcho ? to : from,
      messageType: type,
      providerTime,
      providerTimeInvalid,
      providerMediaId,
      declaredMimeType,
      payloadSha256,
      replyToProviderMessageId,
      byteSize,
      voiceFlag,
      durationMs,
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
      counterpartyIdentity: isEcho ? to : from,
      messageType: type,
      providerTime,
      providerTimeInvalid,
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
    providerTimeInvalid,
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
  const { providerTime, providerTimeInvalid } = parseProviderTimestamp(item.timestamp);

  if (!providerMessageId || !status) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      malformedReason: "missing_status_fields",
      providerTime,
      providerTimeInvalid,
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
    providerTimeInvalid,
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
  const to = readTrimmedString(item.to) || null;
  const type = readTrimmedString(item.type) || null;
  const isBusinessHuman = item.is_business_human === true;
  const { providerTime, providerTimeInvalid } = parseProviderTimestamp(item.timestamp);

  if (!providerEventId || !from) {
    return buildCandidate({
      eventKind: "malformed_event",
      wabaId,
      businessPhoneNumberId,
      raw: item,
      malformedReason: "missing_history_identity",
      providerTime,
      providerTimeInvalid,
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
    toIdentity: to,
    counterpartyIdentity: isBusinessHuman ? to : from,
    body,
    messageType: type,
    providerTime,
    providerTimeInvalid,
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
  providerTimeInvalid?: boolean;
  malformedReason?: string | null;
  providerMediaId?: string | null;
  declaredMimeType?: string | null;
  payloadSha256?: string | null;
  caption?: string | null;
  replyToProviderMessageId?: string | null;
  byteSize?: number | null;
  voiceFlag?: boolean | null;
  durationMs?: number | null;
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
    providerTimeInvalid: input.providerTimeInvalid ?? false,
    payloadDigest: computeDigest(input.raw),
    malformedReason: input.malformedReason ?? null,
    providerMediaId: input.providerMediaId ?? null,
    declaredMimeType: input.declaredMimeType ?? null,
    payloadSha256: input.payloadSha256 ?? null,
    caption: input.caption ?? null,
    replyToProviderMessageId: input.replyToProviderMessageId ?? null,
    byteSize: input.byteSize ?? null,
    voiceFlag: input.voiceFlag ?? null,
    durationMs: input.durationMs ?? null,
  };
}

function computeDigest(value: unknown): string {
  try {
    return createHash("sha256").update(JSON.stringify(value) ?? "null").digest("hex");
  } catch {
    return createHash("sha256").update("undigestible").digest("hex");
  }
}

function parseProviderTimestamp(timestamp: unknown) {
  const raw = readTrimmedString(timestamp);
  if (!raw) {
    return { providerTime: null, providerTimeInvalid: false };
  }
  if (!/^\d+$/.test(raw)) {
    return { providerTime: null, providerTimeInvalid: true };
  }

  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || !Number.isSafeInteger(seconds)) {
    return { providerTime: null, providerTimeInvalid: true };
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return { providerTime: null, providerTimeInvalid: true };
  }

  return { providerTime: date.toISOString(), providerTimeInvalid: false };
}

function readReplyToProviderMessageId(item: Record<string, unknown>) {
  if (!isRecord(item.context)) {
    return null;
  }
  return readTrimmedString(item.context.message_id) || null;
}

function readTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
