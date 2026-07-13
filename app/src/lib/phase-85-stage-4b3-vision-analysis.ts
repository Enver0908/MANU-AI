import type { MediaAssetRecord, VisualAnalysisRecord } from "./phase-85-stage-4b3-media-contracts";
import { evaluateStage4B3VisionProviderGate } from "./phase-85-stage-4b3-provider-gate";
import { validateProviderVisualObservation } from "./phase-85-stage-4b3-visual-observation-validator";
import type { Stage4B3VisionProviderPort } from "./phase-85-stage-4b3-vision-provider";
import type { ManuAppState } from "./types";

export const STAGE_4B3_VISION_ANALYSIS_VERSION = "p85-stage-4b3-vision-analysis-v1";
export const STAGE_4B3_VISION_IN_PROCESS_RETRIES = 2;
export const STAGE_4B3_VISION_MAX_DURABLE_RETRIES = 5;
export const STAGE_4B3_VISION_RETRY_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function updateMediaAsset(state: ManuAppState, assetId: string, patch: Partial<MediaAssetRecord>): ManuAppState {
  return {
    ...state,
    mediaAssets: state.mediaAssets.map((asset) =>
      asset.id === assetId && asset.tenantId === state.tenant.id ? { ...asset, ...patch } : asset,
    ),
  };
}

function resolveBundleIdForAsset(state: ManuAppState, assetId: string): string | null {
  const item = state.inboundMessageBundleItems.find(
    (entry) => entry.tenantId === state.tenant.id && entry.mediaAssetId === assetId,
  );
  return item?.bundleId ?? null;
}

function buildVisualAnalysisRecord(
  state: ManuAppState,
  asset: MediaAssetRecord,
  input: {
    now: string;
    bundleId: string | null;
    observation: VisualAnalysisRecord["observation"];
    status: VisualAnalysisRecord["status"];
    failureCode: string | null;
  },
): VisualAnalysisRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: state.tenant.id,
    clientId: asset.clientId,
    conversationId: asset.conversationId,
    mediaAssetId: asset.id,
    messageId: asset.messageId,
    bundleId: input.bundleId,
    analysisRevision: 1,
    status: input.status,
    observation: input.observation,
    supersededByAnalysisId: null,
    failureCode: input.failureCode,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

async function invokeProviderWithRetries(
  provider: Stage4B3VisionProviderPort,
  asset: MediaAssetRecord,
): Promise<{ observation: VisualAnalysisRecord["observation"]; failureCode: string | null }> {
  if (!asset.contentSha256) {
    return { observation: null, failureCode: "missing_content_sha256" };
  }

  let lastFailureCode: string | null = null;
  for (let attempt = 0; attempt <= STAGE_4B3_VISION_IN_PROCESS_RETRIES; attempt += 1) {
    const result = await provider.analyze({
      contentSha256: asset.contentSha256,
      detectedMimeType: "image/jpeg",
    });

    if (!result.ok) {
      lastFailureCode = result.failureCode;
      if (result.retryable && attempt < STAGE_4B3_VISION_IN_PROCESS_RETRIES) {
        await sleep(STAGE_4B3_VISION_RETRY_DELAY_MS);
        continue;
      }
      return { observation: null, failureCode: lastFailureCode ?? "provider_invalid_output" };
    }

    try {
      return { observation: validateProviderVisualObservation(result.observation), failureCode: null };
    } catch (error) {
      lastFailureCode = error instanceof Error ? error.message : "observation_validation_failed";
      return { observation: null, failureCode: lastFailureCode };
    }
  }

  return { observation: null, failureCode: lastFailureCode ?? "provider_timeout" };
}

export async function analyzeSingleSanitizedMediaAsset(
  state: ManuAppState,
  assetId: string,
  options: {
    env: NodeJS.ProcessEnv;
    provider: Stage4B3VisionProviderPort;
    now?: string;
  },
): Promise<ManuAppState> {
  const gate = evaluateStage4B3VisionProviderGate(options.env);
  if (!gate.mockVisionAllowed) {
    return state;
  }

  const asset = state.mediaAssets.find((entry) => entry.id === assetId && entry.tenantId === state.tenant.id);
  if (!asset || asset.status !== "sanitized") {
    return state;
  }

  const now = options.now ?? new Date().toISOString();
  const workingState = updateMediaAsset(state, assetId, {
    status: "analysis_pending",
    updatedAt: now,
  });

  const currentAsset = workingState.mediaAssets.find((entry) => entry.id === assetId)!;
  const analysisResult = await invokeProviderWithRetries(options.provider, currentAsset);
  const bundleId = resolveBundleIdForAsset(workingState, assetId);

  if (!analysisResult.observation) {
    const nextRetryCount = currentAsset.retryCount + 1;
    if (nextRetryCount > STAGE_4B3_VISION_MAX_DURABLE_RETRIES) {
      const failedAt = options.now ?? new Date().toISOString();
      const failedAnalysis = buildVisualAnalysisRecord(workingState, currentAsset, {
        now: failedAt,
        bundleId,
        observation: null,
        status: "failed",
        failureCode: analysisResult.failureCode ?? "retry_limit_exceeded",
      });
      return {
        ...updateMediaAsset(workingState, assetId, {
          status: "failed",
          retryCount: nextRetryCount,
          failureCode: analysisResult.failureCode ?? "retry_limit_exceeded",
          updatedAt: failedAt,
        }),
        visualAnalysisRecords: [...workingState.visualAnalysisRecords, failedAnalysis],
      };
    }

    const retryAt = new Date(new Date(now).getTime() + STAGE_4B3_VISION_RETRY_DELAY_MS).toISOString();
    return updateMediaAsset(workingState, assetId, {
      status: "sanitized",
      retryCount: nextRetryCount,
      nextAttemptAt: retryAt,
      failureCode: analysisResult.failureCode,
      updatedAt: now,
    });
  }

  const readyAt = options.now ?? new Date().toISOString();
  const readyAnalysis = buildVisualAnalysisRecord(workingState, currentAsset, {
    now: readyAt,
    bundleId,
    observation: analysisResult.observation,
    status: "ready",
    failureCode: null,
  });

  return {
    ...updateMediaAsset(workingState, assetId, {
      status: "analysis_ready",
      failureCode: null,
      nextAttemptAt: null,
      updatedAt: readyAt,
    }),
    visualAnalysisRecords: [...workingState.visualAnalysisRecords, readyAnalysis],
  };
}

export async function processStage4B3PendingVisionAnalysis(
  state: ManuAppState,
  options: {
    env: NodeJS.ProcessEnv;
    provider: Stage4B3VisionProviderPort;
    now?: string;
  },
): Promise<ManuAppState> {
  const gate = evaluateStage4B3VisionProviderGate(options.env);
  if (!gate.mockVisionAllowed) {
    return state;
  }

  const now = options.now ?? new Date().toISOString();
  const dueAssets = state.mediaAssets.filter((asset) => {
    if (asset.tenantId !== state.tenant.id || asset.status !== "sanitized") {
      return false;
    }
    if (!asset.nextAttemptAt) {
      return true;
    }
    return new Date(asset.nextAttemptAt).getTime() <= new Date(now).getTime();
  });

  let workingState = state;
  for (const asset of dueAssets) {
    workingState = await analyzeSingleSanitizedMediaAsset(workingState, asset.id, options);
  }

  return workingState;
}
