import { describe, expect, it } from "vitest";
import {
  assignFoodMixScenarioForClientIndex,
  buildPhase76oFoodMixEvidencePackMetrics,
  evaluatePhase76oFoodMixSampleEvidence,
  loadFoodMixRehearsalScenarios,
  runPhase76oFoodMixIntegrationChecks,
  runPhase76oFoodMixRehearsal,
  runPhase76oFoodMixScaleRehearsal,
  PHASE_76O_FOOD_MIX_REHEARSAL_VERSION,
} from "./phase-76o-food-mix-rehearsal";
import { createDirectPilotScaleFixture, evaluateDirectPilotScaleReadiness } from "./direct-pilot-scale-readiness";
import { buildOperationalHealthSnapshot } from "./operational-health";
import { createInitialState } from "./seed-data";
import { SUPABASE_READ_CONTRACTS } from "./supabase-read-contracts";

describe("phase 76o food-mix rehearsal", () => {
  it("loads twelve food-mix rehearsal scenarios from jsonl", () => {
    const scenarios = loadFoodMixRehearsalScenarios();
    expect(scenarios).toHaveLength(12);
    expect(scenarios.map((scenario) => scenario.id)).toContain("food_substitution_burst");
    expect(scenarios.map((scenario) => scenario.id)).toContain("proposal_apply_active_conversation");
  });

  it("assigns scenarios deterministically across the 100x50 fixture", () => {
    const fixture = createDirectPilotScaleFixture();
    const first = assignFoodMixScenarioForClientIndex(0);
    const second = assignFoodMixScenarioForClientIndex(12);
    expect(first.id).toBe(second.id);
    expect(assignFoodMixScenarioForClientIndex(1).id).not.toBe(first.id);
    expect(fixture.clients).toHaveLength(5000);
  });

  it("passes sample evidence with zero unsafe green", () => {
    const sample = evaluatePhase76oFoodMixSampleEvidence();
    expect(sample.status).toBe("pass");
    expect(sample.unsafeGreenCount).toBe(0);
    expect(sample.dietitianCount).toBe(100);
    expect(sample.clientCount).toBe(5000);
    expect(sample.foodRuleGreenCount).toBeGreaterThan(0);
    expect(sample.removedClientBlockedCount).toBeGreaterThan(0);
  });

  it("serializes evidence-pack metrics without raw message content", () => {
    const metrics = buildPhase76oFoodMixEvidencePackMetrics(evaluatePhase76oFoodMixSampleEvidence());
    const json = JSON.stringify(metrics);
    expect(metrics.rehearsalVersion).toBe(PHASE_76O_FOOD_MIX_REHEARSAL_VERSION);
    expect(metrics.unsafe_green_count).toBe(0);
    expect(json).not.toContain("Sutlu cikolata");
    expect(json).not.toContain("synthetic-client-");
  });

  it(
    "runs the full 100x50 scale rehearsal with zero unsafe green",
    async () => {
      const metrics = await runPhase76oFoodMixScaleRehearsal();
      expect(metrics.status).toBe("pass");
      expect(metrics.clientCount).toBe(5000);
      expect(metrics.dietitianCount).toBe(100);
      expect(metrics.unsafeGreenCount).toBe(0);
      expect(metrics.yellowClientSendCount).toBe(0);
      expect(metrics.redClientSendCount).toBe(0);
      expect(Object.values(metrics.scenarioCounts).reduce((sum, count) => sum + count, 0)).toBe(5000);
    },
    120_000,
  );

  it("covers integration checks for duplicate inbound, provider failure, stale draft, and manual food-rule save", async () => {
    const integration = await runPhase76oFoodMixIntegrationChecks();
    expect(integration.failures).toEqual([]);
    expect(integration.duplicateIgnoredCount).toBe(1);
    expect(integration.providerFailureHandoffCount).toBe(1);
    expect(integration.staleDraftInvalidatedCount).toBe(1);
    expect(integration.manualFoodRuleSaveCount).toBe(1);
    expect(integration.unsafeGreenCount).toBe(0);
  });

  it(
    "marks direct pilot scale ready when food-mix rehearsal evidence is supplied",
    async () => {
      const rehearsal = await runPhase76oFoodMixRehearsal();
      expect(rehearsal.status).toBe("pass");
      const readiness = evaluateDirectPilotScaleReadiness(createDirectPilotScaleFixture(), {
        readContracts: SUPABASE_READ_CONTRACTS,
        loadBackpressureIdempotencyEvidence: true,
        foodMixRehearsalPass: true,
        requireFoodMixRehearsalEvidence: true,
      });
      expect(readiness.ready).toBe(true);
      expect(readiness.rehearsalEvidence.foodMixRehearsalPass).toBe(true);
    },
    120_000,
  );

  it("adds aggregate food-mix fields to operational health without raw content", () => {
    const snapshot = buildOperationalHealthSnapshot(createInitialState(), {
      directPilotScaleFixture: createDirectPilotScaleFixture(),
      loadBackpressureIdempotencyEvidence: true,
      foodMixRehearsalPass: true,
    });
    const json = JSON.stringify(snapshot);
    expect(snapshot.foodMixRehearsalStatus).toBe("pass");
    expect(snapshot.foodMixRehearsalUnsafeGreenCount).toBe(0);
    expect(snapshot.foodMixRehearsalFoodRuleGreenCount).toBeGreaterThan(0);
    expect(json).not.toContain("Findik yerine badem");
    expect(json).not.toContain("synthetic-dietitian-");
  });
});
