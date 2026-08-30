import { AppRequestError } from "./app-errors";
import {
  buildGeminiSafetySettingsContract,
  evaluateProductionAiAdapterReadiness,
  type ProductionAiAdapterApprovalState,
  type ProductionAiAdapterReadinessInput,
  type ProductionAiPayloadSafetyInput,
} from "./production-ai-adapter-contracts";

export type ProductionAiAdapterRequest = {
  model: string;
  prompt: string;
  payloadSafety: ProductionAiPayloadSafetyInput;
  approvalState: ProductionAiAdapterApprovalState;
  boundary: ProductionAiAdapterReadinessInput["boundary"];
};

export type ProductionAiAdapterResponse = {
  provider: "gemini";
  model: string;
  text: string;
  safetySettings: ReturnType<typeof buildGeminiSafetySettingsContract>;
};

export async function generateWithRealGeminiTextAdapter(
  request: ProductionAiAdapterRequest,
): Promise<ProductionAiAdapterResponse> {
  const readiness = evaluateProductionAiAdapterReadiness({
    provider: "gemini",
    operation: "ai_text_generate",
    model: request.model,
    approvalState: request.approvalState,
    boundary: request.boundary,
    payloadSafety: request.payloadSafety,
  });

  if (!readiness.realProviderCallAllowed) {
    throw new AppRequestError(403, "real_ai_provider_blocked");
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppRequestError(503, "real_ai_provider_not_configured");
  }

  // The live HTTP call remains intentionally unimplemented until the production
  // GO decision supplies a current provider SDK/version and audited request logger.
  throw new AppRequestError(503, "real_ai_provider_transport_not_enabled");
}
