import { createHash, timingSafeEqual } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import {
  STAGE_4B3_MEDIA_RETENTION_DAYS,
  type MediaAssetDimensions,
} from "./phase-85-stage-4b3-media-contracts";

export const STAGE_4B3_ADMISSION_VERSION = "p85-stage-4b3-image-admission-v1";
export const STAGE_4B3_MAX_STREAM_BYTES = 5 * 1024 * 1024;
export const STAGE_4B3_MIN_IMAGE_DIMENSION = 32;
export const STAGE_4B3_MAX_IMAGE_DIMENSION = 8192;
export const STAGE_4B3_MAX_MEGAPIXELS = 25_000_000;
export const STAGE_4B3_SANITIZED_FULL_MAX_LONG_EDGE = 3072;
export const STAGE_4B3_SANITIZED_FULL_JPEG_QUALITY = 90;
export const STAGE_4B3_THUMBNAIL_MAX_LONG_EDGE = 640;
export const STAGE_4B3_THUMBNAIL_JPEG_QUALITY = 82;
export const STAGE_4B3_ALLOWED_DECLARED_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const STAGE_4B3_MAX_CAPTION_CODEPOINTS = 1_024;

export const STAGE_4B3_MEDIA_ADMISSION_FAILURE_CODES = [
  "missing_provider_media_id",
  "transport_unavailable",
  "stream_too_large",
  "unsupported_mime",
  "mime_spoof",
  "hash_mismatch",
  "corrupt_image",
  "animated_image",
  "dimensions_too_small",
  "dimensions_too_large",
  "megapixels_too_large",
  "decompression_bomb",
  "caption_too_long",
  "storage_upload_failed",
] as const;

export type Stage4B3MediaAdmissionFailureCode = (typeof STAGE_4B3_MEDIA_ADMISSION_FAILURE_CODES)[number];

export type Stage4B3SanitizedImageArtifacts = {
  contentSha256: string;
  detectedMimeType: "image/jpeg";
  dimensions: MediaAssetDimensions;
  sanitizedFullBytes: Buffer;
  thumbnailBytes: Buffer;
  expiresAt: string;
};

export type Stage4B3ImageAdmissionSuccess = {
  ok: true;
  artifacts: Stage4B3SanitizedImageArtifacts;
};

export type Stage4B3ImageAdmissionFailure = {
  ok: false;
  failureCode: Stage4B3MediaAdmissionFailureCode;
};

export type Stage4B3ImageAdmissionResult = Stage4B3ImageAdmissionSuccess | Stage4B3ImageAdmissionFailure;

export function isAllowedDeclaredMimeType(value: string | null | undefined): value is (typeof STAGE_4B3_ALLOWED_DECLARED_MIME_TYPES)[number] {
  return value === "image/jpeg" || value === "image/png";
}

export function hashMediaBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildStage4B3MediaObjectKeys(tenantId: string, assetId: string) {
  const prefix = `${tenantId}/${assetId}`;
  return {
    sanitizedFullObjectKey: `${prefix}/full.jpg`,
    thumbnailObjectKey: `${prefix}/thumb.jpg`,
  };
}

export function computeStage4B3MediaExpiresAt(now: Date = new Date()): string {
  const expiresAt = new Date(now);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + STAGE_4B3_MEDIA_RETENTION_DAYS);
  return expiresAt.toISOString();
}

export function validateCaptionLength(caption: string | null | undefined): Stage4B3ImageAdmissionFailure | null {
  if (!caption) {
    return null;
  }
  const codepoints = Array.from(caption).length;
  if (codepoints > STAGE_4B3_MAX_CAPTION_CODEPOINTS) {
    return { ok: false, failureCode: "caption_too_long" };
  }
  return null;
}

export async function validateAndSanitizeImageBytes(input: {
  bytes: Buffer;
  declaredMimeType: string;
  expectedSha256?: string | null;
  now?: Date;
}): Promise<Stage4B3ImageAdmissionResult> {
  if (!isAllowedDeclaredMimeType(input.declaredMimeType)) {
    return { ok: false, failureCode: "unsupported_mime" };
  }

  if (input.bytes.byteLength > STAGE_4B3_MAX_STREAM_BYTES) {
    return { ok: false, failureCode: "stream_too_large" };
  }

  const detectedMimeType = await detectMimeFromBytes(input.bytes);
  if (!detectedMimeType || !isAllowedDeclaredMimeType(detectedMimeType)) {
    return { ok: false, failureCode: "mime_spoof" };
  }
  if (detectedMimeType !== input.declaredMimeType) {
    return { ok: false, failureCode: "mime_spoof" };
  }

  if (input.expectedSha256) {
    const actualSha256 = hashMediaBytes(input.bytes);
    if (!safeEqualHex(actualSha256, input.expectedSha256)) {
      return { ok: false, failureCode: "hash_mismatch" };
    }
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: STAGE_4B3_MAX_MEGAPIXELS,
      animated: false,
    }).metadata();
  } catch {
    return { ok: false, failureCode: "corrupt_image" };
  }

  if ((metadata.pages ?? 1) > 1) {
    return { ok: false, failureCode: "animated_image" };
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < STAGE_4B3_MIN_IMAGE_DIMENSION || height < STAGE_4B3_MIN_IMAGE_DIMENSION) {
    return { ok: false, failureCode: "dimensions_too_small" };
  }
  if (width > STAGE_4B3_MAX_IMAGE_DIMENSION || height > STAGE_4B3_MAX_IMAGE_DIMENSION) {
    return { ok: false, failureCode: "dimensions_too_large" };
  }

  const megapixels = width * height;
  if (megapixels > STAGE_4B3_MAX_MEGAPIXELS) {
    return { ok: false, failureCode: "megapixels_too_large" };
  }

  let sanitizedFullBytes: Buffer;
  let thumbnailBytes: Buffer;
  try {
    const pipeline = sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: STAGE_4B3_MAX_MEGAPIXELS,
      animated: false,
    }).rotate();

    sanitizedFullBytes = await pipeline
      .clone()
      .resize({
        width: STAGE_4B3_SANITIZED_FULL_MAX_LONG_EDGE,
        height: STAGE_4B3_SANITIZED_FULL_MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColorspace("srgb")
      .jpeg({
        quality: STAGE_4B3_SANITIZED_FULL_JPEG_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();

    thumbnailBytes = await pipeline
      .clone()
      .resize({
        width: STAGE_4B3_THUMBNAIL_MAX_LONG_EDGE,
        height: STAGE_4B3_THUMBNAIL_MAX_LONG_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColorspace("srgb")
      .jpeg({
        quality: STAGE_4B3_THUMBNAIL_JPEG_QUALITY,
        mozjpeg: true,
      })
      .toBuffer();
  } catch {
    return { ok: false, failureCode: "decompression_bomb" };
  }

  const sanitizedMetadata = await sharp(sanitizedFullBytes).metadata();
  const sanitizedWidth = sanitizedMetadata.width ?? width;
  const sanitizedHeight = sanitizedMetadata.height ?? height;

  await assertSanitizedImageHasNoSensitiveMetadata(sanitizedFullBytes);

  return {
    ok: true,
    artifacts: {
      contentSha256: hashMediaBytes(sanitizedFullBytes),
      detectedMimeType: "image/jpeg",
      dimensions: { width: sanitizedWidth, height: sanitizedHeight },
      sanitizedFullBytes,
      thumbnailBytes,
      expiresAt: computeStage4B3MediaExpiresAt(input.now),
    },
  };
}

async function detectMimeFromBytes(bytes: Buffer): Promise<string | null> {
  const fileType = await import("file-type");
  const detected = await fileType.fileTypeFromBuffer(bytes);
  return detected?.mime ?? null;
}

async function assertSanitizedImageHasNoSensitiveMetadata(bytes: Buffer) {
  const metadata = await sharp(bytes).metadata();
  if (metadata.exif) {
    throw new Error("sanitized_image_retained_exif");
  }
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
