import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  buildCanonicalWhatsAppVoicePayload,
  createStage4B3LocalAdmissionRuntime,
  processCanonicalWhatsAppIngressInState,
  registerStage4B4FixtureMediaAsset,
  runStage4B3LocalWorkerTick,
} from "./phase-85-stage-4b3-canonical-ingress";
import { STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG } from "./phase-85-stage-4b4-provider-gate";
import { createStage4B4MockTranscriptionProvider } from "./phase-85-stage-4b4-mock-transcription-provider";
import { createInMemoryStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import {
  createStage4B4TranscriptionFixtureManifest,
  registerStage4B4TranscriptionFixtureHash,
  type Stage4B4TranscriptionFixtureSceneId,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { processStage4B4PendingTranscriptions } from "./phase-85-stage-4b4-transcription-worker";

const TEST_SECRET = "synthetic-stage4b4-transcription-secret";

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
  } as NodeJS.ProcessEnv;
}

async function admitGoldenVoice(sceneId: Stage4B4TranscriptionFixtureSceneId = "meal_update_tr") {
  const fixture = registerStage4B4FixtureMediaAsset({
    fixtureId: "golden_voice_note",
    mediaId: "MOCK_AUDIO_GOLDEN_VOICE_NOTE",
  });
  const audioStorage = createInMemoryStage4B4AudioStorage();
  let manifest = createStage4B4TranscriptionFixtureManifest();
  const admission = createStage4B3LocalAdmissionRuntime({
    autoProcessAudioPending: false,
    autoProcessTranscription: false,
    autoProcessPending: false,
    autoProcessVision: false,
    autoProcessBundles: false,
    audioStorage,
    transcriptionProvider: createStage4B4MockTranscriptionProvider({ env: testEnv(), manifest }),
  });
  const ingress = await processCanonicalWhatsAppIngressInState(
    createInitialState(),
    buildCanonicalWhatsAppVoicePayload({
      providerEventId: `wamid.TRANSCRIBE_${sceneId}`,
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

  const admitted = await runStage4B3LocalWorkerTick(ingress.state, {
    admission,
    now: "2026-07-14T12:01:00.000Z",
    env: testEnv(),
    runOrchestration: false,
  });

  const asset = admitted.mediaAssets.find((entry) => entry.mediaKind === "audio");
  if (!asset?.contentSha256) {
    throw new Error("expected admitted audio asset");
  }

  manifest = registerStage4B4TranscriptionFixtureHash(manifest, asset.contentSha256, sceneId);
  const transcriptionProvider = createStage4B4MockTranscriptionProvider({ env: testEnv(), manifest });
  const admissionWithManifest = {
    ...admission,
    transcriptionProvider,
  };

  return {
    fixture,
    audioStorage,
    admission: admissionWithManifest,
    state: admitted,
    asset,
  };
}

describe("phase 85 stage 4b-4 transcription worker", () => {
  it("accepts known fixtures and marks media assets analysis_ready", async () => {
    const { state, admission, asset } = await admitGoldenVoice("meal_update_tr");
    const transcribed = await processStage4B4PendingTranscriptions(state, {
      env: testEnv(),
      provider: admission.transcriptionProvider!,
      storage: admission.audioStorage!,
      now: "2026-07-14T12:02:00.000Z",
    });

    const record = transcribed.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
    const updatedAsset = transcribed.mediaAssets.find((entry) => entry.id === asset.id);
    expect(record?.status).toBe("accepted");
    expect(record?.qualityDecision?.accepted).toBe(true);
    expect(updatedAsset?.status).toBe("analysis_ready");
    expect(record?.observation?.transcriptText).toContain("mercimek corbasi");
  });

  it("routes low-confidence transcripts to review_required without marking the asset ready", async () => {
    const { state, admission, asset } = await admitGoldenVoice("low_confidence_tr");
    const transcribed = await processStage4B4PendingTranscriptions(state, {
      env: testEnv(),
      provider: admission.transcriptionProvider!,
      storage: admission.audioStorage!,
    });

    const record = transcribed.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
    const updatedAsset = transcribed.mediaAssets.find((entry) => entry.id === asset.id);
    expect(record?.status).toBe("review_required");
    expect(record?.qualityDecision?.accepted).toBe(false);
    expect(record?.rejectionReasons).toContain("overall_confidence_low");
    expect(updatedAsset?.status).toBe("analysis_pending");
  });

  it("fails closed to review_required when the canonical hash is unknown to the mock manifest", async () => {
    const { state, admission, asset } = await admitGoldenVoice("meal_update_tr");
    const unknownProvider = createStage4B4MockTranscriptionProvider({ env: testEnv() });
    const transcribed = await processStage4B4PendingTranscriptions(state, {
      env: testEnv(),
      provider: unknownProvider,
      storage: admission.audioStorage!,
      now: "2026-07-14T12:03:00.000Z",
    });

    const record = transcribed.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
    expect(record?.status).toBe("review_required");
    expect(record?.rejectionReasons).toContain("unknown_fixture");
  });

  it("terminalizes pending transcriptions as review_required when the mock gate is disabled", async () => {
    const { state, admission, asset } = await admitGoldenVoice("meal_update_tr");
    const disabledEnv = {
      NODE_ENV: "test",
      [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "false",
    } as NodeJS.ProcessEnv;
    const transcribed = await processStage4B4PendingTranscriptions(state, {
      env: disabledEnv,
      provider: admission.transcriptionProvider!,
      storage: admission.audioStorage!,
    });

    const record = transcribed.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
    expect(record?.status).toBe("review_required");
    expect(record?.rejectionReasons).toContain("provider_disabled");
    expect(transcribed.mediaAssets.find((entry) => entry.id === asset.id)?.status).toBe("analysis_pending");
  });
});
