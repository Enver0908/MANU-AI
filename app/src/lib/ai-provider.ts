import type { ClientRecord, RiskLevel } from "./types";

export const PROMPT_VERSION = "manu-prompt-v0.1.0";
export const MOCK_PROVIDER_ID = "mock-local-provider-v0";

export type ProviderStatus = "not_called" | "ok" | "failed";
export type ProviderErrorCode = "provider_timeout" | "provider_error" | "provider_policy_violation";

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
  client: Pick<ClientRecord, "dietPlan">;
  risk: RiskLevel;
};

export type MockProviderOptions = {
  failureMode?: ProviderErrorCode;
  maxRetries?: number;
};

export function buildMockProviderInput(client: Pick<ClientRecord, "dietPlan">, risk: RiskLevel): MockProviderInput {
  return {
    client: {
      dietPlan: {
        summary: client.dietPlan.summary,
      },
    },
    risk,
  };
}

export async function generateMockProviderReply(
  input: MockProviderInput,
  options: MockProviderOptions = {},
) {
  assertMockProviderInputPolicy(input);

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
  assertAllowedKeys(input, ["client", "risk"], "top_level");

  if (!["green", "yellow"].includes(input.risk)) {
    throw new MockProviderError("provider_policy_violation", "Provider boundary allows only green or yellow risk");
  }

  assertAllowedKeys(input.client, ["dietPlan"], "client");
  assertAllowedKeys(input.client.dietPlan, ["summary"], "diet_plan");

  if (typeof input.client.dietPlan.summary !== "string") {
    throw new MockProviderError("provider_policy_violation", "Provider boundary requires dietPlan.summary string");
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

  if (input.risk === "yellow") {
    return "Bunu diyetisyeninizin onayiyla netlestirelim; taslak olarak not aldim.";
  }

  return `Planina uygun olarak kucuk bir degisim yapabilirsin. ${input.client.dietPlan.summary || "Ana plana sadik kalalim."}`;
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
