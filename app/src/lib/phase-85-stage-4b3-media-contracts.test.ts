import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  INBOUND_MESSAGE_BUNDLE_STATUSES,
  MEDIA_ASSET_STATUSES,
  PHASE_85_STAGE_4B3_MEDIA_CONTRACT_VERSION,
  STAGE_4B3_IMAGE_CHANNEL_EVENT_KIND,
  VISUAL_CORRECTION_STATUSES,
  VISUAL_OBSERVATION_SCHEMA_VERSION,
  VISUAL_SCENE_TYPES,
  assertClientSafeMediaPayload,
  assertVisualSceneExhaustive,
  buildConversationMediaDto,
  buildVisualReviewDto,
  createEmptyStage4B3MediaCollections,
  evaluateVisualAutopilotEligibility,
  mergeVisualRiskOverlay,
  parseVisualObservationV1,
  Stage4B3MediaContractError,
  type VisualObservationV1,
} from "./phase-85-stage-4b3-media-contracts";
import { CHANNEL_EVENT_KINDS } from "./phase-85-if-b-provenance-model";

function buildSampleObservation(overrides: Partial<VisualObservationV1> = {}): VisualObservationV1 {
  return {
    schemaVersion: VISUAL_OBSERVATION_SCHEMA_VERSION,
    sceneType: "meal",
    sceneConfidence: 0.98,
    overallConfidence: 0.97,
    qualityFlags: [],
    entityCandidates: [
      {
        label: "Mercimek Corbasi",
        normalizedLabel: "mercimek corbasi",
        confidence: 0.98,
        candidateKind: "food",
      },
    ],
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
    ...overrides,
  };
}

describe("phase-85-stage-4b3-media-contracts", () => {
  it("exports locked vocabulary and channel event kind", () => {
    expect(PHASE_85_STAGE_4B3_MEDIA_CONTRACT_VERSION).toBe("p85-stage-4b3-media-contracts-v1");
    expect(STAGE_4B3_IMAGE_CHANNEL_EVENT_KIND).toBe("client_message_image");
    expect(CHANNEL_EVENT_KINDS).toContain("client_message_image");
    expect(VISUAL_SCENE_TYPES).toHaveLength(9);
    expect(MEDIA_ASSET_STATUSES).toHaveLength(9);
    expect(MEDIA_ASSET_STATUSES).toContain("deletion_pending");
    expect(INBOUND_MESSAGE_BUNDLE_STATUSES).toHaveLength(9);
    expect(VISUAL_CORRECTION_STATUSES).toHaveLength(4);
  });

  it("covers every scene type exhaustively", () => {
    for (const sceneType of VISUAL_SCENE_TYPES) {
      expect(assertVisualSceneExhaustive(sceneType)).toBe(sceneType);
    }
  });

  it("round-trips visual observation schema and rejects unknown keys", () => {
    const observation = buildSampleObservation();
    expect(parseVisualObservationV1(observation)).toEqual(observation);
    expect(() => parseVisualObservationV1({ ...observation, extra: true })).toThrow(Stage4B3MediaContractError);
    expect(() => parseVisualObservationV1({ ...observation, sceneConfidence: 1.2 })).toThrow(Stage4B3MediaContractError);
    expect(() => parseVisualObservationV1({ ...observation, schemaVersion: "wrong" })).toThrow(Stage4B3MediaContractError);
  });

  it("never downgrades visual risk overlay", () => {
    expect(mergeVisualRiskOverlay("green", "yellow")).toBe("yellow");
    expect(mergeVisualRiskOverlay("yellow", "green")).toBe("yellow");
    expect(mergeVisualRiskOverlay("yellow", "red")).toBe("red");
    expect(mergeVisualRiskOverlay("red", "yellow")).toBe("red");
  });

  it("redacts client-safe media DTO fields", () => {
    const dto = buildConversationMediaDto(
      {
        id: "asset-1",
        messageId: "message-1",
        status: "analysis_ready",
        declaredMimeType: "image/jpeg",
        detectedMimeType: "image/jpeg",
        dimensions: { width: 640, height: 480 },
        expiresAt: "2026-08-12T00:00:00.000Z",
        thumbnailObjectKey: "tenant/asset/thumb.jpg",
      },
      "none",
    );

    expect(dto).not.toHaveProperty("thumbnailObjectKey");
    expect(dto).not.toHaveProperty("providerMediaId");
    expect(dto.hasThumbnail).toBe(true);
    assertClientSafeMediaPayload(dto);
    expect(() => assertClientSafeMediaPayload({ assetId: "asset-1", ocrText: "secret" })).toThrow(
      Stage4B3MediaContractError,
    );
  });

  it("limits visual review DTO to authorized dietitian roles", () => {
    const analysis = {
      id: "analysis-1",
      analysisRevision: 1,
      mediaAssetId: "asset-1",
      messageId: "message-1",
      bundleId: "bundle-1",
      observation: buildSampleObservation(),
    };

    expect(
      buildVisualReviewDto({ role: "dietitian", analysis, reviewState: "required", latestCorrectionId: null })?.sceneType,
    ).toBe("meal");
    expect(
      buildVisualReviewDto({ role: "assistant", analysis, reviewState: "required", latestCorrectionId: null }),
    ).toBeNull();
    expect(buildVisualReviewDto({ role: "auditor", analysis, reviewState: "required", latestCorrectionId: null })).toBeNull();
    const review = buildVisualReviewDto({
      role: "dietitian",
      analysis,
      reviewState: "required",
      latestCorrectionId: null,
    });
    assertClientSafeMediaPayload(review);
  });

  it("marks non-autopilot and low-confidence visual scenes ineligible", () => {
    const eligible = evaluateVisualAutopilotEligibility({
      observation: buildSampleObservation(),
      bundleOverflow: false,
      assetReady: true,
      correctionPending: false,
    });
    expect(eligible.eligible).toBe(true);

    const supplement = evaluateVisualAutopilotEligibility({
      observation: buildSampleObservation({ sceneType: "supplement_or_medication" }),
      bundleOverflow: false,
      assetReady: true,
      correctionPending: false,
    });
    expect(supplement.eligible).toBe(false);
    expect(supplement.reasonCodes).toContain("scene_not_allowlisted");

    const injection = evaluateVisualAutopilotEligibility({
      observation: buildSampleObservation({ promptInjectionSignals: ["ignore_previous_instructions"] }),
      bundleOverflow: false,
      assetReady: true,
      correctionPending: false,
    });
    expect(injection.eligible).toBe(false);
    expect(injection.reasonCodes).toContain("prompt_injection_signal");
  });

  it("keeps legacy text seed state compatible with empty media collections", () => {
    const state = createInitialState();
    expect(state.messages.length).toBeGreaterThan(0);
    expect(createEmptyStage4B3MediaCollections()).toEqual({
      mediaAssets: [],
      visualAnalysisRecords: [],
      inboundMessageBundles: [],
      inboundMessageBundleItems: [],
      visualCorrections: [],
      processedBundleDecisionKeys: [],
      bundleDecisionReplayByKey: {},
      processedVisualCorrectionRequestIds: [],
      visualCorrectionReplayByRequestId: {},
    });
    expect(state.mediaAssets).toEqual([]);
    expect(state.inboundMessageBundles).toEqual([]);
  });
});
