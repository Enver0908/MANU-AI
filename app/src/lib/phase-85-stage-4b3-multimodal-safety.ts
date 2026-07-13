import { evaluateMultimodalVisualSafetyChainV1 } from "dietitian-ai-assistant-architecture";
import {
  resolveMultimodalBundleUnderstanding,
  type Stage4B3MultimodalUnderstandingResult,
} from "./phase-85-stage-4b3-multimodal-understanding";
import type { MultimodalMessageEnvelope } from "./phase-85-stage-4b3-media-contracts";
import type { ManuAppState, RiskLevel } from "./types";

export const STAGE_4B3_MULTIMODAL_SAFETY_VERSION = "p85-stage-4b3-multimodal-safety-v1";

export type Stage4B3MultimodalSafetyChain = ReturnType<typeof evaluateMultimodalVisualSafetyChainV1>;

export type Stage4B3MultimodalSafetyResult =
  | {
      ok: true;
      understanding: Extract<Stage4B3MultimodalUnderstandingResult, { ok: true }>;
      safety: Stage4B3MultimodalSafetyChain;
    }
  | { ok: false; failureCode: string; understanding?: Stage4B3MultimodalUnderstandingResult };

export function buildMultimodalSafetyChainInput(input: {
  understanding: Extract<Stage4B3MultimodalUnderstandingResult, { ok: true }>;
  baseRiskDecision?: { level: RiskLevel; reasons?: string[] };
  textMessage?: string;
  clientAiMode?: string;
}) {
  return {
    meaning: input.understanding.meaning,
    envelope: input.understanding.envelope as MultimodalMessageEnvelope,
    baseRiskDecision: input.baseRiskDecision || { level: "green" as const, reasons: [] },
    textMessage: input.textMessage,
    clientAiMode: input.clientAiMode || "autopilot",
  };
}

export function evaluateMultimodalBundleSafetyChain(
  input: Parameters<typeof buildMultimodalSafetyChainInput>[0],
): Stage4B3MultimodalSafetyChain {
  return evaluateMultimodalVisualSafetyChainV1(buildMultimodalSafetyChainInput(input));
}

export function resolveMultimodalBundleSafety(
  state: ManuAppState,
  bundleId: string,
  input?: {
    baseRiskDecision?: { level: RiskLevel; reasons?: string[] };
    textMessage?: string;
    clientAiMode?: string;
  },
): Stage4B3MultimodalSafetyResult {
  const understanding = resolveMultimodalBundleUnderstanding(state, bundleId);
  if (!understanding.ok) {
    return { ok: false, failureCode: understanding.failureCode, understanding };
  }

  const safety = evaluateMultimodalBundleSafetyChain({
    understanding,
    baseRiskDecision: input?.baseRiskDecision,
    textMessage: input?.textMessage,
    clientAiMode: input?.clientAiMode,
  });

  return { ok: true, understanding, safety };
}
