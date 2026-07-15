import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { preflightOggOpusVoiceBytes } from "./phase-85-stage-4b4-ogg-preflight";
import { STAGE_4B4_MAX_INPUT_BYTES } from "./phase-85-stage-4b4-voice-contracts";

const goldenBytes = readFileSync(resolve(__dirname, "fixtures", "stage-4b4-golden-voice-note.ogg"));
const stereoBytes = readFileSync(resolve(__dirname, "fixtures", "stage-4b4-stereo-voice-note.ogg"));

describe("phase 85 stage 4b-4 ogg preflight", () => {
  it("accepts the golden mono fixture before worker decode", () => {
    const result = preflightOggOpusVoiceBytes({ bytes: goldenBytes, declaredDurationMs: 3_000 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected preflight success");
    }
    expect(result.channelCount).toBe(1);
    expect(result.estimatedDurationMs).toBeGreaterThan(0);
  });

  it("rejects stereo and oversized streams before decode", () => {
    const stereo = preflightOggOpusVoiceBytes({ bytes: stereoBytes });
    expect(stereo.ok).toBe(false);
    if (stereo.ok) {
      throw new Error("expected stereo rejection");
    }
    expect(stereo.failureCode).toBe("stereo_not_allowed");

    const oversized = preflightOggOpusVoiceBytes({
      bytes: Buffer.alloc(STAGE_4B4_MAX_INPUT_BYTES + 1),
    });
    expect(oversized.ok).toBe(false);
    if (oversized.ok) {
      throw new Error("expected stream_too_large");
    }
    expect(oversized.failureCode).toBe("corrupt_ogg");
  });
});
