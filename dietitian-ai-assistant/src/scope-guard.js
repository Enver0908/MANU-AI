import { CLINICAL_SAFETY_CLASSIFIER_VERSION } from "./clinical-safety-second-layer.js";

export const SCOPE_GUARD_VERSION = "scope-rag-v0.1.0";
export const FULL_CLASSIFIER_VERSION_WITH_SCOPE = `${CLINICAL_SAFETY_CLASSIFIER_VERSION}+${SCOPE_GUARD_VERSION}`;

const RISK_RANK = {
  green: 0,
  yellow: 1,
  red: 2,
};

const DEFAULT_MATCH_THRESHOLD = 0.4;

export function rankRiskLevel(level) {
  return RISK_RANK[level] ?? 0;
}

export function maxRiskLevel(a, b) {
  return rankRiskLevel(a) >= rankRiskLevel(b) ? a : b;
}

export function buildScopeGuardNoopResult() {
  return {
    active: false,
    escalate: false,
    level: "green",
    reasons: [],
    matchedRuleIds: [],
    scores: {},
    status: "noop",
    version: SCOPE_GUARD_VERSION,
  };
}

export function buildScopeGuardUnavailableResult() {
  return {
    active: true,
    escalate: true,
    level: "yellow",
    reasons: ["scope_guard_unavailable"],
    matchedRuleIds: [],
    scores: {},
    status: "unavailable",
    version: SCOPE_GUARD_VERSION,
  };
}

export function applyScopeRules(retrievedRules = [], options = {}) {
  const threshold = options.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
  const matches = (retrievedRules || []).filter((rule) => Number(rule.score) >= threshold);

  if (matches.length === 0) {
    return {
      active: true,
      escalate: false,
      level: "green",
      reasons: [],
      matchedRuleIds: [],
      scores: Object.fromEntries((retrievedRules || []).map((rule) => [rule.ruleId, rule.score])),
      status: "no_match",
      version: SCOPE_GUARD_VERSION,
    };
  }

  let level = "green";
  const reasons = [];
  const matchedRuleIds = [];

  for (const match of matches) {
    const ruleLevel = match.escalationLevel === "red" ? "red" : "yellow";
    level = maxRiskLevel(level, ruleLevel);
    matchedRuleIds.push(match.ruleId);
    reasons.push(`scope_rule_${match.ruleId}`);
  }

  return {
    active: true,
    escalate: level !== "green",
    level,
    reasons: uniqueReasons(reasons),
    matchedRuleIds: uniqueReasons(matchedRuleIds),
    scores: Object.fromEntries(matches.map((rule) => [rule.ruleId, rule.score])),
    status: "matched",
    version: SCOPE_GUARD_VERSION,
  };
}

export function mergeScopeDecision(baseDecision, scopeResult) {
  if (!scopeResult || scopeResult.status === "noop" || !scopeResult.active) {
    return withClassifierVersion(baseDecision, FULL_CLASSIFIER_VERSION_WITH_SCOPE, scopeResult);
  }

  const mergedLevel = maxRiskLevel(baseDecision.level, scopeResult.level);
  const mergedReasons = uniqueReasons([...(baseDecision.reasons || []), ...(scopeResult.reasons || [])]);

  return {
    ...baseDecision,
    level: mergedLevel,
    reasons: mergedReasons,
    classifierVersion: FULL_CLASSIFIER_VERSION_WITH_SCOPE,
    shouldHandoff: mergedLevel !== "green",
    pauseAutopilot: mergedLevel === "red" || baseDecision.pauseAutopilot === true,
    scopeGuard: {
      version: scopeResult.version,
      status: scopeResult.status,
      matchedRuleIds: scopeResult.matchedRuleIds || [],
      scores: scopeResult.scores || {},
    },
  };
}

function withClassifierVersion(baseDecision, classifierVersion, scopeResult) {
  return {
    ...baseDecision,
    classifierVersion,
    scopeGuard: scopeResult
      ? {
          version: scopeResult.version,
          status: scopeResult.status,
          matchedRuleIds: scopeResult.matchedRuleIds || [],
          scores: scopeResult.scores || {},
        }
      : undefined,
  };
}

function uniqueReasons(reasons) {
  return Array.from(new Set((reasons || []).filter(Boolean)));
}
