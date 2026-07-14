import { describe, expect, it } from "vitest";
import {
  isAllowlistedFixtureMediaId,
  isMetaProviderMediaFetch,
  resolveAllowlistedFixtureBytes,
  resolveFixtureSceneIdFromMediaId,
} from "./phase-85-stage-4b3-fixture-resolver";
import { createStage4B3DurableMediaTransport } from "./phase-85-stage-4b3-durable-media-transport";
import { createInMemoryStage4B3MediaStorage } from "./phase-85-stage-4b3-media-storage";
import { uploadSanitizedMediaObjectsWithRollback, sanitizeInboundMediaBytes } from "./phase-85-stage-4b3-durable-media-admission";
import sharp from "sharp";
import { extractImageIngressDelta } from "./phase-85-stage-4b3-supabase-canonical-ingress";
import { createInitialState } from "./seed-data";
import { processCanonicalWhatsAppIngressInState, registerStage4B3FixtureMediaAsset, buildCanonicalWhatsAppImagePayload } from "./phase-85-stage-4b3-canonical-ingress";
import { hashMediaBytes } from "./phase-85-stage-4b3-image-admission";

describe("phase 85 stage 4b-3 durable ingress foundation", () => {
  it("rejects Meta provider media fetch URLs", async () => {
    expect(isMetaProviderMediaFetch("https://graph.facebook.com/v19.0/media/123")).toBe(true);
    const transport = createStage4B3DurableMediaTransport();
    const result = await transport.fetchProviderMedia("https://lookaside.fbsbx.com/whatsapp_media/abc");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureCode).toBe("transport_unavailable");
    }
  });

  it("resolves allowlisted fixture media IDs deterministically", async () => {
    expect(isAllowlistedFixtureMediaId("MOCK_MEDIA_meal_plate")).toBe(true);
    expect(isAllowlistedFixtureMediaId("MOCK_MEDIA_UPLOAD_demo")).toBe(false);
    expect(resolveFixtureSceneIdFromMediaId("MOCK_MEDIA_meal_plate")).toBe("meal_plate");
    const fixture = await resolveAllowlistedFixtureBytes("MOCK_MEDIA_meal_plate");
    expect(fixture?.sha256).toBeTruthy();
    const again = await resolveAllowlistedFixtureBytes("MOCK_MEDIA_meal_plate");
    expect(again?.sha256).toBe(fixture?.sha256);
  });

  it("rolls back a partial sanitized upload when thumbnail upload fails", async () => {
    const storage = createInMemoryStage4B3MediaStorage();
    const originalUpload = storage.uploadObject.bind(storage);
    let callCount = 0;
    storage.uploadObject = async (objectKey, bytes, contentType) => {
      callCount += 1;
      if (callCount === 2) {
        throw new Error("thumbnail_upload_failed");
      }
      return originalUpload(objectKey, bytes, contentType);
    };

    const bytes = await sharp({
      create: { width: 120, height: 120, channels: 3, background: "#336699" },
    })
      .jpeg()
      .toBuffer();
    const sanitized = await sanitizeInboundMediaBytes({ bytes, declaredMimeType: "image/jpeg" });
    expect(sanitized.ok).toBe(true);
    if (!sanitized.ok) return;

    await expect(
      uploadSanitizedMediaObjectsWithRollback({
        storage,
        tenantId: "tenant-1",
        assetId: "asset-1",
        artifacts: sanitized.artifacts,
      }),
    ).rejects.toThrow("thumbnail_upload_failed");
    expect(storage.objects.size).toBe(0);
  });

  it("builds canonical inbound delta for image ingress without raw observation fields", async () => {
    const before = createInitialState();
    const fixture = await registerStage4B3FixtureMediaAsset({
      sceneId: "meal_plate",
      mediaId: "MOCK_MEDIA_meal_plate",
    });
    const ingress = await processCanonicalWhatsAppIngressInState(
      before,
      buildCanonicalWhatsAppImagePayload({
        providerEventId: "wamid.DURABLE_DELTA_1",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: hashMediaBytes(fixture.bytes),
      }),
      {
        providedSecret: "synthetic-stage4b3-canonical-secret",
        env: {
          NODE_ENV: "test",
          MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
          MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: "synthetic-stage4b3-canonical-secret",
        } as NodeJS.ProcessEnv,
        stage4b3Admission: {
          transport: createStage4B3DurableMediaTransport(),
          storage: createInMemoryStage4B3MediaStorage(),
          autoProcessPending: false,
        },
      },
    );

    const delta = extractImageIngressDelta(before, ingress.state);
    expect(delta?.channelEvent.eventKind).toBe("client_message_image");
    expect(delta?.mediaAsset?.status).toBe("download_pending");
    expect(delta?.bundle?.status).toBe("open");
    expect(JSON.stringify(delta)).not.toMatch(/observation/i);
  });
});
