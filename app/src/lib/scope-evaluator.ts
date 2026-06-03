import { applyScopeRules, buildScopeGuardUnavailableResult } from "dietitian-ai-assistant-architecture";
import type { RetrievedScopeRule } from "./scope-retrieval";

export type ScopeEvaluationResult = ReturnType<typeof applyScopeRules>;

export type ScopeEvaluator = {
  id: string;
  evaluate(input: {
    message: string;
    retrievedRules: RetrievedScopeRule[];
    matchThreshold?: number;
  }): Promise<ScopeEvaluationResult>;
};

export const MOCK_SCOPE_EVALUATOR_ID = "mock-deterministic-scope-evaluator-v0";

export const mockDeterministicScopeEvaluator: ScopeEvaluator = {
  id: MOCK_SCOPE_EVALUATOR_ID,
  async evaluate({ retrievedRules, matchThreshold }) {
    return applyScopeRules(
      retrievedRules.map((rule) => ({
        ruleId: rule.ruleId,
        score: rule.score,
        escalationLevel: rule.escalationLevel,
      })),
      { matchThreshold },
    );
  },
};

export class RealLlmScopeEvaluator implements ScopeEvaluator {
  readonly id = "real-llm-scope-evaluator-disconnected";

  async evaluate(): Promise<ScopeEvaluationResult> {
    throw new Error("real_llm_scope_evaluator_disconnected");
  }
}

export function resolveScopeEvaluator(options: { allowReal?: boolean } = {}): ScopeEvaluator {
  if (options.allowReal) {
    return new RealLlmScopeEvaluator();
  }
  return mockDeterministicScopeEvaluator;
}

export async function evaluateScopeWithFailSafe(
  evaluator: ScopeEvaluator,
  input: { message: string; retrievedRules: RetrievedScopeRule[]; matchThreshold?: number },
) {
  try {
    return await evaluator.evaluate(input);
  } catch {
    return buildScopeGuardUnavailableResult();
  }
}
