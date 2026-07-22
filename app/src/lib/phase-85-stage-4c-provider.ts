import type { AiChatAnswerability, AiChatRiskLevel } from "./phase-85-stage-4c-contracts";

export const AI_CHAT_FIXTURE_PATTERN = /^__fixture:([a-z0-9_-]+)__$/i;

export type AiChatProviderDelta = {
  text: string;
  sequence: number;
};

export type AiChatStructuredClaim = {
  claimId: string;
  text: string;
  sourceRefIds: string[];
  uncertainty?: string | null;
};

export type AiChatStructuredAnswer = {
  directAnswer: string;
  verifiedFacts: AiChatStructuredClaim[];
  inferences: AiChatStructuredClaim[];
  recommendations: AiChatStructuredClaim[];
  missingData?: string[];
  conflictingData?: string[];
};

export type AiChatProviderResult = {
  directAnswer: string | null;
  answerability: AiChatAnswerability;
  riskLevel: AiChatRiskLevel;
  completionState: "complete" | "incomplete";
  deltas: AiChatProviderDelta[];
  structuredAnswer?: AiChatStructuredAnswer | null;
  schemaValid?: boolean;
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
  allowedSourceIds?: string[];
  sourceTypesById?: Record<string, string>;
  sourceExcerptById?: Record<string, string>;
  repairAttempt?: boolean;
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
  sourced: {
    answerability: "answerable",
    riskLevel: "green",
    text: "Deterministic sourced clinical response.",
  },
  "schema-bad": {
    answerability: "answerable",
    riskLevel: "green",
    text: "Deterministic schema repair response.",
  },
  "unsourced-claim": {
    answerability: "answerable",
    riskLevel: "yellow",
    text: "Deterministic unsourced claim response.",
  },
};

function unavailableResult(): AiChatProviderResult {
  return {
    directAnswer: null,
    answerability: "insufficient",
    riskLevel: "green",
    completionState: "incomplete",
    deltas: [],
    structuredAnswer: null,
    schemaValid: false,
  };
}

function resolveFixtureKey(body: string) {
  const match = body.trim().match(AI_CHAT_FIXTURE_PATTERN);
  return match?.[1]?.toLowerCase() ?? null;
}

function pickSourcesByType(request: AiChatGenerationRequest) {
  const clientSource = (request.allowedSourceIds ?? []).find(
    (id) => request.sourceTypesById?.[id] === "client_record",
  );
  const clinicalSource = (request.allowedSourceIds ?? []).find(
    (id) => request.sourceTypesById?.[id] === "approved_clinical_source",
  );
  const fallback = request.allowedSourceIds?.[0] ?? "source-missing";
  return {
    clientSource: clientSource ?? fallback,
    clinicalSource: clinicalSource ?? fallback,
  };
}

function buildStructuredFixtureAnswer(
  fixtureKey: string,
  request: AiChatGenerationRequest,
  directAnswer: string,
): { structuredAnswer: AiChatStructuredAnswer | null; schemaValid: boolean } {
  if (fixtureKey === "schema-bad" && !request.repairAttempt) {
    return {
      structuredAnswer: {
        directAnswer: "",
        verifiedFacts: [{ claimId: "bad", text: "invalid", sourceRefIds: [] }],
        inferences: [],
        recommendations: [],
      },
      schemaValid: false,
    };
  }

  if (fixtureKey === "unsourced-claim") {
    return {
      structuredAnswer: {
        directAnswer,
        verifiedFacts: [{ claimId: "u1", text: "Unsupported clinical claim", sourceRefIds: [] }],
        inferences: [],
        recommendations: [],
      },
      schemaValid: true,
    };
  }

  if (!["context", "sourced", "schema-bad"].includes(fixtureKey)) {
    return { structuredAnswer: null, schemaValid: true };
  }

  const { clientSource, clinicalSource } = pickSourcesByType(request);
  const clientExcerpt = request.sourceExcerptById?.[clientSource] ?? "Client profile snapshot.";
  const clinicalExcerpt =
    request.sourceExcerptById?.[clinicalSource] ?? "Approved clinical source on fiber intake.";

  if (fixtureKey === "context") {
    return {
      structuredAnswer: {
        directAnswer,
        verifiedFacts: [
          {
            claimId: "vf1",
            text: clientExcerpt.slice(0, 80),
            sourceRefIds: [clientSource],
          },
        ],
        inferences: [],
        recommendations: [],
      },
      schemaValid: true,
    };
  }

  return {
    structuredAnswer: {
      directAnswer,
      verifiedFacts: [
        {
          claimId: "vf1",
          text: clientExcerpt.slice(0, 80),
          sourceRefIds: [clientSource],
        },
        {
          claimId: "vf2",
          text: clinicalExcerpt.slice(0, 80),
          sourceRefIds: [clinicalSource],
        },
      ],
      inferences: [
        {
          claimId: "inf1",
          text: "AI inference based on retrieved evidence.",
          sourceRefIds: [clientSource, clinicalSource],
        },
      ],
      recommendations: [
        {
          claimId: "rec1",
          text: "Consider gradual fiber adjustment",
          sourceRefIds: [clientSource, clinicalSource],
          uncertainty: "Monitor tolerance and adherence.",
        },
      ],
      missingData: [],
      conflictingData: [],
    },
    schemaValid: true,
  };
}

export function createDeterministicAiChatProvider(): AiChatGenerationProvider {
  return {
    name: "deterministic-fixture",
    async generate(request) {
      if (request.signal?.aborted) {
        return unavailableResult();
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
            structuredAnswer: null,
            schemaValid: false,
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

      const directAnswer = `${assembled}${contextSuffix}`;
      const structured = buildStructuredFixtureAnswer(fixtureKey, request, directAnswer);

      return {
        directAnswer,
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
        structuredAnswer: structured.structuredAnswer,
        schemaValid: structured.schemaValid,
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
