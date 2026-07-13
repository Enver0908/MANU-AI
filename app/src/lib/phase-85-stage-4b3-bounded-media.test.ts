import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { projectConversationMessage } from "./phase-85-stage-4b2-api";
import type { ConversationProjectionMessage } from "./phase-85-stage-4b2-contracts";
import {
  STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL,
  STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL,
  assertVisualCorrectionAllowed,
  buildConversationMediaStreamHeaders,
  buildStage4B3MediaProjectionSourceFromState,
  filterStage4B3MediaProjectionForConversation,
  parseConversationMediaStreamVariant,
  parseVisualCorrectionMutationBody,
  projectConversationMessageWithMedia,
  resolveConversationListMediaPreview,
  resolveMediaStreamHttpStatus,
  resolveMediaStreamObjectKey,
} from "./phase-85-stage-4b3-bounded-media";
import type { MediaAssetRecord } from "./phase-85-stage-4b3-media-contracts";
import {
  buildVisualObservationFromFixtureTemplate,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";

function buildAsset(overrides: Partial<MediaAssetRecord> = {}): MediaAssetRecord {
  return {
    id: "asset-1",
    tenantId: DEMO_TENANT_ID,
    clientId: "client-1",
    conversationId: "conversation-1",
    messageId: "message-1",
    channelEventId: "channel-event-1",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: "hash-1",
    declaredMimeType: "image/jpeg",
    detectedMimeType: "image/jpeg",
    dimensions: { width: 800, height: 600 },
    byteSize: 12000,
    contentSha256: "abc123",
    status: "analysis_ready",
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    storedAt: "2026-07-14T10:00:00.000Z",
    thumbnailObjectKey: "thumb.jpg",
    sanitizedFullObjectKey: "full.jpg",
    expiresAt: null,
    deletedAt: null,
    failureCode: null,
    createdAt: "2026-07-14T10:00:00.000Z",
    updatedAt: "2026-07-14T10:00:00.000Z",
    ...overrides,
  };
}

function buildProjectionMessage(
  conversationId: string,
  messageId: string,
): ConversationProjectionMessage {
  return {
    id: messageId,
    tenantId: DEMO_TENANT_ID,
    conversationId,
    sender: "client",
    body: "[client image]",
    origin: "client_inbound",
    sourceMessageId: null,
    conversationSequence: 1,
    contentStatus: "available",
    retrievalEligibility: "media_only_excluded",
    status: "received",
    createdAt: "2026-07-14T10:00:00.000Z",
  };
}

describe("phase-85-stage-4b3-bounded-media", () => {
  it("uses Görsel for media-only list previews", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const message = buildProjectionMessage(conversation.id, "message-1");
    expect(resolveConversationListMediaPreview(message)).toBe(STAGE_4B3_CONVERSATION_MEDIA_PREVIEW_LABEL);
  });

  it("projects bounded media DTOs without forbidden keys", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const messageId = "message-image-1";
    state.mediaAssets = [
      buildAsset({
        id: "asset-mm-1",
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
      }),
    ];
    state.visualAnalysisRecords = [
      {
        id: "analysis-mm-1",
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId,
        mediaAssetId: "asset-mm-1",
        bundleId: "bundle-mm-1",
        analysisRevision: 1,
        status: "ready",
        observation,
        supersededByAnalysisId: null,
        failureCode: null,
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-07-14T10:00:00.000Z",
      },
    ];
    state.inboundMessageBundles = [
      {
        id: "bundle-mm-1",
        tenantId: DEMO_TENANT_ID,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        anchorMessageId: messageId,
        status: "review_required",
        openedAt: "2026-07-14T10:00:00.000Z",
        lastEventAt: "2026-07-14T10:00:00.000Z",
        readyAt: "2026-07-14T10:02:00.000Z",
        bundleRevision: 1,
        conversationRevisionAtOpen: 1,
        itemCount: 1,
        imageCount: 1,
        unicodeCodepointCount: 0,
        retryCount: 0,
        nextAttemptAt: null,
        leaseExpiresAt: null,
        decisionId: null,
        failureCode: null,
        createdAt: "2026-07-14T10:00:00.000Z",
        updatedAt: "2026-07-14T10:00:00.000Z",
      },
    ];

    const projectionMessage = buildProjectionMessage(conversation.id, messageId);
    const media = filterStage4B3MediaProjectionForConversation(
      buildStage4B3MediaProjectionSourceFromState(state),
      DEMO_TENANT_ID,
      conversation.id,
    );
    const base = projectConversationMessage(projectionMessage);
    const dto = projectConversationMessageWithMedia(
      projectionMessage,
      { tenantId: DEMO_TENANT_ID, dietitianId: state.dietitian.id, role: "owner" },
      media,
      base,
    );

    expect(dto.media).toHaveLength(1);
    expect(dto.media[0]?.assetId).toBe("asset-mm-1");
    expect(dto.media[0]).not.toHaveProperty("thumbnailObjectKey");
    expect(dto.visualReview?.analysisRevision).toBe(1);
    expect(dto.visualReview?.correctionAllowed).toBe(true);
  });

  it("resolves media stream status and no-store headers", () => {
    const readyAsset = buildAsset();
    expect(resolveMediaStreamHttpStatus(readyAsset, "thumbnail")).toBe(200);
    expect(resolveMediaStreamObjectKey(readyAsset, "full")).toBe("full.jpg");
    expect(resolveMediaStreamHttpStatus(buildAsset({ status: "expired" }), "full")).toBe(410);

    const headers = buildConversationMediaStreamHeaders("image/jpeg");
    expect(headers["Cache-Control"]).toBe(STAGE_4B3_MEDIA_STREAM_CACHE_CONTROL);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Content-Type"]).toBe("image/jpeg");
  });

  it("parses visual correction bodies and enforces role permissions", () => {
    const parsed = parseVisualCorrectionMutationBody({
      analysisId: "analysis-1",
      requestId: "req-1",
      expectedConversationRevision: 2,
      expectedAnalysisRevision: 3,
      reasonCode: "wrong_scene",
      explanation: "Scene mismatch",
    });
    expect(parsed.expectedAnalysisRevision).toBe(3);

    expect(() =>
      parseVisualCorrectionMutationBody({
        analysisId: "analysis-1",
        requestId: "req-1",
        expectedConversationRevision: 1,
        expectedAnalysisRevision: 0,
        reasonCode: "wrong_scene",
        explanation: "x",
      }),
    ).toThrow(AppDomainError);

    expect(() =>
      assertVisualCorrectionAllowed(
        {
          canRead: true,
          canMutateConversation: true,
          canViewTranscript: true,
          canMarkRead: true,
          canSendManualReply: true,
          canReviewDraft: true,
          canActivateAi: true,
          canConfigureAi: true,
          canResolveRisk: true,
          isReadOnly: false,
          assignmentLevel: "primary",
          scope: "assigned",
        },
        "auditor",
      ),
    ).toThrow(AppDomainError);
  });

  it("defaults media stream variant to thumbnail", () => {
    expect(parseConversationMediaStreamVariant(null)).toBe("thumbnail");
    expect(parseConversationMediaStreamVariant("full")).toBe("full");
  });
});
