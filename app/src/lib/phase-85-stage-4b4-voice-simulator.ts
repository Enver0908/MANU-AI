import { computeBundleReadyAt } from "./phase-85-stage-4b3-message-bundles";
import {
  buildCanonicalWhatsAppTextPayload,
  buildCanonicalWhatsAppVoicePayload,
  createStage4B3LocalAdmissionRuntime,
  ensureStage4B3DemoChannelIngressState,
  processCanonicalWhatsAppIngressInState,
  registerStage4B4FixtureMediaAsset,
  runStage4B3LocalWorkerTick,
} from "./phase-85-stage-4b3-canonical-ingress";
import type { Stage4B4VoiceFixtureId } from "./phase-85-stage-4b4-audio-fixture-resolver";
import { createStage4B4MockTranscriptionProvider } from "./phase-85-stage-4b4-mock-transcription-provider";
import { STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG } from "./phase-85-stage-4b4-provider-gate";
import { STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY } from "./phase-85-stage-4b4-voice-contracts";
import {
  createStage4B4TranscriptionFixtureManifest,
  registerStage4B4TranscriptionFixtureHash,
  type Stage4B4TranscriptionFixtureSceneId,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { AppDomainError } from "./app-errors";
import { runInboundSimulation } from "./simulator";
import type { ManuAppState, SimulationResult } from "./types";

export const STAGE_4B4_VOICE_SIMULATOR_VERSION = "p85-stage-4b4-voice-simulator-v1";

export type Stage4B4VoiceSimulationRequest = {
  clientId: string;
  idempotencyKey: string;
  fixtureId?: Stage4B4VoiceFixtureId;
  transcriptionSceneId?: Stage4B4TranscriptionFixtureSceneId;
  burstMessages?: string[];
  flushSilence?: boolean;
  now?: string;
};

export type Stage4B4VoiceSimulationResult = {
  version: string;
  generatedAt: string;
  bundleOpened: boolean;
  flushedSilence: boolean;
  voiceAssetCount: number;
  transcriptionCount: number;
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

function testEnv(secret: string): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: secret,
    [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
  } as NodeJS.ProcessEnv;
}

export async function runStage4B4VoiceSimulationInState(
  state: ManuAppState,
  request: Stage4B4VoiceSimulationRequest,
  options: { providedSecret?: string | null; env?: NodeJS.ProcessEnv } = {},
): Promise<{ state: ManuAppState; result: Stage4B4VoiceSimulationResult }> {
  const channelUserId = resolveClientChannelUserId(state, request.clientId);
  const baseNow = request.now ?? new Date().toISOString();
  const secret = options.providedSecret ?? options.env?.MANU_MOCK_WHATSAPP_WEBHOOK_SECRET ?? "stage4b4-voice-simulator";
  let workingState = ensureStage4B3DemoChannelIngressState(state);
  const voiceAssetsBefore = workingState.mediaAssets.filter((asset) => asset.mediaKind === "audio").length;
  const transcriptionsBefore = workingState.audioTranscriptionRecords.length;
  const bundlesBefore = workingState.inboundMessageBundles.length;

  const fixtureId = request.fixtureId ?? "golden_voice_note";
  const fixture = registerStage4B4FixtureMediaAsset({ fixtureId });
  let manifest = createStage4B4TranscriptionFixtureManifest();
  if (request.transcriptionSceneId) {
    manifest = registerStage4B4TranscriptionFixtureHash(manifest, fixture.contentSha256, request.transcriptionSceneId);
  }
  const admission = createStage4B3LocalAdmissionRuntime({
    autoProcessAudioPending: false,
    autoProcessTranscription: false,
    autoProcessBundles: false,
    workerId: "stage4b4-voice-simulator",
    transcriptionProvider: createStage4B4MockTranscriptionProvider({ env: testEnv(secret), manifest }),
  });

  const voiceIngress = await processCanonicalWhatsAppIngressInState(
    workingState,
    buildCanonicalWhatsAppVoicePayload({
      providerEventId: `wamid.VOICE_SIM_${request.idempotencyKey}`,
      from: channelUserId,
      mediaId: fixture.mediaId,
      sha256: fixture.contentSha256,
      durationMs: 3_000,
      timestamp: String(Math.floor(Date.parse(baseNow) / 1000)),
    }),
    {
      providedSecret: secret,
      env: options.env ?? testEnv(secret),
      now: baseNow,
      stage4b3Admission: admission,
      bootstrapDemoBindings: false,
    },
  );
  workingState = voiceIngress.state;

  const burstMessages = request.burstMessages ?? [];
  let observedAt = baseNow;
  for (const [index, message] of burstMessages.entries()) {
    const compact = message.trim();
    if (!compact) continue;
    observedAt = advanceIsoTimestamp(baseNow, (index + 1) * 15_000);
    const textIngress = await processCanonicalWhatsAppIngressInState(
      workingState,
      buildCanonicalWhatsAppTextPayload({
        providerEventId: `wamid.VOICE_SIM_TXT_${request.idempotencyKey}_${index + 1}`,
        from: channelUserId,
        body: compact,
        timestamp: String(Math.floor(Date.parse(observedAt) / 1000)),
      }),
      {
        providedSecret: secret,
        env: options.env ?? testEnv(secret),
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
    admission.autoProcessTranscription = false;
    workingState = await runStage4B3LocalWorkerTick(workingState, {
      now: advanceIsoTimestamp(baseNow, 60_000),
      env: options.env ?? testEnv(secret),
      admission,
      runOrchestration: false,
      workerId: "stage4b4-voice-simulator-admission",
    });
    const asset = workingState.mediaAssets.find((entry) => entry.mediaKind === "audio" && entry.status !== "failed");
    if (asset?.contentSha256 && request.transcriptionSceneId) {
      manifest = registerStage4B4TranscriptionFixtureHash(manifest, asset.contentSha256, request.transcriptionSceneId);
      admission.transcriptionProvider = createStage4B4MockTranscriptionProvider({
        env: testEnv(secret),
        manifest,
      });
    }
    admission.autoProcessTranscription = true;
    workingState = await runStage4B3LocalWorkerTick(workingState, {
      now: flushAt,
      env: options.env ?? testEnv(secret),
      admission,
      runOrchestration: true,
      workerId: "stage4b4-voice-simulator",
    });
    if (!workingState.lastSimulation) {
      const bridgedVoiceMessage = [...workingState.messages].reverse().find(
        (message) =>
          message.sender === "client" &&
          message.body.trim() &&
          message.body !== STAGE_4B4_PLACEHOLDER_VOICE_MESSAGE_BODY &&
          workingState.mediaAssets.some(
            (asset) => asset.mediaKind === "audio" && asset.messageId === message.id && asset.status === "analysis_ready",
          ),
      );
      const acceptedTranscript = [...workingState.audioTranscriptionRecords].reverse().find(
        (record) =>
          record.clientId === request.clientId &&
          record.status === "accepted" &&
          record.observation?.transcriptText.trim(),
      );
      const typedBridgeBody = bridgedVoiceMessage?.body ?? acceptedTranscript?.observation?.transcriptText ?? null;
      if (typedBridgeBody) {
        workingState = await runInboundSimulation(workingState, {
          clientId: request.clientId,
          body: typedBridgeBody,
          idempotencyKey: `voice-sim-typed-bridge-${request.idempotencyKey}`,
          now: flushAt,
        });
      }
    }
    flushedSilence = true;
  }

  return {
    state: workingState,
    result: {
      version: STAGE_4B4_VOICE_SIMULATOR_VERSION,
      generatedAt: new Date().toISOString(),
      bundleOpened: workingState.inboundMessageBundles.length > bundlesBefore,
      flushedSilence,
      voiceAssetCount:
        workingState.mediaAssets.filter((asset) => asset.mediaKind === "audio").length - voiceAssetsBefore,
      transcriptionCount: workingState.audioTranscriptionRecords.length - transcriptionsBefore,
      bundleCount: workingState.inboundMessageBundles.length,
      lastSimulation: workingState.lastSimulation,
    },
  };
}
