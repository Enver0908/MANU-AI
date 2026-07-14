import { describe, expect, it } from "vitest";
import {
  assertBundleDecisionLocks,
  commitAtomicBundleDecisionV2,
} from "./phase-85-stage-4b3-atomic-bundle-decision";
import { commitAtomicVisualCorrectionV2 } from "./phase-85-stage-4b3-atomic-visual-correction";
import {
  STAGE_4B3_BUNDLE_DECISION_OUTCOME_VERSION,
  validateBundleDecisionOutcome,
} from "./phase-85-stage-4b3-atomic-outcomes";
import {
  applyStage4B3BundleDecisionNotifications,
  buildStage4B3DedupeKey,
} from "./phase-85-stage-4b3-bundle-notifications";
import { runMultimodalBundleInboundTurn } from "./phase-85-stage-4b3-bundle-orchestration";
import {
  buildVisualObservationFromFixtureTemplate,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import type {
  InboundMessageBundleItemRecord,
  InboundMessageBundleRecord,
  MediaAssetRecord,
  VisualAnalysisRecord,
} from "./phase-85-stage-4b3-media-contracts";
import { DEMO_TENANT_ID, DEMO_DIETITIAN_ID, createInitialState } from "./seed-data";
import type { ClientMenuPlanV1Record, ManuAppState } from "./types";

function buildProcessingBundleState(input: {
  bundleStatus?: InboundMessageBundleRecord["status"];
}): ManuAppState {
  const state = createInitialState();
  const bundleId = "bundle-atomic-1";
  const conversationId = state.conversations[0]!.id;
  const clientId = state.conversations[0]!.clientId;
  const imageMessageId = "message-image-atomic-1";
  const observation = buildVisualObservationFromFixtureTemplate(STAGE_4B3_VISION_FIXTURE_TEMPLATES.supplement_bottle);

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
      id: "bundle-item-atomic-1",
      tenantId: DEMO_TENANT_ID,
      bundleId,
      messageId: imageMessageId,
      channelEventId: "channel-event-atomic-1",
      mediaAssetId: "asset-atomic-1",
      ordinal: 1,
      itemType: "image",
      captionText: null,
      replyToProviderMessageId: null,
      observedAt: "2026-07-14T10:00:00.000Z",
      createdAt: "2026-07-14T10:00:00.000Z",
    },
  ];

  const asset: MediaAssetRecord = {
    id: "asset-atomic-1",
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    messageId: imageMessageId,
    channelEventId: "channel-event-atomic-1",
    position: 1,
    providerMediaId: null,
    providerMediaIdHash: "hash-atomic-1",
    declaredMimeType: "image/jpeg",
    detectedMimeType: "image/jpeg",
    dimensions: { width: 640, height: 480 },
    byteSize: 12000,
    contentSha256: "abc123atomic",
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
    id: "analysis-atomic-1",
    tenantId: DEMO_TENANT_ID,
    clientId,
    conversationId,
    mediaAssetId: asset.id,
    messageId: imageMessageId,
    bundleId,
    analysisRevision: 1,
    status: "ready",
    observation,
    supersededByAnalysisId: null,
    failureCode: null,
    createdAt: "2026-07-14T10:00:00.000Z",
    updatedAt: "2026-07-14T10:00:00.000Z",
  };

  const menuPlan: ClientMenuPlanV1Record = {
    id: "menu-plan-atomic-1",
    tenantId: DEMO_TENANT_ID,
    clientId,
    dietitianId: DEMO_DIETITIAN_ID,
    status: "active",
    revision: 1,
    templateType: "weekly_meal_framework",
    title: "Aktif plan",
    summary: "Test menu",
    mealSlots: [],
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
        providerEventId: "wamid.IMG_ATOMIC_1",
        providerMessageId: "wamid.IMG_ATOMIC_1",
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

describe("phase-85-stage-4b3-atomic-decision", () => {
  it("builds stage4b3 notification dedupe keys with bundle or correction scope", () => {
    expect(buildStage4B3DedupeKey("bundle", "yellow_review", "bundle-1")).toBe(
      "stage4b3:bundle:yellow_review:bundle-1",
    );
    expect(buildStage4B3DedupeKey("correction", "manual_follow_up", "corr-1")).toBe(
      "stage4b3:correction:manual_follow_up:corr-1",
    );
  });

  it("rejects non-green boundary outcomes during strict validation", () => {
    const validation = validateBundleDecisionOutcome({
      version: STAGE_4B3_BUNDLE_DECISION_OUTCOME_VERSION,
      bundleId: "bundle-1",
      decisionId: "decision-1",
      expectedBundleRevision: 1,
      expectedConversationRevision: 1,
      action: "draft_for_approval",
      risk: "yellow",
      aiDecision: {
        id: "decision-1",
        tenantId: DEMO_TENANT_ID,
        conversationId: "conversation-1",
        clientId: "client-1",
        mode: "auto",
        aiStatus: "active",
        personaId: "persona-1",
        risk: "yellow",
        model: "deterministic",
        action: "draft_for_approval",
        blockedReason: null,
        qualityIssues: [],
        reasons: [],
        providerStatus: "not_called",
        providerAttempted: false,
        providerId: null,
        providerErrorCode: null,
        sendStatus: "not_sent",
        promptVersion: null,
        contextManifest: {},
        createdAt: "2026-07-14T10:00:00.000Z",
      },
      messages: [
        {
          id: "draft-1",
          tenantId: DEMO_TENANT_ID,
          conversationId: "conversation-1",
          sender: "assistant",
          origin: "ai_generated",
          body: "draft",
          status: "sent",
          contentStatus: "available",
          retrievalEligibility: "eligible",
          providerAccountBindingId: null,
          providerEventId: null,
          providerMessageId: null,
          actorType: "ai",
          actorBindingId: null,
          authorInterface: "dashboard",
          actorResolutionBasis: "system",
          providerSentAt: null,
          observedAt: "2026-07-14T10:00:00.000Z",
          persistedAt: "2026-07-14T10:00:00.000Z",
          createdAt: "2026-07-14T10:00:00.000Z",
          generatedByAiDecisionId: "decision-1",
        },
      ],
      handoffCases: [],
      notifications: [],
      auditEvents: [],
    });
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.code).toBe("outcome_draft_with_sent_invalid");
  });

  it("dedupes yellow bundle notifications by stage4b3 key", () => {
    const state = createInitialState();
    const first = applyStage4B3BundleDecisionNotifications(state, {
      bundleId: "bundle-1",
      clientId: state.clients[0]!.id,
      conversationId: state.conversations[0]!.id,
      anchorMessageId: "message-1",
      action: "draft_for_approval",
      risk: "yellow",
      clientName: state.clients[0]!.fullName,
      now: "2026-07-14T10:00:00.000Z",
    });
    const second = applyStage4B3BundleDecisionNotifications(first, {
      bundleId: "bundle-1",
      clientId: state.clients[0]!.id,
      conversationId: state.conversations[0]!.id,
      anchorMessageId: "message-1",
      action: "draft_for_approval",
      risk: "yellow",
      clientName: state.clients[0]!.fullName,
      now: "2026-07-14T10:01:00.000Z",
    });
    expect(second.notifications).toHaveLength(1);
    expect(second.notifications[0]?.occurrenceCount).toBe(2);
    expect(second.notifications[0]?.dedupeKey).toBe(
      buildStage4B3DedupeKey("bundle", "yellow_review", "bundle-1"),
    );
  });

  it("replays duplicate bundle decisions by idempotency key without new writes", async () => {
    const state = buildProcessingBundleState({});
    const turn = await runMultimodalBundleInboundTurn(state, "bundle-atomic-1", {
      idempotencyKey: "atomic-bundle-dup",
    });
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    const beforeDecisions = turn.state.aiDecisions.length;
    const replay = await runMultimodalBundleInboundTurn(turn.state, "bundle-atomic-1", {
      idempotencyKey: "atomic-bundle-dup",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.state.aiDecisions.length).toBe(beforeDecisions);
    expect(replay.state.processedBundleDecisionKeys).toContain("atomic-bundle-dup");
  });

  it("fails closed on stale bundle revision without mutating base state", () => {
    const state = buildProcessingBundleState({});
    const staleBundle = {
      ...state.inboundMessageBundles[0]!,
      bundleRevision: 2,
    };
    const staleState = {
      ...state,
      inboundMessageBundles: [staleBundle],
    };
    const failure = assertBundleDecisionLocks(staleState, {
      bundleId: "bundle-atomic-1",
      expectedBundleRevision: 1,
      expectedConversationRevision: 1,
    });
    expect(failure).toBe("stale_bundle_revision");

    const commit = commitAtomicBundleDecisionV2(staleState, {
      bundleId: "bundle-atomic-1",
      idempotencyKey: "atomic-stale",
      expectedBundleRevision: 1,
      expectedConversationRevision: 1,
      preparedState: staleState,
      client: staleState.clients[0]!,
      conversation: staleState.conversations[0]!,
      inboundMessage: staleState.messages.find((message) => message.id === "message-image-atomic-1")!,
      coreResult: {
        action: "draft_for_approval",
        risk: "yellow",
        reasons: [],
        qualityIssues: [],
        responseText: "draft",
      },
    });
    expect(commit.ok).toBe(false);
    if (commit.ok) return;
    expect(commit.failureCode).toBe("stale_bundle_revision");
    expect(commit.state).toBe(staleState);
  });

  it("replays duplicate visual corrections by request id", async () => {
    const state = buildProcessingBundleState({});
    const turn = await runMultimodalBundleInboundTurn(state, "bundle-atomic-1");
    expect(turn.ok).toBe(true);
    if (!turn.ok) return;

    const first = commitAtomicVisualCorrectionV2(turn.state, {
      analysisId: "analysis-atomic-1",
      requestId: "corr-dup-1",
      expectedConversationRevision: 1,
      expectedAnalysisRevision: 1,
      reasonCode: "wrong_scene",
      explanation: "Supplement degil.",
      dietitianId: DEMO_DIETITIAN_ID,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const beforeCorrections = first.state.visualCorrections.length;
    const replay = commitAtomicVisualCorrectionV2(first.state, {
      analysisId: "analysis-atomic-1",
      requestId: "corr-dup-1",
      expectedConversationRevision: 1,
      expectedAnalysisRevision: 1,
      reasonCode: "wrong_scene",
      explanation: "Supplement degil.",
      dietitianId: DEMO_DIETITIAN_ID,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.replay).toBe(true);
    expect(replay.state.visualCorrections.length).toBe(beforeCorrections);
  });
});
