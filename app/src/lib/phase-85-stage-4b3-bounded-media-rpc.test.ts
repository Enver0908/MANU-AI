import { describe, expect, it } from "vitest";
import { FORBIDDEN_CLIENT_MEDIA_DTO_KEYS } from "./phase-85-stage-4b3-media-contracts";
import { mapBoundedMediaRpcV2Payload } from "./phase-85-stage-4b3-bounded-media-rpc";
import {
  projectConversationMessageWithMedia,
  resolveMediaStreamHttpStatus,
} from "./phase-85-stage-4b3-bounded-media";
import { projectConversationMessage } from "./phase-85-stage-4b2-api";
import type { ConversationProjectionMessage } from "./phase-85-stage-4b2-contracts";
import { buildAsset } from "./phase-85-stage-4b3-bounded-media.test";
import { DEMO_TENANT_ID } from "./seed-data";
import {
  reasonRequiresCorrectedEntityLabels,
  reasonRequiresCorrectedOcrText,
  reasonRequiresCorrectedSceneType,
  resolveVisualCorrectionReasonLabel,
} from "./phase-85-stage-4b3-visual-review-labels";

describe("phase-85-stage-4b3-bounded-media-rpc", () => {
  it("maps bounded RPC payload without forbidden DTO keys", () => {
    const mapped = mapBoundedMediaRpcV2Payload({
      tenantId: DEMO_TENANT_ID,
      conversationId: "conversation-1",
      clientId: "client-1",
      payload: {
        media_assets: [
          {
            id: "asset-1",
            message_id: "message-1",
            status: "analysis_ready",
            declared_mime_type: "image/jpeg",
            detected_mime_type: "image/jpeg",
            width: 640,
            height: 480,
            expires_at: null,
            has_thumbnail: true,
          },
        ],
        visual_analysis_records: [
          {
            id: "analysis-1",
            media_asset_id: "asset-1",
            message_id: "message-1",
            bundle_id: "bundle-1",
            analysis_revision: 1,
            status: "ready",
            scene_type: "meal",
            retrieval_eligible: true,
          },
        ],
        inbound_message_bundles: [
          {
            id: "bundle-1",
            anchor_message_id: "message-1",
            status: "review_required",
          },
        ],
        visual_corrections: [],
      },
    });

    const message: ConversationProjectionMessage = {
      id: "message-1",
      tenantId: DEMO_TENANT_ID,
      conversationId: "conversation-1",
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
    const dto = projectConversationMessageWithMedia(
      message,
      { tenantId: DEMO_TENANT_ID, dietitianId: "dietitian-1", role: "dietitian" },
      mapped,
      projectConversationMessage(message),
    );
    const serialized = JSON.stringify(dto);
    for (const key of FORBIDDEN_CLIENT_MEDIA_DTO_KEYS) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(mapped.visualAnalysisRecords[0]?.observation?.providerId).toBe("bounded_projection");
    expect(dto.visualReview?.entitySummary).toEqual([]);
  });

  it("hides visual review from assistant while keeping media DTOs", () => {
    const message: ConversationProjectionMessage = {
      id: "message-1",
      tenantId: DEMO_TENANT_ID,
      conversationId: "conversation-1",
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
    const media = mapBoundedMediaRpcV2Payload({
      tenantId: DEMO_TENANT_ID,
      conversationId: "conversation-1",
      clientId: "client-1",
      payload: {
        media_assets: [
          {
            id: "asset-1",
            message_id: "message-1",
            status: "analysis_ready",
            declared_mime_type: "image/jpeg",
            detected_mime_type: "image/jpeg",
            width: 640,
            height: 480,
            expires_at: null,
            has_thumbnail: true,
          },
        ],
        visual_analysis_records: [
          {
            id: "analysis-1",
            media_asset_id: "asset-1",
            message_id: "message-1",
            bundle_id: "bundle-1",
            analysis_revision: 1,
            status: "ready",
            scene_type: "meal",
            retrieval_eligible: true,
          },
        ],
        inbound_message_bundles: [
          {
            id: "bundle-1",
            anchor_message_id: "message-1",
            status: "review_required",
          },
        ],
        visual_corrections: [],
      },
    });

    const dietitianDto = projectConversationMessageWithMedia(
      message,
      { tenantId: DEMO_TENANT_ID, dietitianId: "dietitian-1", role: "dietitian" },
      media,
      projectConversationMessage(message),
    );
    const assistantDto = projectConversationMessageWithMedia(
      message,
      { tenantId: DEMO_TENANT_ID, dietitianId: "assistant-1", role: "assistant" },
      media,
      projectConversationMessage(message),
    );

    expect(dietitianDto.media).toHaveLength(1);
    expect(dietitianDto.visualReview).not.toBeNull();
    expect(assistantDto.media).toHaveLength(1);
    expect(assistantDto.visualReview).toBeNull();
  });

  it("returns 410 for deletion-pending media assets", () => {
    expect(
      resolveMediaStreamHttpStatus(
        buildAsset({ deletedAt: "2026-07-14T10:00:00.000Z" }),
        "thumbnail",
      ),
    ).toBe(410);
  });
});

describe("phase-85-stage-4b3-visual-review-labels", () => {
  it("localizes correction reasons and gates bounded fields by reason", () => {
    expect(resolveVisualCorrectionReasonLabel("tr", "wrong_scene")).toContain("sahne");
    expect(reasonRequiresCorrectedSceneType("wrong_scene")).toBe(true);
    expect(reasonRequiresCorrectedEntityLabels("wrong_food_candidate")).toBe(true);
    expect(reasonRequiresCorrectedOcrText("wrong_ocr_reading")).toBe(true);
    expect(reasonRequiresCorrectedSceneType("other_clinical_mismatch")).toBe(false);
  });
});
