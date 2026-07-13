import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { processInboundWhatsAppChannelBatch } from "./phase-85-if-c-channel-event-ledger";
import { hashMediaBytes, validateAndSanitizeImageBytes } from "./phase-85-stage-4b3-image-admission";
import { createStage4B3MockVisionProvider } from "./phase-85-stage-4b3-mock-vision-provider";
import {
  createInMemoryStage4B3MediaStorage,
} from "./phase-85-stage-4b3-media-storage";
import {
  createEmptyStage4B3MockMediaRegistry,
  createInMemoryStage4B3MediaTransport,
  registerStage4B3MockMediaAsset,
} from "./phase-85-stage-4b3-media-transport";
import {
  analyzeSingleSanitizedMediaAsset,
  processStage4B3PendingVisionAnalysis,
  STAGE_4B3_VISION_MAX_DURABLE_RETRIES,
} from "./phase-85-stage-4b3-vision-analysis";
import {
  createStage4B3VisionFixtureManifest,
  registerStage4B3VisionFixtureHash,
  STAGE_4B3_VISION_FIXTURE_SCENE_IDS,
  STAGE_4B3_VISION_FIXTURE_TEMPLATES,
  type Stage4B3VisionFixtureSceneId,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import { STAGE_4B3_MOCK_VISION_ENV_FLAG } from "./phase-85-stage-4b3-provider-gate";
import type { ChannelAccountBindingRecord } from "./types";

const TEST_SECRET = "synthetic-ifc-test-secret";

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    [STAGE_4B3_MOCK_VISION_ENV_FLAG]: "true",
  } as NodeJS.ProcessEnv;
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
                  timestamp: "1720000200",
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

async function buildFixtureJpeg(sceneId: Stage4B3VisionFixtureSceneId): Promise<Buffer> {
  const index = STAGE_4B3_VISION_FIXTURE_SCENE_IDS.indexOf(sceneId);
  const channel = (index + 1) * 17;
  return sharp({
    create: {
      width: 640,
      height: 480,
      channels: 3,
      background: { r: channel, g: 64, b: 192 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function admitSanitizedFixture(sceneId: Stage4B3VisionFixtureSceneId) {
  const bytes = await buildFixtureJpeg(sceneId);
  const sanitized = await validateAndSanitizeImageBytes({ bytes, declaredMimeType: "image/jpeg" });
  if (!sanitized.ok) {
    throw new Error(`fixture sanitize failed: ${sanitized.failureCode}`);
  }

  const mediaId = `MOCK_MEDIA_${sceneId}`;
  const registry = createEmptyStage4B3MockMediaRegistry();
  registerStage4B3MockMediaAsset(registry, mediaId, bytes, "image/jpeg");
  const transport = createInMemoryStage4B3MediaTransport(registry);
  const storage = createInMemoryStage4B3MediaStorage();

  let manifest = createStage4B3VisionFixtureManifest();
  manifest = registerStage4B3VisionFixtureHash(manifest, sanitized.artifacts.contentSha256, sceneId);
  const visionProvider = createStage4B3MockVisionProvider({ manifest });

  const { state } = await processInboundWhatsAppChannelBatch(
    {
      ...createInitialState(),
      channelAccountBindings: [buildAccountBinding()],
    },
    imagePayload(`wamid.IMG_${sceneId}`, mediaId, hashMediaBytes(bytes)),
    {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: {
        transport,
        storage,
        visionProvider,
        autoProcessPending: true,
        autoProcessVision: true,
      },
    },
  );

  const asset = state.mediaAssets.find((entry) => entry.contentSha256 === sanitized.artifacts.contentSha256);
  const analysis = state.visualAnalysisRecords.find((entry) => entry.mediaAssetId === asset?.id);
  return { state, asset, analysis, sanitizedHash: sanitized.artifacts.contentSha256 };
}

describe("phase-85-stage-4b3 vision analysis integration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not analyze sanitized assets when the mock vision gate is disabled", async () => {
    const bytes = await buildFixtureJpeg("meal_plate");
    const mediaId = "MOCK_MEDIA_GATE_OFF";
    const registry = createEmptyStage4B3MockMediaRegistry();
    registerStage4B3MockMediaAsset(registry, mediaId, bytes, "image/jpeg");

    const { state } = await processInboundWhatsAppChannelBatch(
      {
        ...createInitialState(),
        channelAccountBindings: [buildAccountBinding()],
      },
      imagePayload("wamid.IMG_GATE_OFF", mediaId, hashMediaBytes(bytes)),
      {
        providedSecret: TEST_SECRET,
        env: {
          ...testEnv(),
          [STAGE_4B3_MOCK_VISION_ENV_FLAG]: "false",
        },
        stage4b3Admission: {
          transport: createInMemoryStage4B3MediaTransport(registry),
          storage: createInMemoryStage4B3MediaStorage(),
          visionProvider: createStage4B3MockVisionProvider(),
          autoProcessPending: true,
          autoProcessVision: true,
        },
      },
    );

    expect(state.mediaAssets[0]?.status).toBe("sanitized");
    expect(state.visualAnalysisRecords).toHaveLength(0);
  });

  it.each(STAGE_4B3_VISION_FIXTURE_SCENE_IDS)(
    "produces deterministic observations for fixture scene %s",
    async (sceneId) => {
      const first = await admitSanitizedFixture(sceneId);
      const second = await admitSanitizedFixture(sceneId);

      expect(first.sanitizedHash).toBe(second.sanitizedHash);
      expect(first.asset?.status).toBe("analysis_ready");
      expect(first.analysis?.status).toBe("ready");
      expect(first.analysis?.observation?.sceneType).toBe(STAGE_4B3_VISION_FIXTURE_TEMPLATES[sceneId].sceneType);
      expect(first.analysis?.observation).toEqual(second.analysis?.observation);
      expect(first.state.aiDecisions).toHaveLength(createInitialState().aiDecisions.length);
    },
  );

  it("marks unknown sanitized images as insufficient unknown observations", async () => {
    const bytes = await buildFixtureJpeg("meal_plate");
    const mediaId = "MOCK_MEDIA_UNKNOWN";
    const registry = createEmptyStage4B3MockMediaRegistry();
    registerStage4B3MockMediaAsset(registry, mediaId, bytes, "image/jpeg");

    const { state } = await processInboundWhatsAppChannelBatch(
      {
        ...createInitialState(),
        channelAccountBindings: [buildAccountBinding()],
      },
      imagePayload("wamid.IMG_UNKNOWN", mediaId, hashMediaBytes(bytes)),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: {
          transport: createInMemoryStage4B3MediaTransport(registry),
          storage: createInMemoryStage4B3MediaStorage(),
          visionProvider: createStage4B3MockVisionProvider(),
          autoProcessPending: true,
          autoProcessVision: true,
        },
      },
    );

    const analysis = state.visualAnalysisRecords[0];
    expect(analysis?.observation?.sceneType).toBe("unknown");
    expect(analysis?.observation?.qualityFlags).toContain("insufficient");
  });

  it("flags prompt-injection screenshot fixtures without creating AI decisions", async () => {
    const { state, analysis } = await admitSanitizedFixture("screenshot_prompt_injection");
    expect(analysis?.observation?.promptInjectionSignals).toContain("ignore_previous_instructions");
    expect(state.aiDecisions).toHaveLength(createInitialState().aiDecisions.length);
  });

  it("rejects malformed provider output and fails the asset after durable retries", async () => {
    const bytes = await buildFixtureJpeg("meal_plate");
    const sanitized = await validateAndSanitizeImageBytes({ bytes, declaredMimeType: "image/jpeg" });
    if (!sanitized.ok) throw new Error("sanitize failed");

    const baseState = {
      ...createInitialState(),
      channelAccountBindings: [buildAccountBinding()],
      mediaAssets: [
        {
          id: "asset-retry-1",
          tenantId: DEMO_TENANT_ID,
          clientId: "client-mert",
          conversationId: "conversation-client-mert",
          messageId: "message-1",
          channelEventId: "channel-event-1",
          position: 1,
          providerMediaId: null,
          providerMediaIdHash: "hash",
          declaredMimeType: "image/jpeg",
          detectedMimeType: "image/jpeg",
          dimensions: sanitized.artifacts.dimensions,
          byteSize: sanitized.artifacts.sanitizedFullBytes.byteLength,
          contentSha256: sanitized.artifacts.contentSha256,
          sanitizedFullObjectKey: "tenant/asset/full.jpg",
          thumbnailObjectKey: "tenant/asset/thumb.jpg",
          status: "sanitized",
          retryCount: STAGE_4B3_VISION_MAX_DURABLE_RETRIES,
          nextAttemptAt: null,
          leaseExpiresAt: null,
          storedAt: "2026-07-13T10:00:00.000Z",
          expiresAt: sanitized.artifacts.expiresAt,
          deletedAt: null,
          failureCode: null,
          createdAt: "2026-07-13T10:00:00.000Z",
          updatedAt: "2026-07-13T10:00:00.000Z",
        },
      ],
    };

    const provider = createStage4B3MockVisionProvider({ invalidOutput: true });
    const analyzed = await analyzeSingleSanitizedMediaAsset(baseState, "asset-retry-1", {
      env: testEnv(),
      provider,
    });

    expect(analyzed.mediaAssets[0]?.status).toBe("failed");
    expect(analyzed.visualAnalysisRecords[0]?.status).toBe("failed");
    expect(analyzed.visualAnalysisRecords[0]?.failureCode).toMatch(/unknown_key|confidence_invalid|schema_version_invalid/);
  });

  it("passes only sanitized hash to the provider without client profile context", async () => {
    const receivedInputs: Array<{ contentSha256: string }> = [];
    const bytes = await buildFixtureJpeg("packaged_food_label_complete");
    const sanitized = await validateAndSanitizeImageBytes({ bytes, declaredMimeType: "image/jpeg" });
    if (!sanitized.ok) throw new Error("sanitize failed");

    const manifest = registerStage4B3VisionFixtureHash(
      createStage4B3VisionFixtureManifest(),
      sanitized.artifacts.contentSha256,
      "packaged_food_label_complete",
    );
    const provider = createStage4B3MockVisionProvider({
      manifest,
      onAnalyze: (input) => {
        receivedInputs.push(input);
      },
    });

    await processStage4B3PendingVisionAnalysis(
      {
        ...createInitialState(),
        mediaAssets: [
          {
            id: "asset-context-1",
            tenantId: DEMO_TENANT_ID,
            clientId: "client-mert",
            conversationId: "conversation-client-mert",
            messageId: "message-1",
            channelEventId: "channel-event-1",
            position: 1,
            providerMediaId: null,
            providerMediaIdHash: "hash",
            declaredMimeType: "image/jpeg",
            detectedMimeType: "image/jpeg",
            dimensions: sanitized.artifacts.dimensions,
            byteSize: sanitized.artifacts.sanitizedFullBytes.byteLength,
            contentSha256: sanitized.artifacts.contentSha256,
            sanitizedFullObjectKey: "tenant/asset/full.jpg",
            thumbnailObjectKey: "tenant/asset/thumb.jpg",
            status: "sanitized",
            retryCount: 0,
            nextAttemptAt: null,
            leaseExpiresAt: null,
            storedAt: "2026-07-13T10:00:00.000Z",
            expiresAt: sanitized.artifacts.expiresAt,
            deletedAt: null,
            failureCode: null,
            createdAt: "2026-07-13T10:00:00.000Z",
            updatedAt: "2026-07-13T10:00:00.000Z",
          },
        ],
      },
      { env: testEnv(), provider },
    );

    expect(receivedInputs).toEqual([
      {
        contentSha256: sanitized.artifacts.contentSha256,
        detectedMimeType: "image/jpeg",
      },
    ]);
  });
});
