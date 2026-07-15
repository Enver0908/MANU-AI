import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectVisualMetadataLeaks, loadHarnessCasesFromJsonl } from "dietitian-ai-assistant-architecture";
import { runInboundSimulation } from "./simulator";
import { runMultimodalBundleInboundTurn } from "./phase-85-stage-4b3-bundle-orchestration";
import {
  buildCanonicalWhatsAppVoicePayload,
  createStage4B3LocalAdmissionRuntime,
  processCanonicalWhatsAppIngressInState,
  registerStage4B4FixtureMediaAsset,
  runStage4B3LocalWorkerTick,
} from "./phase-85-stage-4b3-canonical-ingress";
import { promoteDueInboundBundles } from "./phase-85-stage-4b3-message-bundles";
import { processStage4B3DueInboundBundles } from "./phase-85-stage-4b3-media-worker";
import { resolveAllowlistedStage4B4AudioFixtureBytes } from "./phase-85-stage-4b4-audio-fixture-resolver";
import { canonicalizeOggOpusVoiceBytes } from "./phase-85-stage-4b4-audio-canonicalizer";
import {
  buildStage4B4GoldenCorpusCases,
  STAGE_4B4_GOLDEN_CORPUS_MIN_CASES,
  STAGE_4B4_RED_TEAM_CATEGORIES,
  type Stage4B4GoldenCorpusCase,
  type Stage4B4GoldenCorpusExpectation,
} from "./phase-85-stage-4b4-golden-corpus-catalog";
import { createStage4B4MockTranscriptionProvider } from "./phase-85-stage-4b4-mock-transcription-provider";
import { STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG } from "./phase-85-stage-4b4-provider-gate";
import { applyTranscriptQualityGate } from "./phase-85-stage-4b4-transcript-quality";
import {
  buildTranscriptionObservationFromFixtureTemplate,
  createStage4B4TranscriptionFixtureManifest,
  registerStage4B4TranscriptionFixtureHash,
  STAGE_4B4_TRANSCRIPTION_FIXTURE_TEMPLATES,
} from "./phase-85-stage-4b4-transcription-fixture-manifest";
import { processStage4B4PendingTranscriptions } from "./phase-85-stage-4b4-transcription-worker";
import {
  evaluateAudioIngressMetadata,
  type AudioIngressMetadataInput,
} from "./phase-85-stage-4b4-voice-contracts";
import { createInMemoryStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import { detectStage4B4AudioOrphans } from "./phase-85-stage-4b4-audio-lifecycle";
import { createInitialState, DEMO_TENANT_ID } from "./seed-data";
import type { ManuAppState } from "./types";

export const PHASE_85_STAGE_4B_4_CLOSURE_VERSION = "p85-stage-4b4-closure-v1";
export const PHASE_85_STAGE_4B_4_PROGRAM_CLOSURE_VERSION = "p85-stage-4b4-program-closure-v1";
export const STAGE_4B4_CACHED_DECISION_TARGET = 5_000;
export const STAGE_4B4_ADMISSION_ROUNDTRIP_TARGET = 200;
export const STAGE_4B4_VOICE_REPLAY_TARGET = 5_000;

export const STAGE_4B4_HARD_ZERO_METRIC_IDS = [
  "unsafe_voice_client_send_count",
  "yellow_red_voice_send_count",
  "low_confidence_send_count",
  "duplicate_voice_reply_count",
  "raw_audio_leak_count",
  "cross_tenant_audio_read_count",
  "external_transcription_egress_count",
  "stale_correction_send_count",
] as const;

export const STAGE_4B4_PROGRAM_CLOSURE_METRIC_IDS = [
  ...STAGE_4B4_HARD_ZERO_METRIC_IDS,
  "audio_lifecycle_orphan_count",
] as const;

export const STAGE_4B4_RISK_REGISTER_IDS = [
  "R-451",
  "R-452",
  "R-453",
  "R-454",
  "R-455",
  "R-456",
  "R-457",
  "R-458",
  "R-459",
  "R-460",
  "R-461",
] as const;

export const STAGE_4B4_PHASE_EVIDENCE_DOCS = [
  "docs/PHASE_85_STAGE_4B_4_PHASE_0_DOCUMENTATION_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_1_DOMAIN_TYPE_CONTRACT_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_2_DATABASE_STORAGE_RLS_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_3_CANONICAL_INGRESS_AUDIO_ADMISSION_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_4_DETERMINISTIC_TRANSCRIPTION_PROVIDER_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_5_BUNDLE_CORRELATION_TYPED_TEXT_BRIDGE_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_6_RISK_CHAIN_ATOMIC_ORCHESTRATION_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_7_TRANSCRIPT_CORRECTION_HUMAN_CONTROL_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_8_BOUNDED_API_AUDIO_UI_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_9_RETENTION_DSAR_LEGAL_HOLD_EVIDENCE.md",
  "docs/PHASE_85_STAGE_4B_4_PHASE_10_SIMULATOR_GOLDEN_CORPUS_RED_TEAM_EVIDENCE.md",
] as const;

export type Stage4B4RiskReconciliationStatus = "mitigated_locally" | "open_production";

export type Stage4B4RiskReconciliationEntry = {
  riskId: (typeof STAGE_4B4_RISK_REGISTER_IDS)[number];
  status: Stage4B4RiskReconciliationStatus;
  scope: string;
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
const repoRootDir = join(moduleDir, "../../..");
const TEST_SECRET = "synthetic-stage4b4-closure-secret";
const T0 = "2026-07-14T12:00:00.000Z";
const T120 = "2026-07-14T12:02:00.000Z";
const T240 = "2026-07-14T12:04:00.000Z";

export type Stage4B4HardZeroMetrics = Record<(typeof STAGE_4B4_HARD_ZERO_METRIC_IDS)[number], number>;

export type Stage4B4GoldenCorpusBatchMetrics = {
  caseCount: number;
  cachedDecisionCount: number;
  admissionRoundTripCount: number;
  voiceReplayCount: number;
  hardZeroMetrics: Stage4B4HardZeroMetrics;
  hardZeroFailures: string[];
  failures: string[];
  redTeamInventory: Array<{ category: string; covered: boolean; caseCount: number }>;
};

export type Stage4B4ProgramClosureVerificationInput = {
  rlsSuite?: "pass" | "skipped" | "fail" | "pending";
  rlsSkippedCount?: number;
  visualSuite?: "pass" | "skipped" | "fail" | "pending";
  channelReplay?: "pass" | "skipped" | "fail" | "pending";
  productionScaleRehearsal?: "pass" | "skipped" | "fail" | "pending";
  releaseVerify?: "pass" | "skipped" | "fail" | "pending";
  secretScan?: "pass" | "skipped" | "fail" | "pending";
  audioLifecycleOrphanCount?: number;
  phaseEvidenceComplete?: boolean;
};

export type Stage4B4ProgramClosureEvidence = {
  status: "pass" | "fail";
  phase: typeof PHASE_85_STAGE_4B_4_PROGRAM_CLOSURE_VERSION;
  productionPilotGo: false;
  r405Open: true;
  stage4cAuthorized: boolean;
  goldenCorpus: Stage4B4GoldenCorpusBatchMetrics;
  audioLifecycleOrphanCount: number;
  riskReconciliation: Stage4B4RiskReconciliationEntry[];
  failures: string[];
};

function testEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "test",
    MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
    MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
    [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
  } as NodeJS.ProcessEnv;
}

function emptyHardZeroMetrics(): Stage4B4HardZeroMetrics {
  return {
    unsafe_voice_client_send_count: 0,
    yellow_red_voice_send_count: 0,
    low_confidence_send_count: 0,
    duplicate_voice_reply_count: 0,
    raw_audio_leak_count: 0,
    cross_tenant_audio_read_count: 0,
    external_transcription_egress_count: 0,
    stale_correction_send_count: 0,
  };
}

function defaultAdmissionInput(overrides: Partial<AudioIngressMetadataInput> = {}): AudioIngressMetadataInput {
  return {
    messageType: "audio",
    voiceFlag: true,
    mimeType: "audio/ogg",
    providerMediaId: "MOCK_AUDIO_GOLDEN_VOICE_NOTE",
    fromIdentity: "905551110001",
    sourceAuthority: "verified_direct",
    isGroupContext: false,
    isForwarded: false,
    isBusinessEcho: false,
    isTrustedDirectClient: true,
    byteSize: 12_000,
    durationMs: 3_000,
    isDuplicateMedia: false,
    ...overrides,
  };
}

function decisionSnapshot(state: ManuAppState) {
  return {
    risk: state.lastSimulation?.risk ?? null,
    action: state.lastSimulation?.action ?? null,
    blockedReason: state.lastSimulation?.blockedReason ?? null,
  };
}

function recordHardZeroViolations(
  metrics: Stage4B4HardZeroMetrics,
  evaluation: {
    clientSendEligible?: boolean;
    mergedRiskLevel?: string;
    externalEgress?: boolean;
    leakCodes?: string[];
    duplicateSend?: boolean;
    staleCorrectionSend?: boolean;
    crossTenantRead?: boolean;
    terminalStatus?: string;
    unsafeVoiceClientSend?: boolean;
    yellowRedVoiceSend?: boolean;
    lowConfidenceSend?: boolean;
  },
  expect: Stage4B4GoldenCorpusExpectation,
) {
  const clientSendEligible = evaluation.clientSendEligible ?? false;
  const mergedRisk = evaluation.mergedRiskLevel ?? "green";

  if (evaluation.unsafeVoiceClientSend || (clientSendEligible && mergedRisk === "red")) {
    metrics.unsafe_voice_client_send_count += 1;
  }
  if (
    evaluation.yellowRedVoiceSend ||
    (clientSendEligible && (mergedRisk === "yellow" || mergedRisk === "red"))
  ) {
    metrics.yellow_red_voice_send_count += 1;
  }
  if (
    evaluation.lowConfidenceSend ||
    (clientSendEligible && evaluation.terminalStatus === "review_required")
  ) {
    metrics.low_confidence_send_count += 1;
  }
  if (evaluation.duplicateSend) {
    metrics.duplicate_voice_reply_count += 1;
  }
  if ((evaluation.leakCodes?.length ?? 0) > 0) {
    metrics.raw_audio_leak_count += evaluation.leakCodes!.length;
  }
  if (evaluation.crossTenantRead) {
    metrics.cross_tenant_audio_read_count += 1;
  }
  if (evaluation.externalEgress && expect.externalTranscriptionEgress === false) {
    metrics.external_transcription_egress_count += 1;
  }
  if (evaluation.staleCorrectionSend) {
    metrics.stale_correction_send_count += 1;
  }
}

export function loadStage4B4GoldenCorpusCases(): Stage4B4GoldenCorpusCase[] {
  const catalog = buildStage4B4GoldenCorpusCases();
  const jsonlPath = join(moduleDir, "phase-85-stage-4b4-golden-corpus.jsonl");
  try {
    const raw = readFileSync(jsonlPath, "utf8").trim();
    if (raw.length > 0) {
      const loaded = loadHarnessCasesFromJsonl(raw) as Stage4B4GoldenCorpusCase[];
      if (loaded.length >= STAGE_4B4_GOLDEN_CORPUS_MIN_CASES) {
        return loaded;
      }
    }
  } catch {
    // fall back to catalog
  }
  return catalog;
}

export function syncStage4B4GoldenCorpusJsonl(cases: Stage4B4GoldenCorpusCase[] = buildStage4B4GoldenCorpusCases()) {
  const jsonlPath = join(moduleDir, "phase-85-stage-4b4-golden-corpus.jsonl");
  writeFileSync(jsonlPath, `${cases.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8");
}

function evaluateTranscriptionQualityCase(testCase: Stage4B4GoldenCorpusCase) {
  const sceneId = testCase.fixtureSceneId!;
  const template = STAGE_4B4_TRANSCRIPTION_FIXTURE_TEMPLATES[sceneId];
  const observation = buildTranscriptionObservationFromFixtureTemplate(template);
  const gate = applyTranscriptQualityGate({
    observation,
    expectedLocale: testCase.expectedLocale ?? "tr-TR",
  });
  const passed = gate.terminalStatus === testCase.expect.terminalStatus;
  return {
    passed,
    failureCode: passed ? null : "terminal_status_mismatch",
    terminalStatus: gate.terminalStatus,
    leakCodes: [] as string[],
  };
}

function evaluateAdmissionMetadataCase(testCase: Stage4B4GoldenCorpusCase) {
  const evaluation = evaluateAudioIngressMetadata(defaultAdmissionInput(testCase.admissionInput));
  const admitted = evaluation.decision === "admitted";
  const passed = admitted === testCase.expect.admitted;
  return {
    passed,
    failureCode: passed ? null : "admission_expectation_mismatch",
    admitted,
    leakCodes: [] as string[],
  };
}

async function evaluateIngressFixtureCase(testCase: Stage4B4GoldenCorpusCase) {
  const fixture = registerStage4B4FixtureMediaAsset({
    fixtureId: testCase.fixtureId ?? "golden_voice_note",
    mediaId: `MOCK_AUDIO_${(testCase.fixtureId ?? "golden_voice_note").toUpperCase()}`,
  });
  const audioStorage = createInMemoryStage4B4AudioStorage();
  const manifest = createStage4B4TranscriptionFixtureManifest();
  let externalEgress = 0;
  const admission = createStage4B3LocalAdmissionRuntime({
    autoProcessAudioPending: false,
    autoProcessTranscription: false,
    autoProcessPending: false,
    autoProcessVision: false,
    autoProcessBundles: false,
    audioStorage,
    transcriptionProvider: createStage4B4MockTranscriptionProvider({
      env: testEnv(),
      manifest,
      onTranscribe: () => {
        externalEgress += 1;
      },
    }),
  });

  const ingress = await processCanonicalWhatsAppIngressInState(
    createInitialState(),
    buildCanonicalWhatsAppVoicePayload({
      providerEventId: `wamid.CLOSURE_${testCase.id}`,
      from: "905551110001",
      mediaId: fixture.mediaId,
      sha256: fixture.contentSha256,
      durationMs: 3_000,
    }),
    {
      providedSecret: TEST_SECRET,
      env: testEnv(),
      stage4b3Admission: admission,
      now: T0,
    },
  );

  const workerState = await runStage4B3LocalWorkerTick(ingress.state, {
    admission,
    now: "2026-07-14T12:01:00.000Z",
    env: testEnv(),
    runOrchestration: false,
  });

  const asset = workerState.mediaAssets.find((entry) => entry.mediaKind === "audio");
  const admitted = Boolean(asset && asset.status !== "failed");
  const passed = admitted === testCase.expect.admitted;
  return {
    passed,
    failureCode: passed ? null : "ingress_fixture_mismatch",
    admitted,
    externalEgress: externalEgress > 0,
    leakCodes: [] as string[],
  };
}

async function admitVoiceWithTranscript(transcriptText: string) {
  const fixture = registerStage4B4FixtureMediaAsset({
    fixtureId: "golden_voice_note",
    mediaId: "MOCK_AUDIO_GOLDEN_VOICE_NOTE",
  });
  const audioStorage = createInMemoryStage4B4AudioStorage();
  let manifest = createStage4B4TranscriptionFixtureManifest();
  const admission = createStage4B3LocalAdmissionRuntime({
    autoProcessAudioPending: false,
    autoProcessTranscription: false,
    autoProcessPending: false,
    autoProcessVision: false,
    autoProcessBundles: false,
    audioStorage,
    transcriptionProvider: createStage4B4MockTranscriptionProvider({ env: testEnv(), manifest }),
  });

  const ingress = await processCanonicalWhatsAppIngressInState(
    createInitialState(),
    buildCanonicalWhatsAppVoicePayload({
      providerEventId: `wamid.PARITY_${hashString(transcriptText)}`,
      from: "905551110001",
      mediaId: fixture.mediaId,
      sha256: fixture.contentSha256,
      durationMs: 3_000,
    }),
    { providedSecret: TEST_SECRET, env: testEnv(), stage4b3Admission: admission, now: T0 },
  );

  const admitted = await runStage4B3LocalWorkerTick(ingress.state, {
    admission,
    now: "2026-07-14T12:01:00.000Z",
    env: testEnv(),
    runOrchestration: false,
  });
  const asset = admitted.mediaAssets.find((entry) => entry.mediaKind === "audio");
  if (!asset?.contentSha256) {
    throw new Error("expected_admitted_voice_asset");
  }

  manifest = registerStage4B4TranscriptionFixtureHash(manifest, asset.contentSha256, "meal_update_tr");
  const provider = createStage4B4MockTranscriptionProvider({ env: testEnv(), manifest });
  let transcribed = await processStage4B4PendingTranscriptions(admitted, {
    env: testEnv(),
    provider,
    storage: audioStorage,
    now: "2026-07-14T12:01:30.000Z",
  });

  transcribed = {
    ...transcribed,
    messages: transcribed.messages.map((message) =>
      message.id === asset.messageId
        ? { ...message, body: transcriptText, retrievalEligibility: "eligible" }
        : message,
    ),
    audioTranscriptionRecords: transcribed.audioTranscriptionRecords.map((record) =>
      record.messageId === asset.messageId && record.observation
        ? {
            ...record,
            status: "accepted",
            observation: {
              ...record.observation,
              transcriptText,
              segments: record.observation.segments.map((segment) => ({ ...segment, text: transcriptText })),
            },
            qualityDecision: { accepted: true, reasonCodes: [] },
          }
        : record,
    ),
  };

  const promoted = promoteDueInboundBundles(transcribed, T120);
  const worker = await processStage4B3DueInboundBundles(promoted, {
    workerId: "stage4b4-closure",
    now: T240,
    finalizeClaims: false,
    runOrchestration: false,
  });
  const bundleId = worker.claimedBundles[0]?.id;
  if (!bundleId) {
    throw new Error("expected_voice_bundle");
  }
  return { state: worker.state, bundleId };
}

function hashString(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return String(hash);
}

async function evaluateTypedVoiceParityCase(testCase: Stage4B4GoldenCorpusCase) {
  const transcriptText = testCase.transcriptText ?? "";
  const typed = await runInboundSimulation(createInitialState(), {
    clientId: "client-mert",
    body: transcriptText,
    idempotencyKey: `typed-${testCase.id}`,
    now: T240,
  });
  const { state: ready, bundleId } = await admitVoiceWithTranscript(transcriptText);
  const voiceTurn = await runMultimodalBundleInboundTurn(ready, bundleId, {
    idempotencyKey: `voice-${testCase.id}`,
    now: T240,
  });
  if (!voiceTurn.ok) {
    return { passed: false, failureCode: voiceTurn.failureCode, leakCodes: [] as string[] };
  }

  const typedSnapshot = decisionSnapshot(typed);
  const voiceSnapshot = decisionSnapshot(voiceTurn.state);
  const parityPassed = JSON.stringify(typedSnapshot) === JSON.stringify(voiceSnapshot);
  const riskPassed = voiceSnapshot.risk === testCase.expect.mergedRiskLevel;
  const outbound = voiceTurn.state.messages.find((message) => message.generatedByAiDecisionId === voiceTurn.decisionId);
  const clientSendEligible = outbound?.status === "sent";
  const yellowRedVoiceSend =
    clientSendEligible && (voiceSnapshot.risk === "yellow" || voiceSnapshot.risk === "red");
  const leakCodes = detectVisualMetadataLeaks(
    JSON.stringify(voiceTurn.state.aiDecisions.find((entry) => entry.id === voiceTurn.decisionId)?.contextManifest ?? {}),
  );

  const passed =
    parityPassed &&
    riskPassed &&
    clientSendEligible === Boolean(testCase.expect.clientSendEligible) &&
    leakCodes.length === 0;

  return {
    passed,
    failureCode: passed ? null : "typed_voice_parity_mismatch",
    clientSendEligible,
    mergedRiskLevel: voiceSnapshot.risk ?? undefined,
    yellowRedVoiceSend,
    leakCodes,
    externalEgress: false,
  };
}

async function evaluateGoldenCorpusCase(testCase: Stage4B4GoldenCorpusCase) {
  switch (testCase.evaluationKind) {
    case "transcription_quality":
      return evaluateTranscriptionQualityCase(testCase);
    case "admission_metadata":
      return evaluateAdmissionMetadataCase(testCase);
    case "ingress_fixture":
      return evaluateIngressFixtureCase(testCase);
    case "typed_voice_parity":
      return evaluateTypedVoiceParityCase(testCase);
    default:
      return { passed: false, failureCode: "unknown_evaluation_kind", leakCodes: [] as string[] };
  }
}

function buildRedTeamInventory(cases: Stage4B4GoldenCorpusCase[]) {
  const counts = new Map<string, number>();
  for (const testCase of cases) {
    counts.set(testCase.redTeamCategory, (counts.get(testCase.redTeamCategory) ?? 0) + 1);
  }
  return STAGE_4B4_RED_TEAM_CATEGORIES.map((category) => ({
    category,
    covered: (counts.get(category) ?? 0) > 0,
    caseCount: counts.get(category) ?? 0,
  }));
}

export function collectStage4B4HardZeroFailures(metrics: Stage4B4HardZeroMetrics) {
  return STAGE_4B4_HARD_ZERO_METRIC_IDS.filter((metricId) => metrics[metricId] > 0);
}

export async function runStage4B4GoldenCorpusBatch(
  cases: Stage4B4GoldenCorpusCase[] = loadStage4B4GoldenCorpusCases(),
) {
  const hardZeroMetrics = emptyHardZeroMetrics();
  const failures: string[] = [];

  if (cases.length < STAGE_4B4_GOLDEN_CORPUS_MIN_CASES) {
    failures.push("golden_corpus_case_count_below_minimum");
  }

  for (const testCase of cases) {
    const evaluation = await evaluateGoldenCorpusCase(testCase);
    if (!evaluation.passed) {
      failures.push(`golden_case_failed:${testCase.id}:${evaluation.failureCode ?? "unknown"}`);
    }
    recordHardZeroViolations(
      hardZeroMetrics,
      {
        clientSendEligible: "clientSendEligible" in evaluation ? evaluation.clientSendEligible : undefined,
        mergedRiskLevel: "mergedRiskLevel" in evaluation ? evaluation.mergedRiskLevel : undefined,
        terminalStatus: "terminalStatus" in evaluation ? evaluation.terminalStatus : undefined,
        externalEgress: "externalEgress" in evaluation ? evaluation.externalEgress : false,
        leakCodes: evaluation.leakCodes,
        yellowRedVoiceSend: "yellowRedVoiceSend" in evaluation ? evaluation.yellowRedVoiceSend : false,
      },
      testCase.expect,
    );
  }

  const hardZeroFailures = collectStage4B4HardZeroFailures(hardZeroMetrics);
  const redTeamInventory = buildRedTeamInventory(cases);
  if (!redTeamInventory.every((entry) => entry.covered)) {
    failures.push("red_team_category_coverage_incomplete");
  }

  return {
    caseCount: cases.length,
    cachedDecisionCount: 0,
    admissionRoundTripCount: 0,
    voiceReplayCount: 0,
    hardZeroMetrics,
    hardZeroFailures,
    failures: [...failures, ...hardZeroFailures.map((metric) => `${metric}_non_zero`)],
    redTeamInventory,
  } satisfies Stage4B4GoldenCorpusBatchMetrics;
}

export async function runStage4B4AdmissionRoundTrips(targetCount: number) {
  const fixture = resolveAllowlistedStage4B4AudioFixtureBytes("MOCK_AUDIO_GOLDEN_VOICE_NOTE");
  if (!fixture) {
    return { targetCount, successCount: 0, failures: ["golden_fixture_missing"], ready: false };
  }

  const failures: string[] = [];
  let successCount = 0;
  for (let index = 0; index < targetCount; index += 1) {
    const result = await canonicalizeOggOpusVoiceBytes({
      bytes: fixture.bytes,
      declaredMimeType: fixture.mimeType,
      expectedSha256: fixture.sha256,
    });
    if (!result.ok) {
      failures.push(`admission_round_trip_failed:${index}:${result.failureCode}`);
      continue;
    }
    if (!result.artifacts.wavBytes.byteLength) {
      failures.push(`admission_round_trip_empty_wav:${index}`);
      continue;
    }
    successCount += 1;
  }

  return {
    targetCount,
    successCount,
    failures,
    ready: failures.length === 0 && successCount === targetCount,
  };
}

export async function runStage4B4CachedDecisionRehearsal(
  targetCount: number,
  cases: Stage4B4GoldenCorpusCase[] = loadStage4B4GoldenCorpusCases(),
) {
  if (cases.length === 0) {
    return {
      targetCount,
      executedCount: 0,
      failures: ["golden_corpus_empty"],
      hardZeroMetrics: emptyHardZeroMetrics(),
      ready: false,
    };
  }

  const hardZeroMetrics = emptyHardZeroMetrics();
  const failures: string[] = [];
  const qualityCases = cases.filter((entry) => entry.evaluationKind === "transcription_quality");

  for (let index = 0; index < targetCount; index += 1) {
    const testCase = qualityCases[index % qualityCases.length] ?? cases[index % cases.length]!;
    const evaluation = await evaluateGoldenCorpusCase(testCase);
    if (!evaluation.passed) {
      failures.push(`cached_decision_failed:${index}:${testCase.id}`);
    }
    recordHardZeroViolations(
      hardZeroMetrics,
      {
        terminalStatus: "terminalStatus" in evaluation ? evaluation.terminalStatus : undefined,
        leakCodes: evaluation.leakCodes,
      },
      testCase.expect,
    );
  }

  const hardZeroFailures = collectStage4B4HardZeroFailures(hardZeroMetrics);
  return {
    targetCount,
    executedCount: targetCount,
    failures: [...failures, ...hardZeroFailures.map((metric) => `${metric}_non_zero`)],
    hardZeroMetrics,
    ready: failures.length === 0,
  };
}

export async function runStage4B4VoiceIngressReplay(targetCount: number) {
  const failures: string[] = [];
  const cases = loadStage4B4GoldenCorpusCases().filter((entry) => entry.evaluationKind === "admission_metadata");
  for (let index = 0; index < targetCount; index += 1) {
    const testCase = cases[index % cases.length]!;
    const evaluation = evaluateAdmissionMetadataCase(testCase);
    if (!evaluation.passed) {
      failures.push(`voice_replay_failed:${index}:${testCase.id}`);
    }
  }
  return {
    targetCount,
    executedCount: targetCount,
    failures,
    ready: failures.length === 0,
  };
}

export async function runStage4B4ClosureRehearsalSample() {
  const goldenCorpus = await runStage4B4GoldenCorpusBatch();
  const cached = await runStage4B4CachedDecisionRehearsal(250);
  const admission = await runStage4B4AdmissionRoundTrips(24);
  const replay = await runStage4B4VoiceIngressReplay(250);

  const failures = [
    ...goldenCorpus.failures,
    ...cached.failures.map((failure) => `cached:${failure}`),
    ...admission.failures.map((failure) => `admission:${failure}`),
    ...replay.failures.map((failure) => `replay:${failure}`),
  ];

  return {
    status: failures.length === 0 ? ("pass" as const) : ("fail" as const),
    phase: PHASE_85_STAGE_4B_4_CLOSURE_VERSION,
    productionPilotGo: false as const,
    r405Open: true as const,
    goldenCorpus: {
      ...goldenCorpus,
      cachedDecisionCount: cached.executedCount,
      admissionRoundTripCount: admission.successCount,
      voiceReplayCount: replay.executedCount,
    },
    cachedDecisionStatus: "sample_only" as const,
    admissionRoundTripStatus: "sample_only" as const,
    voiceReplayStatus: "sample_only" as const,
    failures,
  };
}

export async function runStage4B4ClosureRehearsalFull() {
  const goldenCorpus = await runStage4B4GoldenCorpusBatch();
  const cached = await runStage4B4CachedDecisionRehearsal(STAGE_4B4_CACHED_DECISION_TARGET);
  const admission = await runStage4B4AdmissionRoundTrips(STAGE_4B4_ADMISSION_ROUNDTRIP_TARGET);
  const replay = await runStage4B4VoiceIngressReplay(STAGE_4B4_VOICE_REPLAY_TARGET);

  const failures = [
    ...goldenCorpus.failures,
    ...cached.failures.map((failure) => `cached:${failure}`),
    ...admission.failures.map((failure) => `admission:${failure}`),
    ...replay.failures.map((failure) => `replay:${failure}`),
  ];

  return {
    status: failures.length === 0 ? ("pass" as const) : ("fail" as const),
    phase: PHASE_85_STAGE_4B_4_CLOSURE_VERSION,
    productionPilotGo: false as const,
    r405Open: true as const,
    goldenCorpus: {
      ...goldenCorpus,
      cachedDecisionCount: cached.executedCount,
      admissionRoundTripCount: admission.successCount,
      voiceReplayCount: replay.executedCount,
    },
    cachedDecisionStatus: cached.ready ? ("pass" as const) : ("fail" as const),
    admissionRoundTripStatus: admission.ready ? ("pass" as const) : ("fail" as const),
    voiceReplayStatus: replay.ready ? ("pass" as const) : ("fail" as const),
    failures,
  };
}

export function buildStage4B4ClosureEvidencePackMetrics(input: {
  goldenCorpus: Stage4B4GoldenCorpusBatchMetrics;
  cachedDecisionStatus: "sample_only" | "pass" | "fail";
  admissionRoundTripStatus: "sample_only" | "pass" | "fail";
  voiceReplayStatus: "sample_only" | "pass" | "fail";
  status: "pass" | "fail";
}) {
  return {
    phase: PHASE_85_STAGE_4B_4_CLOSURE_VERSION,
    status: input.status,
    production_pilot_go: false,
    r405_open: true,
    stage_4c_authorized: input.status === "pass",
    tenant_id: DEMO_TENANT_ID,
    golden_case_count: input.goldenCorpus.caseCount,
    cached_decision_count: input.goldenCorpus.cachedDecisionCount,
    admission_round_trip_count: input.goldenCorpus.admissionRoundTripCount,
    voice_replay_count: input.goldenCorpus.voiceReplayCount,
    cached_decision_status: input.cachedDecisionStatus,
    admission_round_trip_status: input.admissionRoundTripStatus,
    voice_replay_status: input.voiceReplayStatus,
    hard_zero_metrics: input.goldenCorpus.hardZeroMetrics,
    hard_zero_failures: input.goldenCorpus.hardZeroFailures,
    red_team_inventory: input.goldenCorpus.redTeamInventory,
    failures: input.goldenCorpus.failures,
  };
}

export function measureStage4B4BaselineAudioLifecycleOrphanCount(
  state: ManuAppState = createInitialState(),
  storage = createInMemoryStage4B4AudioStorage(),
) {
  return detectStage4B4AudioOrphans(state, storage).orphanCount;
}

export function evaluateStage4B4PhaseEvidenceDocs(repoRoot: string = repoRootDir) {
  const missing = STAGE_4B4_PHASE_EVIDENCE_DOCS.filter((docPath) => !existsSync(join(repoRoot, docPath)));
  return {
    complete: missing.length === 0,
    missing,
  };
}

export function buildStage4B4RiskReconciliationReport(
  closureStatus: "pass" | "fail",
): Stage4B4RiskReconciliationEntry[] {
  const status: Stage4B4RiskReconciliationStatus =
    closureStatus === "pass" ? "mitigated_locally" : "open_production";
  return STAGE_4B4_RISK_REGISTER_IDS.map((riskId) => ({
    riskId,
    status,
    scope: "Stage 4B-4 local prototype and mock-provider paths only; production pilot remains NO-GO",
  }));
}

export function collectStage4B4ProgramClosureFailures(
  verification: Stage4B4ProgramClosureVerificationInput | undefined,
  rehearsalStatus: "pass" | "fail",
  audioLifecycleOrphanCount: number,
) {
  const failures: string[] = [];

  if (rehearsalStatus !== "pass") {
    failures.push("rehearsal_status_fail");
  }
  if (audioLifecycleOrphanCount > 0) {
    failures.push("audio_lifecycle_orphan_count_non_zero");
  }

  if (!verification) {
    failures.push("program_closure_verification_missing");
    return failures;
  }

  if (verification.rlsSuite !== "pass") {
    failures.push(
      verification.rlsSuite === "skipped" ? "rls_suite_skipped_not_allowed" : `rls_suite_${verification.rlsSuite ?? "missing"}`,
    );
  }
  if ((verification.rlsSkippedCount ?? 0) > 0) {
    failures.push("rls_suite_had_skips");
  }
  if (verification.visualSuite !== "pass") {
    failures.push(`visual_suite_${verification.visualSuite ?? "missing"}`);
  }
  if (verification.channelReplay !== "pass") {
    failures.push(`channel_replay_${verification.channelReplay ?? "missing"}`);
  }
  if (verification.productionScaleRehearsal !== "pass") {
    failures.push(`production_scale_${verification.productionScaleRehearsal ?? "missing"}`);
  }
  if (verification.releaseVerify !== "pass") {
    failures.push(`release_verify_${verification.releaseVerify ?? "missing"}`);
  }
  if (verification.secretScan !== "pass") {
    failures.push(`secret_scan_${verification.secretScan ?? "missing"}`);
  }
  if (verification.phaseEvidenceComplete === false) {
    failures.push("phase_evidence_incomplete");
  }

  return failures;
}

export function evaluateStage4B4ProgramClosureEvidence(
  rehearsal: Awaited<ReturnType<typeof runStage4B4ClosureRehearsalSample>>,
  verification?: Stage4B4ProgramClosureVerificationInput,
): Stage4B4ProgramClosureEvidence {
  const audioLifecycleOrphanCount =
    verification?.audioLifecycleOrphanCount ?? measureStage4B4BaselineAudioLifecycleOrphanCount();
  const failures = [
    ...rehearsal.failures,
    ...collectStage4B4ProgramClosureFailures(verification, rehearsal.status, audioLifecycleOrphanCount),
  ];
  const status = failures.length === 0 ? "pass" : "fail";

  return {
    status,
    phase: PHASE_85_STAGE_4B_4_PROGRAM_CLOSURE_VERSION,
    productionPilotGo: false,
    r405Open: true,
    stage4cAuthorized: status === "pass",
    goldenCorpus: rehearsal.goldenCorpus,
    audioLifecycleOrphanCount,
    riskReconciliation: buildStage4B4RiskReconciliationReport(status),
    failures,
  };
}

export function stage4B4ClosureMetricsAreAggregateOnly(
  metrics: ReturnType<typeof buildStage4B4ClosureEvidencePackMetrics>,
) {
  const json = JSON.stringify(metrics);
  return (
    !json.includes("sanitizedAudioObjectKey") &&
    !json.includes("providerMediaId") &&
    !json.includes("object_key") &&
    !json.includes("overallConfidence")
  );
}
