import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import {
  approveScopeRule,
  createPlaceholderScopeRules,
  getApprovedScopeChunks,
  isScopeGuardCorpusActive,
  tokenizeScopeText,
  withApprovedPlaceholderScopeCorpus,
} from "./scope-corpus";

describe("scope corpus governance", () => {
  it("placeholder seed corpus is draft and inactive", () => {
    const state = createInitialState();
    expect(state.scopeRules.length).toBeGreaterThan(0);
    expect(state.scopeRules.every((rule) => rule.status === "draft")).toBe(true);
    expect(isScopeGuardCorpusActive(state)).toBe(false);
  });

  it("approval builds chunks and activates corpus", () => {
    const state = createInitialState();
    const approved = approveScopeRule(state, "scope-rule-plan-change", state.dietitian.id);
    expect(isScopeGuardCorpusActive(approved)).toBe(true);
    expect(getApprovedScopeChunks(approved).length).toBeGreaterThan(0);
  });

  it("tokenizeScopeText normalizes Turkish characters", () => {
    const tokens = tokenizeScopeText("Diyet planımı değiştirmek istiyorum");
    expect(tokens).toContain("diyet");
    expect(tokens).toContain("degistirmek");
  });

  it("withApprovedPlaceholderScopeCorpus approves all draft rules", () => {
    const state = createInitialState();
    const active = withApprovedPlaceholderScopeCorpus(state, state.dietitian.id);
    expect(active.scopeRules.every((rule) => rule.status === "approved")).toBe(true);
    expect(isScopeGuardCorpusActive(active)).toBe(true);
  });

  it("createPlaceholderScopeRules includes escalation levels", () => {
    const rules = createPlaceholderScopeRules();
    expect(rules.some((rule) => rule.escalationLevel === "red")).toBe(true);
    expect(rules.some((rule) => rule.escalationLevel === "yellow")).toBe(true);
  });
});
