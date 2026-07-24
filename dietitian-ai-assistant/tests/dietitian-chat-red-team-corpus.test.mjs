import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import { loadHarnessCasesFromJsonl } from "../src/ai-quality-evaluation-harness-v1.js";
import { finalizeDietitianChatRun } from "../src/dietitian-chat-orchestrator.js";
import { detectDietitianChatPromptInjectionSignals } from "../src/dietitian-chat-answerability.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadCases() {
  const raw = readFileSync(join(moduleDir, "dietitian-chat-red-team-cases.jsonl"), "utf8").trim();
  return loadHarnessCasesFromJsonl(raw);
}

test("red-team corpus jsonl meets minimum size and category coverage", () => {
  const cases = loadCases();
  assert.ok(cases.length >= 100);
  for (const category of [
    "cross_tenant",
    "second_client",
    "source_prompt_injection",
    "attachment_injection",
    "provider_egress",
    "deletion_retrieval",
    "edit_stop_reconnect_race",
  ]) {
    assert.ok(cases.some((entry) => entry.redTeamCategory === category), `missing ${category}`);
  }
});

test("red-team injection cases are flagged", () => {
  const cases = loadCases().filter((entry) =>
    ["source_prompt_injection", "attachment_injection"].includes(entry.redTeamCategory),
  );
  assert.ok(cases.length > 0);
  for (const entry of cases) {
    const text = [...(entry.sourceExcerptTexts ?? []), ...(entry.attachmentExcerpts ?? [])].join(" ");
    if (text.trim().length > 0) {
      const result = detectDietitianChatPromptInjectionSignals(text);
      assert.equal(result.flagged, true, `${entry.id} injection not flagged`);
    }
  }
});

test("stopped runs are not marked complete in red-team race cases", () => {
  const cases = loadCases().filter((entry) => entry.redTeamCategory === "edit_stop_reconnect_race");
  for (const entry of cases) {
    if (entry.runStatus !== "cancel_requested" || !entry.providerResult) continue;
    const finalized = finalizeDietitianChatRun({
      runStatus: entry.runStatus,
      providerResult: entry.providerResult,
    });
    assert.notEqual(finalized.terminalStatus, "completed", `${entry.id} stopped run completed`);
    assert.equal(finalized.validation.completionState, "incomplete", `${entry.id} completion state`);
  }
});
