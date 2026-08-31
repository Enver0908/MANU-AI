import { AppRequestError } from "./app-errors";
import {
  PRODUCTION_AI_GLM_5_3_FLASH_MODEL,
  PRODUCTION_AI_ZAI_BASE_URL,
  PRODUCTION_AI_ZAI_CHAT_COMPLETIONS_PATH,
  PRODUCTION_AI_ZAI_REQUEST_PARAMETERS,
  buildZaiGlmFlashRequestContract,
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
  provider: "zai";
  model: string;
  text: string;
  requestContract: ReturnType<typeof buildZaiGlmFlashRequestContract>;
};

export async function generateWithRealZaiGlmFlashTextAdapter(
  request: ProductionAiAdapterRequest,
): Promise<ProductionAiAdapterResponse> {
  const readiness = evaluateProductionAiAdapterReadiness({
    provider: "zai",
    operation: "ai_text_generate",
    model: request.model,
    approvalState: request.approvalState,
    boundary: request.boundary,
    payloadSafety: request.payloadSafety,
  });

  if (!readiness.realProviderCallAllowed) {
    throw new AppRequestError(403, "real_ai_provider_blocked");
  }

  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    throw new AppRequestError(503, "real_ai_provider_not_configured");
  }

  const model = request.model || PRODUCTION_AI_GLM_5_3_FLASH_MODEL;
  const response = await fetch(`${PRODUCTION_AI_ZAI_BASE_URL}${PRODUCTION_AI_ZAI_CHAT_COMPLETIONS_PATH}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: request.prompt }],
      ...PRODUCTION_AI_ZAI_REQUEST_PARAMETERS,
    }),
  });

  if (response.status === 429) {
    throw new AppRequestError(429, "real_ai_provider_rate_limited");
  }
  if (!response.ok) {
    throw new AppRequestError(response.status >= 500 ? 503 : 502, "real_ai_provider_failed");
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content;
  if (!text?.trim()) {
    throw new AppRequestError(502, "real_ai_provider_invalid_output");
  }

  return {
    provider: "zai",
    model,
    text,
    requestContract: buildZaiGlmFlashRequestContract(),
  };
}
