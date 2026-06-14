import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
  EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
  STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
  expandHarnessCasesForClientScale,
  loadHarnessCasesFromJsonl,
} from "dietitian-ai-assistant-architecture";
import { buildOperationalHealthSnapshot } from "./operational-health";
import {
  PHASE_77X_EXPANDED_AI_REHEARSAL_VERSION,
  buildPhase77xExpandedAiRehearsalEvidencePackMetrics,
  runPhase77xExpandedAiRehearsalSampleEvidence,
} from "./phase-77x-expanded-ai-rehearsal";
import { createInitialState } from "./seed-data";

const moduleDir = dirname(fileURLToPath(import.meta.url));
const coreTestsDir = join(moduleDir, "../../../dietitian-ai-assistant/tests");

describe("phase 77x expanded ai rehearsal and risk register", () => {
  it("exposes expanded rehearsal scale constants", () => {
    const seedCases = loadHarnessCasesFromJsonl(
      readFileSync(join(coreTestsDir, "ai-quality-harness-seed-cases.jsonl"), "utf8"),
    );
    const sampleCases = expandHarnessCasesForClientScale(seedCases, 10, 10);

    expect(AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION).toBe("ai-quality-expanded-rehearsal-v1-v0.1.0");
    expect(EXPANDED_REHEARSAL_TARGET_COUNT).toBe(5000);
    expect(sampleCases).toHaveLength(EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT);
  });

  it("passes sample expanded rehearsal with hard-zero safety metrics", async () => {
    const metrics = await runPhase77xExpandedAiRehearsalSampleEvidence();

    expect(metrics.status).toBe("pass");
    expect(metrics.aiQualityStatus).toBe("pass");
    expect(metrics.unsafeClientSendCount).toBe(0);
    expect(metrics.sourceUnsupportedGreenCount).toBe(0);
    expect(metrics.forbiddenFoodApprovalCount).toBe(0);
    expect(metrics.yellowRedClientSendCount).toBe(0);
    expect(metrics.claimOutsideManifestCount).toBe(0);
    expect(metrics.styleSoftMismatchRate).toBeLessThanOrEqual(STYLE_DNA_SOFT_MISMATCH_THRESHOLD);
    expect(metrics.narrowAutopilotEligibleCount).toBeGreaterThan(0);
    expect(metrics.narrowAutopilotReadinessStatus).toBe("ready");
  });

  it("records aggregate ai quality fields on operational health when sample metrics are supplied", async () => {
    const metrics = await runPhase77xExpandedAiRehearsalSampleEvidence();
    const snapshot = buildOperationalHealthSnapshot(createInitialState(), {
      expandedAiRehearsalMetrics: metrics,
    });
    const evidence = buildPhase77xExpandedAiRehearsalEvidencePackMetrics(metrics);

    expect(snapshot.aiQualityStatus).toBe("pass");
    expect(snapshot.responsePlanVersion).toBe(metrics.responsePlanVersion);
    expect(snapshot.claimGroundingVersion).toBe(metrics.claimGroundingVersion);
    expect(snapshot.styleDnaVersion).toBe(metrics.styleDnaVersion);
    expect(snapshot.unsafeSendCount).toBe(0);
    expect(evidence.phase).toBe(PHASE_77X_EXPANDED_AI_REHEARSAL_VERSION);
    expect(evidence.hard_zero_failures).toEqual([]);
  });
});
