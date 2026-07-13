import sharp from "sharp";
import { beforeAll, describe, expect, it } from "vitest";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { processInboundWhatsAppChannelBatch } from "./phase-85-if-c-channel-event-ledger";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";
import {
  createInMemoryStage4B3MediaStorage,
} from "./phase-85-stage-4b3-media-storage";
import {
  createEmptyStage4B3MockMediaRegistry,
  createInMemoryStage4B3MediaTransport,
  registerStage4B3MockMediaAsset,
} from "./phase-85-stage-4b3-media-transport";
import type { ChannelAccountBindingRecord } from "./types";

const TEST_SECRET = "synthetic-ifc-test-secret";

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
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

function imagePayload(providerEventId: string, mediaId: string, mimeType: string, sha256: string, caption?: string) {
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
                  timestamp: "1720000100",
                  type: "image",
                  image: {
                    id: mediaId,
                    mime_type: mimeType,
                    sha256,
                    caption,
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

describe("phase-85-stage-4b3-media-admission ingress", () => {
  let validJpeg: Buffer;

  beforeAll(async () => {
    validJpeg = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 10, g: 120, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();
  });

  it("admits client images through the ledger without creating AI drafts or client replies", async () => {
    const registry = createEmptyStage4B3MockMediaRegistry();
    const mediaId = "MOCK_MEDIA_JPEG_1";
    registerStage4B3MockMediaAsset(registry, mediaId, validJpeg, "image/jpeg");
    const storage = createInMemoryStage4B3MediaStorage();
    const transport = createInMemoryStage4B3MediaTransport(registry);

    const state = {
      ...createInitialState(),
      channelAccountBindings: [buildAccountBinding()],
    };
    const draftCountBefore = state.messages.filter((message) => message.status === "draft").length;

    const { state: next, result } = await processInboundWhatsAppChannelBatch(
      state,
      imagePayload("wamid.IMG_1", mediaId, "image/jpeg", hashMediaBytes(validJpeg)),
      {
        providedSecret: TEST_SECRET,
        env: testEnv(),
        stage4b3Admission: { transport, storage, autoProcessPending: true },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const committed = result.outcomes[0]?.event;
    expect(committed?.eventKind).toBe("client_message_image");

    const asset = next.mediaAssets.find((item) => item.providerMediaIdHash);
    expect(asset?.status).toBe("sanitized");
    expect(asset?.providerMediaId).toBeNull();
    expect(asset?.sanitizedFullObjectKey).toBeTruthy();
    expect(asset?.thumbnailObjectKey).toBeTruthy();
    expect(storage.objects.size).toBe(2);

    const draftCountAfter = next.messages.filter((message) => message.status === "draft").length;
    expect(draftCountAfter).toBe(draftCountBefore);

    const aiDecisions = next.aiDecisions.length;
    expect(aiDecisions).toBe(state.aiDecisions.length);
  });

  it("keeps unsupported image metadata on the legacy unsupported path when mime is missing", async () => {
    const state = {
      ...createInitialState(),
      channelAccountBindings: [buildAccountBinding()],
    };

    const { state: next, result } = await processInboundWhatsAppChannelBatch(
      state,
      {
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
                      id: "wamid.IMG_UNSUPPORTED",
                      timestamp: "1720000101",
                      type: "image",
                      image: { id: "SYNTHETIC_MEDIA_ID" },
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.outcomes[0]?.event.eventKind).toBe("client_message_media_unsupported");
    expect(next.mediaAssets).toHaveLength(0);
  });
});
