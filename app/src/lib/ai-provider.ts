import type { ClientRecord, RiskLevel } from "./types";

export const PROMPT_VERSION = "manu-prompt-v0.1.0";
export const MOCK_PROVIDER_ID = "mock-local-provider-v0";

export type ProviderStatus = "not_called" | "ok" | "failed";
export type ProviderErrorCode = "provider_timeout" | "provider_error";

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

export async function generateMockProviderReply(
  input: MockProviderInput,
  options: MockProviderOptions = {},
) {
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
