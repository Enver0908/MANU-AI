import {
  AI_CHAT_ATTACHMENT_MAX_AUDIO_DURATION_SECONDS,
  canonicalizeAttachmentAudioBytes,
  detectGeneralChatAttachmentPii,
  extractDocumentText,
  formatAttachmentCitationLocator,
  inspectAttachmentTextForRetrieval,
  resolveAttachmentOcrProvider,
  resolveAttachmentScanner,
  resolveAttachmentSttProvider,
  sanitizeAttachmentImageBytes,
  type AiChatAttachmentCitationLocator,
  type AiChatAttachmentExtractionResult,
} from "./phase-85-stage-4c-attachments";
import type { AiChatAttachmentStatus, AiChatScopeType } from "./phase-85-stage-4c-contracts";
import type { AiChatStore } from "./phase-85-stage-4c-store";

export const STAGE_4C_ATTACHMENT_WORKERS_VERSION = "p85-stage-4c-attachment-workers-v2";

export type AttachmentWorkerAttachmentRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  createdByUserId: string;
  scopeType: AiChatScopeType;
  clientId: string | null;
  kind: "image" | "document" | "audio";
  mimeType: string;
  fileName: string;
  byteSize: number;
  contentSha256: string;
  objectKey: string;
  status: AiChatAttachmentStatus;
  pageCount: number | null;
  durationSec: number | null;
};

export async function processAttachmentScanJob(
  store: AiChatStore,
  attachmentId: string,
  loadBytes: (objectKey: string) => Promise<Buffer | null>,
) {
  const attachment = await store.getAttachmentRecordById(attachmentId);
  if (!attachment || attachment.status !== "scanning") return;

  const bytes = await loadBytes(attachment.objectKey);
  if (!bytes) {
    await store.updateAttachmentStatus(attachment.id, "failed", "hash_mismatch");
    await store.enqueueAttachmentCleanupJob(attachment.tenantId, attachment.conversationId, attachment.id);
    return;
  }

  const scanner = resolveAttachmentScanner();
  const scan = await scanner.scan(bytes);
  if (!scan.ok) {
    await store.updateAttachmentStatus(attachment.id, scanner.status === "disabled" ? "failed" : "quarantined", scan.code);
    return;
  }

  await store.updateAttachmentStatus(attachment.id, "processing");
  await store.enqueueAttachmentParseJob(
    attachment.tenantId,
    attachment.conversationId,
    attachment.id,
    attachment.createdByUserId,
  );
}

export async function processAttachmentParseJob(
  store: AiChatStore,
  attachmentId: string,
  loadBytes: (objectKey: string) => Promise<Buffer | null>,
  options?: { clientNames?: string[] },
) {
  const attachment = await store.getAttachmentRecordById(attachmentId);
  if (!attachment || attachment.status !== "processing") return;

  const bytes = await loadBytes(attachment.objectKey);
  if (!bytes) {
    await store.updateAttachmentStatus(attachment.id, "failed", "parse_failed");
    return;
  }

  const extractions: AiChatAttachmentExtractionResult[] = [];
  let nextStatus: AiChatAttachmentStatus = "ready";
  let pageCount: number | null = attachment.pageCount;
  let durationSec: number | null = attachment.durationSec;

  if (attachment.kind === "image") {
    const sanitized = await sanitizeAttachmentImageBytes({
      bytes,
      declaredMime: attachment.mimeType,
      expectedSha256: attachment.contentSha256,
    });
    if (!sanitized.ok) {
      await store.updateAttachmentStatus(attachment.id, "rejected", sanitized.code);
      return;
    }
    await store.saveAttachmentDerivative({
      attachmentId: attachment.id,
      kind: "sanitized_original",
      status: "accepted",
      contentSha256: sanitized.contentSha256,
      excerpt: null,
      locator: {},
      confidence: 1,
      payload: { width: sanitized.width, height: sanitized.height },
    });
    const ocr = resolveAttachmentOcrProvider();
    if (ocr.status === "disabled") {
      await store.updateAttachmentStatus(attachment.id, "review_required", "ocr_disabled");
      return;
    }
    const ocrResult = await ocr.extractText({ bytes: sanitized.bytes, mimeType: "image/jpeg" });
    if (!ocrResult.ok || !ocrResult.text) {
      await store.updateAttachmentStatus(attachment.id, "review_required", "ocr_disabled");
      return;
    }
    const inspected = inspectAttachmentTextForRetrieval(ocrResult.text);
    if (!inspected.ok) {
      await store.updateAttachmentStatus(attachment.id, "review_required", inspected.code);
      return;
    }
    extractions.push({
      text: inspected.sanitizedText,
      locator: { section: "ocr" },
      partial: false,
      confidence: ocrResult.confidence ?? 0.9,
    });
    if ((ocrResult.confidence ?? 1) < 0.9) nextStatus = "review_required";
  } else if (attachment.kind === "document") {
    const parsed = await extractDocumentText(bytes, attachment.mimeType);
    if (!parsed.ok) {
      await store.updateAttachmentStatus(attachment.id, "rejected", parsed.code);
      return;
    }
    if ("pageCount" in parsed) pageCount = parsed.pageCount;
    extractions.push(...parsed.extractions);
    if (parsed.extractions.some((item) => item.partial)) nextStatus = "review_required";
  } else {
    const audio = await canonicalizeAttachmentAudioBytes({
      bytes,
      declaredMime: attachment.mimeType,
      expectedSha256: attachment.contentSha256,
    });
    if (!audio.ok) {
      await store.updateAttachmentStatus(attachment.id, "rejected", audio.failureCode);
      return;
    }
    durationSec =
      "durationSec" in audio ? audio.durationSec : Math.round(audio.artifacts.durationMs) / 1000;
    if (durationSec > AI_CHAT_ATTACHMENT_MAX_AUDIO_DURATION_SECONDS) {
      await store.updateAttachmentStatus(attachment.id, "rejected", "duration_limit");
      return;
    }
    const stt = resolveAttachmentSttProvider();
    if (stt.status === "disabled") {
      await store.updateAttachmentStatus(attachment.id, "review_required", "stt_disabled");
      return;
    }
    const transcript = await stt.transcribe({
      wavBytes: audio.artifacts.wavBytes,
      durationSec: durationSec ?? 0,
    });
    if (!transcript.ok || !transcript.text) {
      await store.updateAttachmentStatus(attachment.id, "review_required", "stt_disabled");
      return;
    }
    const inspected = inspectAttachmentTextForRetrieval(transcript.text);
    if (!inspected.ok) {
      await store.updateAttachmentStatus(attachment.id, "review_required", inspected.code);
      return;
    }
    extractions.push({
      text: inspected.sanitizedText,
      locator: { audioStartSec: 0, audioEndSec: durationSec },
      partial: false,
      confidence: transcript.confidence ?? 0.9,
    });
    if ((transcript.confidence ?? 1) < 0.9) nextStatus = "review_required";
  }

  for (const extraction of extractions) {
    const inspected = inspectAttachmentTextForRetrieval(extraction.text);
    if (!inspected.ok) {
      await store.updateAttachmentStatus(attachment.id, "review_required", inspected.code);
      return;
    }
    if (
      attachment.scopeType === "general" &&
      detectGeneralChatAttachmentPii(inspected.sanitizedText, options?.clientNames ?? []).flagged
    ) {
      await store.updateAttachmentStatus(attachment.id, "review_required", "general_chat_pii");
      await store.saveAttachmentDerivative({
        attachmentId: attachment.id,
        kind: attachment.kind === "image" ? "ocr_text" : attachment.kind === "audio" ? "transcript" : "extracted_text",
        status: "review_required",
        contentSha256: null,
        excerpt: inspected.sanitizedText,
        locator: extraction.locator,
        confidence: extraction.confidence,
        payload: { citation: formatAttachmentCitationLocator(extraction.locator) },
      });
      return;
    }
    await store.saveAttachmentDerivative({
      attachmentId: attachment.id,
      kind: attachment.kind === "image" ? "ocr_text" : attachment.kind === "audio" ? "transcript" : "extracted_text",
      status: nextStatus === "ready" ? "accepted" : "review_required",
      contentSha256: null,
      excerpt: inspected.sanitizedText,
      locator: extraction.locator,
      confidence: extraction.confidence,
      payload: { citation: formatAttachmentCitationLocator(extraction.locator) },
    });
  }

  await store.updateAttachmentStatus(attachment.id, nextStatus, null, { pageCount, durationSec });
}

export async function processAttachmentCleanupJob(
  store: AiChatStore,
  attachmentId: string,
  deleteObject: (objectKey: string) => Promise<void>,
) {
  const attachment = await store.getAttachmentRecordById(attachmentId);
  if (!attachment) return;
  await deleteObject(attachment.objectKey);
  await store.updateAttachmentStatus(attachment.id, "deleted");
}

export function isAcceptedDerivativeEligible(input: {
  status: "pending" | "review_required" | "accepted" | "superseded" | "rejected";
  confidence: number | null;
}) {
  return input.status === "accepted" && (input.confidence ?? 1) >= 0.9;
}

export function buildAttachmentRetrievalExcerpt(input: {
  attachmentId: string;
  excerpt: string;
  locator: AiChatAttachmentCitationLocator;
}) {
  return {
    sourceId: `attachment:${input.attachmentId}`,
    sourceType: "chat_attachment" as const,
    locator: formatAttachmentCitationLocator(input.locator),
    excerpt: input.excerpt,
    contentHash: null,
    sourceDate: null,
  };
}
