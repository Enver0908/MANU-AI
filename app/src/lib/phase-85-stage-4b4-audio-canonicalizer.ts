import { createHash, timingSafeEqual } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";
import { decodeOggOpusVoiceBytesInWorker } from "./phase-85-stage-4b4-audio-decode-worker";
import { preflightOggOpusVoiceBytes, validateCanonicalWavArtifacts } from "./phase-85-stage-4b4-ogg-preflight";
import {
  STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
  STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
  STAGE_4B4_MAX_INPUT_BYTES,
  STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_AUDIO_CANONICALIZER_VERSION = "p85-stage-4b4-audio-canonicalizer-v2";
export const STAGE_4B4_MAX_DECODE_SAMPLES = STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ * 300;

export const STAGE_4B4_AUDIO_CANONICALIZATION_FAILURE_CODES = [
  "stream_too_large",
  "unsupported_mime",
  "mime_spoof",
  "hash_mismatch",
  "corrupt_ogg",
  "corrupt_ogg_page",
  "missing_opus_head",
  "invalid_opus_head",
  "non_opus_codec",
  "stereo_not_allowed",
  "duration_exceeded",
  "granule_duration_exceeded",
  "decode_sample_limit_exceeded",
  "decode_failed",
] as const;

export type Stage4B4AudioCanonicalizationFailureCode = (typeof STAGE_4B4_AUDIO_CANONICALIZATION_FAILURE_CODES)[number];

export type Stage4B4CanonicalWavArtifacts = {
  contentSha256: string;
  wavBytes: Buffer;
  durationMs: number;
  sampleRateHz: number;
  audioChannels: number;
  audioCodec: "pcm_s16le";
};

export type Stage4B4AudioCanonicalizationSuccess = {
  ok: true;
  artifacts: Stage4B4CanonicalWavArtifacts;
};

export type Stage4B4AudioCanonicalizationFailure = {
  ok: false;
  failureCode: Stage4B4AudioCanonicalizationFailureCode;
};

export type Stage4B4AudioCanonicalizationResult =
  | Stage4B4AudioCanonicalizationSuccess
  | Stage4B4AudioCanonicalizationFailure;

function safeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}

function isSupportedDeclaredVoiceMime(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES.some((candidate) => normalized === candidate.toLowerCase());
}

export async function canonicalizeOggOpusVoiceBytes(input: {
  bytes: Buffer;
  declaredMimeType: string;
  expectedSha256?: string | null;
  declaredDurationMs?: number | null;
}): Promise<Stage4B4AudioCanonicalizationResult> {
  if (input.bytes.byteLength > STAGE_4B4_MAX_INPUT_BYTES) {
    return { ok: false, failureCode: "stream_too_large" };
  }

  if (!isSupportedDeclaredVoiceMime(input.declaredMimeType)) {
    return { ok: false, failureCode: "unsupported_mime" };
  }

  const detected = await fileTypeFromBuffer(input.bytes);
  const detectedMime = detected?.mime?.toLowerCase() ?? "";
  if (!detectedMime.includes("ogg") && !detectedMime.includes("opus")) {
    return { ok: false, failureCode: "mime_spoof" };
  }

  if (input.expectedSha256) {
    const actualSha256 = hashMediaBytes(input.bytes);
    if (!safeEqualHex(actualSha256, input.expectedSha256)) {
      return { ok: false, failureCode: "hash_mismatch" };
    }
  }

  const preflight = preflightOggOpusVoiceBytes({
    bytes: input.bytes,
    declaredDurationMs: input.declaredDurationMs,
  });
  if (!preflight.ok) {
    return { ok: false, failureCode: preflight.failureCode };
  }

  const decoded = await decodeOggOpusVoiceBytesInWorker(input.bytes);
  if (!decoded.ok) {
    return {
      ok: false,
      failureCode: decoded.failureCode as Stage4B4AudioCanonicalizationFailureCode,
    };
  }

  const wavValidation = validateCanonicalWavArtifacts({
    wavBytes: decoded.wavBytes,
    expectedSampleRateHz: STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
    expectedChannels: STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
  });
  if (!wavValidation.ok) {
    return { ok: false, failureCode: wavValidation.failureCode };
  }

  const contentSha256 = createHash("sha256").update(decoded.wavBytes).digest("hex");

  return {
    ok: true,
    artifacts: {
      contentSha256,
      wavBytes: decoded.wavBytes,
      durationMs: wavValidation.durationMs,
      sampleRateHz: STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
      audioChannels: STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
      audioCodec: "pcm_s16le",
    },
  };
}
