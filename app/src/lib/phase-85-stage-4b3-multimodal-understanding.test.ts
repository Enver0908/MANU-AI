import { describe, expect, it } from "vitest";
import {
  findExactMenuItemMatch,
  resolveVisualMeaningV1,
} from "dietitian-ai-assistant-architecture";
import { DEMO_TENANT_ID, createInitialState, DEMO_DIETITIAN_ID } from "./seed-data";
import {
  buildMultimodalMessageEnvelope,
  STAGE_4B3_MAX_VISUAL_PROVIDER_CONTEXT_BYTES,
} from "./phase-85-stage-4b3-multimodal-envelope";
import { getActiveClientMenuPlan, resolveMultimodalBundleUnderstanding } from "./phase-85-stage-4b3-multimodal-understanding";
import {
  buildVisualObservationFromFixtureTemplate,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import {
  type InboundMessageBundleItemRecord,
  type InboundMessageBundleRecord,
  type MediaAssetRecord,
  type MultimodalVisualSegment,
  type VisualAnalysisRecord,
} from "./phase-85-stage-4b3-media-contracts";
import type { ClientMenuPlanV1Record, ManuAppState } from "./types";

function buildReadyBundleState(input: {
  observation: MultimodalVisualSegment["observation"];
  textSegments?: Array<{ messageId: string; body: string; replyToProviderMessageId?: string | null }>;
  menuPlan?: ClientMenuPlanV1Record | null;
  foodRuleForbidden?: string[];
}): ManuAppState {
  const state = createInitialState();
  const bundleId = "bundle-mm-1";
  const conversationId = state.conversations[0]!.id;
  const clientId = state.conversations[0]!.clientId;
  const imageMessageId = "message-image-1";
  const assetId = "asset-mm-1";
  const analysisId = "analysis-mm-1";

  const bundle: InboundMessageBundleRecord = {
    id: bundleId,
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    anchorMessageId: imageMessageId,
    status: "ready",
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
  };

  const bundleItems: InboundMessageBundleItemRecord[] = [
    {
      id: "bundle-item-1",
      tenantId: DEMO_TENANT_ID,
      bundleId,
      messageId: imageMessageId,
      channelEventId: "channel-event-1",
      mediaAssetId: assetId,
      ordinal: 1,
      itemType: "image",
      captionText: null,
      replyToProviderMessageId: null,
      observedAt: "2026-07-14T10:00:00.000Z",
      createdAt: "2026-07-14T10:00:00.000Z",
    },
  ];

  const messages = [
    ...state.messages,
    {
      id: imageMessageId,
      tenantId: DEMO_TENANT_ID,
      conversationId,
      sender: "client" as const,
      origin: "client_inbound" as const,
      body: "[client image]",
      status: "stored" as const,
      contentStatus: "available" as const,
      retrievalEligibility: "excluded_media_only" as const,
      providerAccountBindingId: "account-binding-1",
      providerEventId: "wamid.IMG_MM_1",
      providerMessageId: "wamid.IMG_MM_1",
      actorType: "client" as const,
      actorBindingId: null,
      authorInterface: "client_channel" as const,
      actorResolutionBasis: "provider_counterparty" as const,
      providerSentAt: "2026-07-14T10:00:00.000Z",
      observedAt: "2026-07-14T10:00:00.000Z",
      persistedAt: "2026-07-14T10:00:00.000Z",
      createdAt: "2026-07-14T10:00:00.000Z",
    },
  ];

  for (const [index, text] of (input.textSegments ?? []).entries()) {
    bundleItems.push({
      id: `bundle-item-text-${index + 1}`,
      tenantId: DEMO_TENANT_ID,
      bundleId,
      messageId: text.messageId,
      channelEventId: `channel-event-text-${index + 1}`,
      mediaAssetId: null,
      ordinal: bundleItems.length + 1,
      itemType: "text",
      captionText: null,
      replyToProviderMessageId: text.replyToProviderMessageId ?? null,
      observedAt: `2026-07-14T10:0${index + 1}:00.000Z`,
      createdAt: `2026-07-14T10:0${index + 1}:00.000Z`,
    });
    messages.push({
      id: text.messageId,
      tenantId: DEMO_TENANT_ID,
      conversationId,
      sender: "client" as const,
      origin: "client_inbound" as const,
      body: text.body,
      status: "stored" as const,
      contentStatus: "available" as const,
      retrievalEligibility: "eligible" as const,
      providerAccountBindingId: "account-binding-1",
      providerEventId: `wamid.TEXT_MM_${index + 1}`,
      providerMessageId: `wamid.TEXT_MM_${index + 1}`,
      actorType: "client" as const,
      actorBindingId: null,
      authorInterface: "client_channel" as const,
      actorResolutionBasis: "provider_counterparty" as const,
      providerSentAt: `2026-07-14T10:0${index + 1}:00.000Z`,
      observedAt: `2026-07-14T10:0${index + 1}:00.000Z`,
      persistedAt: `2026-07-14T10:0${index + 1}:00.000Z`,
      createdAt: `2026-07-14T10:0${index + 1}:00.000Z`,
    });
    bundle.itemCount += 1;
  }

  const asset: MediaAssetRecord = {
    id: assetId,
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    messageId: imageMessageId,
    channelEventId: "channel-event-1",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: "hash-1",
    declaredMimeType: "image/jpeg",
    detectedMimeType: "image/jpeg",
    dimensions: { width: 640, height: 480 },
    byteSize: 12000,
    contentSha256: "abc123",
    sanitizedFullObjectKey: "tenant/asset/full.jpg",
    thumbnailObjectKey: "tenant/asset/thumb.jpg",
    status: "analysis_ready",
    retryCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    storedAt: "2026-07-14T10:00:00.000Z",
    expiresAt: "2026-08-14T10:00:00.000Z",
    deletedAt: null,
    failureCode: null,
    createdAt: "2026-07-14T10:00:00.000Z",
    updatedAt: "2026-07-14T10:00:00.000Z",
  };

  const analysis: VisualAnalysisRecord = {
    id: analysisId,
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    mediaAssetId: assetId,
    messageId: imageMessageId,
    bundleId,
    analysisRevision: 1,
    status: "ready",
    observation: input.observation,
    supersededByAnalysisId: null,
    failureCode: null,
    createdAt: "2026-07-14T10:00:00.000Z",
    updatedAt: "2026-07-14T10:00:00.000Z",
  };

  const menuPlan =
    input.menuPlan ??
    ({
      id: "menu-plan-1",
      tenantId: DEMO_TENANT_ID,
      clientId,
      dietitianId: DEMO_DIETITIAN_ID,
      templateType: "day_by_day_detailed",
      status: "active",
      version: 1,
      revision: 1,
      title: "Aktif plan",
      effectiveDate: "2026-07-01",
      mealSlots: [
        {
          id: "slot-1",
          dayKey: "pzt",
          mealKey: "ogle",
          label: "Ogle",
          items: [
            {
              id: "menu-item-1",
              label: "Izgara tavuk",
              freeText: "izgara tavuk",
              catalogFoodIds: [],
              catalogMatch: { query: "izgara tavuk", catalogFoodId: null, catalogFoodName: "izgara tavuk", matchConfidence: "exact" },
              portionNote: "",
              recipe: { title: "Izgara tavuk", ingredients: ["tavuk"], instructions: "" },
            },
          ],
          alternatives: [],
        },
      ],
      preferredFoods: [],
      avoidFoods: [],
      dietitianNotes: "",
      clientFacingNotes: "",
      exportVisible: true,
      migratedFromLegacyDietPlan: false,
      catalogVersion: "v1",
      catalogSourceSha256: "sha",
      catalogRecordSetSha256: "sha",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      activatedAt: "2026-07-01T00:00:00.000Z",
    } satisfies ClientMenuPlanV1Record);

  return {
    ...state,
    messages,
    inboundMessageBundles: [bundle],
    inboundMessageBundleItems: bundleItems,
    mediaAssets: [asset],
    visualAnalysisRecords: [analysis],
    clientMenuPlans: [menuPlan],
    clientFoodRuleProfiles:
      input.foodRuleForbidden && input.foodRuleForbidden.length > 0
        ? [
            {
              id: "food-rule-1",
              tenantId: DEMO_TENANT_ID,
              clientId,
              dietitianId: DEMO_DIETITIAN_ID,
              version: 1,
              status: "published",
              revision: 1,
              allowedCatalogMainCategoryIds: [],
              allowedCatalogSubCategoryIds: [],
              allowedCatalogFoodIds: [],
              forbiddenCatalogMainCategoryIds: [],
              forbiddenCatalogSubCategoryIds: [],
              forbiddenCatalogFoodIds: [],
              allowedFoodGroups: [],
              forbiddenFoodGroups: [],
              freeTextAllowedFoods: [],
              freeTextForbiddenFoods: input.foodRuleForbidden,
              forbiddenIngredientKeywords: input.foodRuleForbidden,
              dietTypeRestrictions: [],
              flexibilityGlobal: "moderate",
              flexibilityByMeal: {},
              flexibilityByGoal: {},
              flexibilityByFoodGroup: {},
              notes: "",
              migratedFromLegacy76d: false,
              catalogVersion: "v1",
              catalogSourceSha256: "sha",
              catalogRecordSetSha256: "sha",
              createdAt: "2026-07-01T00:00:00.000Z",
              updatedAt: "2026-07-01T00:00:00.000Z",
              publishedAt: "2026-07-01T00:00:00.000Z",
            },
          ]
        : state.clientFoodRuleProfiles,
  };
}

describe("phase-85-stage-4b3-multimodal-envelope", () => {
  it("builds chronological envelope segments and keeps provider context under 12 KiB without raw media", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildReadyBundleState({ observation });
    const built = buildMultimodalMessageEnvelope(state, "bundle-mm-1");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.textSegments).toHaveLength(0);
    expect(built.envelope.visualSegments).toHaveLength(1);
    expect(built.envelope.visualSegments[0]?.captionText).toBeNull();
    expect(built.providerContext.withinLimit).toBe(true);
    expect(built.providerContext.byteSize).toBeLessThanOrEqual(STAGE_4B3_MAX_VISUAL_PROVIDER_CONTEXT_BYTES);
    expect(JSON.stringify(built.providerContext)).not.toMatch(/https?:\/\//);
  });
});

describe("phase-85-stage-4b3-multimodal-understanding", () => {
  it("matches core resolver parity for fixture meal observation", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const activeMenu = {
      mealSlots: [
        {
          items: [
            {
              id: "menu-item-1",
              label: "Izgara tavuk",
              freeText: "izgara tavuk",
              catalogMatch: { catalogFoodName: "izgara tavuk" },
              recipe: { title: "Izgara tavuk", ingredients: ["tavuk"] },
            },
          ],
          alternatives: [],
        },
      ],
    };
    const result = resolveVisualMeaningV1({
      envelope: {
        bundleId: "bundle-core-parity",
        textSegments: [],
        visualSegments: [
          {
            messageId: "msg-1",
            mediaAssetId: "asset-1",
            analysisId: "analysis-1",
            observation,
            captionText: null,
            observedAt: "2026-07-14T10:00:00.000Z",
          },
        ],
      },
      activeMenu,
      foodRules: {},
    });
    expect(result.visualSegments[0]?.workflowState).toBe("meal_exact_menu");
  });

  it("resolves exact active-menu meal authority", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildReadyBundleState({ observation });
    const menu = getActiveClientMenuPlan(state, state.inboundMessageBundles[0]!.clientId);
    expect(menu).not.toBeNull();
    expect(findExactMenuItemMatch(menu, "izgara tavuk")).not.toBeNull();
    const built = buildMultimodalMessageEnvelope(state, "bundle-mm-1");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.envelope.visualSegments[0]?.captionText).toBeNull();
    const result = resolveMultimodalBundleUnderstanding(state, "bundle-mm-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.visualSegments[0]?.workflowState).toBe("meal_exact_menu");
    expect(result.meaning.absenceOfEvidenceAllowedCount).toBe(0);
    expect(result.envelope.sourceAuthorityState).toBe("approved_only");
  });

  it("keeps ambiguous meal scenes without approved authority", () => {
    const observation = buildVisualObservationFromFixtureTemplate({
      ...STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate,
      entityCandidates: [
        STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate.entityCandidates[0]!,
        {
          label: "Pilav",
          normalizedLabel: "pilav",
          confidence: 0.96,
          candidateKind: "food",
        },
      ],
    });
    const result = resolveMultimodalBundleUnderstanding(buildReadyBundleState({ observation }), "bundle-mm-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.visualSegments[0]?.workflowState).toBe("meal_ambiguous");
    expect(result.envelope.sourceAuthorityState).toBe("unresolved");
  });

  it("never grants product allowed authority from label absence", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.packaged_food_label_complete);
    const result = resolveMultimodalBundleUnderstanding(
      buildReadyBundleState({ observation, foodRuleForbidden: ["fistik"] }),
      "bundle-mm-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.visualSegments[0]?.workflowState).toBe("label_absence_not_allowed");
    expect(result.meaning.absenceOfEvidenceAllowedCount).toBe(0);
  });

  it("flags high-integrity label conflicts from forbidden ingredients only", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.packaged_food_label_complete);
    const result = resolveMultimodalBundleUnderstanding(
      buildReadyBundleState({
        observation: {
          ...observation,
          ocrBlocks: [{ text: "Icindekiler: sut, fistik", confidence: 0.96, blockKind: "label" }],
        },
        foodRuleForbidden: ["fistik"],
      }),
      "bundle-mm-1",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.visualSegments[0]?.workflowState).toBe("label_conflict_high_integrity");
    expect(result.meaning.visualSegments[0]?.productDecision).toBe("product_blocked");
    expect(result.meaning.absenceOfEvidenceAllowedCount).toBe(0);
  });

  it("treats cropped labels as incomplete without approved authority", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.packaged_food_label_cropped);
    const result = resolveMultimodalBundleUnderstanding(buildReadyBundleState({ observation }), "bundle-mm-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.visualSegments[0]?.workflowState).toBe("label_incomplete");
    expect(result.envelope.sourceAuthorityState).toBe("unresolved");
  });

  it("blocks supplement scenes from approved source authority", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.supplement_bottle);
    const result = resolveMultimodalBundleUnderstanding(buildReadyBundleState({ observation }), "bundle-mm-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.visualSegments[0]?.workflowState).toBe("supplement_review");
    expect(result.meaning.visualSegments[0]?.sourceAuthority).toBe("untrusted_visual");
    expect(result.envelope.sourceAuthorityState).toBe("unresolved");
  });

  it("prioritizes explicit reply binding over sequential bundle text", () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildReadyBundleState({
      observation,
      textSegments: [
        {
          messageId: "message-text-reply",
          body: "Bu porsiyon uygun mu?",
          replyToProviderMessageId: "wamid.IMG_MM_1",
        },
      ],
    });
    const result = resolveMultimodalBundleUnderstanding(state, "bundle-mm-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meaning.textBinding.primaryBinding).toBe("reply");
  });

  it("classifies screenshot queries as untrusted unless approved source exact hit exists", () => {
    const unknownScreenshot = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.screenshot_document);
    const unknown = resolveMultimodalBundleUnderstanding(buildReadyBundleState({ observation: unknownScreenshot }), "bundle-mm-1");
    expect(unknown.ok).toBe(true);
    if (!unknown.ok) return;
    expect(unknown.meaning.visualSegments[0]?.workflowState).toBe("screenshot_no_approved_source");

    const hitObservation: MultimodalVisualSegment["observation"] = {
      ...unknownScreenshot,
      ocrBlocks: [{ text: "izgara tavuk uygun mu?", confidence: 0.92, blockKind: "screenshot" }],
    };
    const hit = resolveMultimodalBundleUnderstanding(buildReadyBundleState({ observation: hitObservation }), "bundle-mm-1");
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.meaning.visualSegments[0]?.workflowState).toBe("screenshot_approved_source_hit");
  });

  it("rejects open bundles without terminal observations", () => {
    const state = buildReadyBundleState({
      observation: buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate),
    });
    state.inboundMessageBundles[0]!.status = "open";
    const built = buildMultimodalMessageEnvelope(state, "bundle-mm-1");
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.failureCode).toBe("bundle_not_terminal");
  });
});
