import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPhase74TransactionalRedactionInState } from "./phase-74-data-lifecycle-policy";
import { getFallbackStage4B3MediaStorage, resetFallbackStage4B3MediaStorage } from "./phase-85-stage-4b3-fallback-media-storage";
import {
  detectStage4B3MediaExportLeaks,
  isMediaAssetDueForExpiry,
  processDueStage4B3MediaExpiryInState,
  serializeStage4B3MediaExportMetadata,
} from "./phase-85-stage-4b3-media-lifecycle";
import {
  detectStage4B3MediaOrphansFromStorage,
  finalizeMediaAssetDeletionInState,
  prepareMediaAssetDeletionInState,
  processDueStage4B3MediaExpirySagaInState,
  redactStaleVisualEvidenceInState,
  STAGE_4B3_MEDIA_LIFECYCLE_SAGA_VERSION,
} from "./phase-85-stage-4b3-media-lifecycle-saga";
import { createInMemoryStage4B3MediaStorage } from "./phase-85-stage-4b3-media-storage";
import { resolveMediaStreamHttpStatus } from "./phase-85-stage-4b3-bounded-media";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import { resetFallbackState } from "./app-state-store";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";

function buildAsset(overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord {
  return {
    id: "asset-saga-1",
    tenantId: DEMO_TENANT_ID,
    clientId: "client-mert",
    conversationId: "conversation-mert",
    messageId: "message-image-1",
    channelEventId: "channel-event-1",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: "hash-saga-1",
    declaredMimeType: "image/jpeg",
    detectedMimeType: "image/jpeg",
    dimensions: { width: 640, height: 480 },
    byteSize: 9000,
    contentSha256: "sha-saga-1",
    sanitizedFullObjectKey: "tenant/full-saga-1.jpg",
    thumbnailObjectKey: "tenant/thumb-saga-1.jpg",
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

function seedState() {
  const state = createInitialState();
  const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
  return {
    ...state,
    mediaAssets: [buildAsset({ conversationId: conversation.id })],
    visualAnalysisRecords: [
      {
        id: "analysis-saga-1",
        tenantId: DEMO_TENANT_ID,
        clientId: "client-mert",
        conversationId: conversation.id,
        mediaAssetId: "asset-saga-1",
        messageId: "message-image-1",
        bundleId: "bundle-saga-1",
        analysisRevision: 1,
        status: "ready" as const,
        observation: {
          schemaVersion: "visual-observation-v1-v0.1.0",
          sceneType: "meal",
          sceneConfidence: 0.9,
          overallConfidence: 0.9,
          qualityFlags: [],
          entityCandidates: ["apple"],
          ocrBlocks: ["hello"],
          labelIntegrity: { hasVisibleLabel: false, hasVisibleBrand: false, hasVisibleNutritionPanel: false },
          sensitivitySignals: [],
          promptInjectionSignals: [],
          providerId: "fixture",
          providerVersion: "v1",
        },
        supersededByAnalysisId: null,
        failureCode: null,
        retrievalEligible: true,
        createdAt: "2024-01-01T10:00:00.000Z",
        updatedAt: "2024-01-01T10:00:00.000Z",
      },
    ],
    inboundMessageBundles: [
      {
        id: "bundle-saga-1",
        tenantId: DEMO_TENANT_ID,
        clientId: "client-mert",
        conversationId: conversation.id,
        anchorMessageId: "message-image-1",
        status: "open",
        openedAt: "2026-06-01T10:00:00.000Z",
        lastEventAt: "2026-06-01T10:00:00.000Z",
        readyAt: "2026-06-01T10:02:00.000Z",
        revision: 1,
        leaseOwner: null,
        leaseExpiresAt: null,
        retryCount: 0,
        nextAttemptAt: null,
        itemCount: 1,
        imageCount: 1,
        characterCount: 0,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
    messages: [
      ...state.messages,
      {
        id: "message-image-1",
        tenantId: DEMO_TENANT_ID,
        conversationId: conversation.id,
        sender: "client",
        body: "[client image]",
        origin: "client_inbound",
        sourceMessageId: null,
        generatedByAiDecisionId: null,
        approvedByDietitianId: null,
        authorDietitianId: null,
        providerAccountBindingId: "demo-binding",
        providerEventId: "wamid.IMG_SAGA",
        providerMessageId: "wamid.IMG_SAGA",
        actorBindingId: null,
        authorInterface: null,
        actorType: "client",
        actorResolutionBasis: "channel_identity",
        contentStatus: "available",
        retrievalEligibility: "media_only_excluded",
        status: "received",
        conversationSequence: 99,
        createdAt: "2026-06-01T10:00:00.000Z",
        providerSentAt: "2026-06-01T10:00:00.000Z",
        observedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  };
}

describe("phase 85 stage 4b-3 media lifecycle saga", () => {
  beforeEach(() => {
    resetFallbackState();
    resetFallbackStage4B3MediaStorage();
  });

  it("prepares deletion by blocking access before storage purge completes", () => {
    const state = seedState();
    const prepared = prepareMediaAssetDeletionInState(state, "asset-saga-1", "expired", "2026-07-01T10:00:00.000Z");
    const asset = prepared.state.mediaAssets[0]!;

    expect(asset.status).toBe("deletion_pending");
    expect(asset.sanitizedFullObjectKey).toBeNull();
    expect(prepared.pendingObjectKeys).toHaveLength(2);
    expect(prepared.state.visualAnalysisRecords[0]?.retrievalEligible).toBe(false);
    expect(resolveMediaStreamHttpStatus(asset, "full")).toBe(410);
  });

  it("keeps day-29 assets active and expires on day 30 via saga", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    await storage.uploadObject("tenant/full-saga-1.jpg", Buffer.from("full"), "image/jpeg");
    await storage.uploadObject("tenant/thumb-saga-1.jpg", Buffer.from("thumb"), "image/jpeg");

    const state = seedState();
    expect(isMediaAssetDueForExpiry(state.mediaAssets[0]!, "2026-06-29T10:00:00.000Z")).toBe(false);

    const onDay30 = await processDueStage4B3MediaExpiryInState(state, {
      now: "2026-07-01T10:00:00.000Z",
      storage,
    });
    expect(onDay30.mediaAssets[0]?.status).toBe("expired");
    expect(storage.objects.has("tenant/full-saga-1.jpg")).toBe(false);

    const onDay31 = await processDueStage4B3MediaExpiryInState(onDay30, {
      now: "2026-07-02T10:00:00.000Z",
      storage,
    });
    expect(onDay31.mediaAssets.filter((asset) => asset.status === "expired")).toHaveLength(1);
  });

  it("defers storage deletion while legal hold is active but still blocks access", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    await storage.uploadObject("tenant/full-saga-1.jpg", Buffer.from("full"), "image/jpeg");

    const state = seedState();
    const blocked = await processDueStage4B3MediaExpirySagaInState(state, {
      now: "2026-07-01T10:00:00.000Z",
      storage,
      legalHoldClientIds: new Set(["client-mert"]),
    });

    expect(blocked.mediaAssets[0]?.status).toBe("deletion_pending");
    expect(storage.objects.has("tenant/full-saga-1.jpg")).toBe(true);
    expect(blocked.visualAnalysisRecords[0]?.retrievalEligible).toBe(false);
  });

  it("redacts DSAR media with open bundle via transactional policy", async () => {
    const storage = getFallbackStage4B3MediaStorage();
    await storage.uploadObject("tenant/full-saga-1.jpg", Buffer.from("full"), "image/jpeg");
    const state = seedState();
    const { state: redacted } = applyPhase74TransactionalRedactionInState(state, "client-mert", "deletion");

    expect(redacted.inboundMessageBundles[0]?.status).toBe("superseded");
    expect(redacted.mediaAssets[0]?.status).toBe("revoked");
    expect(redacted.visualAnalysisRecords[0]?.observation?.ocrBlocks).toEqual([]);
    expect(storage.objects.has("tenant/full-saga-1.jpg")).toBe(false);
  });

  it("detects paginated orphan objects from storage listing", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    storage.objects.set("tenant/orphan-saga.jpg", { bytes: Buffer.from("orphan"), contentType: "image/jpeg" });
    const state = seedState();
  state.mediaAssets[0] = buildAsset({
      sanitizedFullObjectKey: "tenant/missing-saga.jpg",
      thumbnailObjectKey: null,
    });

    const report = await detectStage4B3MediaOrphansFromStorage(state, storage, "tenant/");
    expect(report.entries.some((entry) => entry.kind === "object_without_row")).toBe(true);
    expect(report.entries.some((entry) => entry.kind === "row_without_object")).toBe(true);
  });

  it("redacts 24-month-old visual evidence text", () => {
    const state = seedState();
    const redacted = redactStaleVisualEvidenceInState(state, "2026-07-14T10:00:00.000Z");
    expect(redacted.visualAnalysisRecords[0]?.observation?.ocrBlocks).toEqual([]);
    expect(redacted.visualCorrections).toBeDefined();
  });

  it("keeps export metadata bounded without object keys or OCR", () => {
    const state = seedState();
    const payload = serializeStage4B3MediaExportMetadata(state, "client-mert");
    const leakScan = detectStage4B3MediaExportLeaks(JSON.parse(payload));
    expect(leakScan.passed).toBe(true);
    expect(payload).toContain("asset-saga-1");
  });

  it("runs lifecycle worker batch against supabase RPC surface", async () => {
    const { runStage4B3MediaLifecycleWorkerBatch } = await import("./phase-85-stage-4b3-media-lifecycle-saga");
    const storage = createInMemoryStage4B3MediaStorage();
    const rpc = vi.fn(async (name: string) => {
      if (name === "p85_stage_4b3_process_due_media_expiry_batch_v2") {
        return { data: { prepared: 1 }, error: null };
      }
      if (name === "p85_stage_4b3_resume_legal_hold_media_deletions_v2") {
        return { data: { enqueued: 0 }, error: null };
      }
      if (name === "p85_stage_4b3_redact_stale_visual_evidence_v2") {
        return { data: { analysesRedacted: 2 }, error: null };
      }
      if (name === "p85_stage_4b3_claim_media_object_operation_v2") {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });

    const summary = await runStage4B3MediaLifecycleWorkerBatch({
      supabase: { rpc } as never,
      tenantId: DEMO_TENANT_ID,
      storage,
    });

    expect(summary.version).toBe(STAGE_4B3_MEDIA_LIFECYCLE_SAGA_VERSION);
    expect(summary.expiryPrepared).toBe(1);
    expect(summary.evidenceRedacted).toBe(2);
  });

  it("finalizes prepared assets after storage deletion", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    const state = seedState();
    const prepared = prepareMediaAssetDeletionInState(state, "asset-saga-1", "expired", "2026-07-01T10:00:00.000Z");
    await storage.deleteObject("tenant/full-saga-1.jpg");
    await storage.deleteObject("tenant/thumb-saga-1.jpg");
    const finalized = finalizeMediaAssetDeletionInState(
      prepared.state,
      "asset-saga-1",
      "expired",
      "2026-07-01T10:00:00.000Z",
    );
    expect(finalized.mediaAssets[0]?.status).toBe("expired");
    expect(finalized.mediaAssets[0]?.deletedAt).toBeTruthy();
  });
});
