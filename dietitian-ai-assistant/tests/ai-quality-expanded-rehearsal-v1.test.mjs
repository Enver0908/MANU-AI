import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { handleInboundMessage } from "../src/orchestrator.js";
import {
  AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
  STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
  expandHarnessCasesForClientScale,
  loadHarnessCasesFromJsonl,
  runExpandedRehearsalBatch,
} from "../src/index.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const seedCases = loadHarnessCasesFromJsonl(
  readFileSync(join(moduleDir, "ai-quality-harness-seed-cases.jsonl"), "utf8"),
);
const sampleCases = expandHarnessCasesForClientScale(seedCases, 10, 10);

const { metrics } = await runExpandedRehearsalBatch(sampleCases, {
  handleInboundMessage,
  clientCount: 10,
  messagesPerClient: 10,
});

assert.equal(AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION, "ai-quality-expanded-rehearsal-v1-v0.1.0");
assert.equal(EXPANDED_REHEARSAL_TARGET_COUNT, 5000);
assert.equal(EXPANDED_REHEARSAL_CLIENT_COUNT, 100);
assert.equal(EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT, 50);
assert.equal(sampleCases.length, EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT);
assert.equal(metrics.caseCount, EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT);
assert.equal(metrics.status, "pass");
assert.equal(metrics.unsafeClientSendCount, 0);
assert.equal(metrics.sourceUnsupportedGreenCount, 0);
assert.equal(metrics.forbiddenFoodApprovalCount, 0);
assert.equal(metrics.yellowRedClientSendCount, 0);
assert.equal(metrics.claimOutsideManifestCount, 0);
assert.ok(metrics.styleSoftMismatchRate <= STYLE_DNA_SOFT_MISMATCH_THRESHOLD);
assert.ok(metrics.responsePlanPassRate > 0);
assert.ok(metrics.claimGroundingPassRate > 0);
assert.ok(metrics.narrowAutopilotEligibleCount >= 0);

console.log("ai-quality-expanded-rehearsal-v1 tests passed");
