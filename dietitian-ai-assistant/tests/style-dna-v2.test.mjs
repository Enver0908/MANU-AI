import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildResponsePlanV1 } from "../src/response-plan-v1.js";
import {
  STYLE_DNA_V2_VERSION,
  buildStyleDnaV2,
  buildStyleEditHistoryRecord,
  clinicalSnapshotsEqual,
  detectHardStyleGuardViolations,
  extractClinicalDecisionSnapshot,
  extractStyleSignalsFromEditHistory,
  filterCandidateStylePhrases,
  measureSoftStyleMismatch,
  stripClientIdentifyingText,
} from "../src/style-dna-v2.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));

const clinicalFixture = {
  riskDecision: { level: "green" },
  canonicalIntent: { intentFamily: "green_allowed_substitution", allowed: true, workflowState: null, reasons: [] },
  greenIntent: { intentFamily: "green_allowed_substitution", allowed: true, reasons: [] },
  answerability: {
    allowed: true,
    intentFamily: "green_allowed_substitution",
    reasons: [],
    sourceCategories: ["active_diet_plan"],
  },
  foodDecisionV2: {
    decision: "allow",
    reasonCodes: ["food_decision_v2_on_menu"],
    queryType: "food_permission",
  },
  modeDecision: { action: "auto_send", reason: "autopilot_green" },
  tenantId: "tenant-manu-demo",
  dietitianId: "dietitian-demo",
};

function loadGoldenCases() {
  const raw = readFileSync(join(moduleDir, "style-dna-poisoning-golden-cases.jsonl"), "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("style dna v2 exposes version", () => {
  assert.equal(STYLE_DNA_V2_VERSION, "style-dna-v2-v0.1.0");
});

test("style poisoning golden cases", () => {
  for (const entry of loadGoldenCases()) {
    if (entry.kind === "clinical_isolation") {
      const planA = buildResponsePlanV1({
        ...clinicalFixture,
        voiceProfile: {
          averageMessageChars: 90,
          formality: entry.formalityA,
          emojiPolicy: entry.emojiPolicyA,
          commonGreetings: ["Merhaba"],
          commonClosings: [],
          styleNotes: "Kisa ve net",
        },
      });
      const planB = buildResponsePlanV1({
        ...clinicalFixture,
        voiceProfile: {
          averageMessageChars: 260,
          formality: entry.formalityB,
          emojiPolicy: entry.emojiPolicyB,
          commonGreetings: ["Selam"],
          commonClosings: ["Kolay gelsin"],
          styleNotes: "Daha uzun ve sicak",
        },
      });
      assert.equal(
        clinicalSnapshotsEqual(
          extractClinicalDecisionSnapshot(planA),
          extractClinicalDecisionSnapshot(planB),
        ),
        true,
        entry.id,
      );
      assert.notEqual(planA.styleDna.greetingStyle, planB.styleDna.greetingStyle, entry.id);
    }

    if (entry.kind === "covenant_filter") {
      const filtered = filterCandidateStylePhrases([entry.phrase]);
      assert.equal(filtered.accepted.length > 0, entry.expectAccepted, entry.id);
    }

    if (entry.kind === "hard_guard") {
      const styleDna = buildStyleDnaV2({
        tenantId: "tenant-manu-demo",
        dietitianId: "dietitian-demo",
        voiceProfile: { averageMessageChars: 140, formality: "balanced", emojiPolicy: entry.emojiPolicy, commonGreetings: [], commonClosings: [], styleNotes: "" },
      });
      const violations = detectHardStyleGuardViolations(entry.text, styleDna);
      assert.equal(violations.includes(entry.expectViolation), true, entry.id);
    }

    if (entry.kind === "soft_mismatch") {
      const styleDna = buildStyleDnaV2({
        tenantId: "tenant-manu-demo",
        dietitianId: "dietitian-demo",
        voiceProfile: { averageMessageChars: 140, formality: entry.formality, emojiPolicy: "limited", commonGreetings: [], commonClosings: [], styleNotes: "" },
      });
      const mismatch = measureSoftStyleMismatch(entry.text, styleDna);
      assert.equal(mismatch.hardBlock, entry.expectHardBlock, entry.id);
      assert.equal(mismatch.exceedsThreshold, entry.expectExceedsThreshold, entry.id);
    }
  }
});

test("edit-history learning strips client-identifying text", () => {
  const record = buildStyleEditHistoryRecord({
    tenantId: "tenant-manu-demo",
    dietitianId: "dietitian-demo",
    aiDraft: "Merhaba Mert, bugun planina uygun ilerleyebilirsin.",
    dietitianFinal: "Merhaba, bugun planina uygun ilerleyebilirsin.",
    knownClientNames: ["Mert"],
  });
  assert.ok(record.aiDraftHash);
  assert.ok(record.dietitianFinalHash);
  assert.equal(stripClientIdentifyingText("Mert icin plan hazir", ["Mert"]).includes("Mert"), false);
});

test("extractStyleSignalsFromEditHistory aggregates warmth adjustments", () => {
  const signals = extractStyleSignalsFromEditHistory([
    { diffMetadata: { lengthDelta: 40, greetingChanged: true, closingChanged: false } },
    { diffMetadata: { lengthDelta: 30, greetingChanged: true, closingChanged: true } },
  ]);
  assert.equal(signals.warmthAdjustment, "warmer");
  assert.equal(signals.responseTimingStyle, "reflective");
});
