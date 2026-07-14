import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getWhatsAppWebhook, POST as postWhatsAppWebhook } from "@/app/api/whatsapp/webhook/route";
import { POST as postVisualSimulator } from "@/app/api/simulator/visual/route";
import { resetFallbackState } from "@/lib/app-state-store";
import { createInitialState } from "@/lib/seed-data";
import { resetRateLimits } from "@/lib/rate-limit";
import {
  buildCanonicalWhatsAppImagePayload,
  buildCanonicalWhatsAppTextPayload,
  extractWebhookPayloadAndSecret,
  isCanonicalMockWebhookGateEnabled,
  processCanonicalWhatsAppIngressInState,
  registerStage4B3FixtureMediaAsset,
  runStage4B3LocalWorkerTick,
} from "@/lib/phase-85-stage-4b3-canonical-ingress";
import { runStage4B3VisualSimulationInState } from "@/lib/phase-85-stage-4b3-visual-simulator";
import { hashMediaBytes } from "@/lib/phase-85-stage-4b3-image-admission";

const TEST_SECRET = "synthetic-stage4b3-canonical-secret";

function testEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    MANU_ALLOW_MOCK_VISION: "true",
    ...overrides,
  } as NodeJS.ProcessEnv;
}

function buildWebhookRequest(payload: unknown, secret = TEST_SECRET) {
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-manu-mock-webhook-secret": secret,
    },
    body: JSON.stringify(payload),
  }) as never;
}

describe("phase 85 stage 4b-3 canonical ingress", () => {
  beforeEach(() => {
    resetRateLimits();
    resetFallbackState();
    process.env.MANU_DEV_FALLBACK_STORE = "true";
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    process.env.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET = TEST_SECRET;
  });

  it("requires the mock webhook secret and refuses production or hosted sandbox", () => {
    expect(isCanonicalMockWebhookGateEnabled(testEnv(), TEST_SECRET)).toBe(true);
    expect(isCanonicalMockWebhookGateEnabled(testEnv({ NODE_ENV: "production" }), TEST_SECRET)).toBe(false);
    expect(isCanonicalMockWebhookGateEnabled(testEnv({ MANU_HOSTED_SANDBOX_ACTIVE: "true" }), TEST_SECRET)).toBe(false);
    expect(isCanonicalMockWebhookGateEnabled(testEnv(), "wrong-secret")).toBe(false);
    expect(isCanonicalMockWebhookGateEnabled(testEnv({ MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: undefined }), TEST_SECRET)).toBe(
      false,
    );
  });

  it("strips webhook_secret from the payload before normalization", () => {
    const extracted = extractWebhookPayloadAndSecret(
      {
        webhook_secret: TEST_SECRET,
        object: "whatsapp_business_account",
      },
      null,
    );

    expect(extracted.providedSecret).toBe(TEST_SECRET);
    expect(extracted.sanitizedPayload).toEqual({ object: "whatsapp_business_account" });
  });

  it("returns 403 when the mock webhook is enabled but the secret gate fails", async () => {
    const response = await postWhatsAppWebhook(
      buildWebhookRequest(
        buildCanonicalWhatsAppTextPayload({
          providerEventId: "wamid.NO_SECRET",
          from: "905551110001",
          body: "Merhaba",
        }),
        "",
      ),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "secure_ingress_gate_disabled" });
  });

  it("processes canonical text ingress for known identities", async () => {
    const payload = buildCanonicalWhatsAppTextPayload({
      providerEventId: "wamid.CANONICAL_TEXT_1",
      from: "905551110001",
      body: "Bugun kahvaltida ne yiyebilirim?",
    });
    const response = await postWhatsAppWebhook(buildWebhookRequest(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("processed");
    expect(body.action).toBe("sent");
  });

  it("ignores duplicate provider events through the canonical webhook route", async () => {
    const payload = buildCanonicalWhatsAppTextPayload({
      providerEventId: "wamid.CANONICAL_DUP_1",
      from: "905551110001",
      body: "Tekrarlayan mesaj",
    });
    const first = await postWhatsAppWebhook(buildWebhookRequest(payload));
    const second = await postWhatsAppWebhook(buildWebhookRequest(payload));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).status).toBe("duplicate_ignored");
  });

  it("commits image ingress once and opens a bundle without immediate client send", async () => {
    const fixture = await registerStage4B3FixtureMediaAsset({ sceneId: "meal_plate", mediaId: "MOCK_MEDIA_CANONICAL_IMG" });
    const state = createInitialState();
    const ingress = await processCanonicalWhatsAppIngressInState(
      state,
      buildCanonicalWhatsAppImagePayload({
        providerEventId: "wamid.CANONICAL_IMG_1",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: hashMediaBytes(fixture.bytes),
        caption: "Öğle yemeği",
      }),
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    expect(ingress.result.status).toBe("processed");
    expect(ingress.state.mediaAssets).toHaveLength(1);
    expect(ingress.state.inboundMessageBundles).toHaveLength(1);
    expect(ingress.state.lastSimulation).toBeNull();
    expect(fixture.mediaId).toBe("MOCK_MEDIA_CANONICAL_IMG");
  });

  it("runs burst text reset and injected-clock worker flush for visual simulation", async () => {
    const fixture = await registerStage4B3FixtureMediaAsset({ sceneId: "meal_plate", mediaId: "MOCK_MEDIA_VIS_SIM" });
    const simulation = await runStage4B3VisualSimulationInState(
      createInitialState(),
      {
        clientId: "client-mert",
        idempotencyKey: "vis-sim-1",
        fixtureSceneId: "meal_plate",
        caption: "Öğle",
        burstMessages: ["Bu tabağı yedim", "Teşekkürler"],
        flushSilence: true,
        now: "2026-07-13T10:00:00.000Z",
      },
      { providedSecret: TEST_SECRET, env: testEnv() },
    );

    expect(simulation.result.bundleOpened).toBe(true);
    expect(simulation.result.flushedSilence).toBe(true);
    expect(simulation.result.mediaAssetCount).toBe(1);
    expect(simulation.state.inboundMessageBundles.length).toBeGreaterThan(0);
    expect(fixture.mediaId).toBe("MOCK_MEDIA_VIS_SIM");
  });

  it("reclaims due assets and bundles through the local worker tick", async () => {
    const fixture = await registerStage4B3FixtureMediaAsset({ sceneId: "meal_plate", mediaId: "MOCK_MEDIA_WORKER" });
    const base = createInitialState();
    const ingress = await processCanonicalWhatsAppIngressInState(
      base,
      buildCanonicalWhatsAppImagePayload({
        providerEventId: "wamid.WORKER_IMG_1",
        from: "905551110001",
        mediaId: fixture.mediaId,
        sha256: hashMediaBytes(fixture.bytes),
      }),
      { providedSecret: TEST_SECRET, env: testEnv(), now: "2026-07-13T10:00:00.000Z" },
    );

    const workerState = await runStage4B3LocalWorkerTick(ingress.state, {
      now: "2026-07-13T10:02:00.000Z",
      env: testEnv(),
      runOrchestration: true,
    });

    expect(workerState.mediaAssets[0]?.status).not.toBe("admission_pending");
    expect(workerState.visualAnalysisRecords.length).toBeGreaterThan(0);
  });

  it("accepts multipart visual simulator uploads and returns refreshed fallback state", async () => {
    const bytes = await sharp({
      create: { width: 320, height: 240, channels: 3, background: { r: 12, g: 120, b: 200 } },
    })
      .jpeg()
      .toBuffer();
    const form = new FormData();
    form.set("clientId", "client-mert");
    form.set("idempotencyKey", "vis-upload-1");
    form.set("burstMessages", "Bilinmeyen görsel\nNe dersiniz?");
    form.set(
      "image",
      new File([Uint8Array.from(bytes)], "upload.jpg", { type: "image/jpeg" }),
    );

    const response = await postVisualSimulator(
      new Request("http://localhost/api/simulator/visual", {
        method: "POST",
        body: form,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mediaAssets?.length).toBeGreaterThan(0);
    expect(body.inboundMessageBundles?.length).toBeGreaterThan(0);
  });

  it("keeps GET mock webhook post-only when enabled", async () => {
    const response = await getWhatsAppWebhook();
    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({ error: "mock_webhook_post_only" });
  });
});
