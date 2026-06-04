import {
  buildScopeGuardUnavailableResult,
  FULL_CLASSIFIER_VERSION_WITH_SCOPE,
  mergeScopeDecision,
  SCOPE_GUARD_VERSION,
  type ScopeGuardResult,
} from "dietitian-ai-assistant-architecture";
import { getApprovedScopeChunks, isScopeGuardCorpusActive } from "./scope-corpus";
import { evaluateScopeWithFailSafe, resolveScopeEvaluator } from "./scope-evaluator";
import { isRealScopeGuardProviderAllowed } from "./scope-guard-provider";
import { resolveRetrievalProvider } from "./scope-retrieval";
import type { LaunchGateEvidenceRecord } from "./launch-gates";
import type {
  ManuAppState,
  RiskLevel,
  ScopeGuardEvaluationRecord,
  ScopeRuleChunkRecord,
} from "./types";

export type ScopeGuardRuntimeInput = {
  state: ManuAppState;
  message: string;
  baseDecision: {
    level: RiskLevel;
    reasons: string[];
    shouldHandoff: boolean;
    pauseAutopilot: boolean;
    classifierVersion?: string;
    [key: string]: unknown;
  };
  conversationId?: string | null;
  messageId?: string | null;
  approvedLaunchGateIds?: string[];
  launchGateEvidence?: LaunchGateEvidenceRecord[];
  matchThreshold?: number;
  topK?: number;
};

export type ScopeGuardRuntimeResult = {
  decision: ScopeGuardRuntimeInput["baseDecision"] & {
    classifierVersion: string;
    scopeGuard?: {
      version: string;
      status: string;
      matchedRuleIds: string[];
      scores: Record<string, number>;
    };
  };
  evaluationRecord: ScopeGuardEvaluationRecord | null;
  corpusActive: boolean;
};

export async function applyScopeGuardToRiskDecision(
  input: ScopeGuardRuntimeInput,
): Promise<ScopeGuardRuntimeResult> {
  const corpusActive = isScopeGuardCorpusActive(input.state);

  if (!corpusActive) {
    const decision = normalizeBaseDecision(input.baseDecision);
    return {
      decision,
      evaluationRecord: buildEvaluationRecord(input, {
        decisionLevel: input.baseDecision.level,
        matchedRuleIds: [],
        scores: {},
        status: "noop",
      }),
      corpusActive: false,
    };
  }

  const allowReal = isRealScopeGuardProviderAllowed({
    launchGateEvidence: input.launchGateEvidence,
  });
  const retrievalProvider = resolveRetrievalProvider({ allowReal });
  const evaluator = resolveScopeEvaluator({ allowReal });
  const chunks = getApprovedScopeChunks(input.state);

  let scopeResult: ScopeGuardResult;
  try {
    const retrieved = await retrievalProvider.retrieve({
      message: input.message,
      chunks,
      topK: input.topK ?? 3,
    });
    scopeResult = await evaluateScopeWithFailSafe(evaluator, {
      message: input.message,
      retrievedRules: retrieved,
      matchThreshold: input.matchThreshold,
    });
  } catch {
    scopeResult = buildScopeGuardUnavailableResult();
  }

  const decision = mergeScopeDecision(normalizeBaseDecision(input.baseDecision), scopeResult);

  return {
    decision,
    evaluationRecord: buildEvaluationRecord(input, {
      decisionLevel: decision.level as RiskLevel,
      matchedRuleIds: scopeResult.matchedRuleIds,
      scores: scopeResult.scores,
      status: mapScopeStatusForAudit(scopeResult.status),
    }),
    corpusActive: true,
  };
}

function mapScopeStatusForAudit(
  status: ScopeGuardResult["status"],
): ScopeGuardEvaluationRecord["status"] {
  if (status === "noop") return "noop";
  if (status === "unavailable") return "unavailable";
  if (status === "no_match") return "no_match";
  return "matched";
}

function normalizeBaseDecision(baseDecision: ScopeGuardRuntimeInput["baseDecision"]) {
  return {
    ...baseDecision,
    classifierVersion: baseDecision.classifierVersion || FULL_CLASSIFIER_VERSION_WITH_SCOPE,
  };
}

function buildEvaluationRecord(
  input: ScopeGuardRuntimeInput,
  payload: {
    decisionLevel: RiskLevel;
    matchedRuleIds: string[];
    scores: Record<string, number>;
    status: ScopeGuardEvaluationRecord["status"];
  },
): ScopeGuardEvaluationRecord {
  return {
    id: crypto.randomUUID(),
    tenantId: input.state.tenant.id,
    conversationId: input.conversationId ?? null,
    messageId: input.messageId ?? null,
    decisionLevel: payload.decisionLevel,
    matchedRuleIds: payload.matchedRuleIds,
    scores: payload.scores,
    scopeGuardVersion: SCOPE_GUARD_VERSION,
    status: payload.status,
    createdAt: new Date().toISOString(),
  };
}

export function appendScopeGuardEvaluation(
  state: ManuAppState,
  record: ScopeGuardEvaluationRecord | null,
): ManuAppState {
  if (!record) return state;
  return {
    ...state,
    scopeGuardEvaluations: [...state.scopeGuardEvaluations, record],
  };
}

export function buildScopeGuardHealthSignal(state: ManuAppState) {
  const approvedChunkCount = getApprovedScopeChunks(state).length;
  return {
    corpusActive: approvedChunkCount > 0,
    approvedRuleCount: state.scopeRules.filter((rule) => rule.status === "approved").length,
    approvedChunkCount,
    draftRuleCount: state.scopeRules.filter((rule) => rule.status === "draft").length,
    evaluationCount: state.scopeGuardEvaluations.length,
  };
}

export type { ScopeRuleChunkRecord };
