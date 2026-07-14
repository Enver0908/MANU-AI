import { createHash, timingSafeEqual } from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import { OggOpusDecoder } from "ogg-opus-decoder";
import { resample } from "wave-resampler";
import { WaveFile } from "wavefile";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";
import {
  STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
  STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
  STAGE_4B4_MAX_INPUT_BYTES,
  STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS,
  STAGE_4B4_SUPPORTED_VOICE_MIME_TYPES,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_AUDIO_CANONICALIZER_VERSION = "p85-stage-4b4-audio-canonicalizer-v1";
export const STAGE_4B4_MAX_DECODE_SAMPLES = STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ * 300;

export const STAGE_4B4_AUDIO_CANONICALIZATION_FAILURE_CODES = [
  "stream_too_large",
  "unsupported_mime",
  "mime_spoof",
  "hash_mismatch",
  "corrupt_ogg",
  "non_opus_codec",
  "stereo_not_allowed",
  "duration_exceeded",
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

function floatToPcm16(samples: Float32Array | number[]): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index];
    pcm[index] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
  }
  return pcm;
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

  const decoder = new OggOpusDecoder();
  try {
    await decoder.ready;
    const decoded = await decoder.decode(input.bytes);
    if (!decoded || decoded.channelData.length === 0 || decoded.samplesDecoded <= 0) {
      return { ok: false, failureCode: "corrupt_ogg" };
    }
    if (decoded.channelData.length !== 1) {
      return { ok: false, failureCode: "stereo_not_allowed" };
    }

    const durationMs = Math.round((decoded.samplesDecoded / decoded.sampleRate) * 1000);
    if (input.declaredDurationMs !== null && input.declaredDurationMs !== undefined && durationMs > STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS) {
      return { ok: false, failureCode: "duration_exceeded" };
    }
    if (durationMs > STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS) {
      return { ok: false, failureCode: "duration_exceeded" };
    }

    const mono = decoded.channelData[0];
    const sourceSampleRate = Number(decoded.sampleRate);
    const resampled =
      sourceSampleRate === STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ
        ? mono
        : resample(mono, sourceSampleRate, STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ);

    if (resampled.length > STAGE_4B4_MAX_DECODE_SAMPLES) {
      return { ok: false, failureCode: "decode_sample_limit_exceeded" };
    }

    const wav = new WaveFile();
    wav.fromScratch(1, STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ, "16", floatToPcm16(Float32Array.from(resampled)));
    const wavBytes = Buffer.from(wav.toBuffer());
    const contentSha256 = createHash("sha256").update(wavBytes).digest("hex");

    return {
      ok: true,
      artifacts: {
        contentSha256,
        wavBytes,
        durationMs,
        sampleRateHz: STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
        audioChannels: STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
        audioCodec: "pcm_s16le",
      },
    };
  } catch {
    return { ok: false, failureCode: "decode_failed" };
  } finally {
    decoder.free();
  }
}
