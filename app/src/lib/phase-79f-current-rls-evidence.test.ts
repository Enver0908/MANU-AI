import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { buildOperationalHealthSnapshot } from "./operational-health";
import {
  PHASE_79F_RLS_SCOPE_REQUIREMENTS,
  buildPhase79fEvidenceFromRunResult,
  buildPhase79fPendingEvidence,
  evaluatePhase79fCurrentRlsEvidenceForHealth,
  evaluatePhase79fScopeManifestCoverage,
  isLocalSupabaseRlsConfigured,
  lifecycleRlsEvidenceIsAggregateOnly,
  parseVitestSummary,
  runPhase79fCurrentRlsEvidencePass,
} from "./phase-79f-current-rls-evidence";

describe("phase 79f current rls evidence", () => {
  it("covers the minimum Phase 79F RLS scope manifest", () => {
    const manifest = evaluatePhase79fScopeManifestCoverage();

    expect(manifest.requiredScopeCount).toBe(PHASE_79F_RLS_SCOPE_REQUIREMENTS.length);
    expect(manifest.uncoveredScopeIds).toEqual([]);
    expect(manifest.coveredScopeCount).toBe(PHASE_79F_RLS_SCOPE_REQUIREMENTS.length);
    expect(PHASE_79F_RLS_SCOPE_REQUIREMENTS.map((item) => item.id)).toEqual([
      "channel_deliveries",
      "channel_adapter_rollback_controls",
      "inbound_quarantines",
      "internal_copilot_records",
      "client_removal_anonymization_rows",
      "assistant_viewer_auditor_boundaries",
    ]);
  });

  it("records pending evidence when local Supabase is unavailable", () => {
    const evidence = buildPhase79fPendingEvidence({ localSupabaseAvailable: false, runAttempted: false });

    expect(evidence.status).toBe("pending");
    expect(evidence.r406CurrentReRunStatus).toBe("pending");
    expect(evidence.r406Narrative).toContain("current migration/RLS re-run pending");
    expect(evidence.r406Narrative).toContain("Phase 50/52 baseline");
    expect(evidence.failures).toContain("local_supabase_unavailable");
    expect(evidence.failures).toContain("current_migration_rls_re_run_pending");
  });

  it("parses vitest pass output into pass evidence", () => {
    const evidence = buildPhase79fEvidenceFromRunResult({
      exitCode: 0,
      output: "Tests  20 passed (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    });

    expect(evidence.status).toBe("pass");
    expect(evidence.r406CurrentReRunStatus).toBe("pass");
    expect(evidence.testsPassed).toBe(20);
    expect(evidence.testsFailed).toBe(0);
    expect(evidence.failures).toEqual([]);
  });

  it("parses vitest skipped output into pending evidence", () => {
    const evidence = buildPhase79fEvidenceFromRunResult({
      exitCode: 0,
      output: "Test Files  1 skipped (1)\nTests  20 skipped (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    });

    expect(evidence.status).toBe("pending");
    expect(evidence.failures).toContain("rls_integration_suite_skipped");
  });

  it("parses vitest failure output into fail evidence", () => {
    const evidence = buildPhase79fEvidenceFromRunResult({
      exitCode: 1,
      output: "Tests  1 failed | 19 passed (20)",
      localSupabaseAvailable: true,
      runAttempted: true,
    });

    expect(evidence.status).toBe("fail");
    expect(evidence.r406CurrentReRunStatus).toBe("fail");
    expect(evidence.testsFailed).toBe(1);
    expect(evidence.failures).toContain("rls_integration_tests_failed");
  });

  it("keeps RLS evidence aggregate-only and exposes pending status in operational health", () => {
    const evidence = evaluatePhase79fCurrentRlsEvidenceForHealth();
    const health = buildOperationalHealthSnapshot(createInitialState(), {
      phase79fCurrentRlsEvidence: evidence,
    });

    expect(lifecycleRlsEvidenceIsAggregateOnly(evidence)).toBe(true);
    expect(health.phase79CurrentRlsEvidenceStatus).toBe("pending");
    expect(health.phase79CurrentRlsEvidenceReady).toBe(false);
    expect(health.phase79R406CurrentReRunStatus).toBe("pending");
    expect(JSON.stringify(health)).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|manu-rls-test-password/);
  });

  it("detects local Supabase configuration from env shape", () => {
    expect(
      isLocalSupabaseRlsConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toBe(true);
    expect(
      isLocalSupabaseRlsConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toBe(false);
  });

  it("runs npm test:rls only when local Supabase is configured", () => {
    const evidence = runPhase79fCurrentRlsEvidencePass({
      env: {},
      cwd: process.cwd(),
    });

    expect(evidence.runAttempted).toBe(false);
    expect(evidence.status).toBe("pending");
  });

  it("parses mixed vitest summaries", () => {
    expect(parseVitestSummary("Tests  2 failed | 18 passed (20)")).toEqual({
      failed: 2,
      passed: 18,
      skipped: 0,
      total: 20,
    });
  });
});
