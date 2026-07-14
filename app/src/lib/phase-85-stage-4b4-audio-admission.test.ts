import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  buildCanonicalWhatsAppVoicePayload,
  createStage4B3LocalAdmissionRuntime,
  processCanonicalWhatsAppIngressInState,
  registerStage4B4FixtureMediaAsset,
  runStage4B3LocalWorkerTick,
} from "./phase-85-stage-4b3-canonical-ingress";
import { STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY } from "./phase-85-stage-4b4-voice-contracts";
import { createInMemoryStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";

const TEST_SECRET = "synthetic-stage4b4-audio-secret";

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
  } as NodeJS.ProcessEnv;
}

describe("phase 85 stage 4b-4 audio admission", () => {
  it("stages voice ingress metadata without immediate decode when autoProcessAudioPending is false", async () => {
    const fixture = registerStage4B4FixtureMediaAsset({ fixtureId: "golden_voice_note" });
    const audioStorage = createInMemoryStage4B4AudioStorage();
    const ingress = await processCanonicalWhatsAppIngressInState(
      createInitialState(),
      buildCanonicalWhatsAppVoicePayload({
        providerEventId: "wamid.AUDIO_STAGE_1",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: fixture.contentSha256,
        durationMs: 3_000,
      }),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: createStage4B3LocalAdmissionRuntime({
          autoProcessAudioPending: false,
          autoProcessPending: false,
          autoProcessVision: false,
          autoProcessBundles: false,
          audioStorage,
        }),
      },
    );

    expect(ingress.result.status).toBe("processed");
    expect(ingress.state.mediaAssets).toHaveLength(1);
    expect(ingress.state.mediaAssets.find((entry) => entry.mediaKind === "audio")?.status).toBe("download_pending");
    expect(ingress.state.mediaAssets.find((entry) => entry.mediaKind === "audio")?.mediaKind).toBe("audio");
    expect(
      ingress.state.messages.find((message) => message.providerEventId === "wamid.AUDIO_STAGE_1")?.body,
    ).toBe(STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY);
    expect(ingress.state.audioTranscriptionRecords).toHaveLength(0);
    expect(audioStorage.objects.size).toBe(0);
  });

  it("admits golden voice notes through the worker tick and opens a pending transcription row", async () => {
    const fixture = registerStage4B4FixtureMediaAsset({
      fixtureId: "golden_voice_note",
      mediaId: "MOCK_AUDIO_GOLDEN_VOICE_NOTE",
    });
    const audioStorage = createInMemoryStage4B4AudioStorage();
    const admission = createStage4B3LocalAdmissionRuntime({
      autoProcessAudioPending: false,
      autoProcessPending: false,
      autoProcessVision: false,
      autoProcessBundles: false,
      audioStorage,
    });
    const ingress = await processCanonicalWhatsAppIngressInState(
      createInitialState(),
      buildCanonicalWhatsAppVoicePayload({
        providerEventId: "wamid.AUDIO_WORKER_1",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: fixture.contentSha256,
        durationMs: 3_000,
      }),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admission,
        now: "2026-07-14T12:00:00.000Z",
      },
    );

    const workerState = await runStage4B3LocalWorkerTick(ingress.state, {
      admission,
      now: "2026-07-14T12:01:00.000Z",
      runOrchestration: false,
    });

    const asset = workerState.mediaAssets.find((entry) => entry.mediaKind === "audio");
    expect(asset?.status).toBe("analysis_pending");
    expect(asset?.detectedMimeType).toBe("audio/wav");
    expect(asset?.sampleRateHz).toBe(16_000);
    expect(asset?.audioChannels).toBe(1);
    expect(asset?.sanitizedAudioObjectKey).toContain("voice.wav");
    expect(workerState.audioTranscriptionRecords).toHaveLength(1);
    expect(workerState.audioTranscriptionRecords[0]?.status).toBe("pending");
    expect(asset?.transcriptionId).toBe(workerState.audioTranscriptionRecords[0]?.id);
    expect(audioStorage.objects.size).toBe(1);
  });

  it("fails stereo voice notes during worker admission", async () => {
    const fixture = registerStage4B4FixtureMediaAsset({
      fixtureId: "stereo_voice_note",
      mediaId: "MOCK_AUDIO_STEREO_VOICE_NOTE",
    });
    const audioStorage = createInMemoryStage4B4AudioStorage();
    const admission = createStage4B3LocalAdmissionRuntime({
      autoProcessAudioPending: false,
      autoProcessPending: false,
      autoProcessVision: false,
      autoProcessBundles: false,
      audioStorage,
    });
    const ingress = await processCanonicalWhatsAppIngressInState(
      createInitialState(),
      buildCanonicalWhatsAppVoicePayload({
        providerEventId: "wamid.AUDIO_STEREO_1",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: fixture.contentSha256,
        durationMs: 3_000,
      }),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admission,
      },
    );

    const workerState = await runStage4B3LocalWorkerTick(ingress.state, {
      admission,
      runOrchestration: false,
    });

    const asset = workerState.mediaAssets.find((entry) => entry.mediaKind === "audio");
    expect(asset?.status).toBe("failed");
    expect(asset?.failureCode).toBe("stereo_not_allowed");
    expect(
      workerState.messages.find((message) => message.providerEventId === "wamid.AUDIO_STEREO_1")?.contentStatus,
    ).toBe("content_unavailable");
    expect(workerState.audioTranscriptionRecords).toHaveLength(0);
  });
});
