import assert from "node:assert/strict";
import test from "node:test";
import {
  SCOPE_GUARD_VERSION,
  applyScopeRules,
  buildScopeGuardNoopResult,
  buildScopeGuardUnavailableResult,
  maxRiskLevel,
  mergeScopeDecision,
} from "../src/scope-guard.js";

test("maxRiskLevel is monotonic", () => {
  assert.equal(maxRiskLevel("green", "yellow"), "yellow");
  assert.equal(maxRiskLevel("yellow", "red"), "red");
  assert.equal(maxRiskLevel("red", "green"), "red");
});

test("applyScopeRules returns no_match below threshold", () => {
  const result = applyScopeRules([{ ruleId: "r1", score: 0.1, escalationLevel: "yellow" }]);
  assert.equal(result.status, "no_match");
  assert.equal(result.escalate, false);
});

test("applyScopeRules escalates to yellow for matched rule", () => {
  const result = applyScopeRules([{ ruleId: "plan_change", score: 0.8, escalationLevel: "yellow" }]);
  assert.equal(result.status, "matched");
  assert.equal(result.level, "yellow");
  assert.ok(result.reasons.includes("scope_rule_plan_change"));
});

test("applyScopeRules escalates to red when rule level is red", () => {
  const result = applyScopeRules([{ ruleId: "insulin_dose", score: 0.9, escalationLevel: "red" }]);
  assert.equal(result.level, "red");
});

test("mergeScopeDecision never downgrades base risk", () => {
  const base = {
    level: "red",
    reasons: ["possible_emergency_symptom"],
    shouldHandoff: true,
    pauseAutopilot: true,
    classifierVersion: "base-v1",
  };
  const scope = applyScopeRules([{ ruleId: "x", score: 0.9, escalationLevel: "yellow" }]);
  const merged = mergeScopeDecision(base, scope);
  assert.equal(merged.level, "red");
});

test("mergeScopeDecision upgrades green to yellow", () => {
  const base = {
    level: "green",
    reasons: [],
    shouldHandoff: false,
    pauseAutopilot: false,
    classifierVersion: "base-v1",
  };
  const scope = applyScopeRules([{ ruleId: "supplement_dose", score: 0.75, escalationLevel: "yellow" }]);
  const merged = mergeScopeDecision(base, scope);
  assert.equal(merged.level, "yellow");
  assert.equal(merged.shouldHandoff, true);
  assert.ok(merged.classifierVersion.includes(SCOPE_GUARD_VERSION));
});

test("noop scope result leaves base level unchanged", () => {
  const base = { level: "green", reasons: [], shouldHandoff: false, pauseAutopilot: false };
  const merged = mergeScopeDecision(base, buildScopeGuardNoopResult());
  assert.equal(merged.level, "green");
});

test("unavailable scope result escalates green to yellow", () => {
  const base = { level: "green", reasons: [], shouldHandoff: false, pauseAutopilot: false };
  const merged = mergeScopeDecision(base, buildScopeGuardUnavailableResult());
  assert.equal(merged.level, "yellow");
  assert.ok(merged.reasons.includes("scope_guard_unavailable"));
});
