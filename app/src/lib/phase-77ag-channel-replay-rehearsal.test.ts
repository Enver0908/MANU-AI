import { describe, expect, it } from "vitest";
import {
  assignChannelReplayScenarioForClientIndex,
  buildPhase77agChannelReplayEvidencePackMetrics,
  loadChannelReplayRehearsalScenarios,
  PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION,
  runPhase77agChannelReplayIntegrationChecks,
  runPhase77agChannelReplayRehearsal,
  runPhase77agChannelReplaySampleEvidence,
  runPhase77agChannelReplayScaleRehearsal,
} from "./phase-77ag-channel-replay-rehearsal";
import { createDirectPilotScaleFixture } from "./direct-pilot-scale-readiness";
import { buildOperationalHealthSnapshot } from "./operational-health";
import { createInitialState } from "./seed-data";

const runFullReplay = process.env.PHASE_77AG_FULL_REPLAY === "1";
const fullReplayIt = runFullReplay ? it : it.skip;

describe("phase 77ag channel replay rehearsal", () => {
  it("loads twelve channel replay scenarios from jsonl", () => {
    const scenarios = loadChannelReplayRehearsalScenarios();
    expect(scenarios).toHaveLength(12);
    expect(scenarios.map((scenario) => scenario.id)).toContain("unknown_identity");
    expect(scenarios.map((scenario) => scenario.id)).toContain("group_inbound");
  });

  it("assigns scenarios deterministically across the 100x50 fixture", () => {
    const fixture = createDirectPilotScaleFixture();
    const first = assignChannelReplayScenarioForClientIndex(0);
    const second = assignChannelReplayScenarioForClientIndex(12);
    expect(first.id).toBe(second.id);
    expect(assignChannelReplayScenarioForClientIndex(1).id).not.toBe(first.id);
    expect(fixture.clients).toHaveLength(5000);
  });

  it("passes sample evidence with hard-zero safety metrics", async () => {
    const metrics = await runPhase77agChannelReplaySampleEvidence();

    expect(metrics.status).toBe("pass");
    expect(metrics.duplicateClientSendCount).toBe(0);
    expect(metrics.unknownIdentityProviderCallCount).toBe(0);
    expect(metrics.yellowRedClientSendCount).toBe(0);
    expect(metrics.unsafeGreenCount).toBe(0);
    expect(metrics.hardZeroFailures).toEqual([]);
    expect(metrics.dietitianCount).toBe(100);
    expect(metrics.clientCount).toBe(5000);
    expect(metrics.duplicateIgnoredCount).toBe(1);
    expect(metrics.groupQuarantineCount).toBeGreaterThan(0);
  });

  it("serializes evidence-pack metrics without raw message content", async () => {
    const metrics = await runPhase77agChannelReplaySampleEvidence();
    const evidence = buildPhase77agChannelReplayEvidencePackMetrics(metrics);
    const json = JSON.stringify(evidence);

    expect(evidence.phase).toBe(PHASE_77AG_CHANNEL_REPLAY_REHEARSAL_VERSION);
    expect(evidence.unsafe_green_count).toBe(0);
    expect(json).not.toContain("Findik yerine badem");
    expect(json).not.toContain("synthetic-client-");
    expect(json).not.toContain("+9055");
  });

  it("covers integration checks for duplicate, identity quarantine, provider failure, and stale draft", async () => {
    const integration = await runPhase77agChannelReplayIntegrationChecks();
    expect(integration.failures).toEqual([]);
    expect(integration.duplicateIgnoredCount).toBe(1);
    expect(integration.quarantineCount).toBe(1);
    expect(integration.providerFailureHandoffCount).toBe(1);
    expect(integration.staleDraftInvalidatedCount).toBe(1);
    expect(integration.duplicateClientSendCount).toBe(0);
    expect(integration.unknownIdentityProviderCallCount).toBe(0);
  });

  it("records aggregate channel replay fields on operational health when sample metrics are supplied", async () => {
    const metrics = await runPhase77agChannelReplaySampleEvidence();
    const snapshot = buildOperationalHealthSnapshot(createInitialState(), {
      channelReplayRehearsalMetrics: metrics,
    });

    expect(snapshot.channelReplayRehearsalStatus).toBe("pass");
    expect(snapshot.channelReplayRehearsalVersion).toBe(metrics.rehearsalVersion);
    expect(snapshot.channelReplayRehearsalDuplicateClientSendCount).toBe(0);
    expect(snapshot.channelReplayRehearsalUnknownIdentityProviderCallCount).toBe(0);
    expect(snapshot.channelReplayRehearsalYellowRedClientSendCount).toBe(0);
    expect(snapshot.channelReplayRehearsalUnsafeGreenCount).toBe(0);
  });

  fullReplayIt(
    "runs the full 100x50 scale rehearsal with hard-zero safety metrics",
    async () => {
      const metrics = await runPhase77agChannelReplayScaleRehearsal();
      expect(metrics.status).toBe("pass");
      expect(metrics.clientCount).toBe(5000);
      expect(metrics.dietitianCount).toBe(100);
      expect(metrics.duplicateClientSendCount).toBe(0);
      expect(metrics.unknownIdentityProviderCallCount).toBe(0);
      expect(metrics.yellowRedClientSendCount).toBe(0);
      expect(metrics.unsafeGreenCount).toBe(0);
      expect(Object.values(metrics.scenarioCounts).reduce((sum, count) => sum + count, 0)).toBe(5000);
    },
    300_000,
  );

  fullReplayIt(
    "runs the full channel replay rehearsal with integration checks",
    async () => {
      const metrics = await runPhase77agChannelReplayRehearsal();
      expect(metrics.status).toBe("pass");
      expect(metrics.hardZeroFailures).toEqual([]);
      expect(metrics.duplicateIgnoredCount).toBe(1);
      expect(metrics.providerFailureHandoffCount).toBe(1);
    },
    360_000,
  );
});
