import { describe, expect, it } from "vitest";
import {
  evaluateStage4CProgramClosureEvidence,
  runStage4CRemediationClosureRehearsal,
  STAGE_4C_REMEDIATED_PASS_VERDICT,
  runStage4CSecretScan,
} from "./phase-85-stage-4c-closure";

const runFullRehearsal = process.env.STAGE_4C_FULL_REHEARSAL === "1";
const fullRehearsalIt = runFullRehearsal ? it : it.skip;

describe("phase 85 stage 4c remediation closure", () => {
  it("passes repo-wide secret scan", () => {
    const scan = runStage4CSecretScan();
    expect(scan.hits).toEqual([]);
    expect(scan.status).toBe("pass");
    expect(scan.scannedFileCount).toBeGreaterThan(0);
  }, 60_000);

  it("blocks sample remediation rehearsal without full local Supabase postgres scale proof", async () => {
    const previousFullRehearsal = process.env.STAGE_4C_FULL_REHEARSAL;
    let rehearsal!: Awaited<ReturnType<typeof runStage4CRemediationClosureRehearsal>>;
    try {
      delete process.env.STAGE_4C_FULL_REHEARSAL;
      rehearsal = await runStage4CRemediationClosureRehearsal();
    } finally {
      if (previousFullRehearsal !== undefined) {
        process.env.STAGE_4C_FULL_REHEARSAL = previousFullRehearsal;
      }
    }
    expect(rehearsal.concurrency.failures).toEqual([]);
    expect(rehearsal.status).toBe("fail");
    expect(rehearsal.postgresScale.status).toBe("blocked");
    expect(rehearsal.failures).toContain("full_postgres_rehearsal_required");
  }, 180_000);

  fullRehearsalIt(
    "passes full remediation closure with remediated verdict",
    async () => {
      const rehearsal = await runStage4CRemediationClosureRehearsal();
      const closure = evaluateStage4CProgramClosureEvidence(
        rehearsal,
        {
          coreTests: "pass",
          lint: "pass",
          typecheck: "pass",
          unitTests: "pass",
          rlsSuite: "pass",
          rlsSkippedCount: 0,
          visualSuite: "pass",
          accessibilitySuite: "pass",
          releaseVerify: "pass",
          dependencyAudit: "pass",
          secretScan: "pass",
          forbiddenNamingScan: "pass",
          migrationReset: "pass",
        },
        { remediated: true },
      );
      expect(
        rehearsal.failures,
        JSON.stringify(rehearsal.postgresScale.scaleRehearsal, null, 2),
      ).toEqual([]);
      expect(rehearsal.status).toBe("pass");
      expect(closure.verdict).toBe(STAGE_4C_REMEDIATED_PASS_VERDICT);
      expect(closure.failures).toEqual([]);
    },
    1_800_000,
  );
});
