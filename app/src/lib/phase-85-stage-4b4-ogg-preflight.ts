import {
  STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
  STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
  STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS,
} from "./phase-85-stage-4b4-voice-contracts";

export const STAGE_4B4_OGG_PREFLIGHT_VERSION = "p85-stage-4b4-ogg-preflight-v1";
export const STAGE_4B4_OGG_PREFLIGHT_FAILURE_CODES = [
  "corrupt_ogg",
  "corrupt_ogg_page",
  "missing_opus_head",
  "invalid_opus_head",
  "non_opus_codec",
  "stereo_not_allowed",
  "granule_duration_exceeded",
] as const;

export type Stage4B4OggPreflightFailureCode = (typeof STAGE_4B4_OGG_PREFLIGHT_FAILURE_CODES)[number];

export type Stage4B4OggPreflightSuccess = {
  ok: true;
  channelCount: number;
  estimatedDurationMs: number;
  opusSampleRateHz: number;
};

export type Stage4B4OggPreflightFailure = {
  ok: false;
  failureCode: Stage4B4OggPreflightFailureCode;
};

export type Stage4B4OggPreflightResult = Stage4B4OggPreflightSuccess | Stage4B4OggPreflightFailure;

const OGG_MAGIC = Buffer.from("OggS");
const OPUS_HEAD_MAGIC = Buffer.from("OpusHead");
const OPUS_GRANULE_RATE_HZ = 48_000;

function readUInt64LE(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

export function preflightOggOpusVoiceBytes(input: {
  bytes: Buffer;
  declaredDurationMs?: number | null;
}): Stage4B4OggPreflightResult {
  if (input.bytes.byteLength < 27 || !input.bytes.subarray(0, 4).equals(OGG_MAGIC)) {
    return { ok: false, failureCode: "corrupt_ogg" };
  }

  let offset = 0;
  let opusHead: Buffer | null = null;
  let maxGranule = BigInt(0);

  while (offset + 27 <= input.bytes.byteLength) {
    if (!input.bytes.subarray(offset, offset + 4).equals(OGG_MAGIC)) {
      return { ok: false, failureCode: "corrupt_ogg_page" };
    }

    const granulePosition = readUInt64LE(input.bytes, offset + 6);
    if (granulePosition > maxGranule) {
      maxGranule = granulePosition;
    }

    const pageSegments = input.bytes[offset + 26];
    const headerSize = 27 + pageSegments;
    if (offset + headerSize > input.bytes.byteLength) {
      return { ok: false, failureCode: "corrupt_ogg_page" };
    }

    const segmentTableOffset = offset + 27;
    let payloadOffset = segmentTableOffset + pageSegments;
    let segmentIndex = 0;
    while (segmentIndex < pageSegments) {
      let segmentLength = 0;
      let continued = true;
      while (continued && segmentIndex < pageSegments) {
        const segmentSize = input.bytes[segmentTableOffset + segmentIndex];
        segmentLength += segmentSize;
        continued = segmentSize === 255;
        segmentIndex += 1;
      }

      if (payloadOffset + segmentLength > input.bytes.byteLength) {
        return { ok: false, failureCode: "corrupt_ogg_page" };
      }

      const packet = input.bytes.subarray(payloadOffset, payloadOffset + segmentLength);
      if (packet.subarray(0, 8).equals(OPUS_HEAD_MAGIC)) {
        opusHead = packet;
      }

      payloadOffset += segmentLength;
    }

    offset = payloadOffset;
    if (offset >= input.bytes.byteLength) {
      break;
    }
  }

  if (!opusHead || opusHead.byteLength < 19) {
    return { ok: false, failureCode: "missing_opus_head" };
  }

  if (opusHead[8] !== 1) {
    return { ok: false, failureCode: "invalid_opus_head" };
  }

  const channelCount = opusHead[9];
  if (channelCount !== STAGE_4B4_CANONICAL_AUDIO_CHANNELS) {
    return { ok: false, failureCode: "stereo_not_allowed" };
  }

  const preSkip = opusHead[10];
  const opusSampleRateHz = opusHead.readUInt32LE(11);
  if (preSkip > 312 || opusSampleRateHz <= 0) {
    return { ok: false, failureCode: "invalid_opus_head" };
  }

  const estimatedDurationMs =
    maxGranule > BigInt(0)
      ? Number((maxGranule * BigInt(1000)) / BigInt(OPUS_GRANULE_RATE_HZ))
      : input.declaredDurationMs ?? 0;

  if (estimatedDurationMs > STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS) {
    return { ok: false, failureCode: "granule_duration_exceeded" };
  }
  if (
    input.declaredDurationMs !== null &&
    input.declaredDurationMs !== undefined &&
    input.declaredDurationMs > STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS
  ) {
    return { ok: false, failureCode: "granule_duration_exceeded" };
  }

  return {
    ok: true,
    channelCount,
    estimatedDurationMs,
    opusSampleRateHz,
  };
}

export function validateCanonicalWavArtifacts(input: {
  wavBytes: Buffer;
  expectedSampleRateHz?: number;
  expectedChannels?: number;
}): { ok: true; durationMs: number; sampleCount: number } | { ok: false; failureCode: "decode_failed" | "duration_exceeded" } {
  if (input.wavBytes.byteLength < 44 || input.wavBytes.toString("ascii", 0, 4) !== "RIFF") {
    return { ok: false, failureCode: "decode_failed" };
  }

  const channels = input.wavBytes.readUInt16LE(22);
  const sampleRateHz = input.wavBytes.readUInt32LE(24);
  const bitsPerSample = input.wavBytes.readUInt16LE(34);
  const dataSize = input.wavBytes.readUInt32LE(40);
  const expectedSampleRateHz = input.expectedSampleRateHz ?? STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ;
  const expectedChannels = input.expectedChannels ?? STAGE_4B4_CANONICAL_AUDIO_CHANNELS;

  if (
    channels !== expectedChannels ||
    sampleRateHz !== expectedSampleRateHz ||
    bitsPerSample !== 16 ||
    44 + dataSize !== input.wavBytes.byteLength
  ) {
    return { ok: false, failureCode: "decode_failed" };
  }

  const sampleCount = dataSize / 2 / channels;
  const durationMs = Math.round((sampleCount / sampleRateHz) * 1000);
  if (durationMs > STAGE_4B4_MAX_VOICE_NOTE_DURATION_MS) {
    return { ok: false, failureCode: "duration_exceeded" };
  }

  return { ok: true, durationMs, sampleCount };
}
