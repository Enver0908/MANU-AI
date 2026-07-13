import { describe, expect, it } from "vitest";
import { runInboundSimulation } from "./simulator";
import { commitInboundBundleDecision } from "./phase-85-stage-4b3-bundle-decisions";
import { runMultimodalBundleInboundTurn } from "./phase-85-stage-4b3-bundle-orchestration";
import { submitVisualCorrection } from "./phase-85-stage-4b3-visual-corrections";
import {
  buildVisualObservationFromFixtureTemplate,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import type {
  InboundMessageBundleItemRecord,
  InboundMessageBundleRecord,
  MediaAssetRecord,
  MultimodalVisualSegment,
  VisualAnalysisRecord,
} from "./phase-85-stage-4b3-media-contracts";
import { DEMO_TENANT_ID, DEMO_DIETITIAN_ID, createInitialState } from "./seed-data";
import type { ClientMenuPlanV1Record, ManuAppState } from "./types";

function buildProcessingBundleState(input: {
  observation: MultimodalVisualSegment["observation"];
  bundleStatus?: InboundMessageBundleRecord["status"];
}): ManuAppState {
  const state = createInitialState();
  const bundleId = "bundle-mm-1";
  const conversationId = state.conversations[0]!.id;
  const clientId = state.conversations[0]!.clientId;
  const imageMessageId = "message-image-1";

  const bundle: InboundMessageBundleRecord = {
    id: bundleId,
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    anchorMessageId: imageMessageId,
    status: input.bundleStatus ?? "processing",
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
    leaseExpiresAt: "2026-07-14T10:03:00.000Z",
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
      mediaAssetId: "asset-mm-1",
      ordinal: 1,
      itemType: "image",
      captionText: null,
      replyToProviderMessageId: null,
      observedAt: "2026-07-14T10:00:00.000Z",
      createdAt: "2026-07-14T10:00:00.000Z",
    },
  ];

  const asset: MediaAssetRecord = {
    id: "asset-mm-1",
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
    id: "analysis-mm-1",
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    mediaAssetId: asset.id,
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

  const menuPlan: ClientMenuPlanV1Record = {
    id: "menu-plan-1",
    tenantId: DEMO_TENANT_ID,
    clientId,
    dietitianId: DEMO_DIETITIAN_ID,
    status: "active",
    revision: 1,
    templateType: "weekly_meal_framework",
    title: "Aktif plan",
    summary: "Test menu",
    mealSlots: [
      {
        id: "slot-1",
        label: "Ogle",
        items: [
          {
            id: "menu-item-1",
            label: "Izgara tavuk",
            freeText: "izgara tavuk",
            catalogMatch: {
              query: "izgara tavuk",
              catalogFoodId: null,
              catalogFoodName: "izgara tavuk",
              matchConfidence: "exact",
            },
            recipe: { title: "Izgara tavuk", ingredients: ["tavuk"], instructions: "" },
          },
        ],
        alternatives: [],
      },
    ],
    createdAt: "2026-07-14T09:00:00.000Z",
    updatedAt: "2026-07-14T09:00:00.000Z",
  };

  return {
    ...state,
    clientMenuPlans: [menuPlan],
    messages: [
      ...state.messages,
      {
        id: imageMessageId,
        tenantId: DEMO_TENANT_ID,
        conversationId,
        sender: "client",
        origin: "client_inbound",
        body: "[client image]",
        status: "stored",
        contentStatus: "available",
        retrievalEligibility: "excluded_media_only",
        providerAccountBindingId: "account-binding-1",
        providerEventId: "wamid.IMG_MM_1",
        providerMessageId: "wamid.IMG_MM_1",
        actorType: "client",
        actorBindingId: null,
        authorInterface: "client_channel",
        actorResolutionBasis: "provider_counterparty",
        providerSentAt: "2026-07-14T10:00:00.000Z",
        observedAt: "2026-07-14T10:00:00.000Z",
        persistedAt: "2026-07-14T10:00:00.000Z",
        createdAt: "2026-07-14T10:00:00.000Z",
      },
    ],
    mediaAssets: [asset],
    visualAnalysisRecords: [analysis],
    inboundMessageBundles: [bundle],
    inboundMessageBundleItems: bundleItems,
  };
}

describe("phase-85-stage-4b3-bundle-orchestration", () => {
  it("preserves text-only simulator parity through shared inbound turn pipeline", async () => {
    const before = createInitialState();
    const after = await runInboundSimulation(before, {
      clientId: before.clients[0]!.id,
      body: "Bugun ogle yemegini yedim",
      idempotencyKey: "phase8-text-parity",
    });
    expect(after.messages.length).toBeGreaterThan(before.messages.length);
    expect(after.lastSimulation?.action).not.toBe("duplicate_ignored");
  });

  it("commits one green deterministic send for an exact-menu visual bundle", async () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildProcessingBundleState({ observation });
    const beforeMessages = state.messages.length;
    const beforeDecisions = state.aiDecisions.length;

    const turn = await runMultimodalBundleInboundTurn(state, "bundle-mm-1", {
      idempotencyKey: "bundle-green-1",
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    expect(turn.state.messages.length).toBe(beforeMessages + 1);
    expect(turn.state.aiDecisions.length).toBe(beforeDecisions + 1);
    const bundle = turn.state.inboundMessageBundles.find((entry) => entry.id === "bundle-mm-1");
    expect(bundle?.status).toBe("completed");
    expect(bundle?.decisionId).toBe(turn.decisionId);
    const outbound = turn.state.messages.find((message) => message.generatedByAiDecisionId === turn.decisionId);
    expect(outbound?.status).toBe("sent");
    expect(outbound?.body).toContain("plan");
  });

  it("rejects duplicate bundle decision commits for the same revision", async () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildProcessingBundleState({ observation });
    const turn = await runMultimodalBundleInboundTurn(state, "bundle-mm-1", {
      idempotencyKey: "bundle-dup-1",
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    const duplicate = commitInboundBundleDecision(turn.state, {
      bundleId: "bundle-mm-1",
      expectedBundleRevision: 1,
      expectedConversationRevision: 1,
      idempotencyKey: "bundle-dup-2",
      decisionId: crypto.randomUUID(),
    });
    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.failureCode).toBe("bundle_decision_already_committed");
  });

  it("routes supplement visual bundles to yellow draft without client send", async () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.supplement_bottle);
    const state = buildProcessingBundleState({ observation });
    const turn = await runMultimodalBundleInboundTurn(state, "bundle-mm-1");
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;
    expect(turn.state.lastSimulation?.risk).toBe("yellow");
    expect(turn.state.lastSimulation?.action).toBe("draft_for_approval");
    const outbound = turn.state.messages.find((message) => message.generatedByAiDecisionId === turn.decisionId);
    expect(outbound?.status).toBe("draft");
  });

  it("fails closed on stale conversation revision without partial commit", async () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildProcessingBundleState({ observation });
    const stale = {
      ...state,
      conversations: state.conversations.map((conversation) =>
        conversation.id === state.conversations[0]!.id ? { ...conversation, revision: 2 } : conversation,
      ),
    };
    const turn = await runMultimodalBundleInboundTurn(stale, "bundle-mm-1");
    expect(turn.ok).toBe(false);
    if (turn.ok) return;
    expect(turn.failureCode).toBe("stale_conversation_revision");
  });
});

describe("phase-85-stage-4b3-visual-corrections", () => {
  it("invalidates pending draft and reopens bundle when corrected before send", async () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.supplement_bottle);
    const state = buildProcessingBundleState({ observation });
    const turn = await runMultimodalBundleInboundTurn(state, "bundle-mm-1");
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    const correction = submitVisualCorrection(turn.state, {
      analysisId: "analysis-mm-1",
      requestId: "corr-1",
      expectedConversationRevision: 1,
      expectedAnalysisRevision: 1,
      reasonCode: "wrong_scene",
      explanation: "Supplement degil, ogun fotografi.",
      dietitianId: DEMO_DIETITIAN_ID,
    });
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.resultAction).toBe("invalidate_pending");
    const bundle = correction.state.inboundMessageBundles.find((entry) => entry.id === "bundle-mm-1");
    expect(bundle?.decisionId).toBeNull();
    expect(bundle?.status).toBe("ready");
    expect(correction.state.clients[0]?.aiMode).not.toBe("manual");
  });

  it("pauses AI and requires manual follow-up after a sent visual correction", async () => {
    const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.meal_plate);
    const state = buildProcessingBundleState({ observation });
    const turn = await runMultimodalBundleInboundTurn(state, "bundle-mm-1");
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    const sentBefore = turn.state.messages.filter(
      (message) => message.origin === "ai_generated" && message.status === "sent",
    ).length;
    const correction = submitVisualCorrection(turn.state, {
      analysisId: "analysis-mm-1",
      requestId: "corr-2",
      expectedConversationRevision: 1,
      expectedAnalysisRevision: 1,
      reasonCode: "wrong_food_candidate",
      explanation: "Yanlis yemek eslesti.",
      dietitianId: DEMO_DIETITIAN_ID,
    });
    expect(correction.ok).toBe(true);
    if (!correction.ok) return;
    expect(correction.resultAction).toBe("manual_follow_up");
    expect(correction.state.clients[0]?.aiMode).toBe("manual");
    expect(correction.state.clients[0]?.humanTakeoverLocked).toBe(true);
    const sentAfter = correction.state.messages.filter(
      (message) => message.origin === "ai_generated" && message.status === "sent",
    ).length;
    expect(sentAfter).toBe(sentBefore);
  });
});
