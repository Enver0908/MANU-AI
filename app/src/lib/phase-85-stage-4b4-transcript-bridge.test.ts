import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildMultimodalMessageEnvelope } from "./phase-85-stage-4b3-multimodal-envelope";
import {
  promoteDueInboundBundles,
} from "./phase-85-stage-4b3-message-bundles";
import {
  buildCanonicalWhatsAppTextPayload,
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
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import {
  applyAcceptedTranscriptionBridge,
  buildTranscriptBridgeIdempotencyKey,
  evaluateInboundBundleDerivationReadiness,
  isBundleVoiceTranscriptionDeadlineExceeded,
  isVoiceMessageBridged,
  processStage4B4AcceptedTranscriptionBridges,
  resolveBundleVoiceTranscriptionDeadline,
} from "./phase-85-stage-4b4-transcript-bridge";
import { processStage4B4PendingTranscriptions } from "./phase-85-stage-4b4-transcription-worker";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
import { STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY } from "./phase-85-stage-4b4-voice-contracts";
import type { ManuAppState } from "./types";

function findConversationBundle(state: ManuAppState, conversationId: string) {
  return state.inboundMessageBundles.find(
    (bundle) => bundle.tenantId === state.tenant.id && bundle.conversationId === conversationId,
  );
}

const TEST_SECRET = "synthetic-stage4b4-bridge-secret";
const T0 = "2026-07-14T12:00:00.000Z";
const T119 = "2026-07-14T12:01:59.000Z";
const T120 = "2026-07-14T12:02:00.000Z";
const T240 = "2026-07-14T12:04:00.000Z";
const SEED_AI_DECISION_COUNT = 1;

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
  } as NodeJS.ProcessEnv;
}

async function admitAndTranscribeVoice(sceneId: "meal_update_tr" | "low_confidence_tr" = "meal_update_tr") {
  const fixture = registerStage4B4FixtureMediaAsset({
    fixtureId: "golden_voice_note",
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
      providerEventId: `wamid.BRIDGE_${sceneId}`,
      from: "905551110001",
      mediaId: fixture.mediaId,
      sha256: fixture.contentSha256,
      durationMs: 3_000,
    }),
    {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: admission,
      now: T0,
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

  const transcribed = await processStage4B4PendingTranscriptions(admitted, {
    env: testEnv(),
    provider: transcriptionProvider,
    storage: audioStorage,
    now: "2026-07-14T12:02:00.000Z",
  });

  return {
    fixture,
    admission: admissionWithManifest,
    state: transcribed,
    asset,
    conversationId: transcribed.conversations[0]!.id,
  };
}

describe("phase-85-stage-4b4-transcript-bridge", () => {
  it("bridges accepted transcripts into message body and bundle item transcription id", async () => {
    const { state, asset } = await admitAndTranscribeVoice("meal_update_tr");
    const message = state.messages.find((entry) => entry.id === asset.messageId);
    const bundleItem = state.inboundMessageBundleItems.find((entry) => entry.mediaAssetId === asset.id);

    expect(message?.body).toContain("mercimek corbasi");
    expect(message?.body).not.toBe(STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY);
    expect(message?.retrievalEligibility).toBe("eligible");
    expect(bundleItem?.transcriptionId).toBeTruthy();
    expect(isVoiceMessageBridged(message!)).toBe(true);
  });

  it("keeps duplicate bridge execution idempotent", async () => {
    const { state, asset } = await admitAndTranscribeVoice("meal_update_tr");
    const record = state.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
    if (!record) {
      throw new Error("expected transcription record");
    }

    const replay = applyAcceptedTranscriptionBridge(state, record.id, T120);
    expect(replay).toEqual(state);
    expect(replay.processedTranscriptBridgeKeys).toHaveLength(1);
  });

  it("does not promote a due bundle while voice transcription is still pending", async () => {
    const fixture = registerStage4B4FixtureMediaAsset({
      fixtureId: "golden_voice_note",
    });
    const audioStorage = createInMemoryStage4B4AudioStorage();
    const admission = createStage4B3LocalAdmissionRuntime({
      autoProcessAudioPending: false,
      autoProcessTranscription: false,
      autoProcessBundles: false,
      audioStorage,
    });

    const ingress = await processCanonicalWhatsAppIngressInState(
      createInitialState(),
      buildCanonicalWhatsAppVoicePayload({
        providerEventId: "wamid.BRIDGE_PENDING",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: fixture.contentSha256,
        durationMs: 3_000,
      }),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admission,
        now: T0,
      },
    );

    const conversationId = ingress.state.conversations[0]!.id;
    const bundle = findConversationBundle(ingress.state, conversationId);
    const voiceAsset = ingress.state.mediaAssets.find((entry) => entry.mediaKind === "audio");
    expect(bundle?.status).toBe("open");
    expect(voiceAsset?.status).toBe("download_pending");
    expect(evaluateInboundBundleDerivationReadiness(ingress.state, bundle!).status).toBe("pending");

    const promoted = promoteDueInboundBundles(ingress.state, T119);
    const stillOpen = findConversationBundle(promoted, conversationId);
    expect(stillOpen?.status).toBe("open");
    expect(evaluateInboundBundleDerivationReadiness(promoted, stillOpen!).status).toBe("pending");
  });

  it("promotes and bridges voice+text bundles after silence and accepted transcription", async () => {
    const { state, admission } = await admitAndTranscribeVoice("meal_update_tr");

    const withText = await processCanonicalWhatsAppIngressInState(
      state,
      buildCanonicalWhatsAppTextPayload({
        providerEventId: "wamid.BRIDGE_TEXT",
        from: "905551110001",
        body: "Bunu yedim",
      }),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admission,
        now: T119,
      },
    );

    expect(withText.state.inboundMessageBundleItems).toHaveLength(2);
    expect(withText.state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);

    const worker = await processStage4B3DueInboundBundles(withText.state, {
      workerId: "bridge-test-worker",
      now: T240,
      finalizeClaims: false,
      runOrchestration: false,
    });
    expect(worker.claimedBundles).toHaveLength(1);
    const bundle = worker.state.inboundMessageBundles.find((entry) => entry.id === worker.claimedBundles[0]?.id);
    expect(bundle?.status).toBe("processing");

    const envelope = buildMultimodalMessageEnvelope(worker.state, bundle!.id);
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.envelope.textSegments).toHaveLength(2);
      expect(envelope.envelope.textSegments.some((segment) => segment.body.includes("mercimek corbasi"))).toBe(true);
      expect(envelope.envelope.textSegments.some((segment) => segment.body.includes("Bunu yedim"))).toBe(true);
    }
  });

  it("moves bundle to review_required when transcription quality fails", async () => {
    const { state, conversationId } = await admitAndTranscribeVoice("low_confidence_tr");
    const bundle = state.inboundMessageBundles.find((entry) => entry.conversationId === conversationId);
    expect(bundle?.status).toBe("review_required");
    expect(bundle?.failureCode).toBe("overall_confidence_low");

    const message = state.messages.find((entry) => entry.body.includes("mercimek"));
    expect(message).toBeUndefined();
    expect(state.messages.some((entry) => entry.body === STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY)).toBe(true);
  });

  it("builds stable bridge idempotency keys with transcription revision", () => {
    const key = buildTranscriptBridgeIdempotencyKey({
      conversationId: "conversation-1",
      mediaAssetId: "asset-1",
      transcriptionId: "transcription-1",
      transcriptionRevision: 1,
      bundleId: "bundle-1",
    });
    expect(key).toBe("voice-bridge:conversation-1:bundle-1:asset-1:transcription-1:1");
  });

  it("does not overwrite a non-placeholder voice message body during bridge", async () => {
    const { state, asset } = await admitAndTranscribeVoice("meal_update_tr");
    const record = state.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
    if (!record) {
      throw new Error("expected transcription record");
    }

    const manualBody = "Diyetisyen tarafindan onceden yazilmis metin";
    const withManualBody = {
      ...state,
      processedTranscriptBridgeKeys: [],
      messages: state.messages.map((message) =>
        message.id === asset.messageId ? { ...message, body: manualBody } : message,
      ),
    };

    const bridged = applyAcceptedTranscriptionBridge(withManualBody, record.id, T120);
    const message = bridged.messages.find((entry) => entry.id === asset.messageId);
    expect(message?.body).toBe(manualBody);
    expect(bridged.inboundMessageBundleItems.find((entry) => entry.mediaAssetId === asset.id)?.transcriptionId).toBe(
      record.id,
    );
  });

  it("closes pending voice bundles to review_required after the 120s transcription deadline", async () => {
    const fixture = registerStage4B4FixtureMediaAsset({
      fixtureId: "golden_voice_note",
    });
    const audioStorage = createInMemoryStage4B4AudioStorage();
    const admission = createStage4B3LocalAdmissionRuntime({
      autoProcessAudioPending: false,
      autoProcessTranscription: false,
      autoProcessBundles: false,
      audioStorage,
    });

    const ingress = await processCanonicalWhatsAppIngressInState(
      createInitialState(),
      buildCanonicalWhatsAppVoicePayload({
        providerEventId: "wamid.BRIDGE_TIMEOUT",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: fixture.contentSha256,
        durationMs: 3_000,
      }),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admission,
        now: T0,
      },
    );

    const conversationId = ingress.state.conversations[0]!.id;
    const bundle = findConversationBundle(ingress.state, conversationId);
    if (!bundle) {
      throw new Error("expected bundle");
    }

    const deadline = resolveBundleVoiceTranscriptionDeadline(ingress.state, bundle.id);
    expect(deadline).toBe("2026-07-14T12:02:00.000Z");
    expect(isBundleVoiceTranscriptionDeadlineExceeded(ingress.state, bundle.id, T119)).toBe(false);
    expect(isBundleVoiceTranscriptionDeadlineExceeded(ingress.state, bundle.id, T120)).toBe(true);

    const promoted = promoteDueInboundBundles(ingress.state, T240);
    const timedOut = findConversationBundle(promoted, conversationId);
    expect(timedOut?.status).toBe("review_required");
    expect(timedOut?.failureCode).toBe("transcription_timeout");
  });

  it("reports derivation readiness for accepted bridged voice", async () => {
    const { state, conversationId } = await admitAndTranscribeVoice("meal_update_tr");
    const bundle = state.inboundMessageBundles.find((entry) => entry.conversationId === conversationId);
    if (!bundle) {
      throw new Error("expected bundle");
    }
    expect(evaluateInboundBundleDerivationReadiness(state, bundle).status).toBe("ready");
  });

  it("processes all accepted bridges in one pass", async () => {
    const { state } = await admitAndTranscribeVoice("meal_update_tr");
    const clearedKeys = {
      ...state,
      processedTranscriptBridgeKeys: [],
      messages: state.messages.map((message) =>
        message.body.includes("mercimek")
          ? { ...message, body: STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY, retrievalEligibility: "excluded_voice_pending" }
          : message,
      ),
    };
    const bridged = processStage4B4AcceptedTranscriptionBridges(clearedKeys, T120);
    expect(bridged.messages.some((message) => message.body.includes("mercimek corbasi"))).toBe(true);
    expect(bridged.processedTranscriptBridgeKeys).toHaveLength(1);
  });
});
