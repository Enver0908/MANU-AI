import { describe, expect, it } from "vitest";
import {
  BUNDLE_ITEM_ACTOR_TYPES,
  INBOUND_MESSAGE_BUNDLE_STATUSES_V2,
  STAGE_4B3_MAX_RETRY_ATTEMPTS,
  VISUAL_EVIDENCE_SOURCE_TYPES,
  assertBundleStatusExhaustiveV2,
  assertBundleStatusTransitionV2,
  assertClientSafeMediaPayloadV2,
  assertProviderContextExcludesRawOcr,
  assertVisualEvidenceSourceType,
  buildSourceGatedVisualSummary,
  createInboundMessageBundleItemV2,
  createRawVisualOcrEvidence,
  listExhaustiveBundleStatusTransitionsV2,
  mapBundleItemV1ToV2,
  mapBundleRecordV1ToV2,
  mapBundleStatusV1ToV2,
  parseVisualCorrectionRequestV2,
  parseVisualEvidenceRefV2,
  Stage4B3MediaContractError,
} from "./phase-85-stage-4b3-media-contracts-v2";

const ANALYSIS_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";

describe("phase-85-stage-4b3-media-contracts-v2", () => {
  it("locks retry ceiling and V2 vocabulary", () => {
    expect(STAGE_4B3_MAX_RETRY_ATTEMPTS).toBe(3);
    expect(INBOUND_MESSAGE_BUNDLE_STATUSES_V2).toEqual([
      "open",
      "ready",
      "processing",
      "decided",
      "review_required",
      "superseded",
      "failed",
      "cancelled",
    ]);
    expect(VISUAL_EVIDENCE_SOURCE_TYPES).not.toContain("user_label_text");
    expect(BUNDLE_ITEM_ACTOR_TYPES).toEqual(["client", "dietitian", "system"]);
  });

  it("covers every bundle status exhaustively and validates transitions", () => {
    for (const status of INBOUND_MESSAGE_BUNDLE_STATUSES_V2) {
      expect(assertBundleStatusExhaustiveV2(status)).toBe(status);
    }

    expect(() => assertBundleStatusTransitionV2("open", "ready")).not.toThrow();
    expect(() => assertBundleStatusTransitionV2("processing", "decided")).not.toThrow();
    expect(() => assertBundleStatusTransitionV2("decided", "open")).toThrow(Stage4B3MediaContractError);

    const matrix = listExhaustiveBundleStatusTransitionsV2();
    expect(matrix.length).toBe(INBOUND_MESSAGE_BUNDLE_STATUSES_V2.length ** 2);
    expect(matrix.some((entry) => entry.from === "superseded" && entry.to === "open" && entry.allowed === false)).toBe(
      true,
    );
  });

  it("maps legacy V1 bundle statuses without mutating unknown completed-with-decision rows", () => {
    expect(mapBundleStatusV1ToV2("open", null)).toEqual({ status: "open" });
    expect(mapBundleStatusV1ToV2("completed", "decision-1")).toEqual({ status: "decided" });
    expect(mapBundleStatusV1ToV2("completed", null)).toEqual({
      status: "failed",
      failureCode: "legacy_completed_without_decision",
    });
    expect(mapBundleStatusV1ToV2("unexpected" as never, null)).toEqual({
      status: "failed",
      failureCode: "legacy_contract_unknown",
    });
  });

  it("requires actorType and sender on bundle items", () => {
    const item = createInboundMessageBundleItemV2({
      id: "item-1",
      tenantId: "tenant-1",
      bundleId: "bundle-1",
      actorType: "dietitian",
      senderId: "dietitian-1",
      messageId: "message-1",
      itemType: "text",
      observedAt: "2026-07-14T12:00:00.000Z",
      ordinal: 1,
      createdAt: "2026-07-14T12:00:00.000Z",
    });
    expect(item.actorType).toBe("dietitian");

    expect(() =>
      createInboundMessageBundleItemV2({
        id: "item-2",
        tenantId: "tenant-1",
        bundleId: "bundle-1",
        actorType: "client",
        senderId: "   ",
        messageId: "message-2",
        itemType: "text",
        observedAt: "2026-07-14T12:00:00.000Z",
        ordinal: 2,
        createdAt: "2026-07-14T12:00:00.000Z",
      }),
    ).toThrow(Stage4B3MediaContractError);

    const legacy = mapBundleItemV1ToV2({
      id: "legacy-item",
      tenantId: "tenant-1",
      bundleId: "bundle-1",
      messageId: "message-legacy",
      channelEventId: null,
      mediaAssetId: null,
      ordinal: 1,
      itemType: "image",
      captionText: null,
      replyToProviderMessageId: null,
      observedAt: "2026-07-14T12:00:00.000Z",
      createdAt: "2026-07-14T12:00:00.000Z",
    });
    expect(legacy.actorType).toBe("client");
    expect(legacy.senderId).toBe("tenant-1");
  });

  it("rejects visual_label_ocr elevation to user_label_text and parses evidence refs", () => {
    expect(() => assertVisualEvidenceSourceType("user_label_text")).toThrow(Stage4B3MediaContractError);
    expect(
      parseVisualEvidenceRefV2({
        sourceType: "visual_menu_match",
        authority: "approved_menu_exact",
        allowedUses: ["menu_exact_match"],
        analysisId: ANALYSIS_ID,
        approvedSourceId: null,
      }).sourceType,
    ).toBe("visual_menu_match");
  });

  it("parses strict correction requests and rejects unknown keys and limits", () => {
    const parsed = parseVisualCorrectionRequestV2({
      analysisId: ANALYSIS_ID,
      requestId: REQUEST_ID,
      expectedConversationRevision: 2,
      expectedAnalysisRevision: 1,
      reasonCode: "wrong_ocr_reading",
      explanation: "OCR missed lactose.",
      correctedOcrText: "laktoz",
      correctedEntityLabels: ["mercimek corbasi"],
    });
    expect(parsed.requestId).toBe(REQUEST_ID);

    expect(() =>
      parseVisualCorrectionRequestV2({
        analysisId: ANALYSIS_ID,
        requestId: REQUEST_ID,
        expectedConversationRevision: 2,
        expectedAnalysisRevision: 1,
        reasonCode: "wrong_ocr_reading",
        explanation: "OCR missed lactose.",
        unexpected: true,
      }),
    ).toThrow(Stage4B3MediaContractError);

    expect(() =>
      parseVisualCorrectionRequestV2({
        analysisId: "not-a-uuid",
        requestId: REQUEST_ID,
        expectedConversationRevision: 2,
        expectedAnalysisRevision: 1,
        reasonCode: "wrong_ocr_reading",
        explanation: "OCR missed lactose.",
      }),
    ).toThrow(Stage4B3MediaContractError);

    expect(() =>
      parseVisualCorrectionRequestV2({
        analysisId: ANALYSIS_ID,
        requestId: REQUEST_ID,
        expectedConversationRevision: 2,
        expectedAnalysisRevision: 1,
        reasonCode: "wrong_ocr_reading",
        explanation: "",
      }),
    ).toThrow(Stage4B3MediaContractError);
  });

  it("blocks raw OCR in provider context and allows only source-gated summaries", () => {
    const raw = createRawVisualOcrEvidence([{ text: "laktoz", confidence: 0.99, blockKind: "label" }]);
    expect(() => assertProviderContextExcludesRawOcr(raw)).toThrow(Stage4B3MediaContractError);

    const summary = buildSourceGatedVisualSummary({
      evidenceRef: {
        sourceType: "visual_label_ocr",
        authority: "limited_visual_label_conflict",
        allowedUses: ["forbidden_conflict_only"],
        analysisId: ANALYSIS_ID,
        approvedSourceId: null,
      },
      boundedTokens: ["forbidden:laktoz"],
    });
    expect(() => assertProviderContextExcludesRawOcr(summary)).not.toThrow();
  });

  it("extends client-safe DTO leak checks for snake_case and provider fields", () => {
    expect(() => assertClientSafeMediaPayloadV2({ assetId: "asset-1", raw_observation: {} })).toThrow(
      Stage4B3MediaContractError,
    );
    expect(() => assertClientSafeMediaPayloadV2({ assetId: "asset-1", signed_url: "https://example.test" })).toThrow(
      Stage4B3MediaContractError,
    );
    expect(() => assertClientSafeMediaPayloadV2({ assetId: "asset-1", reviewState: "required" })).not.toThrow();
  });

  it("maps full legacy bundle records to V2 status contracts", () => {
    const mapped = mapBundleRecordV1ToV2({
      id: "bundle-1",
      tenantId: "tenant-1",
      clientId: "client-1",
      conversationId: "conversation-1",
      anchorMessageId: "message-1",
      status: "completed",
      openedAt: "2026-07-14T12:00:00.000Z",
      lastEventAt: "2026-07-14T12:00:00.000Z",
      readyAt: "2026-07-14T12:02:00.000Z",
      bundleRevision: 1,
      conversationRevisionAtOpen: 1,
      itemCount: 1,
      imageCount: 1,
      unicodeCodepointCount: 10,
      retryCount: 0,
      nextAttemptAt: null,
      leaseExpiresAt: null,
      decisionId: null,
      failureCode: null,
      createdAt: "2026-07-14T12:00:00.000Z",
      updatedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(mapped.status).toBe("failed");
    expect(mapped.failureCode).toBe("legacy_completed_without_decision");
  });
});
