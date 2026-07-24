import { createHash, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { parse as parseCsv } from "csv-parse";
import mammoth from "mammoth";
import yauzl from "yauzl";
import { WaveFile } from "wavefile";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import { detectDietitianChatPromptInjectionSignals } from "dietitian-ai-assistant-architecture";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";
import { canonicalizeOggOpusVoiceBytes } from "./phase-85-stage-4b4-audio-canonicalizer";
import { validateCanonicalWavArtifacts } from "./phase-85-stage-4b4-ogg-preflight";
import {
  STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
  STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
  STAGE_4B4_MAX_INPUT_BYTES,
} from "./phase-85-stage-4b4-voice-contracts";
import { computeEvidenceContentHash, truncateEvidenceExcerpt } from "./phase-85-stage-4c-retrieval";

export const STAGE_4C_ATTACHMENTS_VERSION = "p85-stage-4c-attachments-v1";

export const AI_CHAT_ATTACHMENT_BUCKET = "p85-stage-4c-ai-chat";
export const AI_CHAT_CLIENT_RECORD_BUCKET = "p85-stage-4c-client-records";
export const AI_CHAT_ATTACHMENT_UPLOAD_TTL_SECONDS = 600;

export const AI_CHAT_ATTACHMENT_KINDS = ["image", "document", "audio"] as const;
export type AiChatAttachmentKind = (typeof AI_CHAT_ATTACHMENT_KINDS)[number];

export const AI_CHAT_ATTACHMENT_DERIVATIVE_KINDS = [
  "sanitized_original",
  "extracted_text",
  "ocr_text",
  "transcript",
  "chunk",
] as const;
export type AiChatAttachmentDerivativeKind = (typeof AI_CHAT_ATTACHMENT_DERIVATIVE_KINDS)[number];

export const AI_CHAT_ATTACHMENT_DERIVATIVE_STATUSES = [
  "pending",
  "review_required",
  "accepted",
  "superseded",
  "rejected",
] as const;
export type AiChatAttachmentDerivativeStatus = (typeof AI_CHAT_ATTACHMENT_DERIVATIVE_STATUSES)[number];

export const AI_CHAT_ATTACHMENT_JOB_TYPES = [
  "attachment_scan",
  "attachment_parse",
  "attachment_cleanup",
] as const;
export type AiChatAttachmentJobType = (typeof AI_CHAT_ATTACHMENT_JOB_TYPES)[number];

export const AI_CHAT_ATTACHMENT_MAX_PER_MESSAGE = 10;
export const AI_CHAT_ATTACHMENT_MAX_IMAGES = 4;
export const AI_CHAT_ATTACHMENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const AI_CHAT_ATTACHMENT_MAX_DOCUMENTS = 5;
export const AI_CHAT_ATTACHMENT_MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const AI_CHAT_ATTACHMENT_MAX_DOCUMENT_PAGES_PER_MESSAGE = 300;
export const AI_CHAT_ATTACHMENT_MAX_CSV_ROWS = 50_000;
export const AI_CHAT_ATTACHMENT_MAX_CSV_COLUMNS = 200;
export const AI_CHAT_ATTACHMENT_MAX_CSV_CELL_CHARS = 10_000;
export const AI_CHAT_ATTACHMENT_MAX_MEGAPIXELS = 25_000_000;
export const AI_CHAT_ATTACHMENT_MAX_AUDIO_FILES = 4;
export const AI_CHAT_ATTACHMENT_MAX_AUDIO_BYTES = 16 * 1024 * 1024;
export const AI_CHAT_ATTACHMENT_MAX_AUDIO_DURATION_SECONDS = 300;
export const AI_CHAT_ATTACHMENT_MAX_AUDIO_TOTAL_SECONDS = 600;
export const AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES = 75 * 1024 * 1024;
export const AI_CHAT_ATTACHMENT_MAX_EXTRACTED_CHARS = 2_000_000;
export const AI_CHAT_DOCX_MAX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024;
export const AI_CHAT_DOCX_MAX_COMPRESSION_RATIO = 100;
export const AI_CHAT_DOCX_MAX_ENTRIES = 10_000;

export const AI_CHAT_ATTACHMENT_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const AI_CHAT_ATTACHMENT_DOCUMENT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
] as const;
export const AI_CHAT_ATTACHMENT_AUDIO_MIMES = ["audio/wav", "audio/x-wav", "audio/ogg", "audio/ogg; codecs=opus"] as const;

export const AI_CHAT_ATTACHMENT_REJECTED_EXTENSIONS = [
  ".docm",
  ".xls",
  ".xlsx",
  ".zip",
  ".rar",
  ".svg",
  ".html",
  ".htm",
  ".exe",
  ".bat",
  ".cmd",
  ".msi",
] as const;

export type AiChatAttachmentFailureCode =
  | "unsupported_mime"
  | "mime_spoof"
  | "rejected_extension"
  | "hash_mismatch"
  | "size_limit"
  | "count_limit"
  | "page_limit"
  | "duration_limit"
  | "megapixel_limit"
  | "encrypted_document"
  | "docx_zip_bomb"
  | "invalid_utf8"
  | "extracted_text_too_large"
  | "partial_extraction"
  | "scanner_unavailable"
  | "prompt_injection"
  | "general_chat_pii"
  | "scan_failed"
  | "parse_failed";

export type AiChatAttachmentCitationLocator = {
  page?: number | null;
  section?: string | null;
  rowStart?: number | null;
  rowEnd?: number | null;
  audioStartSec?: number | null;
  audioEndSec?: number | null;
};

export type AiChatAttachmentExtractionResult = {
  text: string;
  locator: AiChatAttachmentCitationLocator;
  partial: boolean;
  confidence: number | null;
};

GlobalWorkerOptions.workerSrc = "pdfjs-dist/legacy/build/pdf.worker.mjs";

export function hashAttachmentBytes(bytes: Buffer): string {
  return hashMediaBytes(bytes);
}

export function buildAiChatAttachmentObjectKey(
  tenantId: string,
  userId: string,
  conversationId: string,
  attachmentId: string,
) {
  return `${tenantId}/${userId}/${conversationId}/${attachmentId}`;
}

export function buildClientRecordObjectKey(tenantId: string, clientId: string, assetId: string) {
  return `${tenantId}/${clientId}/${assetId}`;
}

export function resolveAttachmentKindFromMime(mimeType: string): AiChatAttachmentKind | null {
  const normalized = mimeType.trim().toLowerCase();
  if (AI_CHAT_ATTACHMENT_IMAGE_MIMES.some((item) => item === normalized)) return "image";
  if (AI_CHAT_ATTACHMENT_DOCUMENT_MIMES.some((item) => item === normalized)) return "document";
  if (normalized.startsWith("audio/ogg") || normalized === "audio/wav" || normalized === "audio/x-wav") return "audio";
  return null;
}

export function isRejectedAttachmentFileName(fileName: string) {
  const lower = fileName.trim().toLowerCase();
  return AI_CHAT_ATTACHMENT_REJECTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function validateAttachmentLimits(input: {
  kind: AiChatAttachmentKind;
  byteSize: number;
  existing: Array<{ kind: AiChatAttachmentKind; byteSize: number; pageCount?: number; durationSec?: number }>;
}) {
  const next = [...input.existing, { kind: input.kind, byteSize: input.byteSize }];
  if (next.length > AI_CHAT_ATTACHMENT_MAX_PER_MESSAGE) {
    return { ok: false as const, code: "count_limit" as const };
  }
  const totalBytes = next.reduce((sum, item) => sum + item.byteSize, 0);
  if (totalBytes > AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
    return { ok: false as const, code: "size_limit" as const };
  }
  const images = next.filter((item) => item.kind === "image");
  const documents = next.filter((item) => item.kind === "document");
  const audio = next.filter((item) => item.kind === "audio");
  if (images.length > AI_CHAT_ATTACHMENT_MAX_IMAGES) return { ok: false as const, code: "count_limit" as const };
  if (documents.length > AI_CHAT_ATTACHMENT_MAX_DOCUMENTS) return { ok: false as const, code: "count_limit" as const };
  if (audio.length > AI_CHAT_ATTACHMENT_MAX_AUDIO_FILES) return { ok: false as const, code: "count_limit" as const };
  if (input.kind === "image" && input.byteSize > AI_CHAT_ATTACHMENT_MAX_IMAGE_BYTES) {
    return { ok: false as const, code: "size_limit" as const };
  }
  if (input.kind === "document" && input.byteSize > AI_CHAT_ATTACHMENT_MAX_DOCUMENT_BYTES) {
    return { ok: false as const, code: "size_limit" as const };
  }
  if (input.kind === "audio" && input.byteSize > AI_CHAT_ATTACHMENT_MAX_AUDIO_BYTES) {
    return { ok: false as const, code: "size_limit" as const };
  }
  return { ok: true as const };
}

function safeEqualHex(left: string, right: string) {
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}

export async function verifyDeclaredMimeMatchesBytes(bytes: Buffer, declaredMime: string) {
  const detected = await fileTypeFromBuffer(bytes);
  const normalizedDeclared = declaredMime.trim().toLowerCase();
  const detectedMime = detected?.mime?.toLowerCase() ?? "";
  if (!detectedMime) {
    if (normalizedDeclared === "text/plain" || normalizedDeclared === "text/csv") {
      return { ok: true as const, detectedMime: normalizedDeclared };
    }
    return { ok: false as const, code: "mime_spoof" as const };
  }
  if (normalizedDeclared.startsWith("audio/ogg") && detectedMime.includes("ogg")) {
    return { ok: true as const, detectedMime };
  }
  if ((normalizedDeclared === "audio/wav" || normalizedDeclared === "audio/x-wav") && detectedMime === "audio/wav") {
    return { ok: true as const, detectedMime };
  }
  if (detectedMime !== normalizedDeclared) {
    return { ok: false as const, code: "mime_spoof" as const };
  }
  return { ok: true as const, detectedMime };
}

export async function sanitizeAttachmentImageBytes(input: {
  bytes: Buffer;
  declaredMime: string;
  expectedSha256?: string | null;
}) {
  const mimeCheck = await verifyDeclaredMimeMatchesBytes(input.bytes, input.declaredMime);
  if (!mimeCheck.ok) return mimeCheck;
  if (!AI_CHAT_ATTACHMENT_IMAGE_MIMES.includes(input.declaredMime as (typeof AI_CHAT_ATTACHMENT_IMAGE_MIMES)[number])) {
    return { ok: false as const, code: "unsupported_mime" as const };
  }
  if (input.expectedSha256 && !safeEqualHex(hashAttachmentBytes(input.bytes), input.expectedSha256)) {
    return { ok: false as const, code: "hash_mismatch" as const };
  }
  const metadata = await sharp(input.bytes, { failOn: "error" }).metadata();
  const pixels = (metadata.width ?? 0) * (metadata.height ?? 0);
  if (pixels > AI_CHAT_ATTACHMENT_MAX_MEGAPIXELS) {
    return { ok: false as const, code: "megapixel_limit" as const };
  }
  const sanitized = await sharp(input.bytes, { failOn: "error" })
    .rotate()
    .toColourspace("srgb")
    .jpeg({ quality: 90, mozjpeg: true })
  .toBuffer();
  return {
    ok: true as const,
    bytes: sanitized,
    contentSha256: hashAttachmentBytes(sanitized),
    detectedMime: "image/jpeg" as const,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

async function preflightDocxZip(bytes: Buffer) {
  return new Promise<{ ok: true } | { ok: false; code: AiChatAttachmentFailureCode }>((resolve) => {
    yauzl.fromBuffer(bytes, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        resolve({ ok: false, code: "docx_zip_bomb" });
        return;
      }
      let entries = 0;
      let uncompressedTotal = 0;
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        entries += 1;
        if (entries > AI_CHAT_DOCX_MAX_ENTRIES) {
          zipfile.close();
          resolve({ ok: false, code: "docx_zip_bomb" });
          return;
        }
        uncompressedTotal += entry.uncompressedSize;
        if (uncompressedTotal > AI_CHAT_DOCX_MAX_UNCOMPRESSED_BYTES) {
          zipfile.close();
          resolve({ ok: false, code: "docx_zip_bomb" });
          return;
        }
        const ratio = entry.compressedSize > 0 ? entry.uncompressedSize / entry.compressedSize : 1;
        if (ratio > AI_CHAT_DOCX_MAX_COMPRESSION_RATIO) {
          zipfile.close();
          resolve({ ok: false, code: "docx_zip_bomb" });
          return;
        }
        zipfile.readEntry();
      });
      zipfile.on("end", () => resolve({ ok: true }));
      zipfile.on("error", () => resolve({ ok: false, code: "docx_zip_bomb" }));
    });
  });
}

function assertExtractedTextWithinLimit(text: string) {
  if (text.length > AI_CHAT_ATTACHMENT_MAX_EXTRACTED_CHARS) {
    return { ok: false as const, code: "extracted_text_too_large" as const };
  }
  return { ok: true as const };
}

export async function extractPdfText(bytes: Buffer) {
  let encrypted = false;
  const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  loadingTask.onPassword = () => {
    encrypted = true;
  };
  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch {
    return { ok: false as const, code: "encrypted_document" as const };
  }
  if (encrypted) {
    return { ok: false as const, code: "encrypted_document" as const };
  }
  const pageCount = pdf.numPages;
  const chunks: string[] = [];
  let partial = false;
  for (let page = 1; page <= pageCount; page += 1) {
    const pageRef = await pdf.getPage(page);
    const textContent = await pageRef.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .trim();
    if (pageText) {
      chunks.push(`[page ${page}] ${pageText}`);
    }
    if (chunks.join("\n").length > AI_CHAT_ATTACHMENT_MAX_EXTRACTED_CHARS) {
      partial = true;
      break;
    }
  }
  const text = chunks.join("\n");
  const limit = assertExtractedTextWithinLimit(text);
  if (!limit.ok) return limit;
  return {
    ok: true as const,
    pageCount,
    extractions: [{ text, locator: { page: 1, rowStart: null, rowEnd: null }, partial, confidence: 1 }],
  };
}

export async function extractDocxText(bytes: Buffer) {
  const zipCheck = await preflightDocxZip(bytes);
  if (!zipCheck.ok) return zipCheck;
  const result = await mammoth.extractRawText({ buffer: bytes });
  const text = result.value.trim();
  const limit = assertExtractedTextWithinLimit(text);
  if (!limit.ok) return limit;
  return {
    ok: true as const,
    extractions: [
      {
        text,
        locator: { section: "document", rowStart: null, rowEnd: null },
        partial: Boolean(result.messages.length),
        confidence: result.messages.length ? 0.8 : 1,
      },
    ],
  };
}

export function extractUtf8Text(bytes: Buffer) {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const limit = assertExtractedTextWithinLimit(text);
    if (!limit.ok) return limit;
    return {
      ok: true as const,
      extractions: [{ text, locator: { section: "text", rowStart: null, rowEnd: null }, partial: false, confidence: 1 }],
    };
  } catch {
    return { ok: false as const, code: "invalid_utf8" as const };
  }
}

export async function extractCsvText(bytes: Buffer) {
  return new Promise<
    | { ok: true; extractions: AiChatAttachmentExtractionResult[] }
    | { ok: false; code: AiChatAttachmentFailureCode }
  >((resolve) => {
    const rows: string[] = [];
    let rowCount = 0;
    let maxColumns = 0;
    const parser = parseCsv({
      bom: true,
      relax_column_count: true,
      skip_empty_lines: true,
    });
    parser.on("readable", () => {
      let record: string[] | null;
      while ((record = parser.read()) !== null) {
        rowCount += 1;
        if (rowCount > AI_CHAT_ATTACHMENT_MAX_CSV_ROWS) {
          parser.destroy();
          resolve({ ok: false, code: "page_limit" });
          return;
        }
        maxColumns = Math.max(maxColumns, record.length);
        if (maxColumns > AI_CHAT_ATTACHMENT_MAX_CSV_COLUMNS) {
          parser.destroy();
          resolve({ ok: false, code: "page_limit" });
          return;
        }
        if (record.some((cell) => cell.length > AI_CHAT_ATTACHMENT_MAX_CSV_CELL_CHARS)) {
          parser.destroy();
          resolve({ ok: false, code: "size_limit" });
          return;
        }
        rows.push(record.join(","));
      }
    });
    parser.on("error", () => resolve({ ok: false, code: "parse_failed" }));
    parser.on("end", () => {
      const text = rows.join("\n");
      const limit = assertExtractedTextWithinLimit(text);
      if (!limit.ok) {
        resolve(limit);
        return;
      }
      resolve({
        ok: true,
        extractions: [
          {
            text,
            locator: { rowStart: 1, rowEnd: rowCount },
            partial: false,
            confidence: 1,
          },
        ],
      });
    });
    Readable.from(bytes).pipe(parser);
  });
}

export async function canonicalizeAttachmentAudioBytes(input: {
  bytes: Buffer;
  declaredMime: string;
  expectedSha256?: string | null;
}) {
  const normalized = input.declaredMime.trim().toLowerCase();
  if (normalized.startsWith("audio/ogg")) {
    return canonicalizeOggOpusVoiceBytes({
      bytes: input.bytes,
      declaredMimeType: input.declaredMime,
      expectedSha256: input.expectedSha256,
    });
  }
  if (normalized !== "audio/wav" && normalized !== "audio/x-wav") {
    return { ok: false as const, failureCode: "unsupported_mime" as const };
  }
  if (input.bytes.byteLength > STAGE_4B4_MAX_INPUT_BYTES) {
    return { ok: false as const, failureCode: "stream_too_large" as const };
  }
  if (input.expectedSha256 && !safeEqualHex(hashAttachmentBytes(input.bytes), input.expectedSha256)) {
    return { ok: false as const, failureCode: "hash_mismatch" as const };
  }
  const mimeCheck = await verifyDeclaredMimeMatchesBytes(input.bytes, input.declaredMime);
  if (!mimeCheck.ok) return { ok: false as const, failureCode: "mime_spoof" as const };
  let wavBytes: Buffer;
  try {
    const wav = new WaveFile(input.bytes);
    wav.toBitDepth("16");
    wav.toSampleRate(STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ);
    const fmt = wav.fmt as { numChannels: number };
    if (fmt.numChannels !== STAGE_4B4_CANONICAL_AUDIO_CHANNELS) {
      if (fmt.numChannels < 1) {
        return { ok: false as const, failureCode: "decode_failed" as const };
      }
      const channels = wav.getSamples(true) as unknown as Float64Array[];
      const sampleCount = channels[0]?.length ?? 0;
      const mono = new Float64Array(sampleCount);
      for (let index = 0; index < sampleCount; index += 1) {
        let sum = 0;
        for (const channel of channels) {
          sum += channel[index] ?? 0;
        }
        mono[index] = sum / channels.length;
      }
      const normalized = new WaveFile();
      normalized.fromScratch(
        STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
        STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
        "16",
        mono,
      );
      wavBytes = Buffer.from(normalized.toBuffer());
    } else {
      wavBytes = Buffer.from(wav.toBuffer());
    }
  } catch {
    return { ok: false as const, failureCode: "decode_failed" as const };
  }
  const validation = validateCanonicalWavArtifacts({ wavBytes });
  if (!validation.ok) {
    return { ok: false as const, failureCode: validation.failureCode };
  }
  const durationSec = validation.durationMs / 1000;
  if (durationSec > AI_CHAT_ATTACHMENT_MAX_AUDIO_DURATION_SECONDS) {
    return { ok: false as const, failureCode: "duration_exceeded" as const };
  }
  return {
    ok: true as const,
    artifacts: {
      contentSha256: hashAttachmentBytes(wavBytes),
      wavBytes,
      durationMs: validation.durationMs,
      sampleRateHz: STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
      audioChannels: STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
      audioCodec: "pcm_s16le" as const,
    },
    durationSec,
  };
}

export function detectGeneralChatAttachmentPii(text: string, clientNames: string[] = []) {
  const patterns = [
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
    /\b\+?\d{10,15}\b/,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  ];
  if (patterns.some((pattern) => pattern.test(text))) {
    return { flagged: true, reason: "identifier_pattern" as const };
  }
  const haystack = text.toLowerCase();
  for (const name of clientNames) {
    const normalized = name.trim().toLowerCase();
    if (normalized.length >= 3 && haystack.includes(normalized)) {
      return { flagged: true, reason: "client_name" as const };
    }
  }
  return { flagged: false, reason: null };
}

export function inspectAttachmentTextForRetrieval(text: string) {
  const injection = detectDietitianChatPromptInjectionSignals(text);
  if (injection.flagged) {
    return { ok: false as const, code: "prompt_injection" as const };
  }
  return { ok: true as const, sanitizedText: text.slice(0, AI_CHAT_ATTACHMENT_MAX_EXTRACTED_CHARS) };
}

export function isDeterministicAttachmentScannerEnabled() {
  return process.env.AI_CHAT_DETERMINISTIC_MODE === "true" || process.env.NODE_ENV === "test";
}

export function runDeterministicAttachmentScan(bytes: Buffer) {
  const eicar = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";
  if (bytes.includes(eicar)) {
    return { ok: false as const, code: "scan_failed" as const };
  }
  return { ok: true as const };
}

export function resolveAttachmentScanner() {
  if (isDeterministicAttachmentScannerEnabled()) {
    return {
      status: "fixture" as const,
      async scan(bytes: Buffer) {
        return runDeterministicAttachmentScan(bytes);
      },
    };
  }
  return {
    status: "disabled" as const,
    async scan() {
      return { ok: false as const, code: "scanner_unavailable" as const };
    },
  };
}

export type AiChatOcrSttProviderStatus = "disabled" | "fixture";

export function resolveAttachmentOcrProvider(): {
  status: AiChatOcrSttProviderStatus;
  extractText(input: { bytes: Buffer; mimeType: string }): Promise<{
    ok: boolean;
    text?: string;
    confidence?: number;
    reason?: string;
  }>;
} {
  if (!isDeterministicAttachmentScannerEnabled()) {
    return {
      status: "disabled",
      async extractText() {
        return { ok: false, reason: "ocr_disabled" };
      },
    };
  }
  return {
    status: "fixture",
    async extractText(input) {
      if (!input.mimeType.startsWith("image/")) {
        return { ok: false, reason: "unsupported_mime" };
      }
      return {
        ok: true,
        text: "Fixture OCR text for synthetic image attachment.",
        confidence: 0.96,
      };
    },
  };
}

export function resolveAttachmentSttProvider(): {
  status: AiChatOcrSttProviderStatus;
  transcribe(input: { wavBytes: Buffer; durationSec: number }): Promise<{
    ok: boolean;
    text?: string;
    confidence?: number;
    reason?: string;
  }>;
} {
  if (!isDeterministicAttachmentScannerEnabled()) {
    return {
      status: "disabled",
      async transcribe() {
        return { ok: false, reason: "stt_disabled" };
      },
    };
  }
  return {
    status: "fixture",
    async transcribe(input) {
      return {
        ok: true,
        text: `Fixture transcript (${input.durationSec.toFixed(1)}s).`,
        confidence: 0.94,
      };
    },
  };
}

export async function extractDocumentText(bytes: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return extractPdfText(bytes);
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocxText(bytes);
  }
  if (mimeType === "text/plain") return extractUtf8Text(bytes);
  if (mimeType === "text/csv") return extractCsvText(bytes);
  return { ok: false as const, code: "unsupported_mime" as const };
}

export function formatAttachmentCitationLocator(locator: AiChatAttachmentCitationLocator) {
  if (locator.page) return `page ${locator.page}`;
  if (locator.section) return `section ${locator.section}`;
  if (locator.rowStart && locator.rowEnd) return `rows ${locator.rowStart}-${locator.rowEnd}`;
  if (locator.audioStartSec != null && locator.audioEndSec != null) {
    return `${locator.audioStartSec.toFixed(1)}s-${locator.audioEndSec.toFixed(1)}s`;
  }
  return "unknown";
}

export function computeAttachmentRetryDelayMs(retryCount: number) {
  if (retryCount <= 0) return 30_000;
  if (retryCount === 1) return 120_000;
  return 600_000;
}

export function sha256FromArrayBuffer(buffer: ArrayBuffer) {
  return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

export function buildAttachmentDerivativeEvidenceRows(
  clientId: string | null,
  items: Array<{
    derivativeId: string;
    attachmentId: string;
    excerpt: string;
    contentHash: string | null;
    locator: string | null;
  }>,
) {
  return items
    .filter((item) => item.excerpt.trim())
    .map((item) => {
      const excerpt = truncateEvidenceExcerpt(item.excerpt.trim());
      return {
        sourceId: `attachment:${item.attachmentId}:${item.derivativeId}`,
        clientId: clientId ?? "",
        sourceType: "chat_attachment" as const,
        locator: item.locator,
        excerpt,
        contentHash: item.contentHash ?? computeEvidenceContentHash(excerpt),
        sourceDate: null,
        updatedAt: null,
        occurredAt: null,
        lifecycleStatus: "current" as const,
        retrievalEligible: true,
        authorityWeight: 2,
      };
    });
}
