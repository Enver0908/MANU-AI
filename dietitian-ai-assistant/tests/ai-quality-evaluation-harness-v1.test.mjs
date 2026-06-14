import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_QUALITY_EVAL_HARNESS_V1_VERSION,
  RELEASE_SUBSET_TARGET_COUNT,
  FULL_REHEARSAL_TARGET_COUNT,
  assertClientFacingTextSafe,
  detectClientFacingMetadataLeaks,
  expandHarnessCasesDeterministically,
  loadHarnessCasesFromJsonl,
  runHarnessBatch,
  runHarnessCase,
} from "../src/ai-quality-evaluation-harness-v1.js";
import { handleInboundMessage } from "../src/orchestrator.js";
import { renderDeterministicTemplate } from "../src/deterministic-template-library-v1.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const seedCases = loadHarnessCasesFromJsonl(
  readFileSync(join(moduleDir, "ai-quality-harness-seed-cases.jsonl"), "utf8"),
);
const releaseCases = expandHarnessCasesDeterministically(seedCases, RELEASE_SUBSET_TARGET_COUNT);
const rehearsalCases = expandHarnessCasesDeterministically(seedCases, FULL_REHEARSAL_TARGET_COUNT);

test("ai quality harness exposes version and release target", () => {
  assert.equal(AI_QUALITY_EVAL_HARNESS_V1_VERSION, "ai-quality-evaluation-harness-v1-v0.1.0");
  assert.equal(releaseCases.length, RELEASE_SUBSET_TARGET_COUNT);
  assert.equal(rehearsalCases.length, FULL_REHEARSAL_TARGET_COUNT);
});

test("deterministic template text stays free of internal metadata markers", () => {
  const text = renderDeterministicTemplate({
    templateId: "ingredient_label_request_v1",
    language: "tr",
  });
  assertClientFacingTextSafe(text);
  assert.equal(detectClientFacingMetadataLeaks(text).length, 0);
});

test("release subset passes structured ai quality harness expectations", async () => {
  const { metrics } = await runHarnessBatch(releaseCases, { handleInboundMessage });
  if (metrics.failureCount > 0) {
    assert.fail(metrics.failures.slice(0, 12).join("\n"));
  }
  assert.equal(metrics.status, "pass");
  assert.equal(metrics.caseCount, RELEASE_SUBSET_TARGET_COUNT);
  assert.equal(metrics.passCount, RELEASE_SUBSET_TARGET_COUNT);
});

test("seed multi-turn awaiting label re-runs food decision on follow-up", async () => {
  const seed = seedCases.find((entry) => entry.id === "77t-mt-label-then-allow");
  const result = await runHarnessCase(seed, { handleInboundMessage });
  assert.equal(result.pass, true, result.failures.join("\n"));
  assert.equal(result.snapshots[0]?.replyMode, "ask_label");
  assert.equal(result.snapshots[1]?.foodDecision, "allow");
  assert.equal(result.snapshots[1]?.replyMode, "send");
});

test("seed pending clarification blocks before provider", async () => {
  const seed = seedCases.find((entry) => entry.id === "77t-pending-clarify-greeting");
  const result = await runHarnessCase(seed, { handleInboundMessage });
  assert.equal(result.pass, true, result.failures.join("\n"));
  assert.equal(result.snapshots[0]?.providerAttempted, false);
  assert.equal(result.snapshots[0]?.workflowState, "clarify");
});
