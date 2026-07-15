import { describe, expect, it } from "vitest";
import { DEMO_DIETITIAN_ID } from "./seed-data";
import { runMultimodalBundleInboundTurn } from "./phase-85-stage-4b3-bundle-orchestration";
import { promoteDueInboundBundles } from "./phase-85-stage-4b3-message-bundles";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
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
  STAGE_4B4_TRANSCRIPTION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { processStage4B4PendingTranscriptions } from "./phase-85-stage-4b4-transcription-worker";
import { submitTranscriptCorrection } from "./phase-85-stage-4b4-transcript-corrections";
import { createInitialState } from "./seed-data";
import type { ManuAppState } from "./types";

const TEST_SECRET = "synthetic-stage4b4-correction-secret";
const T0 = "2026-07-14T12:00:00.000Z";
const T120 = "2026-07-14T12:02:00.000Z";
const T240 = "2026-07-14T12:04:00.000Z";

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
  } as NodeJS.ProcessEnv;
}

async function admitAndTranscribeVoice() {
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
      providerEventId: "wamid.CORR_VOICE_1",
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

  manifest = registerStage4B4TranscriptionFixtureHash(manifest, asset.contentSha256, "meal_update_tr");
  const transcribed = await processStage4B4PendingTranscriptions(admitted, {
    env: testEnv(),
    provider: createStage4B4MockTranscriptionProvider({ env: testEnv(), manifest }),
    storage: audioStorage,
    now: "2026-07-14T12:01:30.000Z",
  });

  const transcription = transcribed.audioTranscriptionRecords.find((entry) => entry.mediaAssetId === asset.id);
  if (!transcription) {
    throw new Error("expected transcription record");
  }

  return { state: transcribed, asset, transcription, conversationId: transcribed.conversations[0]!.id };
}

async function prepareVoiceBundleForOrchestration(state: ManuAppState) {
  const promoted = promoteDueInboundBundles(state, T120);
  const worker = await processStage4B3DueInboundBundles(promoted, {
    workerId: "corr-test-worker",
    now: T240,
    finalizeClaims: false,
    runOrchestration: false,
  });
  const bundleId = worker.claimedBundles[0]?.id;
  if (!bundleId) {
    throw new Error("expected claimed voice bundle");
  }
  return { state: worker.state, bundleId };
}

function correctionRequest(
  transcriptionId: string,
  messageId: string,
  correctedTranscript: string,
) {
  return {
    transcriptionId,
    targetMessageId: messageId,
    requestId: crypto.randomUUID(),
    expectedConversationRevision: 1,
    expectedTranscriptionRevision: 1,
    reasonCode: "wrong_word" as const,
    explanation: "Diyetisyen duzeltmesi",
    correctedTranscript,
    dietitianId: DEMO_DIETITIAN_ID,
  };
}

describe("phase-85-stage-4b4-transcript-corrections", () => {
  it("supersedes transcription revision and updates message body before send", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const correctedText = "Bugun ogle yemeginde nohut yedim.";
    const correction = await submitTranscriptCorrection(
      state,
      correctionRequest(transcription.id, transcription.messageId, correctedText),
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;

    const superseded = correction.state.audioTranscriptionRecords.find((entry) => entry.id === transcription.id);
    const nextRevision = correction.state.audioTranscriptionRecords.find(
      (entry) => entry.mediaAssetId === transcription.mediaAssetId && entry.status === "accepted" && entry.id !== transcription.id,
    );
    expect(superseded?.status).toBe("superseded");
    expect(nextRevision?.transcriptionRevision).toBe(2);
    expect(nextRevision?.observation).toBeNull();
    expect(nextRevision?.overallConfidence).toBeNull();
    expect(nextRevision?.origin).toBe("dietitian_correction");
    expect(nextRevision?.transcriptText).toBe(correctedText);
    expect(superseded?.observation?.transcriptText).toBe(
      STAGE_4B4_TRANSCRIPTION_FIXTURE_TEMPLATES.meal_update_tr.transcriptText,
    );
    const message = correction.state.messages.find((entry) => entry.id === transcription.messageId);
    expect(message?.body).toBe(correctedText);
    expect(correction.resultAction).toBe("supersede_rerun");
  });

  it("invalidates pending draft and reopens bundle when corrected before send", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const replaced = {
      ...state,
      messages: state.messages.map((message) =>
        message.id === transcription.messageId
          ? { ...message, body: "D vitamini takviyesi kullanayim mi?" }
          : message,
      ),
      audioTranscriptionRecords: state.audioTranscriptionRecords.map((record) =>
        record.id === transcription.id && record.observation
          ? {
              ...record,
              observation: {
                ...record.observation,
                transcriptText: "D vitamini takviyesi kullanayim mi?",
              },
            }
          : record,
      ),
    };
    const { state: ready, bundleId } = await prepareVoiceBundleForOrchestration(replaced);
    const turn = await runMultimodalBundleInboundTurn(ready, bundleId, { now: T240 });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.state.lastSimulation?.action).toBe("draft_for_approval");

    const correction = await submitTranscriptCorrection(
      turn.state,
      correctionRequest(
        transcription.id,
        transcription.messageId,
        "D vitamini kullanmayi birakmak istiyorum.",
      ),
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.resultAction).toBe("invalidate_pending");
    expect(correction.rerunDecisionId).toBeTruthy();
    const bundle = correction.state.inboundMessageBundles.find((entry) => entry.id === bundleId);
    expect(bundle?.decisionId).toBe(correction.rerunDecisionId);
    expect(
      correction.state.messages.some(
        (message) => message.generatedByAiDecisionId === turn.decisionId && message.status === "draft",
      ),
    ).toBe(false);
  });

  it("requires manual follow-up after a sent voice correction without auto client send", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const { state: ready, bundleId } = await prepareVoiceBundleForOrchestration(state);
    const turn = await runMultimodalBundleInboundTurn(ready, bundleId, { now: T240 });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    const sentBefore = turn.state.messages.filter(
      (message) => message.origin === "ai_generated" && message.status === "sent",
    ).length;
    const correction = await submitTranscriptCorrection(
      turn.state,
      correctionRequest(
        transcription.id,
        transcription.messageId,
        "Bugun ogle yemeginde mercimek corbasi ve salata yedim.",
      ),
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.resultAction).toBe("manual_follow_up");
    expect(correction.state.clients[0]?.aiMode).toBe("manual");
    expect(correction.state.clients[0]?.humanTakeoverLocked).toBe(true);
    const sentAfter = correction.state.messages.filter(
      (message) => message.origin === "ai_generated" && message.status === "sent",
    ).length;
    expect(sentAfter).toBe(sentBefore);
    expect(
      correction.state.notifications.some((notification) => notification.kind === "voice_transcript_correction_follow_up"),
    ).toBe(true);
  });

  it("rejects stale conversation and transcription revisions", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const staleConversation = await submitTranscriptCorrection(state, {
      ...correctionRequest(transcription.id, transcription.messageId, "Bugun salata yedim."),
      expectedConversationRevision: 99,
    });
    expect(staleConversation.ok).toBe(false);
    if (staleConversation.ok) return;
    expect(staleConversation.failureCode).toBe("stale_conversation_revision");

    const staleTranscription = await submitTranscriptCorrection(state, {
      ...correctionRequest(transcription.id, transcription.messageId, "Bugun salata yedim."),
      expectedTranscriptionRevision: 99,
    });
    expect(staleTranscription.ok).toBe(false);
    if (staleTranscription.ok) return;
    expect(staleTranscription.failureCode).toBe("stale_transcription_revision");
  });

  it("replays the same request idempotently", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const request = {
      ...correctionRequest(transcription.id, transcription.messageId, "Bugun salata yedim."),
      requestId: "corr-replay-1",
    };
    const first = await submitTranscriptCorrection(state, request);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const replay = await submitTranscriptCorrection(first.state, request);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.state).toEqual(first.state);
    expect(replay.correctionId).toBe(first.correctionId);
  });

  it("preserves an active red risk lock during pre-send correction", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const locked = {
      ...state,
      clients: state.clients.map((client) =>
        client.id === state.conversations[0]!.clientId
          ? {
              ...client,
              redRiskLock: {
                status: "locked" as const,
                handoffId: "handoff-red-lock-1",
                lockedAt: T0,
                reasons: ["emergency_symptom"],
                previousAiStatus: client.aiStatus,
                previousAiMode: client.aiMode,
              },
            }
          : client,
      ),
    };
    const correction = await submitTranscriptCorrection(
      locked,
      correctionRequest(transcription.id, transcription.messageId, "Bugun sadece salata yedim."),
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.state.clients[0]?.redRiskLock.status).toBe("locked");
  });

  it("rejects target message mismatches and supersedes stale draft decisions on rerun", async () => {
    const { state, transcription } = await admitAndTranscribeVoice();
    const mismatch = await submitTranscriptCorrection(state, {
      ...correctionRequest(transcription.id, transcription.messageId, "Bugun salata yedim."),
      targetMessageId: crypto.randomUUID(),
    });
    expect(mismatch.ok).toBe(false);
    if (mismatch.ok) return;
    expect(mismatch.failureCode).toBe("transcript_correction_target_message_mismatch");

    const replaced = {
      ...state,
      messages: state.messages.map((message) =>
        message.id === transcription.messageId
          ? { ...message, body: "D vitamini takviyesi kullanayim mi?" }
          : message,
      ),
      audioTranscriptionRecords: state.audioTranscriptionRecords.map((record) =>
        record.id === transcription.id && record.observation
          ? {
              ...record,
              observation: {
                ...record.observation,
                transcriptText: "D vitamini takviyesi kullanayim mi?",
              },
              transcriptText: "D vitamini takviyesi kullanayim mi?",
            }
          : record,
      ),
    };
    const { state: ready, bundleId } = await prepareVoiceBundleForOrchestration(replaced);
    const turn = await runMultimodalBundleInboundTurn(ready, bundleId, { now: T240 });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.state.lastSimulation?.action).toBe("draft_for_approval");

    const correction = await submitTranscriptCorrection(
      turn.state,
      correctionRequest(transcription.id, transcription.messageId, "D vitamini kullanmayi birakmak istiyorum."),
    );
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;

    const superseded = correction.state.aiDecisions.find((entry) => entry.id === turn.decisionId);
    expect(superseded?.sendStatus).toBe("draft_invalidated");
    expect(superseded?.blockedReason).toBe("transcript_correction_superseded");
    expect(correction.rerunDecisionId).toBeTruthy();
    expect(correction.rerunDecisionId).not.toBe(turn.decisionId);
  });
});
