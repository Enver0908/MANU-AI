import sharp from "sharp";
import type { ChannelAccountBindingRecord, ManuAppState } from "./types";
import { DEMO_TENANT_ID } from "./seed-data";
import {
  processInboundWhatsAppChannelBatch,
  resolveSecureChannelIngressGate,
  type ChannelEventIngressResult,
  type Stage4B3AdmissionRuntime,
} from "./phase-85-if-c-channel-event-ledger";
import { hashMediaBytes, validateAndSanitizeImageBytes } from "./phase-85-stage-4b3-image-admission";
import { getFallbackStage4B3MediaStorage } from "./phase-85-stage-4b3-fallback-media-storage";
import { getFallbackStage4B3MockMediaRegistry } from "./phase-85-stage-4b3-fallback-media-registry";
import { createStage4B3DurableMediaTransport } from "./phase-85-stage-4b3-durable-media-transport";
import {
  createInMemoryStage4B3MediaTransport,
  registerStage4B3MockMediaAsset,
} from "./phase-85-stage-4b3-media-transport";
import { createStage4B3MockVisionProvider } from "./phase-85-stage-4b3-mock-vision-provider";
import {
  createStage4B3VisionFixtureManifest,
  registerStage4B3VisionFixtureHash,
  STAGE_4B3_VISION_FIXTURE_SCENE_IDS,
  type Stage4B3VisionFixtureSceneId,
} from "./phase-85-stage-4b3-vision-fixture-manifest";
import { processStage4B3PendingMediaAssets } from "./phase-85-stage-4b3-media-admission";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
import { processStage4B3PendingVisionAnalysis } from "./phase-85-stage-4b3-vision-analysis";
import type { WhatsAppMockWebhookResult } from "./whatsapp-mock-webhook";
import { toWhatsAppMockWebhookResult } from "./whatsapp-mock-webhook";

export const STAGE_4B3_CANONICAL_INGRESS_VERSION = "p85-stage-4b3-canonical-ingress-v1";
export const STAGE_4B3_DEMO_BUSINESS_PHONE_NUMBER_ID = "SYNTHETIC_PHONE_NUMBER_ID";
export const STAGE_4B3_MOCK_WEBHOOK_SECRET_HEADER = "x-manu-mock-webhook-secret";

const DEMO_ACCOUNT_BINDING_ID = "demo-account-binding-whatsapp";

const QUARANTINE_BLOCKED_REASON_MAP: Record<string, string> = {
  no_client_matches_counterparty: "identity_quarantine_unknown_channel_identity",
  multiple_tenant_clients_match_counterparty: "identity_quarantine_ambiguous_channel_identity",
  whatsapp_group_unsupported: "whatsapp_group_unsupported",
};

export type CanonicalIngressProcessOptions = {
  providedSecret?: string | null;
  env?: NodeJS.ProcessEnv;
  now?: string;
  stage4b3Admission?: Stage4B3AdmissionRuntime;
  bootstrapDemoBindings?: boolean;
};

export function extractWebhookPayloadAndSecret(
  payload: unknown,
  headerSecret?: string | null,
): { sanitizedPayload: unknown; providedSecret: string | null } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { sanitizedPayload: payload, providedSecret: headerSecret?.trim() || null };
  }

  const record = payload as Record<string, unknown>;
  const bodySecret = typeof record.webhook_secret === "string" ? record.webhook_secret.trim() : "";
  if (bodySecret) {
    const { webhook_secret: _ignored, ...rest } = record;
    return {
      sanitizedPayload: rest,
      providedSecret: headerSecret?.trim() || bodySecret,
    };
  }

  return { sanitizedPayload: payload, providedSecret: headerSecret?.trim() || null };
}

export function buildStage4B3DemoAccountBinding(): ChannelAccountBindingRecord {
  return {
    id: DEMO_ACCOUNT_BINDING_ID,
    tenantId: DEMO_TENANT_ID,
    provider: "whatsapp_cloud",
    providerAccountId: STAGE_4B3_DEMO_BUSINESS_PHONE_NUMBER_ID,
    wabaId: "SYNTHETIC_WABA_1",
    businessPhoneNumberId: STAGE_4B3_DEMO_BUSINESS_PHONE_NUMBER_ID,
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

export function ensureStage4B3DemoChannelIngressState(state: ManuAppState): ManuAppState {
  if (
    state.channelAccountBindings.some(
      (binding) => binding.businessPhoneNumberId === STAGE_4B3_DEMO_BUSINESS_PHONE_NUMBER_ID,
    )
  ) {
    return state;
  }

  return {
    ...state,
    channelAccountBindings: [...state.channelAccountBindings, buildStage4B3DemoAccountBinding()],
  };
}

export async function buildStage4B3FixtureJpeg(sceneId: Stage4B3VisionFixtureSceneId): Promise<Buffer> {
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

export function createStage4B3LocalAdmissionRuntime(input?: {
  registry?: ReturnType<typeof getFallbackStage4B3MockMediaRegistry>;
  manifest?: ReturnType<typeof createStage4B3VisionFixtureManifest>;
  autoProcessPending?: boolean;
  autoProcessVision?: boolean;
  autoProcessBundles?: boolean;
  workerId?: string;
  useDurableFixtureTransport?: boolean;
}): Stage4B3AdmissionRuntime {
  const registry = input?.registry ?? getFallbackStage4B3MockMediaRegistry();
  return {
    transport: input?.useDurableFixtureTransport
      ? createStage4B3DurableMediaTransport()
      : createInMemoryStage4B3MediaTransport(registry),
    storage: getFallbackStage4B3MediaStorage(),
    visionProvider: createStage4B3MockVisionProvider({ manifest: input?.manifest }),
    autoProcessPending: input?.autoProcessPending ?? true,
    autoProcessVision: input?.autoProcessVision ?? true,
    autoProcessBundles: input?.autoProcessBundles ?? false,
    workerId: input?.workerId ?? "stage4b3-local-worker",
  };
}

export async function registerStage4B3FixtureMediaAsset(input: {
  sceneId: Stage4B3VisionFixtureSceneId;
  mediaId?: string;
  bytes?: Buffer;
}): Promise<{
  mediaId: string;
  bytes: Buffer;
  contentSha256: string;
  manifest: ReturnType<typeof createStage4B3VisionFixtureManifest>;
}> {
  const bytes = input.bytes ?? (await buildStage4B3FixtureJpeg(input.sceneId));
  const sanitized = await validateAndSanitizeImageBytes({ bytes, declaredMimeType: "image/jpeg" });
  if (!sanitized.ok) {
    throw new Error(`fixture_sanitize_failed:${sanitized.failureCode}`);
  }

  const mediaId = input.mediaId ?? `MOCK_MEDIA_${input.sceneId}`;
  registerStage4B3MockMediaAsset(getFallbackStage4B3MockMediaRegistry(), mediaId, bytes, "image/jpeg");
  let manifest = createStage4B3VisionFixtureManifest();
  manifest = registerStage4B3VisionFixtureHash(manifest, sanitized.artifacts.contentSha256, input.sceneId);
  return {
    mediaId,
    bytes,
    contentSha256: sanitized.artifacts.contentSha256,
    manifest,
  };
}

export function mapCanonicalIngressToWebhookResult(
  state: ManuAppState,
  result: ChannelEventIngressResult,
): WhatsAppMockWebhookResult {
  if (!result.ok) {
    if (result.code === "secure_ingress_gate_disabled") {
      return {
        status: "rejected",
        action: null,
        blockedReason: result.blockingReasons.join(","),
      };
    }
    return {
      status: "rejected",
      action: null,
      blockedReason: result.reason,
      normalizationCode: result.code,
    };
  }

  const duplicateMessage = result.outcomes.some((outcome) => outcome.event.eventKind === "duplicate_message");
  if (duplicateMessage) {
    return {
      status: "duplicate_ignored",
      action: null,
      blockedReason: "duplicate_message",
    };
  }

  const duplicateProviderEvent = result.outcomes.some((outcome) => {
    const latestAudit = [...state.auditEvents]
      .reverse()
      .find((event) => event.entityId === outcome.event.id);
    return (
      latestAudit?.eventType === "channel_event_duplicate" ||
      latestAudit?.eventType === "channel_event_duplicate_conflict"
    );
  });
  if (duplicateProviderEvent) {
    return {
      status: "duplicate_ignored",
      action: null,
      blockedReason: "duplicate_event",
    };
  }

  const quarantined = result.outcomes.find((outcome) => outcome.event.processingStatus === "quarantined");
  if (quarantined) {
    const audit = [...state.auditEvents]
      .reverse()
      .find((event) => event.eventType === "channel_event_quarantined" && event.entityId === quarantined.event.id);
    const reasonCode = Array.isArray(audit?.metadata?.reasons)
      ? audit.metadata.reasons[0]
      : Array.isArray(audit?.metadata?.reasonCodes)
        ? audit.metadata.reasonCodes[0]
        : undefined;
    const blockedReason =
      (typeof reasonCode === "string" && QUARANTINE_BLOCKED_REASON_MAP[reasonCode]) ||
      (typeof reasonCode === "string" ? reasonCode : "channel_event_quarantined");
    return {
      status: "blocked",
      action: null,
      blockedReason,
    };
  }

  if (state.lastSimulation) {
    return toWhatsAppMockWebhookResult(state.lastSimulation);
  }

  const imageCommitted = result.outcomes.some((outcome) => outcome.event.eventKind === "client_message_image");
  if (imageCommitted) {
    return {
      status: "processed",
      action: null,
      blockedReason: null,
    };
  }

  return {
    status: "processed",
    action: null,
    blockedReason: null,
  };
}

export function resolveCanonicalWebhookHttpStatus(result: WhatsAppMockWebhookResult) {
  if (result.status === "rejected") {
    return 422;
  }
  return 200;
}

export async function processCanonicalWhatsAppIngressInState(
  state: ManuAppState,
  payload: unknown,
  options: CanonicalIngressProcessOptions = {},
): Promise<{ state: ManuAppState; result: WhatsAppMockWebhookResult; ingress: ChannelEventIngressResult }> {
  const prepared =
    options.bootstrapDemoBindings === false ? state : ensureStage4B3DemoChannelIngressState(state);
  const admission = options.stage4b3Admission ?? createStage4B3LocalAdmissionRuntime();
  const extracted = extractWebhookPayloadAndSecret(payload);
  const providedSecret = options.providedSecret ?? extracted.providedSecret;

  const { state: nextState, result: ingress } = await processInboundWhatsAppChannelBatch(prepared, extracted.sanitizedPayload, {
    providedSecret,
    env: options.env ?? process.env,
    stage4b3Admission: admission,
    now: options.now,
  });

  return {
    state: nextState,
    result: mapCanonicalIngressToWebhookResult(nextState, ingress),
    ingress,
  };
}

export function isCanonicalMockWebhookGateEnabled(
  env: NodeJS.ProcessEnv = process.env,
  providedSecret?: string | null,
) {
  return resolveSecureChannelIngressGate(env, providedSecret ?? null).enabled;
}

export async function runStage4B3LocalWorkerTick(
  state: ManuAppState,
  input: {
    now?: string;
    env?: NodeJS.ProcessEnv;
    admission?: Stage4B3AdmissionRuntime;
    runOrchestration?: boolean;
    workerId?: string;
  } = {},
): Promise<ManuAppState> {
  const now = input.now ?? new Date().toISOString();
  const admission = input.admission ?? createStage4B3LocalAdmissionRuntime({ autoProcessBundles: false });
  let workingState = state;

  if (admission.transport && admission.storage) {
    workingState = await processStage4B3PendingMediaAssets(workingState, {
      transport: admission.transport,
      storage: admission.storage,
      now,
    });
  }

  if (admission.visionProvider) {
    workingState = await processStage4B3PendingVisionAnalysis(workingState, {
      env: input.env ?? process.env,
      provider: admission.visionProvider,
      now,
    });
  }

  const worker = await processStage4B3DueInboundBundles(workingState, {
    workerId: input.workerId ?? admission.workerId ?? "stage4b3-local-worker",
    now,
    runOrchestration: input.runOrchestration ?? true,
    finalizeClaims: true,
  });

  return worker.state;
}

export function normalizeClientWhatsAppIdentity(channelUserId: string): string {
  const compact = channelUserId.trim();
  if (compact.startsWith("+")) {
    return compact.slice(1);
  }
  return compact;
}

export function buildCanonicalWhatsAppTextPayload(input: {
  providerEventId: string;
  from: string;
  body: string;
  timestamp?: string;
  businessPhoneNumberId?: string;
}) {
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
              metadata: {
                phone_number_id: input.businessPhoneNumberId ?? STAGE_4B3_DEMO_BUSINESS_PHONE_NUMBER_ID,
              },
              messages: [
                {
                  from: normalizeClientWhatsAppIdentity(input.from),
                  id: input.providerEventId,
                  timestamp: input.timestamp ?? "1720000000",
                  type: "text",
                  text: { body: input.body },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

export function buildCanonicalWhatsAppImagePayload(input: {
  providerEventId: string;
  from: string;
  mediaId: string;
  sha256: string;
  caption?: string;
  timestamp?: string;
  businessPhoneNumberId?: string;
}) {
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
              metadata: {
                phone_number_id: input.businessPhoneNumberId ?? STAGE_4B3_DEMO_BUSINESS_PHONE_NUMBER_ID,
              },
              messages: [
                {
                  from: normalizeClientWhatsAppIdentity(input.from),
                  id: input.providerEventId,
                  timestamp: input.timestamp ?? "1720000000",
                  type: "image",
                  image: {
                    id: input.mediaId,
                    mime_type: "image/jpeg",
                    sha256: input.sha256,
                    caption: input.caption,
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

export function resolveWebhookStatusCode(
  ingress: ChannelEventIngressResult,
  webhookResult: WhatsAppMockWebhookResult,
): number {
  if (!ingress.ok && ingress.code === "secure_ingress_gate_disabled") {
    return 403;
  }
  return resolveCanonicalWebhookHttpStatus(webhookResult);
}

export { hashMediaBytes };
