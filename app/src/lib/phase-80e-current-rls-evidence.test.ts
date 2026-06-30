import { describe, expect, it } from "vitest";
import {
  buildPhase80eCurrentRlsEvidenceReport,
  buildPhase80eR406Narrative,
} from "./phase-80e-current-rls-evidence";
import {
  buildPhase79fEvidenceFromRunResult,
  buildPhase79fPendingEvidence,
} from "./phase-79f-current-rls-evidence";

const NOW = "2026-06-30T12:00:00.000Z";

describe("phase 80e current rls evidence", () => {
  it("records current re-run complete when RLS integration tests pass", () => {
    const evidence = buildPhase79fEvidenceFromRunResult({
      exitCode: 0,
      output: "Tests  20 passed (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    });
    const report = buildPhase80eCurrentRlsEvidenceReport({ evidence, generatedAt: NOW, runAttempted: true });

    expect(report.evidence.status).toBe("pass");
    expect(report.r406NarrativeForPhase80).toContain("re-run complete");
    expect(report.closesLaunchGate).toBe(false);
    expect(report.launchGateImpact).toBe("readiness_evidence_only");
  });

  it("keeps pending R-406 narrative when local Supabase is unavailable", () => {
    const evidence = buildPhase79fPendingEvidence({
      localSupabaseAvailable: false,
      runAttempted: true,
      failures: ["local_supabase_unavailable", "rls_integration_suite_skipped"],
    });
    const narrative = buildPhase80eR406Narrative(evidence);

    expect(evidence.status).toBe("pending");
    expect(narrative).toContain("Phase 50/52 baseline");
    expect(narrative).toContain("re-run pending");
    expect(narrative).not.toContain("re-run complete");
  });

  it("records skipped RLS suite output as pending evidence", () => {
    const evidence = buildPhase79fEvidenceFromRunResult({
      exitCode: 0,
      output: "Test Files  1 skipped (1)\nTests  20 skipped (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    });
    const report = buildPhase80eCurrentRlsEvidenceReport({ evidence, generatedAt: NOW, runAttempted: true });

    expect(report.evidence.status).toBe("pending");
    expect(report.evidence.failures).toContain("rls_integration_suite_skipped");
    expect(report.r406NarrativeForPhase80).toContain("re-run pending");
  });

  it("never closes a launch gate from RLS evidence alone", () => {
    const passReport = buildPhase80eCurrentRlsEvidenceReport({
      evidence: buildPhase79fEvidenceFromRunResult({
        exitCode: 0,
        output: "Tests  20 passed (20)",
        localSupabaseAvailable: true,
        runAttempted: true,
      }),
      generatedAt: NOW,
    });

    expect(passReport.closesLaunchGate).toBe(false);
  });

  it("records pending evidence after attempted rerun without local Supabase configuration", () => {
    const report = buildPhase80eCurrentRlsEvidenceReport({
      evidence: buildPhase79fPendingEvidence({
        localSupabaseAvailable: false,
        runAttempted: true,
        failures: ["local_supabase_unavailable", "rls_integration_suite_skipped"],
      }),
      generatedAt: NOW,
      runAttempted: true,
    });

    expect(report.runAttempted).toBe(true);
    expect(report.evidence.status).toBe("pending");
    expect(report.closesLaunchGate).toBe(false);
  });
});
