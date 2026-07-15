import { beforeAll, describe, expect, it } from "vitest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { processInboundWhatsAppChannelBatch } from "./phase-85-if-c-channel-event-ledger";
import {
  appendInboundBundleItem,
  computeBundleReadyAt,
  findActiveInboundBundle,
  openInboundMessageBundle,
  promoteDueInboundBundles,
} from "./phase-85-stage-4b3-message-bundles";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
import { createInMemoryStage4B3MediaStorage } from "./phase-85-stage-4b3-media-storage";
import { getFallbackStage4B3MockMediaRegistry } from "./phase-85-stage-4b3-fallback-media-registry";
import {
  createInMemoryStage4B3MediaTransport,
} from "./phase-85-stage-4b3-media-transport";
import { createStage4B3MockVisionProvider } from "./phase-85-stage-4b3-mock-vision-provider";
import type { Stage4B3AdmissionRuntime } from "./phase-85-if-c-channel-event-ledger";
import { registerStage4B3FixtureMediaAsset } from "./phase-85-stage-4b3-canonical-ingress";
import type { ChannelAccountBindingRecord } from "./types";

const TEST_SECRET = "synthetic-ifc-test-secret";
const T0 = "2026-07-13T10:00:00.000Z";
const T119 = "2026-07-13T10:01:59.000Z";
const T120 = "2026-07-13T10:02:00.000Z";
const T239 = "2026-07-13T10:03:59.000Z";
const T240 = "2026-07-13T10:04:00.000Z";
const T359 = "2026-07-13T10:05:59.000Z";
const T360 = "2026-07-13T10:06:00.000Z";
const SEED_AI_DECISION_COUNT = 1;

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    MANU_ALLOW_MOCK_VISION: "true",
    MANU_DEV_FALLBACK_STORE: "true",
  } as NodeJS.ProcessEnv;
}

function buildBusinessActorBindings() {
  return [
    {
      id: "actor-binding-1",
      tenantId: DEMO_TENANT_ID,
      accountBindingId: "account-binding-1",
      dietitianId: null,
      actorType: "business_operator" as const,
      attributionBasis: "shared_authorized_team" as const,
      validFrom: "2024-06-01T00:00:00.000Z",
      validTo: null,
      verifiedAt: "2024-06-01T00:00:00.000Z",
      revokedAt: null,
      createdByDietitianId: null,
      revokedByDietitianId: null,
      auditReasonCode: null,
      createdAt: "2024-06-01T00:00:00.000Z",
    },
  ];
}

function buildAccountBinding(): ChannelAccountBindingRecord {
  return {
    id: "account-binding-1",
    tenantId: DEMO_TENANT_ID,
    provider: "whatsapp_cloud",
    providerAccountId: "SYNTHETIC_PHONE_1",
    wabaId: "SYNTHETIC_WABA_1",
    businessPhoneNumberId: "SYNTHETIC_PHONE_1",
    normalizedDisplayNumber: null,
    operatingMode: "mock",
    lifecycleStatus: "active",
    attributionPolicy: "shared_authorized_team",
    verifiedAt: "2024-06-01T00:00:00.000Z",
    revokedAt: null,
    createdByDietitianId: null,
    revokedByDietitianId: null,
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
  };
}

function textPayload(providerEventId: string, body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              messages: [
                {
                  from: "905551110001",
                  id: providerEventId,
                  timestamp: "1720000000",
                  type: "text",
                  text: { body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function imagePayload(providerEventId: string, mediaId: string, sha256: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              messages: [
                {
                  from: "905551110001",
                  id: providerEventId,
                  timestamp: "1720000000",
                  type: "image",
                  image: {
                    id: mediaId,
                    mime_type: "image/jpeg",
                    sha256,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function businessEchoPayload(providerEventId: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "SYNTHETIC_WABA_1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
              smb_message_echoes: [
                {
                  from: "SYNTHETIC_PHONE_1",
                  to: "905551110001",
                  id: providerEventId,
                  timestamp: "1720000000",
                  type: "text",
                  text: { body: "Diyetisyen manuel yanit" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("phase-85-stage-4b3-message-bundles", () => {
  it("computes readyAt as observedAt plus 120 seconds", () => {
    expect(computeBundleReadyAt(T0)).toBe(T120);
  });
});

describe("phase-85-stage-4b3 bundle ingress integration", () => {
  let bundleFixtureSha256: string;
  let admissionRuntime: Stage4B3AdmissionRuntime;

  beforeAll(async () => {
    process.env.MANU_DEV_FALLBACK_STORE = "true";
    const fixture = await registerStage4B3FixtureMediaAsset({
      sceneId: "meal_plate",
      mediaId: "MOCK_MEDIA_BUNDLE",
    });
    bundleFixtureSha256 = fixture.contentSha256;
    admissionRuntime = {
      transport: createInMemoryStage4B3MediaTransport(getFallbackStage4B3MockMediaRegistry()),
      storage: createInMemoryStage4B3MediaStorage(),
      visionProvider: createStage4B3MockVisionProvider({ manifest: fixture.manifest }),
      autoProcessPending: true,
      autoProcessVision: true,
      autoProcessBundles: false,
      workerId: "bundle-test-worker",
    };
  });

  function baseState() {
    return {
      ...createInitialState(),
      channelAccountBindings: [buildAccountBinding()],
    };
  }

  it("opens a bundle on image ingress and keeps text-only messages on the legacy orchestrator path", async () => {
    const standalone = await processInboundWhatsAppChannelBatch(baseState(), textPayload("wamid.TEXT_ONLY", "Merhaba"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      now: T0,
    });
    expect(standalone.result.ok).toBe(true);
    expect(standalone.state.inboundMessageBundles).toHaveLength(0);
    expect(standalone.state.aiDecisions.length).toBeGreaterThan(0);

    const imageFirst = await processInboundWhatsAppChannelBatch(
      baseState(),
      imagePayload("wamid.IMG_BUNDLE", "MOCK_MEDIA_BUNDLE", bundleFixtureSha256),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admissionRuntime,
        now: T0,
      },
    );
    expect(imageFirst.state.inboundMessageBundles).toHaveLength(1);
    expect(imageFirst.state.inboundMessageBundleItems).toHaveLength(1);
    expect(imageFirst.state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);

    const conversationId = imageFirst.state.conversations[0]?.id;
    const bundle = findActiveInboundBundle(imageFirst.state, conversationId!);
    expect(bundle?.status).toBe("open");
    expect(bundle?.readyAt).toBe(T120);
  });

  it("resets bundle silence when a follow-up text arrives before 120 seconds", async () => {
    let state = baseState();
    const image = await processInboundWhatsAppChannelBatch(
      state,
      imagePayload("wamid.IMG_RESET", "MOCK_MEDIA_BUNDLE", bundleFixtureSha256),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admissionRuntime,
        now: T0,
      },
    );
    state = image.state;
    const conversationId = state.conversations[0]!.id;

    const followUp = await processInboundWhatsAppChannelBatch(state, textPayload("wamid.TEXT_RESET", "Bu yemekten yedim"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: admissionRuntime,
      now: T119,
    });
    const bundle = findActiveInboundBundle(followUp.state, conversationId);
    expect(bundle?.itemCount).toBe(2);
    expect(bundle?.readyAt).toBe(T239);
    expect(followUp.state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);

    const promotedTooEarly = promoteDueInboundBundles(followUp.state, T120);
    expect(findActiveInboundBundle(promotedTooEarly, conversationId)?.status).toBe("open");

    const promotedOnTime = promoteDueInboundBundles(followUp.state, T240);
    expect(findActiveInboundBundle(promotedOnTime, conversationId)?.status).toBe("ready");
  });

  it("claims a ready bundle exactly once after silence without creating AI decisions", async () => {
    let state = baseState();
    const image = await processInboundWhatsAppChannelBatch(
      state,
      imagePayload("wamid.IMG_CLAIM", "MOCK_MEDIA_BUNDLE", bundleFixtureSha256),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admissionRuntime,
        now: T0,
      },
    );
    state = image.state;
    const followUp = await processInboundWhatsAppChannelBatch(state, textPayload("wamid.TEXT_CLAIM", "devam"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: admissionRuntime,
      now: T119,
    });
    state = promoteDueInboundBundles(followUp.state, T240);
    const worker = await processStage4B3DueInboundBundles(state, {
      workerId: "bundle-test-worker",
      now: T240,
      finalizeClaims: false,
    });
    expect(worker.claimedBundles).toHaveLength(1);
    expect(worker.claimedBundles[0]?.status).toBe("processing");
    expect(worker.state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);

    const secondClaim = await processStage4B3DueInboundBundles(worker.state, {
      workerId: "bundle-test-worker",
      now: T240,
      finalizeClaims: false,
    });
    expect(secondClaim.claimedBundles).toHaveLength(0);
  });

  it("appends a dietitian actor item when a business-human echo arrives", async () => {
    let state = baseState();
    const image = await processInboundWhatsAppChannelBatch(
      state,
      imagePayload("wamid.IMG_SUPERSEDE", "MOCK_MEDIA_BUNDLE", bundleFixtureSha256),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admissionRuntime,
        now: T0,
      },
    );
    state = image.state;
    const conversationId = state.conversations[0]!.id;
    const echo = await processInboundWhatsAppChannelBatch(
      { ...state, channelActorBindings: buildBusinessActorBindings() },
      businessEchoPayload("wamid.ECHO_SUPERSEDE"),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        now: T119,
      },
    );
    const activeBundle = findActiveInboundBundle(echo.state, conversationId);
    expect(activeBundle).toBeTruthy();
    expect(activeBundle?.itemCount).toBe(2);
    expect(activeBundle?.readyAt).toBe(T239);
    const dietitianItem = echo.state.inboundMessageBundleItems.find((item) => item.actorType === "dietitian");
    expect(dietitianItem).toBeTruthy();
    expect(echo.state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);
  });

  it("keeps the bundle open across unlimited total duration when silence resets repeatedly", async () => {
    let state = baseState();
    const image = await processInboundWhatsAppChannelBatch(
      state,
      imagePayload("wamid.IMG_UNLIMITED", "MOCK_MEDIA_BUNDLE", bundleFixtureSha256),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: admissionRuntime,
        now: T0,
      },
    );
    state = image.state;
    const conversationId = state.conversations[0]!.id;

    const firstReset = await processInboundWhatsAppChannelBatch(state, textPayload("wamid.TEXT_UNLIMITED_1", "ilk"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: admissionRuntime,
      now: T119,
    });
    state = firstReset.state;
    expect(findActiveInboundBundle(state, conversationId)?.readyAt).toBe(T239);

    const secondReset = await processInboundWhatsAppChannelBatch(state, textPayload("wamid.TEXT_UNLIMITED_2", "ikinci"), {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: admissionRuntime,
      now: T239,
    });
    state = secondReset.state;
    expect(findActiveInboundBundle(state, conversationId)?.readyAt).toBe(T359);

    const promotedTooEarly = promoteDueInboundBundles(state, T240);
    expect(findActiveInboundBundle(promotedTooEarly, conversationId)?.status).toBe("open");

    const promotedOnTime = promoteDueInboundBundles(state, T360);
    expect(findActiveInboundBundle(promotedOnTime, conversationId)?.status).toBe("ready");
  });

  it("marks a bundle review_required when image cap overflow is reached", async () => {
    const overflowManifest = (await registerStage4B3FixtureMediaAsset({
      sceneId: "meal_plate",
      mediaId: "MOCK_MEDIA_OVERFLOW_1",
    })).manifest;
    for (let index = 2; index <= 5; index += 1) {
      await registerStage4B3FixtureMediaAsset({
        sceneId: "meal_plate",
        mediaId: `MOCK_MEDIA_OVERFLOW_${index}`,
      });
    }
    const overflowRuntime: Stage4B3AdmissionRuntime = {
      transport: createInMemoryStage4B3MediaTransport(getFallbackStage4B3MockMediaRegistry()),
      storage: createInMemoryStage4B3MediaStorage(),
      visionProvider: createStage4B3MockVisionProvider({ manifest: overflowManifest }),
      autoProcessPending: true,
      autoProcessVision: true,
      autoProcessBundles: false,
      workerId: "bundle-overflow-worker",
    };

    let state = baseState();
    for (let index = 1; index <= 5; index += 1) {
      const result = await processInboundWhatsAppChannelBatch(
        state,
        imagePayload(`wamid.IMG_OVERFLOW_${index}`, `MOCK_MEDIA_OVERFLOW_${index}`, bundleFixtureSha256),
        {
          providedSecret: TEST_SECRET,
          env: testEnv(),
          stage4b3Admission: overflowRuntime,
          now: `2026-07-13T10:0${index - 1}:00.000Z`,
        },
      );
      state = result.state;
    }

    const bundle = state.inboundMessageBundles[0];
    expect(bundle?.status).toBe("review_required");
    expect(bundle?.failureCode).toBe("bundle_image_cap_exceeded");
    expect(bundle?.imageCount).toBe(5);
    expect(state.aiDecisions).toHaveLength(SEED_AI_DECISION_COUNT);
  });
});

describe("phase-85-stage-4b3 bundle item idempotency", () => {
  it("ignores duplicate append attempts for the same message id", () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const opened = openInboundMessageBundle(state, {
      clientId: conversation.clientId,
      conversationId: conversation.id,
      anchorMessageId: "message-anchor-1",
      observedAt: T0,
      item: {
        messageId: "message-anchor-1",
        channelEventId: "channel-event-1",
        observedAt: T0,
        itemType: "image",
        mediaAssetId: "asset-1",
      },
    });
    const bundleId = opened.inboundMessageBundles[0]!.id;
    const duplicate = appendInboundBundleItem(opened, bundleId, {
      messageId: "message-anchor-1",
      channelEventId: "channel-event-1",
      observedAt: T119,
      itemType: "image",
      mediaAssetId: "asset-1",
    });

    expect(duplicate.inboundMessageBundleItems).toHaveLength(1);
    expect(duplicate.inboundMessageBundles[0]?.itemCount).toBe(1);
  });
});
