import type { AiChatAnswerability, AiChatRiskLevel } from "./phase-85-stage-4c-contracts";

export const AI_CHAT_FIXTURE_PATTERN = /^__fixture:([a-z0-9_-]+)__$/i;

export type AiChatProviderDelta = {
  text: string;
  sequence: number;
};

export type AiChatProviderResult = {
  directAnswer: string | null;
  answerability: AiChatAnswerability;
  riskLevel: AiChatRiskLevel;
  completionState: "complete" | "incomplete";
  deltas: AiChatProviderDelta[];
};

export type AiChatProviderContextEnvelope = {
  intent: string;
  evidenceText: string;
  sourceRefCount: number;
  partialEvidence: boolean;
  insufficientEvidence: boolean;
  conflictingEvidence: boolean;
  serializedCharCount: number;
};

export type AiChatGenerationRequest = {
  triggerBody: string;
  messages: Array<{ role: "user" | "assistant"; body: string }>;
  contextEnvelope?: AiChatProviderContextEnvelope | null;
  signal?: AbortSignal;
};

export interface AiChatGenerationProvider {
  readonly name: string;
  generate(request: AiChatGenerationRequest): Promise<AiChatProviderResult>;
}

const FIXTURE_RESPONSES: Record<
  string,
  { answerability: AiChatAnswerability; riskLevel: AiChatRiskLevel; text: string; chunks?: string[] }
> = {
  hello: {
    answerability: "answerable",
    riskLevel: "green",
    text: "Deterministic greeting response for dietitian-facing AI Chat.",
  },
  stream: {
    answerability: "answerable",
    riskLevel: "green",
    text: "Deterministic streaming response assembled from multiple deltas.",
    chunks: ["Deterministic ", "streaming ", "response ", "assembled ", "from ", "multiple ", "deltas."],
  },
  partial: {
    answerability: "partial",
    riskLevel: "yellow",
    text: "Deterministic partial response with bounded uncertainty.",
  },
  unavailable: {
    answerability: "insufficient",
    riskLevel: "green",
    text: "",
  },
  "stop-mid": {
    answerability: "answerable",
    riskLevel: "green",
    text: "This deterministic response is intentionally long to exercise stop generation mid-stream behavior in tests.",
    chunks: [
      "This deterministic response ",
      "is intentionally long ",
      "to exercise stop generation ",
      "mid-stream behavior ",
      "in tests.",
    ],
  },
  context: {
    answerability: "answerable",
    riskLevel: "green",
    text: "Deterministic context-aware response.",
  },
};

function unavailableResult(): AiChatProviderResult {
  return {
    directAnswer: null,
    answerability: "insufficient",
    riskLevel: "green",
    completionState: "incomplete",
    deltas: [],
  };
}

function resolveFixtureKey(body: string) {
  const match = body.trim().match(AI_CHAT_FIXTURE_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

export function createDeterministicAiChatProvider(): AiChatGenerationProvider {
  return {
    name: "deterministic-fixture",
    async generate(request) {
      if (request.signal?.aborted) {
        return {
          directAnswer: null,
          answerability: "insufficient",
          riskLevel: "green",
          completionState: "incomplete",
          deltas: [],
        };
      }

      const fixtureKey = resolveFixtureKey(request.triggerBody);
      if (!fixtureKey) {
        return unavailableResult();
      }

      const fixture = FIXTURE_RESPONSES[fixtureKey];
      if (!fixture) {
        return unavailableResult();
      }

      const chunks = fixture.chunks ?? [fixture.text];
      const deltas: AiChatProviderDelta[] = [];
      let assembled = "";

      for (let index = 0; index < chunks.length; index += 1) {
        if (request.signal?.aborted) {
          return {
            directAnswer: assembled || null,
            answerability: fixture.answerability,
            riskLevel: fixture.riskLevel,
            completionState: "incomplete",
            deltas,
          };
        }
        const chunk = chunks[index];
        assembled += chunk;
        deltas.push({ text: chunk, sequence: index + 1 });
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (!fixture.text) {
        return unavailableResult();
      }

      const contextSuffix =
        request.contextEnvelope && request.contextEnvelope.sourceRefCount > 0
          ? ` [context:${request.contextEnvelope.sourceRefCount}]`
          : "";

      return {
        directAnswer: `${assembled}${contextSuffix}`,
        answerability: request.contextEnvelope?.insufficientEvidence
          ? "insufficient"
          : request.contextEnvelope?.conflictingEvidence
            ? "conflicting"
            : request.contextEnvelope?.partialEvidence
              ? "partial"
              : fixture.answerability,
        riskLevel: fixture.riskLevel,
        completionState: "complete",
        deltas,
      };
    },
  };
}

export function resolveAiChatGenerationProvider(): AiChatGenerationProvider {
  if (process.env.AI_CHAT_REAL_PROVIDER_ENABLED === "true") {
    throw new Error("ai_chat_real_provider_disabled");
  }
  return createDeterministicAiChatProvider();
}
