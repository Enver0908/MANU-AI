import { describe, expect, it } from "vitest";
import { buildScopeRuleChunks } from "./scope-corpus";
import { retrieveScopeRulesLexical, scoreLexicalSimilarity } from "./scope-retrieval";
import type { ScopeRuleRecord } from "./types";

describe("scope retrieval", () => {
  const rule: ScopeRuleRecord = {
    id: "scope-rule-plan-change",
    title: "Diet plan change requires dietitian",
    body: "AI must not independently change a client diet plan or calorie target.",
    languageCode: "en",
    escalationLevel: "yellow",
    version: 1,
    status: "approved",
    approvedByDietitianId: "dietitian-1",
    approvedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
  };

  it("scores lexical similarity deterministically", () => {
    const score = scoreLexicalSimilarity(
      ["change", "diet", "plan"],
      ["diet", "plan", "change", "calorie"],
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("retrieves plan-change rule for matching message", () => {
    const chunks = buildScopeRuleChunks(rule);
    const retrieved = retrieveScopeRulesLexical("Can you change my diet plan calories?", chunks, 3);
    expect(retrieved.length).toBeGreaterThan(0);
    expect(retrieved[0].ruleId).toBe("scope-rule-plan-change");
    expect(retrieved[0].score).toBeGreaterThanOrEqual(0.4);
  });
});
