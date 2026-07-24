import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { loadHarnessCasesFromJsonl } from "../src/ai-quality-evaluation-harness-v1.js";
import { classifyDietitianChatIntentFromSignals, planDietitianChatContextTools } from "../src/dietitian-chat-context-policy.js";
import { classifyDietitianChatRisk } from "../src/dietitian-chat-risk.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadCases(fileName) {
  const raw = readFileSync(join(moduleDir, fileName), "utf8").trim();
  return loadHarnessCasesFromJsonl(raw);
}

test("golden corpus jsonl meets minimum size and category coverage", () => {
  const cases = loadCases("dietitian-chat-golden-cases.jsonl");
  assert.ok(cases.length >= 240);
  const categories = new Set(cases.map((entry) => entry.category));
  for (const category of [
    "general_non_clinical",
    "general_pii_attempt",
    "client_retrieval",
    "longitudinal_large_context",
    "source_conflict",
    "risk",
    "multimodal",
  ]) {
    assert.ok(categories.has(category), `missing category ${category}`);
  }
});

function normalizeCorpusTriggerBody(triggerBody) {
  return String(triggerBody).replace(/\s\[#\d+\]$/u, "").trim();
}

test("golden corpus cases classify deterministically without client tools in general scope", () => {
  const cases = loadCases("dietitian-chat-golden-cases.jsonl");
  for (const entry of cases) {
    const triggerBody = normalizeCorpusTriggerBody(entry.triggerBody);
    const intent = classifyDietitianChatIntentFromSignals({
      triggerBody,
      scopeType: entry.scopeType,
    });
    const tools = planDietitianChatContextTools(intent, entry.scopeType);
    if (entry.scopeType === "general") {
      assert.equal(tools.length, 0, `${entry.id} exposed client tools in general scope`);
    }
    if (entry.expect?.intent) {
      assert.equal(intent, entry.expect.intent, `${entry.id} intent mismatch`);
    }
    if (entry.expect?.riskLevel) {
      const risk = classifyDietitianChatRisk({
        triggerBody,
        verifiedFactTexts: entry.verifiedFactTexts ?? [],
        attachmentExcerpts: entry.attachmentExcerpts ?? [],
        sourceExcerptTexts: entry.sourceExcerptTexts ?? [],
        scopeType: entry.scopeType,
        providerRiskLevel: entry.providerRiskLevel ?? null,
      });
      assert.equal(risk.riskLevel, entry.expect.riskLevel, `${entry.id} risk mismatch`);
    }
  }
});

test("golden corpus includes at least ten true red risk cases", () => {
  const cases = loadCases("dietitian-chat-golden-cases.jsonl");
  const redCases = cases.filter((entry) => entry.category === "risk" && entry.expect?.riskLevel === "red");
  assert.ok(redCases.length >= 10);
});
