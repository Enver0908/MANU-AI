import { beforeEach, describe, expect, it } from "vitest";
import { PHASE_74_REDACTION_MARKER } from "./data-governance";
import { applyPhase74TransactionalRedactionInState, buildPhase74ExportPackage } from "./phase-74-data-lifecycle-policy";
import { getFallbackStage4B3MediaStorage, resetFallbackStage4B3MediaStorage } from "./phase-85-stage-4b3-fallback-media-storage";
import {
  buildStage4B3MediaOperationalHealth,
  detectStage4B3MediaOrphans,
  evaluateStage4B3MediaRedactionInvariants,
  isMediaAssetDueForExpiry,
  processDueStage4B3MediaExpiryInState,
  revokeMediaAssetsForMessageInState,
  STAGE_4B3_MEDIA_LIFECYCLE_VERSION,
} from "./phase-85-stage-4b3-media-lifecycle";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import { createInMemoryStage4B3MediaStorage } from "./phase-85-stage-4b3-media-storage";
import {
  buildVisualObservationFromFixtureTemplate,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { resetFallbackState } from "./app-state-store";

function buildAsset(overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord {
  return {
    id: "asset-life-1",
    tenantId: DEMO_TENANT_ID,
    clientId: "client-mert",
    conversationId: "conversation-mert",
    messageId: "message-image-1",
    channelEventId: "channel-event-1",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: "hash-life-1",
    declaredMimeType: "image/jpeg",
    detectedMimeType: "image/jpeg",
    dimensions: { width: 640, height: 480 },
    byteSize: 9000,
    contentSha256: "sha-life-1",
    sanitizedFullObjectKey: "tenant/full-life-1.jpg",
    thumbnailObjectKey: "tenant/thumb-life-1.jpg",
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

function seedStateWithMedia() {
  const state = createInitialState();
  const conversation = state.conversations.find((item) => item.clientId === "client-mert")!;
  const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
  return {
    ...state,
    mediaAssets: [
      buildAsset({
        conversationId: conversation.id,
        messageId: "message-image-1",
      }),
    ],
    visualAnalysisRecords: [
      {
        id: "analysis-life-1",
        tenantId: DEMO_TENANT_ID,
        clientId: "client-mert",
        conversationId: conversation.id,
        mediaAssetId: "asset-life-1",
        messageId: "message-image-1",
        bundleId: "bundle-life-1",
        analysisRevision: 1,
        status: "ready",
        observation,
        supersededByAnalysisId: null,
        failureCode: null,
        createdAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
    inboundMessageBundles: [
      {
        id: "bundle-life-1",
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
        providerEventId: "wamid.IMG_1",
        providerMessageId: "wamid.IMG_1",
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

describe("phase 85 stage 4b-3 media lifecycle", () => {
  beforeEach(() => {
    resetFallbackState();
    resetFallbackStage4B3MediaStorage();
  });

  it("does not expire assets before day 30 and expires on day 30+", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    await storage.uploadObject("tenant/full-life-1.jpg", Buffer.from("full"), "image/jpeg");
    await storage.uploadObject("tenant/thumb-life-1.jpg", Buffer.from("thumb"), "image/jpeg");

    const state = seedStateWithMedia();
    expect(isMediaAssetDueForExpiry(state.mediaAssets[0]!, "2026-06-29T10:00:00.000Z")).toBe(false);

    const onDay30 = await processDueStage4B3MediaExpiryInState(state, {
      now: "2026-07-01T10:00:00.000Z",
      storage,
    });
    expect(onDay30.mediaAssets[0]?.status).toBe("expired");
    expect(onDay30.mediaAssets[0]?.sanitizedFullObjectKey).toBeNull();
    expect(storage.objects.has("tenant/full-life-1.jpg")).toBe(false);

    const onDay31 = await processDueStage4B3MediaExpiryInState(onDay30, {
      now: "2026-07-02T10:00:00.000Z",
      storage,
    });
    expect(onDay31.mediaAssets.filter((asset) => asset.status === "expired")).toHaveLength(1);
  });

  it("revokes media assets and deletes objects when a message is revoked", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    await storage.uploadObject("tenant/full-life-1.jpg", Buffer.from("full"), "image/jpeg");
    const state = seedStateWithMedia();
    const { state: revoked, objectKeys } = revokeMediaAssetsForMessageInState(
      state,
      "message-image-1",
      "2026-07-14T10:00:00.000Z",
    );
    expect(objectKeys).toEqual(["tenant/full-life-1.jpg", "tenant/thumb-life-1.jpg"]);
    expect(revoked.mediaAssets[0]?.status).toBe("revoked");
    expect(revoked.messages.find((message) => message.id === "message-image-1")?.retrievalEligibility).toBe(
      "excluded_revoked",
    );
  });

  it("redacts media, cancels bundles, and clears storage on DSAR removal", async () => {
    const storage = getFallbackStage4B3MediaStorage();
    await storage.uploadObject("tenant/full-life-1.jpg", Buffer.from("full"), "image/jpeg");
    const state = seedStateWithMedia();
    const { state: redacted } = applyPhase74TransactionalRedactionInState(state, "client-mert", "deletion");

    expect(redacted.inboundMessageBundles[0]?.status).toBe("superseded");
    expect(redacted.mediaAssets[0]?.status).toBe("revoked");
    expect(redacted.visualAnalysisRecords[0]?.observation?.ocrBlocks).toEqual([]);
    expect(storage.objects.has("tenant/full-life-1.jpg")).toBe(false);
    expect(evaluateStage4B3MediaRedactionInvariants(redacted, "client-mert", storage).passed).toBe(true);
  });

  it("keeps media export metadata bounded without object keys or OCR", () => {
    const state = seedStateWithMedia();
    const pkg = buildPhase74ExportPackage(state, "client-mert");
    expect(pkg.files["media_metadata.json"]).toBeTruthy();
    expect(pkg.files["media_metadata.json"]).not.toContain("sanitizedFullObjectKey");
    expect(pkg.files["media_metadata.json"]).not.toContain("ocrBlocks");
    expect(pkg.files["media_metadata.json"]).toContain("asset-life-1");
  });

  it("detects orphan objects and missing objects", () => {
    const storage = createInMemoryStage4B3MediaStorage();
    storage.objects.set("orphan-object.jpg", { bytes: Buffer.from("orphan"), contentType: "image/jpeg" });
    const state = seedStateWithMedia();
    const report = detectStage4B3MediaOrphans(state, storage);
    expect(report.orphanCount).toBeGreaterThan(0);
    expect(report.entries.some((entry) => entry.kind === "object_without_row")).toBe(true);
    expect(report.entries.some((entry) => entry.kind === "row_without_object")).toBe(true);
  });

  it("reports aggregate media lifecycle operational health", () => {
    const state = seedStateWithMedia();
    const health = buildStage4B3MediaOperationalHealth(state);
    expect(health.version).toBe(STAGE_4B3_MEDIA_LIFECYCLE_VERSION);
    expect(health.openBundleCount).toBe(1);
    expect(health.pendingExpiryCount).toBeGreaterThanOrEqual(0);
  });

  it("keeps audit metadata minimized without raw OCR in lifecycle events", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    const state = seedStateWithMedia();
    const next = await processDueStage4B3MediaExpiryInState(state, {
      now: "2026-07-02T10:00:00.000Z",
      storage,
    });
    const audit = next.auditEvents.find((event) => event.eventType === "media_asset_expired");
    expect(audit?.metadata.minimized).toBe(true);
    expect(JSON.stringify(audit?.metadata)).not.toContain(PHASE_74_REDACTION_MARKER);
    expect(JSON.stringify(audit?.metadata)).not.toContain("ocrBlocks");
  });
});
