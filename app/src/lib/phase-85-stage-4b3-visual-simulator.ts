import { AppDomainError } from "./app-errors";
import type { ManuAppState, SimulationResult } from "./types";
import { computeBundleReadyAt } from "./phase-85-stage-4b3-message-bundles";
import {
  buildCanonicalWhatsAppImagePayload,
  buildCanonicalWhatsAppTextPayload,
  createStage4B3LocalAdmissionRuntime,
  ensureStage4B3DemoChannelIngressState,
  hashMediaBytes,
  processCanonicalWhatsAppIngressInState,
  registerStage4B3FixtureMediaAsset,
  runStage4B3LocalWorkerTick,
} from "./phase-85-stage-4b3-canonical-ingress";
import {
  STAGE_4B3_VISION_FIXTURE_SCENE_IDS,
  type Stage4B3VisionFixtureSceneId,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import { validateAndSanitizeImageBytes } from "./phase-85-stage-4b3-image-admission";
import { getFallbackStage4B3MockMediaRegistry } from "./phase-85-stage-4b3-fallback-media-registry";
import { registerStage4B3MockMediaAsset } from "./phase-85-stage-4b3-media-transport";

export const STAGE_4B3_VISUAL_SIMULATOR_VERSION = "p85-stage-4b3-visual-simulator-v1";
export const STAGE_4B3_BUNDLE_SILENCE_MS = 120_000;

export type Stage4B3VisualSimulationRequest = {
  clientId: string;
  idempotencyKey: string;
  fixtureSceneId?: Stage4B3VisionFixtureSceneId;
  caption?: string;
  burstMessages?: string[];
  flushSilence?: boolean;
  now?: string;
  uploadBytes?: Buffer;
  uploadMimeType?: string;
};

export type Stage4B3VisualSimulationResult = {
  version: string;
  generatedAt: string;
  bundleOpened: boolean;
  flushedSilence: boolean;
  mediaAssetCount: number;
  bundleCount: number;
  lastSimulation: SimulationResult | null;
};

function resolveClientChannelUserId(state: ManuAppState, clientId: string): string {
  const client = state.clients.find((entry) => entry.id === clientId && entry.lifecycleStatus === "active");
  if (!client?.channelUserId?.trim()) {
    throw new AppDomainError(404, "client_not_found");
  }
  return client.channelUserId;
}

function advanceIsoTimestamp(baseIso: string, deltaMs: number): string {
  return new Date(Date.parse(baseIso) + deltaMs).toISOString();
}

export async function runStage4B3VisualSimulationInState(
  state: ManuAppState,
  request: Stage4B3VisualSimulationRequest,
  options: { providedSecret?: string | null; env?: NodeJS.ProcessEnv } = {},
): Promise<{ state: ManuAppState; result: Stage4B3VisualSimulationResult }> {
  const channelUserId = resolveClientChannelUserId(state, request.clientId);
  const baseNow = request.now ?? new Date().toISOString();
  let workingState = ensureStage4B3DemoChannelIngressState(state);
  const mediaAssetsBefore = workingState.mediaAssets.length;
  const bundlesBefore = workingState.inboundMessageBundles.length;

  let manifest;
  let mediaId: string;
  let sha256: string;

  if (request.uploadBytes) {
    const mimeType = request.uploadMimeType ?? "image/jpeg";
    const sanitized = await validateAndSanitizeImageBytes({
      bytes: request.uploadBytes,
      declaredMimeType: mimeType,
    });
    if (!sanitized.ok) {
      throw new AppDomainError(400, sanitized.failureCode);
    }
    mediaId = `MOCK_MEDIA_UPLOAD_${request.idempotencyKey}`;
    registerStage4B3MockMediaAsset(
      getFallbackStage4B3MockMediaRegistry(),
      mediaId,
      sanitized.artifacts.sanitizedFullBytes,
      "image/jpeg",
    );
    sha256 = sanitized.artifacts.contentSha256;
    manifest = undefined;
  } else {
    const sceneId = request.fixtureSceneId ?? "meal_plate";
    if (!STAGE_4B3_VISION_FIXTURE_SCENE_IDS.includes(sceneId)) {
      throw new AppDomainError(400, "invalid_fixture_scene");
    }
    const fixture = await registerStage4B3FixtureMediaAsset({ sceneId });
    mediaId = fixture.mediaId;
    sha256 = hashMediaBytes(fixture.bytes);
    manifest = fixture.manifest;
  }

  const admission = createStage4B3LocalAdmissionRuntime({
    manifest,
    autoProcessBundles: false,
    workerId: "stage4b3-visual-simulator",
  });

  const imageIngress = await processCanonicalWhatsAppIngressInState(
    workingState,
    buildCanonicalWhatsAppImagePayload({
      providerEventId: `wamid.VIS_SIM_IMG_${request.idempotencyKey}`,
      from: channelUserId,
      mediaId,
      sha256,
      caption: request.caption,
      timestamp: String(Math.floor(Date.parse(baseNow) / 1000)),
    }),
    {
      providedSecret: options.providedSecret ?? options.env?.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET ?? null,
      env: options.env,
      now: baseNow,
      stage4b3Admission: admission,
      bootstrapDemoBindings: false,
    },
  );
  workingState = imageIngress.state;

  const burstMessages = request.burstMessages ?? [];
  let observedAt = baseNow;
  for (const [index, message] of burstMessages.entries()) {
    const compact = message.trim();
    if (!compact) continue;
    observedAt = advanceIsoTimestamp(baseNow, (index + 1) * 15_000);
    const textIngress = await processCanonicalWhatsAppIngressInState(
      workingState,
      buildCanonicalWhatsAppTextPayload({
        providerEventId: `wamid.VIS_SIM_TXT_${request.idempotencyKey}_${index + 1}`,
        from: channelUserId,
        body: compact,
        timestamp: String(Math.floor(Date.parse(observedAt) / 1000)),
      }),
      {
        providedSecret: options.providedSecret ?? options.env?.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET ?? null,
        env: options.env,
        now: observedAt,
        stage4b3Admission: admission,
        bootstrapDemoBindings: false,
      },
    );
    workingState = textIngress.state;
  }

  let flushedSilence = false;
  if (request.flushSilence !== false) {
    const flushAt = computeBundleReadyAt(observedAt);
    workingState = await runStage4B3LocalWorkerTick(workingState, {
      now: flushAt,
      env: options.env,
      admission,
      runOrchestration: true,
      workerId: "stage4b3-visual-simulator",
    });
    flushedSilence = true;
  }

  return {
    state: workingState,
    result: {
      version: STAGE_4B3_VISUAL_SIMULATOR_VERSION,
      generatedAt: new Date().toISOString(),
      bundleOpened: workingState.inboundMessageBundles.length > bundlesBefore,
      flushedSilence,
      mediaAssetCount: workingState.mediaAssets.length - mediaAssetsBefore,
      bundleCount: workingState.inboundMessageBundles.length,
      lastSimulation: workingState.lastSimulation,
    },
  };
}
