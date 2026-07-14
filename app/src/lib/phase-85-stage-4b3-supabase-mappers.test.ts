import { describe, expect, it } from "vitest";
import {
  mapInboundMessageBundle,
  mapInboundMessageBundleItem,
  mapMediaAsset,
  mapVisualAnalysisRecord,
  mapVisualCorrection,
  type DbInboundMessageBundle,
  type DbInboundMessageBundleItem,
  type DbMediaAsset,
  type DbVisualAnalysisRecord,
  type DbVisualCorrection,
} from "./phase-85-stage-4b3-supabase-mappers";
import { VISUAL_OBSERVATION_SCHEMA_VERSION } from "./phase-85-stage-4b3-media-contracts";

const baseAsset: DbMediaAsset = {
  id: "asset-1",
  tenant_id: "tenant-1",
  client_id: "client-1",
  conversation_id: "conversation-1",
  message_id: "message-1",
  channel_event_id: "event-1",
  position: 1,
  provider_media_id: null,
  provider_media_id_hash: "hash-1",
  declared_mime_type: "image/jpeg",
  detected_mime_type: "image/jpeg",
  width: 640,
  height: 480,
  byte_size: 1200,
  content_sha256: "sha-1",
  sanitized_full_object_key: "tenant/asset/full.jpg",
  thumbnail_object_key: "tenant/asset/thumb.jpg",
  status: "analysis_ready",
  retry_count: 0,
  next_attempt_at: null,
  lease_expires_at: null,
  lease_owner: null,
  stored_at: "2026-07-13T00:00:00.000Z",
  expires_at: "2026-08-12T00:00:00.000Z",
  deleted_at: null,
  failure_code: null,
  created_at: "2026-07-13T00:00:00.000Z",
  updated_at: "2026-07-13T00:00:00.000Z",
};

describe("phase-85-stage-4b3-supabase-mappers", () => {
  it("maps media asset rows into domain records", () => {
    const mapped = mapMediaAsset(baseAsset);
    expect(mapped.tenantId).toBe("tenant-1");
    expect(mapped.dimensions).toEqual({ width: 640, height: 480 });
    expect(mapped.status).toBe("analysis_ready");
  });

  it("maps visual analysis observation json when valid", () => {
    const row: DbVisualAnalysisRecord = {
      id: "analysis-1",
      tenant_id: "tenant-1",
      client_id: "client-1",
      conversation_id: "conversation-1",
      media_asset_id: "asset-1",
      message_id: "message-1",
      bundle_id: "bundle-1",
      analysis_revision: 1,
      status: "ready",
      observation: {
        schemaVersion: VISUAL_OBSERVATION_SCHEMA_VERSION,
        sceneType: "meal",
        sceneConfidence: 0.98,
        overallConfidence: 0.97,
        qualityFlags: [],
        entityCandidates: [],
        ocrBlocks: [],
        labelIntegrity: {
          completePanel: true,
          ingredientsHeaderPresent: true,
          cropOrGlareSuspected: false,
        },
        sensitivitySignals: [],
        promptInjectionSignals: [],
        providerId: "mock-local-vision",
        providerVersion: "mock-v1",
      },
      superseded_by_analysis_id: null,
      failure_code: null,
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    };

    expect(mapVisualAnalysisRecord(row).observation?.sceneType).toBe("meal");
    expect(mapVisualAnalysisRecord({ ...row, observation: { invalid: true } }).observation).toBeNull();
  });

  it("maps bundle, bundle item, and correction rows", () => {
    const bundle: DbInboundMessageBundle = {
      id: "bundle-1",
      tenant_id: "tenant-1",
      client_id: "client-1",
      conversation_id: "conversation-1",
      anchor_message_id: "message-1",
      status: "ready",
      opened_at: "2026-07-13T00:00:00.000Z",
      last_event_at: "2026-07-13T00:00:00.000Z",
      ready_at: "2026-07-13T00:02:00.000Z",
      bundle_revision: 2,
      conversation_revision_at_open: 4,
      item_count: 2,
      image_count: 1,
      unicode_codepoint_count: 42,
      retry_count: 0,
      next_attempt_at: null,
      lease_expires_at: null,
      lease_owner: null,
      decision_id: null,
      failure_code: null,
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    };
    const item: DbInboundMessageBundleItem = {
      id: "item-1",
      tenant_id: "tenant-1",
      bundle_id: "bundle-1",
      message_id: "message-1",
      channel_event_id: "event-1",
      media_asset_id: "asset-1",
      ordinal: 1,
      item_type: "image",
      caption_text: null,
      reply_to_provider_message_id: null,
      actor_type: "dietitian",
      sender_id: "dietitian-1",
      observed_at: "2026-07-13T00:00:00.000Z",
      created_at: "2026-07-13T00:00:00.000Z",
    };
    const correction: DbVisualCorrection = {
      id: "correction-1",
      tenant_id: "tenant-1",
      client_id: "client-1",
      conversation_id: "conversation-1",
      analysis_id: "analysis-1",
      dietitian_id: "dietitian-1",
      status: "submitted",
      reason_code: "wrong_scene",
      explanation: "Scene mismatch",
      corrected_scene_type: "unknown",
      corrected_ocr_text: null,
      corrected_entity_labels: [],
      conversation_revision_at_submit: 4,
      analysis_revision_at_submit: 1,
      result_action: "supersede_rerun",
      created_at: "2026-07-13T00:00:00.000Z",
      updated_at: "2026-07-13T00:00:00.000Z",
    };

    expect(mapInboundMessageBundle(bundle).status).toBe("ready");
    expect(mapInboundMessageBundleItem(item).itemType).toBe("image");
    expect(mapInboundMessageBundleItem(item).actorType).toBe("dietitian");
    expect(mapVisualCorrection(correction).reasonCode).toBe("wrong_scene");
  });
});
