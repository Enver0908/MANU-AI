import { MISSING_HISTORICAL_CONTEXT_TOKEN } from "dietitian-ai-assistant-architecture";
import type { RiskLevel } from "./types";

export { MISSING_HISTORICAL_CONTEXT_TOKEN };

export const PROMPT_VERSION = "manu-prompt-v0.1.0";
export const MOCK_PROVIDER_ID = "mock-local-provider-v0";

export type ProviderStatus = "not_called" | "ok" | "failed";
export type ProviderErrorCode = "provider_timeout" | "provider_error" | "provider_policy_violation";
export const ALLOWED_PROVIDER_SEGMENT_TYPES = new Set([
  "system_instruction",
  "current_message",
  "diet_plan_summary",
  "allergies",
  "restricted_foods",
  "pinned_note",
  "dietitian_context_update",
  "client_form_summary",
  "rolling_summary",
  "recent_message",
  "persona",
  "voice_profile",
]);
const MAX_PROVIDER_SEGMENTS = 32;
const MAX_PROVIDER_SEGMENT_CHARS = 3000;

export class MockProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MockProviderError";
  }
}

export type MockProviderInput = {
  context: {
    segments: Array<{
      type: string;
      text: string;
      sourceId?: string | null;
      origin?: string | null;
      createdAt?: string | null;
      authority?: string | null;
    }>;
  };
  risk: RiskLevel;
};

export type MockProviderOptions = {
  failureMode?: ProviderErrorCode;
  maxRetries?: number;
  forceMissingHistoricalContext?: boolean;
};

export function buildMockProviderInput(
  context: MockProviderInput["context"],
  risk: RiskLevel,
): MockProviderInput {
  return {
    context: {
      segments: context.segments.map((segment) => ({
        type: segment.type,
        text: segment.text,
        ...(segment.sourceId !== undefined ? { sourceId: segment.sourceId } : {}),
        ...(segment.origin !== undefined ? { origin: segment.origin } : {}),
        ...(segment.createdAt !== undefined ? { createdAt: segment.createdAt } : {}),
        ...(segment.authority !== undefined ? { authority: segment.authority } : {}),
      })),
    },
    risk,
  };
}

export async function generateMockProviderReply(
  input: MockProviderInput,
  options: MockProviderOptions = {},
) {
  assertMockProviderInputPolicy(input);

  if (options.forceMissingHistoricalContext) {
    return MISSING_HISTORICAL_CONTEXT_TOKEN;
  }

  const maxRetries = options.maxRetries ?? 1;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await attemptMockGeneration(input, options.failureMode);
    } catch (error) {
      if (attempt >= maxRetries) {
        throw error;
      }
    }
  }

  throw new MockProviderError("provider_error", "Mock provider retry loop exhausted");
}

export function assertMockProviderInputPolicy(input: MockProviderInput) {
  assertAllowedKeys(input, ["context", "risk"], "top_level");

  if (!["green", "yellow"].includes(input.risk)) {
    throw new MockProviderError("provider_policy_violation", "Provider boundary allows only green or yellow risk");
  }

  assertAllowedKeys(input.context, ["segments"], "context");

  if (!Array.isArray(input.context.segments)) {
    throw new MockProviderError("provider_policy_violation", "Provider boundary requires context.segments array");
  }

  if (input.context.segments.length > MAX_PROVIDER_SEGMENTS) {
    throw new MockProviderError("provider_policy_violation", "Provider boundary rejected too many context segments");
  }

  for (const segment of input.context.segments) {
    assertAllowedKeys(segment, ["type", "text", "sourceId", "origin", "createdAt", "authority"], "context_segment");
    if (typeof segment.type !== "string" || typeof segment.text !== "string") {
      throw new MockProviderError("provider_policy_violation", "Provider boundary requires string context segments");
    }
    if (!ALLOWED_PROVIDER_SEGMENT_TYPES.has(segment.type)) {
      throw new MockProviderError("provider_policy_violation", `Provider boundary rejected segment type: ${segment.type}`);
    }
    if (segment.text.length > MAX_PROVIDER_SEGMENT_CHARS) {
      throw new MockProviderError("provider_policy_violation", `Provider boundary rejected overlong segment: ${segment.type}`);
    }
  }
}

export function getProviderErrorCode(error: unknown): ProviderErrorCode {
  if (error instanceof MockProviderError) {
    return error.code;
  }

  return "provider_error";
}

export function buildSafeProviderMetadata(input: {
  providerId?: string | null;
  promptVersion?: string | null;
  model?: string | null;
  status: ProviderStatus;
  errorCode?: ProviderErrorCode | null;
}) {
  return {
    providerId: input.providerId ?? MOCK_PROVIDER_ID,
    promptVersion: input.promptVersion ?? PROMPT_VERSION,
    model: input.model ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
  };
}

async function attemptMockGeneration(input: MockProviderInput, failureMode?: ProviderErrorCode) {
  if (failureMode) {
    throw new MockProviderError(failureMode, `Mock provider forced ${failureMode}`);
  }

  const dietPlanSummary = input.context.segments.find((segment) => segment.type === "diet_plan_summary")?.text || "";

  if (input.risk === "yellow") {
    return "Bunu diyetisyeninizin onayiyla netlestirelim; taslak olarak not aldim.";
  }

  return `Planina uygun olarak kucuk bir degisim yapabilirsin. ${dietPlanSummary || "Ana plana sadik kalalim."}`;
}

function assertAllowedKeys(value: unknown, allowedKeys: string[], label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MockProviderError("provider_policy_violation", `Provider boundary expected object for ${label}`);
  }

  const allowed = new Set(allowedKeys);
  const extraKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (extraKeys.length > 0) {
    throw new MockProviderError("provider_policy_violation", `Provider boundary rejected ${label} keys`);
  }
}
