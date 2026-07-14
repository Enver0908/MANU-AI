import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppTenantContext } from "./auth-context";
import { conversationActorFromContext } from "./phase-85-stage-4b2-messaging";
import type { Stage4B3ConversationMediaProjectionSource } from "./phase-85-stage-4b3-bounded-media";
import {
  VISUAL_OBSERVATION_SCHEMA_VERSION,
  type InboundMessageBundleRecord,
  type MediaAssetRecord,
  type VisualAnalysisRecord,
  type VisualCorrectionRecord,
  type VisualObservationV1,
  type VisualSceneType,
} from "./phase-85-stage-4b3-media-contracts";

export const STAGE_4B3_BOUNDED_MEDIA_RPC_VERSION = "p85-stage-4b3-bounded-media-rpc-v2";

type BoundedMediaRpcAsset = {
  id: string;
  message_id: string;
  status: MediaAssetRecord["status"];
  declared_mime_type: string;
  detected_mime_type: string | null;
  width: number | null;
  height: number | null;
  expires_at: string | null;
  has_thumbnail: boolean;
};

type BoundedMediaRpcAnalysis = {
  id: string;
  media_asset_id: string;
  message_id: string;
  bundle_id: string | null;
  analysis_revision: number;
  status: VisualAnalysisRecord["status"];
  scene_type: string | null;
  retrieval_eligible: boolean;
};

type BoundedMediaRpcBundle = {
  id: string;
  anchor_message_id: string;
  status: InboundMessageBundleRecord["status"];
};

type BoundedMediaRpcCorrection = {
  id: string;
  analysis_id: string;
  status: VisualCorrectionRecord["status"];
  created_at: string;
};

function buildBoundedSceneObservation(sceneType: VisualSceneType): VisualObservationV1 {
  return {
    schemaVersion: VISUAL_OBSERVATION_SCHEMA_VERSION,
    sceneType,
    sceneConfidence: 0,
    overallConfidence: 0,
    qualityFlags: [],
    entityCandidates: [],
    ocrBlocks: [],
    labelIntegrity: {
      completePanel: false,
      ingredientsHeaderPresent: false,
      cropOrGlareSuspected: false,
    },
    sensitivitySignals: [],
    promptInjectionSignals: [],
    providerId: "bounded_projection",
    providerVersion: STAGE_4B3_BOUNDED_MEDIA_RPC_VERSION,
  };
}

function normalizeSceneType(value: string | null | undefined): VisualSceneType {
  const normalized = value?.trim();
  if (
    normalized === "meal" ||
    normalized === "packaged_food_label" ||
    normalized === "supplement_or_medication" ||
    normalized === "screenshot_or_document" ||
    normalized === "lab_or_medical_document" ||
    normalized === "body_or_symptom" ||
    normalized === "sensitive_identity_document" ||
    normalized === "other" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return "unknown";
}

export function mapBoundedMediaRpcV2Payload(input: {
  tenantId: string;
  conversationId: string;
  clientId: string;
  payload: {
    media_assets?: BoundedMediaRpcAsset[];
    visual_analysis_records?: BoundedMediaRpcAnalysis[];
    inbound_message_bundles?: BoundedMediaRpcBundle[];
    visual_corrections?: BoundedMediaRpcCorrection[];
  };
}): Stage4B3ConversationMediaProjectionSource {
  const now = new Date().toISOString();
  const mediaAssets: MediaAssetRecord[] = (input.payload.media_assets ?? []).map((row) => ({
    id: row.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    conversationId: input.conversationId,
    messageId: row.message_id,
    channelEventId: "",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: null,
    declaredMimeType: row.declared_mime_type,
    detectedMimeType: row.detected_mime_type,
    dimensions:
      row.width != null && row.height != null ? { width: row.width, height: row.height } : null,
    byteSize: null,
    contentSha256: null,
    sanitizedFullObjectKey: null,
    thumbnailObjectKey: row.has_thumbnail ? "__bounded_has_thumbnail__" : null,
    status: row.status,
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    storedAt: now,
    expiresAt: row.expires_at,
    deletedAt: null,
    failureCode: null,
    createdAt: now,
    updatedAt: now,
  }));

  const visualAnalysisRecords: VisualAnalysisRecord[] = (input.payload.visual_analysis_records ?? []).map(
    (row) => ({
      id: row.id,
      tenantId: input.tenantId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      mediaAssetId: row.media_asset_id,
      messageId: row.message_id,
      bundleId: row.bundle_id,
      analysisRevision: row.analysis_revision,
      status: row.status,
      observation: row.scene_type
        ? buildBoundedSceneObservation(normalizeSceneType(row.scene_type))
        : null,
      supersededByAnalysisId: null,
      failureCode: null,
      retrievalEligible: row.retrieval_eligible,
      createdAt: now,
      updatedAt: now,
    }),
  );

  const inboundMessageBundles: InboundMessageBundleRecord[] = (input.payload.inbound_message_bundles ?? []).map(
    (row) => ({
      id: row.id,
      tenantId: input.tenantId,
      clientId: input.clientId,
      conversationId: input.conversationId,
      anchorMessageId: row.anchor_message_id,
      status: row.status,
      openedAt: now,
      lastEventAt: now,
      readyAt: now,
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
      createdAt: now,
      updatedAt: now,
    }),
  );

  const visualCorrections: VisualCorrectionRecord[] = (input.payload.visual_corrections ?? []).map((row) => ({
    id: row.id,
    tenantId: input.tenantId,
    clientId: input.clientId,
    conversationId: input.conversationId,
    analysisId: row.analysis_id,
    dietitianId: "",
    status: row.status,
    reasonCode: "other_clinical_mismatch",
    explanation: "",
    correctedSceneType: null,
    correctedOcrText: null,
    correctedEntityLabels: [],
    conversationRevisionAtSubmit: 1,
    analysisRevisionAtSubmit: 1,
    resultAction: "manual_follow_up",
    createdAt: row.created_at,
    updatedAt: row.created_at,
  }));

  return {
    mediaAssets,
    visualAnalysisRecords,
    inboundMessageBundles,
    visualCorrections,
  };
}

export async function loadBoundedMediaProjectionFromSupabaseV2(input: {
  supabase: SupabaseClient;
  context: AppTenantContext;
  conversationId: string;
  clientId: string;
  messageIds: string[];
}): Promise<Stage4B3ConversationMediaProjectionSource> {
  const actor = conversationActorFromContext(input.context);
  const { data, error } = await input.supabase.rpc("p85_stage_4b3_load_bounded_media_v2", {
    p_tenant_id: actor.tenantId,
    p_user_id: actor.userId,
    p_dietitian_id: actor.dietitianId,
    p_role: actor.role,
    p_conversation_id: input.conversationId,
    p_message_ids: input.messageIds,
  });
  if (error) {
    throw error;
  }

  return mapBoundedMediaRpcV2Payload({
    tenantId: actor.tenantId,
    conversationId: input.conversationId,
    clientId: input.clientId,
    payload: (data ?? {}) as {
      media_assets?: BoundedMediaRpcAsset[];
      visual_analysis_records?: BoundedMediaRpcAnalysis[];
      inbound_message_bundles?: BoundedMediaRpcBundle[];
      visual_corrections?: BoundedMediaRpcCorrection[];
    },
  });
}
