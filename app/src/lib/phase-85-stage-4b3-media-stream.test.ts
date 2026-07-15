import { describe, expect, it, beforeEach } from "vitest";
import { streamConversationMediaFromFallbackState } from "./phase-85-stage-4b3-media-stream";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import { buildAsset } from "./phase-85-stage-4b3-bounded-media.test";
import { listFallbackAssignments } from "./phase-85-stage-4b-api";
import {
  getFallbackStage4B4AudioStorage,
  resetFallbackStage4B4AudioStorage,
} from "./phase-85-stage-4b4-fallback-audio-storage";

describe("phase-85-stage-4b3-media-stream audio range", () => {
  beforeEach(() => {
    resetFallbackStage4B4AudioStorage();
  });

  it("streams partial audio ranges with consistent range headers", async () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const assetId = "voice-range-asset";
    const objectKey = `${DEMO_TENANT_ID}/${assetId}/voice.wav`;
    const fullBody = Buffer.from("0123456789abcdef");
    await getFallbackStage4B4AudioStorage().uploadObject(objectKey, fullBody, "audio/wav");

    state.mediaAssets = [
      buildAsset({
        id: assetId,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId: "voice-range-message",
        mediaKind: "audio",
        voiceMessage: true,
        durationMs: 4_000,
        sanitizedAudioObjectKey: objectKey,
        byteSize: fullBody.byteLength,
        contentSha256: "sha-range-test",
        declaredMimeType: "audio/ogg",
        detectedMimeType: "audio/wav",
        status: "analysis_ready",
      }),
    ];

    const stream = await streamConversationMediaFromFallbackState({
      state,
      context: {
        tenantId: DEMO_TENANT_ID,
        dietitianId: state.dietitian.id,
        role: "owner",
        userId: "user-1",
      },
      assignments: listFallbackAssignments(),
      conversationId: conversation.id,
      assetId,
      variant: "audio",
      rangeHeader: "bytes=2-5",
    });

    expect(stream.ok).toBe(true);
    if (!stream.ok) return;
    expect(stream.status).toBe(206);
    expect(stream.body.toString()).toBe("2345");
    expect(stream.headers["Content-Range"]).toBe(`bytes 2-5/${fullBody.byteLength}`);
    expect(stream.headers["Content-Length"]).toBe("4");
    expect(stream.headers["Accept-Ranges"]).toBe("bytes");
    expect(stream.headers.ETag).toBe('"sha-range-test"');
  });

  it("returns 416 with the real asset size for invalid ranges", async () => {
    const state = createInitialState();
    const conversation = state.conversations[0]!;
    const assetId = "voice-range-invalid";
    const objectKey = `${DEMO_TENANT_ID}/${assetId}/voice.wav`;
    const fullBody = Buffer.from("abcdefghij");
    await getFallbackStage4B4AudioStorage().uploadObject(objectKey, fullBody, "audio/wav");

    state.mediaAssets = [
      buildAsset({
        id: assetId,
        clientId: conversation.clientId,
        conversationId: conversation.id,
        messageId: "voice-range-invalid-message",
        mediaKind: "audio",
        voiceMessage: true,
        durationMs: 4_000,
        sanitizedAudioObjectKey: objectKey,
        byteSize: fullBody.byteLength,
        declaredMimeType: "audio/ogg",
        detectedMimeType: "audio/wav",
        status: "analysis_ready",
      }),
    ];

    const stream = await streamConversationMediaFromFallbackState({
      state,
      context: {
        tenantId: DEMO_TENANT_ID,
        dietitianId: state.dietitian.id,
        role: "owner",
        userId: "user-1",
      },
      assignments: listFallbackAssignments(),
      conversationId: conversation.id,
      assetId,
      variant: "audio",
      rangeHeader: "bytes=20-30",
    });

    expect(stream.ok).toBe(false);
    if (stream.ok) return;
    expect(stream.status).toBe(416);
    expect(stream.headers?.["Content-Range"]).toBe(`bytes */${fullBody.byteLength}`);
  });
});
