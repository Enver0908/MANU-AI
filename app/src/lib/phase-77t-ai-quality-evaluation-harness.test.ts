import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_QUALITY_EVAL_HARNESS_V1_VERSION,
  RELEASE_SUBSET_TARGET_COUNT,
  expandHarnessCasesDeterministically,
  loadHarnessCasesFromJsonl,
  runHarnessBatch,
} from "dietitian-ai-assistant-architecture";
import { handleInboundMessage } from "dietitian-ai-assistant-architecture";
import { buildPhase70QualifiedClientAnswers } from "./phase-70-seed-answers";
import { publishClientFormSchemaInState, saveClientFormResponseInState } from "./client-forms";
import { runInboundSimulation } from "./simulator";
import { createInitialState } from "./seed-data";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const coreTestsDir = join(moduleDir, "../../../dietitian-ai-assistant/tests");
const seedCases = loadHarnessCasesFromJsonl(
  readFileSync(join(coreTestsDir, "ai-quality-harness-seed-cases.jsonl"), "utf8"),
);
const releaseCases = expandHarnessCasesDeterministically(seedCases, RELEASE_SUBSET_TARGET_COUNT);

function seedPublishedFormResponse(state = createInitialState()) {
  const schema = state.clientFormSchemas[0];
  const published = publishClientFormSchemaInState(state, schema.id);
  return saveClientFormResponseInState(published, "client-mert", schema.id, buildPhase70QualifiedClientAnswers());
}

describe("phase 77t ai quality evaluation harness v1", () => {
  it("exposes harness version and release subset size", () => {
    expect(AI_QUALITY_EVAL_HARNESS_V1_VERSION).toBe("ai-quality-evaluation-harness-v1-v0.1.0");
    expect(releaseCases).toHaveLength(RELEASE_SUBSET_TARGET_COUNT);
  });

  it("passes release subset through orchestrator harness batch", async () => {
    const { metrics } = await runHarnessBatch(releaseCases, { handleInboundMessage });
    expect(metrics.status).toBe("pass");
    expect(metrics.caseCount).toBe(RELEASE_SUBSET_TARGET_COUNT);
  });

  it("keeps simulator needs_label path on structured responsePlan fields", async () => {
    const state = await runInboundSimulation(seedPublishedFormResponse(), {
      clientId: "client-mert",
      body: "Bir tane cikolata yiyebilir miyim?",
      idempotencyKey: "phase-77t-needs-label",
      now: "2026-06-13T12:00:00.000Z",
    });

    const manifest = state.aiDecisions.at(-1)?.contextManifest as {
      responsePlan?: { replyMode?: string; templateId?: string };
      deterministicClientMessage?: { text?: string };
    };

    expect(state.lastSimulation?.action).toBe("handoff");
    expect(manifest?.responsePlan?.replyMode).toBe("ask_label");
    expect(manifest?.responsePlan?.templateId).toBe("ingredient_label_request_v1");
    expect(manifest?.deterministicClientMessage?.text || "").not.toMatch(/intentFamily=/i);
  });
});
