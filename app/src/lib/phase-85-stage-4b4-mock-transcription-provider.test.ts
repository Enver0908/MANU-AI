import { describe, expect, it } from "vitest";
import { STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG } from "./phase-85-stage-4b4-provider-gate";
import { createStage4B4MockTranscriptionProvider } from "./phase-85-stage-4b4-mock-transcription-provider";
import {
  createStage4B4TranscriptionFixtureManifest,
  registerStage4B4TranscriptionFixtureHash,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { parseAudioTranscriptionObservationV1 } from "./phase-85-stage-4b4-voice-contracts";

const TEST_ENV = {
  NODE_ENV: "test",
  [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
} as NodeJS.ProcessEnv;

describe("phase 85 stage 4b-4 mock transcription provider", () => {
  it("returns deterministic observations for known canonical hashes without egress", async () => {
    let egressCount = 0;
    const manifest = registerStage4B4TranscriptionFixtureHash(
      createStage4B4TranscriptionFixtureManifest(),
      "a".repeat(64),
      "meal_update_tr",
    );
    const provider = createStage4B4MockTranscriptionProvider({
      env: TEST_ENV,
      manifest,
      onTranscribe: () => {
        egressCount += 1;
      },
    });

    const first = await provider.transcribe({
      requestId: "req-1",
      contentSha256: "a".repeat(64),
      locale: "tr-TR",
      wavBytes: Buffer.from("RIFF"),
    });
    const second = await provider.transcribe({
      requestId: "req-2",
      contentSha256: "a".repeat(64),
      locale: "tr-TR",
      wavBytes: Buffer.from("RIFF"),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected provider success");
    }
    expect(parseAudioTranscriptionObservationV1(first.observation)).toEqual(
      parseAudioTranscriptionObservationV1(second.observation),
    );
    expect(egressCount).toBe(2);
  });

  it("fails closed for unknown hashes and malformed outputs", async () => {
    const provider = createStage4B4MockTranscriptionProvider({ env: TEST_ENV });
    const unknown = await provider.transcribe({
      requestId: "req-unknown",
      contentSha256: "b".repeat(64),
      locale: "tr-TR",
      wavBytes: Buffer.from("RIFF"),
    });
    expect(unknown.ok).toBe(false);
    if (unknown.ok) {
      throw new Error("expected unknown_fixture");
    }
    expect(unknown.failureCode).toBe("unknown_fixture");
    expect(unknown.retryable).toBe(false);

    const manifest = registerStage4B4TranscriptionFixtureHash(
      createStage4B4TranscriptionFixtureManifest(),
      "c".repeat(64),
      "meal_update_tr",
    );
    const invalid = createStage4B4MockTranscriptionProvider({
      env: TEST_ENV,
      manifest,
      invalidOutput: true,
    });
    const malformed = await invalid.transcribe({
      requestId: "req-invalid",
      contentSha256: "c".repeat(64),
      locale: "tr-TR",
      wavBytes: Buffer.from("RIFF"),
    });
    expect(malformed.ok).toBe(true);
  });

  it("marks provider timeouts as retryable", async () => {
    const manifest = registerStage4B4TranscriptionFixtureHash(
      createStage4B4TranscriptionFixtureManifest(),
      "d".repeat(64),
      "meal_update_tr",
    );
    const provider = createStage4B4MockTranscriptionProvider({
      env: TEST_ENV,
      manifest,
      simulateTimeout: true,
    });
    const result = await provider.transcribe({
      requestId: "req-timeout",
      contentSha256: "d".repeat(64),
      locale: "tr-TR",
      wavBytes: Buffer.from("RIFF"),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected timeout");
    }
    expect(result.failureCode).toBe("provider_timeout");
    expect(result.retryable).toBe(true);
  });
});
