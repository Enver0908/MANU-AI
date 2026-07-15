import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";
import { canonicalizeOggOpusVoiceBytes } from "./phase-85-stage-4b4-audio-canonicalizer";
import {
  STAGE_4B4_CANONICAL_AUDIO_CHANNELS,
  STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ,
  STAGE_4B4_MAX_INPUT_BYTES,
} from "./phase-85-stage-4b4-voice-contracts";

const goldenBytes = readFileSync(resolve(__dirname, "fixtures", "stage-4b4-golden-voice-note.ogg"));
const stereoBytes = readFileSync(resolve(__dirname, "fixtures", "stage-4b4-stereo-voice-note.ogg"));

describe("phase 85 stage 4b-4 audio canonicalizer", () => {
  it("canonicalizes the golden mono OGG voice note to 16 kHz mono PCM16 WAV", async () => {
    const sha256 = hashMediaBytes(goldenBytes);
    const result = await canonicalizeOggOpusVoiceBytes({
      bytes: goldenBytes,
      declaredMimeType: "audio/ogg; codecs=opus",
      expectedSha256: sha256,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`expected canonicalization success, got ${result.failureCode}`);
    }
    expect(result.artifacts.sampleRateHz).toBe(STAGE_4B4_CANONICAL_SAMPLE_RATE_HZ);
    expect(result.artifacts.audioChannels).toBe(STAGE_4B4_CANONICAL_AUDIO_CHANNELS);
    expect(result.artifacts.audioCodec).toBe("pcm_s16le");
    expect(result.artifacts.wavBytes.byteLength).toBeGreaterThan(44);
    expect(result.artifacts.durationMs).toBeGreaterThan(0);
  });

  it("rejects stereo OGG voice notes", async () => {
    const result = await canonicalizeOggOpusVoiceBytes({
      bytes: stereoBytes,
      declaredMimeType: "audio/ogg; codecs=opus",
      expectedSha256: hashMediaBytes(stereoBytes),
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected stereo rejection");
    }
    expect(result.failureCode).toBe("stereo_not_allowed");
  });

  it("rejects hash mismatches and oversized streams", async () => {
    const hashMismatch = await canonicalizeOggOpusVoiceBytes({
      bytes: goldenBytes,
      declaredMimeType: "audio/ogg; codecs=opus",
      expectedSha256: "0".repeat(64),
    });
    expect(hashMismatch.ok).toBe(false);
    if (hashMismatch.ok) {
      throw new Error("expected hash mismatch");
    }
    expect(hashMismatch.failureCode).toBe("hash_mismatch");

    const oversized = await canonicalizeOggOpusVoiceBytes({
      bytes: Buffer.alloc(STAGE_4B4_MAX_INPUT_BYTES + 1),
      declaredMimeType: "audio/ogg; codecs=opus",
    });
    expect(oversized.ok).toBe(false);
    if (oversized.ok) {
      throw new Error("expected stream_too_large");
    }
    expect(oversized.failureCode).toBe("stream_too_large");
  });

  it("rejects unsupported declared mime types", async () => {
    const result = await canonicalizeOggOpusVoiceBytes({
      bytes: goldenBytes,
      declaredMimeType: "audio/mpeg",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected unsupported_mime");
    }
    expect(result.failureCode).toBe("unsupported_mime");
  });
});
