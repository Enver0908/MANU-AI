import { describe, expect, it } from "vitest";
import { appendDietitianManualReplyByConversation } from "./simulator";
import { createInitialState } from "./seed-data";
import {
  appendInboundBundleItem,
  claimReadyInboundBundle,
  findActiveInboundBundle,
  openInboundMessageBundle,
  promoteDueInboundBundles,
  releaseInboundBundleWork,
} from "./phase-85-stage-4b3-message-bundles";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
import { runMultimodalBundleInboundTurn } from "./phase-85-stage-4b3-bundle-orchestration";

const T0 = "2026-07-13T10:00:00.000Z";
const T119 = "2026-07-13T10:01:59.000Z";
const T240 = "2026-07-13T10:04:00.000Z";
const SEED_AI_DECISION_COUNT = 1;

function openImageBundle(state = createInitialState()) {
  const conversation = state.conversations[0]!;
  return openInboundMessageBundle(state, {
    clientId: conversation.clientId,
    conversationId: conversation.id,
    anchorMessageId: "anchor-image-1",
    observedAt: T0,
    item: {
      messageId: "anchor-image-1",
      channelEventId: "channel-event-1",
      observedAt: T0,
      itemType: "image",
      actorType: "client",
      senderId: conversation.clientId,
      mediaAssetId: "asset-1",
    },
  });
}

describe("phase-85-stage-4b3 bundle worker outcomes", () => {
  it("resets readyAt when a dietitian manual reply appends to the active bundle", () => {
    const opened = openImageBundle();
    const bundleId = opened.inboundMessageBundles[0]!.id;
    const conversationId = opened.conversations[0]!.id;
    const beforeReadyAt = opened.inboundMessageBundles[0]!.readyAt;
    const manual = appendDietitianManualReplyByConversation(opened, {
      conversationId,
      body: "Ben bakiyorum",
      expectedConversationRevision: 1,
    });
    const bundle = findActiveInboundBundle(manual.nextState, conversationId);
    expect(bundle?.itemCount).toBe(2);
    expect(bundle?.readyAt).not.toBe(beforeReadyAt);
    const dietitianItem = manual.nextState.inboundMessageBundleItems.find(
      (item) => item.bundleId === bundleId && item.actorType === "dietitian",
    );
    expect(dietitianItem).toBeTruthy();
  });

  it("finalizes human_handled without creating AI decisions", async () => {
    let state = openImageBundle();
    const bundleId = state.inboundMessageBundles[0]!.id;
    const conversationId = state.conversations[0]!.id;
    state = appendInboundBundleItem(state, bundleId, {
      messageId: "dietitian-msg-1",
      channelEventId: null,
      observedAt: T119,
      itemType: "text",
      actorType: "dietitian",
      senderId: state.dietitian.id,
      bodyText: "Manuel yanit",
    });
    state = promoteDueInboundBundles(state, T240);
    const worker = await processStage4B3DueInboundBundles(state, {
      workerId: "r4-worker",
      now: T240,
      runOrchestration: true,
      finalizeClaims: true,
    });
    expect(worker.outcomes[0]?.outcome).toBe("human_handled");
    expect(worker.state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);
    const bundle = worker.state.inboundMessageBundles.find((entry) => entry.id === bundleId);
    expect(bundle?.status).toBe("cancelled");
    expect(bundle?.failureCode).toBe("human_handled");
    expect(findActiveInboundBundle(worker.state, conversationId)).toBeNull();
  });

  it("does not mark a bundle decided when orchestration fails", async () => {
    let state = openImageBundle();
    const bundleId = state.inboundMessageBundles[0]!.id;
    state = promoteDueInboundBundles(state, T240);
    const claimed = claimReadyInboundBundle(state, { workerId: "r4-worker", now: T240 });
    const turn = await runMultimodalBundleInboundTurn(claimed.state, bundleId, { now: T240 });
    expect(turn.ok).toBe(false);
    const finalized = releaseInboundBundleWork(claimed.state, bundleId, {
      workerId: "r4-worker",
      now: T240,
      outcome: "terminal_failure",
      failureCode: turn.failureCode,
    });
    const bundle = finalized.inboundMessageBundles.find((entry) => entry.id === bundleId);
    expect(bundle?.status).not.toBe("decided");
    expect(bundle?.decisionId).toBeNull();
    expect(bundle?.status).toBe("failed");
  });

  it("reopens a processing bundle when a new client item arrives during processing", async () => {
    let state = openImageBundle();
    const bundleId = state.inboundMessageBundles[0]!.id;
    state = promoteDueInboundBundles(state, T240);
    const claimed = claimReadyInboundBundle(state, { workerId: "r4-worker", now: T240 });
    expect(claimed.claimed?.status).toBe("processing");

    const interrupted = appendInboundBundleItem(claimed.state, bundleId, {
      messageId: "client-follow-up",
      channelEventId: "channel-event-2",
      observedAt: T119,
      itemType: "text",
      actorType: "client",
      senderId: state.conversations[0]!.clientId,
      bodyText: "bir de su",
    });
    const bundle = interrupted.inboundMessageBundles.find((entry) => entry.id === bundleId);
    expect(bundle?.status).toBe("open");
    expect(bundle?.leaseExpiresAt).toBeNull();
    expect(bundle?.bundleRevision).toBe(2);
  });
});
