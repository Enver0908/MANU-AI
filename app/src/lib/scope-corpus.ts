import type { ManuAppState, ScopeRuleChunkRecord, ScopeRuleRecord, SupportedLanguageCode } from "./types";

export const SCOPE_CORPUS_VERSION = "scope-corpus-v0.1.0";
export const PLACEHOLDER_SCOPE_CORPUS_NOTE =
  "Placeholder rules remain draft until qualified dietitian clinical taxonomy approval.";

export function normalizeScopeText(text: string) {
  return String(text || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function tokenizeScopeText(text: string) {
  return normalizeScopeText(text)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 2);
}

export function chunkScopeRuleBody(body: string, maxChunkChars = 280): string[] {
  const trimmed = String(body || "").trim();
  if (!trimmed) return [];

  const paragraphs = trimmed.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChunkChars) {
      chunks.push(paragraph);
      continue;
    }

    let cursor = 0;
    while (cursor < paragraph.length) {
      chunks.push(paragraph.slice(cursor, cursor + maxChunkChars).trim());
      cursor += maxChunkChars;
    }
  }

  return chunks.filter(Boolean);
}

export function buildScopeRuleChunks(rule: ScopeRuleRecord): ScopeRuleChunkRecord[] {
  return chunkScopeRuleBody(rule.body).map((chunkText, index) => ({
    id: `${rule.id}-chunk-${index + 1}`,
    ruleId: rule.id,
    chunkIndex: index,
    chunkText,
    lexicalTokens: tokenizeScopeText(`${rule.title} ${chunkText}`),
    languageCode: rule.languageCode,
    escalationLevel: rule.escalationLevel,
  }));
}

export function getApprovedScopeRules(state: ManuAppState): ScopeRuleRecord[] {
  return state.scopeRules.filter((rule) => rule.status === "approved");
}

export function getApprovedScopeChunks(state: ManuAppState): ScopeRuleChunkRecord[] {
  const approvedRuleIds = new Set(getApprovedScopeRules(state).map((rule) => rule.id));
  return state.scopeRuleChunks.filter((chunk) => approvedRuleIds.has(chunk.ruleId));
}

export function isScopeGuardCorpusActive(state: ManuAppState) {
  return getApprovedScopeChunks(state).length > 0;
}

export function approveScopeRule(
  state: ManuAppState,
  ruleId: string,
  dietitianId: string,
  approvedAt = new Date().toISOString(),
): ManuAppState {
  const rule = state.scopeRules.find((item) => item.id === ruleId);
  if (!rule) {
    throw new Error("scope_rule_not_found");
  }

  const approvedRule: ScopeRuleRecord = {
    ...rule,
    status: "approved",
    approvedByDietitianId: dietitianId,
    approvedAt,
  };

  const otherChunks = state.scopeRuleChunks.filter((chunk) => chunk.ruleId !== ruleId);
  const nextChunks = buildScopeRuleChunks(approvedRule);

  return {
    ...state,
    scopeRules: state.scopeRules.map((item) => (item.id === ruleId ? approvedRule : item)),
    scopeRuleChunks: [...otherChunks, ...nextChunks],
  };
}

export function createPlaceholderScopeRules(now = new Date().toISOString()): ScopeRuleRecord[] {
  return [
    {
      id: "scope-rule-plan-change",
      title: "Diet plan change requires dietitian",
      body: "AI must not independently change a client diet plan, calorie target, meal structure, or fasting protocol. Plan change requests require dietitian review.",
      languageCode: "en" as SupportedLanguageCode,
      escalationLevel: "yellow",
      version: 1,
      status: "draft",
      approvedByDietitianId: null,
      approvedAt: null,
      createdAt: now,
    },
    {
      id: "scope-rule-supplement-dose",
      title: "Supplement or medication dosing",
      body: "Supplement dosing, medication adjustment, and insulin dosing are dietitian-only decisions. AI must escalate these messages.",
      languageCode: "en" as SupportedLanguageCode,
      escalationLevel: "red",
      version: 1,
      status: "draft",
      approvedByDietitianId: null,
      approvedAt: null,
      createdAt: now,
    },
    {
      id: "scope-rule-lab-interpretation",
      title: "Lab result interpretation",
      body: "Interpreting blood tests, HbA1c, ferritin, vitamin levels, or diagnostic results requires qualified dietitian review.",
      languageCode: "en" as SupportedLanguageCode,
      escalationLevel: "yellow",
      version: 1,
      status: "draft",
      approvedByDietitianId: null,
      approvedAt: null,
      createdAt: now,
    },
  ];
}

export function withApprovedPlaceholderScopeCorpus(state: ManuAppState, dietitianId: string): ManuAppState {
  let next = state;
  for (const rule of state.scopeRules) {
    if (rule.status === "draft") {
      next = approveScopeRule(next, rule.id, dietitianId);
    }
  }
  return next;
}
