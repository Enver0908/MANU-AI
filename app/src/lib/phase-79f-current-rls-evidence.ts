import { spawnSync } from "node:child_process";

export const PHASE_79F_VERSION = "phase-79f-current-rls-evidence-v0.1.0";

export const PHASE_79F_RLS_INTEGRATION_TEST_FILE = "supabase-rls.integration.test.ts";

export const PHASE_79F_RLS_SCOPE_REQUIREMENTS = [
  {
    id: "channel_deliveries",
    table: "channel_deliveries",
    integrationTests: [
      "allows a tenant member to read only their tenant rows",
      "blocks a user without membership from tenant data",
      "blocks auditor access to raw client, message, AI, handoff, risk, and copilot tables",
    ],
  },
  {
    id: "channel_adapter_rollback_controls",
    table: "channel_adapter_rollback_controls",
    integrationTests: [
      "allows a tenant member to read only their tenant rows",
      "blocks a user without membership from tenant data",
    ],
  },
  {
    id: "inbound_quarantines",
    table: "inbound_quarantines",
    integrationTests: [
      "allows a tenant member to read only their tenant rows",
      "enforces assigned assistant read-only access",
      "stores Supabase-backed group quarantines without client records or AI artifacts",
    ],
  },
  {
    id: "internal_copilot_records",
    table: "internal_copilot_messages",
    integrationTests: [
      "blocks auditor access to raw client, message, AI, handoff, risk, and copilot tables",
      "scopes internal copilot records to owner/admin or the current dietitian",
    ],
  },
  {
    id: "client_removal_anonymization_rows",
    table: "data_requests",
    integrationTests: [
      "allows a tenant member to read only their tenant rows",
      "blocks a user without membership from tenant data",
      "rejects cross-tenant writes through the anon client",
    ],
  },
  {
    id: "assistant_viewer_auditor_boundaries",
    table: "client_assignments",
    integrationTests: [
      "enforces assigned assistant read-only access",
      "enforces viewer read-only and care-team write assignment levels",
      "blocks auditor access to raw client, message, AI, handoff, risk, and copilot tables",
    ],
  },
] as const;

export type Phase79RlsScopeId = (typeof PHASE_79F_RLS_SCOPE_REQUIREMENTS)[number]["id"];

export type Phase79CurrentRlsEvidenceStatus = "pass" | "fail" | "pending";

export type Phase79CurrentRlsEvidence = {
  version: string;
  status: Phase79CurrentRlsEvidenceStatus;
  localSupabaseAvailable: boolean;
  runAttempted: boolean;
  integrationTestFile: typeof PHASE_79F_RLS_INTEGRATION_TEST_FILE;
  requiredScopeCount: number;
  coveredScopeCount: number;
  uncoveredScopeIds: Phase79RlsScopeId[];
  testsPassed: number | null;
  testsFailed: number | null;
  testsSkipped: number | null;
  r406BaselineMitigation: "phase_50_52_local_rls_mitigated";
  r406CurrentReRunStatus: Phase79CurrentRlsEvidenceStatus;
  r406Narrative: string;
  aggregateEvidenceOnly: boolean;
  failures: string[];
};

const RAW_EVIDENCE_PATTERNS =
  /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|manu-rls-test-password|rls-member@manu\.local/i;

export function isLocalSupabaseRlsConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const allowRemoteRlsTests = env.MANU_ALLOW_REMOTE_RLS_TESTS === "true";
  const isLocalSupabase =
    supabaseUrl?.startsWith("http://127.0.0.1:") || supabaseUrl?.startsWith("http://localhost:");
  return Boolean(
    supabaseUrl && anonKey && serviceRoleKey && (isLocalSupabase || allowRemoteRlsTests),
  );
}

export function evaluatePhase79fScopeManifestCoverage() {
  const uncoveredScopeIds: Phase79RlsScopeId[] = [];
  for (const requirement of PHASE_79F_RLS_SCOPE_REQUIREMENTS) {
    const integrationTests: readonly string[] = requirement.integrationTests;
    if (integrationTests.length === 0) {
      uncoveredScopeIds.push(requirement.id);
    }
  }
  return {
    requiredScopeCount: PHASE_79F_RLS_SCOPE_REQUIREMENTS.length,
    coveredScopeCount: PHASE_79F_RLS_SCOPE_REQUIREMENTS.length - uncoveredScopeIds.length,
    uncoveredScopeIds,
  };
}

export function parseVitestSummary(output: string) {
  const pipeSummary = output.match(
    /Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(?:(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?\s+\((\d+)\))/,
  );
  if (pipeSummary) {
    return {
      failed: Number(pipeSummary[1] || 0),
      passed: Number(pipeSummary[2] || 0),
      skipped: Number(pipeSummary[3] || 0),
      total: Number(pipeSummary[4] || 0),
    };
  }

  const skippedOnly = output.match(/Tests\s+(\d+)\s+skipped\s+\((\d+)\)/);
  if (skippedOnly) {
    return {
      failed: 0,
      passed: 0,
      skipped: Number(skippedOnly[1] || 0),
      total: Number(skippedOnly[2] || 0),
    };
  }

  const passedOnly = output.match(/Tests\s+(\d+)\s+passed\s+\((\d+)\)/);
  if (passedOnly) {
    return {
      failed: 0,
      passed: Number(passedOnly[1] || 0),
      skipped: 0,
      total: Number(passedOnly[2] || 0),
    };
  }

  return { passed: 0, failed: 0, skipped: 0, total: 0 };
}

function buildR406Narrative(status: Phase79CurrentRlsEvidenceStatus, localSupabaseAvailable: boolean) {
  if (status === "pass") {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current migration/RLS re-run passed after Phase 76N and Phase 77AA-77AI postconditions.";
  }
  if (status === "fail") {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current migration/RLS re-run failed and must be remediated before production GO.";
  }
  if (localSupabaseAvailable) {
    return "Phase 50/52 baseline local RLS mitigation remains valid; current migration/RLS re-run pending execution.";
  }
  return "Phase 50/52 baseline local RLS mitigation remains valid; current migration/RLS re-run pending because local Supabase is unavailable.";
}

export function lifecycleRlsEvidenceIsAggregateOnly(evidence: Phase79CurrentRlsEvidence) {
  const serialized = JSON.stringify({
    version: evidence.version,
    status: evidence.status,
    localSupabaseAvailable: evidence.localSupabaseAvailable,
    runAttempted: evidence.runAttempted,
    integrationTestFile: evidence.integrationTestFile,
    requiredScopeCount: evidence.requiredScopeCount,
    coveredScopeCount: evidence.coveredScopeCount,
    uncoveredScopeIds: evidence.uncoveredScopeIds,
    testsPassed: evidence.testsPassed,
    testsFailed: evidence.testsFailed,
    testsSkipped: evidence.testsSkipped,
    r406BaselineMitigation: evidence.r406BaselineMitigation,
    r406CurrentReRunStatus: evidence.r406CurrentReRunStatus,
    r406Narrative: evidence.r406Narrative,
    failures: evidence.failures,
  });
  return !RAW_EVIDENCE_PATTERNS.test(serialized);
}

export function buildPhase79fPendingEvidence(options: {
  localSupabaseAvailable?: boolean;
  runAttempted?: boolean;
  failures?: string[];
} = {}): Phase79CurrentRlsEvidence {
  const manifest = evaluatePhase79fScopeManifestCoverage();
  const localSupabaseAvailable = options.localSupabaseAvailable ?? isLocalSupabaseRlsConfigured();
  const failures = [...(options.failures ?? [])];
  if (manifest.uncoveredScopeIds.length > 0) {
    failures.push("rls_scope_manifest_incomplete");
  }
  if (!localSupabaseAvailable) {
    failures.push("local_supabase_unavailable");
  }
  if (options.runAttempted !== true) {
    failures.push("current_migration_rls_re_run_pending");
  }

  const evidence: Phase79CurrentRlsEvidence = {
    version: PHASE_79F_VERSION,
    status: "pending",
    localSupabaseAvailable,
    runAttempted: options.runAttempted ?? false,
    integrationTestFile: PHASE_79F_RLS_INTEGRATION_TEST_FILE,
    requiredScopeCount: manifest.requiredScopeCount,
    coveredScopeCount: manifest.coveredScopeCount,
    uncoveredScopeIds: manifest.uncoveredScopeIds,
    testsPassed: null,
    testsFailed: null,
    testsSkipped: null,
    r406BaselineMitigation: "phase_50_52_local_rls_mitigated",
    r406CurrentReRunStatus: "pending",
    r406Narrative: buildR406Narrative("pending", localSupabaseAvailable),
    aggregateEvidenceOnly: true,
    failures,
  };
  evidence.aggregateEvidenceOnly = lifecycleRlsEvidenceIsAggregateOnly(evidence);
  return evidence;
}

export function buildPhase79fEvidenceFromRunResult(input: {
  exitCode: number;
  output: string;
  localSupabaseAvailable: boolean;
  runAttempted?: boolean;
}): Phase79CurrentRlsEvidence {
  const manifest = evaluatePhase79fScopeManifestCoverage();
  const summary = parseVitestSummary(input.output);
  const failures: string[] = [];

  if (manifest.uncoveredScopeIds.length > 0) {
    failures.push("rls_scope_manifest_incomplete");
  }

  if (!input.localSupabaseAvailable) {
    return buildPhase79fPendingEvidence({
      localSupabaseAvailable: false,
      runAttempted: input.runAttempted ?? false,
      failures,
    });
  }

  const suiteSkipped =
    summary.total > 0 && summary.skipped === summary.total && summary.passed === 0 && summary.failed === 0;
  if (suiteSkipped) {
    return buildPhase79fPendingEvidence({
      localSupabaseAvailable: false,
      runAttempted: input.runAttempted ?? true,
      failures: [...failures, "rls_integration_suite_skipped"],
    });
  }

  let status: Phase79CurrentRlsEvidenceStatus = "fail";
  if (input.exitCode === 0 && summary.failed === 0 && summary.passed > 0) {
    status = "pass";
  } else {
    if (summary.failed > 0) failures.push("rls_integration_tests_failed");
    if (input.exitCode !== 0) failures.push("rls_integration_exit_non_zero");
    if (summary.passed === 0) failures.push("rls_integration_no_passing_tests");
  }

  const evidence: Phase79CurrentRlsEvidence = {
    version: PHASE_79F_VERSION,
    status,
    localSupabaseAvailable: true,
    runAttempted: input.runAttempted ?? true,
    integrationTestFile: PHASE_79F_RLS_INTEGRATION_TEST_FILE,
    requiredScopeCount: manifest.requiredScopeCount,
    coveredScopeCount: manifest.coveredScopeCount,
    uncoveredScopeIds: manifest.uncoveredScopeIds,
    testsPassed: summary.passed,
    testsFailed: summary.failed,
    testsSkipped: summary.skipped,
    r406BaselineMitigation: "phase_50_52_local_rls_mitigated",
    r406CurrentReRunStatus: status,
    r406Narrative: buildR406Narrative(status, true),
    aggregateEvidenceOnly: true,
    failures,
  };
  evidence.aggregateEvidenceOnly = lifecycleRlsEvidenceIsAggregateOnly(evidence);
  return evidence;
}

export function runPhase79fCurrentRlsEvidencePass(options: {
  cwd?: string;
  env?: Record<string, string | undefined>;
} = {}): Phase79CurrentRlsEvidence {
  const env = options.env ?? process.env;
  const localSupabaseAvailable = isLocalSupabaseRlsConfigured(env);
  if (!localSupabaseAvailable) {
    return buildPhase79fPendingEvidence({ localSupabaseAvailable: false, runAttempted: false });
  }

  const result = spawnSync("npm", ["run", "test:rls"], {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    shell: process.platform === "win32",
    env: env as NodeJS.ProcessEnv,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return buildPhase79fEvidenceFromRunResult({
    exitCode: result.status ?? 1,
    output,
    localSupabaseAvailable: true,
    runAttempted: true,
  });
}

export function evaluatePhase79fCurrentRlsEvidenceForHealth(
  evidenceOverride?: Phase79CurrentRlsEvidence,
): Phase79CurrentRlsEvidence {
  if (evidenceOverride) {
    return evidenceOverride;
  }
  return buildPhase79fPendingEvidence();
}

export function buildPhase79fCurrentRlsHealthSignal(evidence: Phase79CurrentRlsEvidence) {
  return {
    phase79CurrentRlsEvidenceVersion: evidence.version,
    phase79CurrentRlsEvidenceStatus: evidence.status,
    phase79CurrentRlsEvidenceReady: evidence.status === "pass",
    phase79CurrentRlsScopeCoverageCount: evidence.coveredScopeCount,
    phase79CurrentRlsEvidenceFailures: evidence.failures,
    phase79R406CurrentReRunStatus: evidence.r406CurrentReRunStatus,
  };
}
