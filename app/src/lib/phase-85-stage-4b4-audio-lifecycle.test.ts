import { beforeEach, describe, expect, it } from "vitest";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { applyPhase74TransactionalRedactionInState, buildPhase74ExportPackage } from "./phase-74-data-lifecycle-policy";
import { buildOperationalFoundationInspectionDto } from "./phase-85-if-h-operational-visibility";
import { resetFallbackStage4B4AudioStorage, getFallbackStage4B4AudioStorage } from "./phase-85-stage-4b4-fallback-audio-storage";
import {
  buildStage4B4AudioOperationalHealth,
  detectStage4B4AudioOrphans,
  evaluateStage4B4AudioRedactionInvariants,
  isAudioAssetDueForExpiry,
  processDueStage4B4AudioExpiryInState,
  STAGE_4B4_AUDIO_LIFECYCLE_VERSION,
  STAGE_4B4_VOICE_EXPORT_FILE,
} from "./phase-85-stage-4b4-audio-lifecycle";
import {
  finalizeAudioAssetDeletionInState,
  prepareAudioAssetDeletionInState,
} from "./phase-85-stage-4b4-audio-lifecycle-saga";
import { createInMemoryStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  buildTranscriptionLineageFieldsFromObservation,
  type AudioTranscriptionObservationV1,
  type AudioTranscriptionRecord,
} from "./phase-85-stage-4b4-voice-contracts";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { resetFallbackState } from "./app-state-store";

function buildVoiceAsset(overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord {
  return {
    id: "asset-voice-life-1",
    tenantId: DEMO_TENANT_ID,
    clientId: "client-mert",
    conversationId: "conversation-mert",
    messageId: "message-voice-1",
    channelEventId: "channel-event-voice-1",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: "hash-voice-life-1",
    declaredMimeType: "audio/ogg",
    detectedMimeType: "audio/wav",
    dimensions: null,
    byteSize: 12_000,
    contentSha256: "sha-voice-life-1",
    sanitizedFullObjectKey: null,
    thumbnailObjectKey: null,
    mediaKind: "audio",
    voiceMessage: true,
    durationMs: 3_000,
    audioCodec: "pcm_s16le",
    audioChannels: 1,
    sampleRateHz: 16_000,
    sanitizedAudioObjectKey: `${DEMO_TENANT_ID}/asset-voice-life-1/voice.wav`,
    status: "analysis_ready",
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    storedAt: "2026-06-01T10:00:00.000Z",
    expiresAt: "2026-07-01T10:00:00.000Z",
    deletedAt: null,
    failureCode: null,
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function buildObservation(): AudioTranscriptionObservationV1 {
  return {
    schemaVersion: "audio-transcription-observation-v1-v0.1.0",
    locale: "tr-TR",
    transcriptText: "Bugun mercimek corbasi yedim.",
    overallConfidence: 0.98,
    segments: [{ startMs: 0, endMs: 2_800, text: "Bugun mercimek corbasi yedim.", confidence: 0.98, uncertain: false }],
    uncertainSpanCount: 0,
    providerId: "mock-stage4b4",
    providerVersion: "v1",
  };
}

function buildTranscription(overrides: Partial<AudioTranscriptionRecord> = {}): AudioTranscriptionRecord {
  const observation = buildObservation();
  return {
    id: "transcription-life-1",
    tenantId: DEMO_TENANT_ID,
    clientId: "client-mert",
    conversationId: "conversation-mert",
    messageId: "message-voice-1",
    mediaAssetId: "asset-voice-life-1",
    bundleId: "bundle-voice-life-1",
    transcriptionRevision: 1,
    status: "accepted",
    locale: "tr-TR",
    observation,
    qualityDecision: { accepted: true, reasonCodes: [] },
    rejectionReasons: [],
    sourceModality: "voice_transcript",
    providerMode: "mock",
    retrievalEligible: true,
    evidenceExpiresAt: "2026-07-01T10:00:00.000Z",
    ...buildTranscriptionLineageFieldsFromObservation({ observation }),
    createdAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

function seedStateWithVoice() {
  const state = createInitialState();
  const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
  return {
    ...state,
    mediaAssets: [buildVoiceAsset({ conversationId: conversation.id })],
    audioTranscriptionRecords: [buildTranscription({ conversationId: conversation.id })],
    messages: [
      ...state.messages,
      {
        id: "message-voice-1",
        tenantId: DEMO_TENANT_ID,
        conversationId: conversation.id,
        sender: "client",
        body: "Bugun mercimek corbasi yedim.",
        origin: "client_inbound",
        sourceMessageId: null,
        generatedByAiDecisionId: null,
        approvedByDietitianId: null,
        authorDietitianId: null,
        providerAccountBindingId: "demo-binding",
        providerEventId: "wamid.VOICE_1",
        providerMessageId: "wamid.VOICE_1",
        actorBindingId: null,
        authorInterface: null,
        actorType: "client",
        actorResolutionBasis: "channel_identity",
        contentStatus: "available",
        retrievalEligibility: "eligible",
        status: "received",
        conversationSequence: 120,
        createdAt: "2026-06-01T10:00:00.000Z",
        providerSentAt: "2026-06-01T10:00:00.000Z",
        observedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
}

describe("phase 85 stage 4b-4 audio lifecycle", () => {
  beforeEach(() => {
    resetFallbackState();
    resetFallbackStage4B4AudioStorage();
  });

  it("does not expire voice assets before day 30 and expires on day 30+", async () => {
    const storage = createInMemoryStage4B4AudioStorage();
    await storage.uploadObject(
      `${DEMO_TENANT_ID}/asset-voice-life-1/voice.wav`,
      Buffer.from("voice"),
      "audio/wav",
    );

    const state = seedStateWithVoice();
    expect(isAudioAssetDueForExpiry(state.mediaAssets[0]!, "2026-06-29T10:00:00.000Z")).toBe(false);

    const onDay30 = await processDueStage4B4AudioExpiryInState(state, {
      now: "2026-07-01T10:00:00.000Z",
      storage,
    });
    expect(onDay30.mediaAssets[0]?.status).toBe("expired");
    expect(onDay30.mediaAssets[0]?.sanitizedAudioObjectKey).toBeNull();
    expect(storage.objects.has(`${DEMO_TENANT_ID}/asset-voice-life-1/voice.wav`)).toBe(false);
    expect(onDay30.messages.find((message) => message.id === "message-voice-1")?.retrievalEligibility).toBe(
      "excluded_voice_expired",
    );
    expect(onDay30.messages.find((message) => message.id === "message-voice-1")?.body).toContain("mercimek corbasi");
    expect(onDay30.audioTranscriptionRecords[0]?.observation?.segments).toEqual([]);

    const onDay31 = await processDueStage4B4AudioExpiryInState(onDay30, {
      now: "2026-07-02T10:00:00.000Z",
      storage,
    });
    expect(onDay31.mediaAssets.filter((asset) => asset.status === "expired")).toHaveLength(1);
  });

  it("defers physical deletion under legal hold without re-enabling playback", async () => {
    const storage = createInMemoryStage4B4AudioStorage();
    const objectKey = `${DEMO_TENANT_ID}/asset-voice-life-1/voice.wav`;
    await storage.uploadObject(objectKey, Buffer.from("voice"), "audio/wav");

    const state = {
      ...seedStateWithVoice(),
      clients: seedStateWithVoice().clients.map((client) =>
        client.id === "client-mert" ? { ...client, mediaLegalHold: true } : client,
      ),
    };

    const prepared = await processDueStage4B4AudioExpiryInState(state, {
      now: "2026-07-02T10:00:00.000Z",
      storage,
      legalHoldClientIds: new Set(["client-mert"]),
    });
    expect(prepared.mediaAssets[0]?.status).toBe("deletion_pending");
    expect(prepared.mediaAssets[0]?.sanitizedAudioObjectKey).toBeNull();
    expect(storage.objects.has(objectKey)).toBe(true);
    expect(prepared.messages.find((message) => message.id === "message-voice-1")?.retrievalEligibility).toBe(
      "excluded_voice_expired",
    );
  });

  it("redacts audio metadata, clears storage, and preserves accepted message body on DSAR removal", async () => {
    const storage = getFallbackStage4B4AudioStorage();
    await storage.uploadObject(
      `${DEMO_TENANT_ID}/asset-voice-life-1/voice.wav`,
      Buffer.from("voice"),
      "audio/wav",
    );
    const state = seedStateWithVoice();
    const { state: redacted } = applyPhase74TransactionalRedactionInState(state, "client-mert", "deletion");

    expect(redacted.mediaAssets[0]?.status).toBe("revoked");
    expect(redacted.audioTranscriptionRecords[0]?.observation?.segments).toEqual([]);
    expect(storage.objects.has(`${DEMO_TENANT_ID}/asset-voice-life-1/voice.wav`)).toBe(false);
    expect(evaluateStage4B4AudioRedactionInvariants(redacted, "client-mert", storage).passed).toBe(true);
  });

  it("keeps voice transcript export bounded without object keys or provider confidence", () => {
    const state = seedStateWithVoice();
    state.mediaAssets = state.mediaAssets.map((asset) => ({
      ...asset,
      expiresAt: "2027-08-01T10:00:00.000Z",
    }));
    const pkg = buildPhase74ExportPackage(state, "client-mert");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).toBeTruthy();
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).not.toContain("sanitizedAudioObjectKey");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).not.toContain("overallConfidence");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).not.toContain("segments");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).toContain("transcription-life-1");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).toContain("mercimek corbasi");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).toContain("corrections");
    expect(pkg.files[STAGE_4B4_VOICE_EXPORT_FILE]).toContain("/api/conversations/");
  });

  it("detects orphan audio objects and missing objects", () => {
    const storage = createInMemoryStage4B4AudioStorage();
    storage.objects.set("orphan-voice.wav", { bytes: Buffer.from("orphan"), contentType: "audio/wav" });
    const state = seedStateWithVoice();
    const report = detectStage4B4AudioOrphans(state, storage);
    expect(report.orphanCount).toBeGreaterThan(0);
    expect(report.entries.some((entry) => entry.kind === "object_without_row")).toBe(true);
    expect(report.entries.some((entry) => entry.kind === "row_without_object")).toBe(true);
  });

  it("reports aggregate audio lifecycle operational health", () => {
    const state = seedStateWithVoice();
    const health = buildStage4B4AudioOperationalHealth(state);
    expect(health.version).toBe(STAGE_4B4_AUDIO_LIFECYCLE_VERSION);
    expect(health.pendingTranscriptionEvidenceCount).toBeGreaterThan(0);

    const inspection = buildOperationalFoundationInspectionDto(state);
    expect(inspection.audioLifecycle.version).toBe(STAGE_4B4_AUDIO_LIFECYCLE_VERSION);
    expect(inspection.audioLifecycle.status).toBe("degraded");
  });

  it("treats idempotent object deletion as success during finalize", async () => {
    const state = seedStateWithVoice();
    const { state: prepared, pendingObjectKeys } = prepareAudioAssetDeletionInState(
      state,
      "asset-voice-life-1",
      "expired",
      "2026-07-02T10:00:00.000Z",
    );
    expect(pendingObjectKeys).toHaveLength(1);
    const finalized = finalizeAudioAssetDeletionInState(prepared, "asset-voice-life-1", "expired", "2026-07-02T10:00:00.000Z");
    expect(finalized.mediaAssets[0]?.status).toBe("expired");
    expect(finalized.audioTranscriptionRecords[0]?.observation?.providerId).toBe(PHASE_74_REDACTION_MARKER);
  });
});
