#!/usr/bin/env node

/**
 * Plan 1 v3 Phase 5.4 safety and behavior checks.
 *
 * This stage exercises existing unit/static contracts and the local RLS
 * boundary. It never resets a database, runs a migration, sends provider
 * traffic, or changes runtime.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { phase53SourceIdentity } from "./performance-plan-1-phase-5-3-layer-attribution.mjs";
import {
  redactionCheck,
  sha256File,
} from "./lib/performance-plan-1-phase-4-contract.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const vitestEntrypoint = join(appRoot, "node_modules", "vitest", "vitest.mjs");
const supabaseEntrypoint = join(appRoot, "node_modules", "supabase", "dist", "supabase.js");

export const PHASE_5_4_PLAN_REVISION = "plan1-final-v3";
export const PHASE_5_4_STAGE_ID = "5.4";
export const PHASE_5_4_EVIDENCE_SCHEMA_VERSION =
  "aiya-performance-plan1-v3-phase5-4-safety-behavior-evidence-v1";
export const PHASE_5_4_RUN_ID =
  "aiya-performance-plan1-phase5-4-safety-behavior-v3-20260917T192500000Z-7e539b27-1e6f-4c7c-91ac-1e5d6cf83ca4";
export const PHASE_5_4_INPUT_RUN_ID =
  "aiya-performance-plan1-phase5-3-layer-attribution-v3-20260917T190703732Z-380aeab1-c2ff-4dd5-a42c-54988706de3b";
export const PHASE_5_4_INPUT_EVIDENCE_PATH =
  `docs/AIYA_PERFORMANCE_PLAN_1_V3_${PHASE_5_4_INPUT_RUN_ID}_PHASE_5_3_LAYER_ATTRIBUTION_EVIDENCE.json`;

export const PHASE_5_4_FOCUSED_TEST_FILES = Object.freeze([
  "src/lib/auth-context.test.ts",
  "src/app/auth/callback/route.test.ts",
  "src/app/api/auth/password-login/route.test.ts",
  "src/lib/phase-84d-customer-auth.test.ts",
  "src/lib/app-state-store.test.ts",
  "src/lib/supabase-store.test.ts",
  "src/lib/phase-79c-scoped-client-mutation.test.ts",
  "src/lib/phase-85-stage-4b2-mutations.test.ts",
  "src/lib/phase-85-stage-4b2-state-merge.test.ts",
  "src/lib/phase-85-stage-5-shell-provider-state.test.ts",
  "src/lib/phase-85-stage-5-shell-authenticated-mutation.test.ts",
  "src/lib/phase-85-stage-5-shell-session.test.ts",
  "src/lib/phase-85-stage-5-shell-navigation.test.ts",
  "src/lib/phase-85-stage-5-shell-pwa.test.ts",
  "src/lib/phase-85-stage-5-shell-privacy-scan.test.ts",
  "src/lib/phase-85-stage-5-shell-migration-contract.test.ts",
  "src/lib/phase-85-stage-6-r1-mutation-idempotency.test.ts",
  "src/lib/public-surface-phase-6-pwa.test.ts",
  "src/lib/public-surface-phase-7-closure.test.ts",
  "src/lib/phase-83d-pwa-install-gate.test.ts",
  "src/lib/phase-85-stage-4d-billing-pwa.test.ts",
]);

export const PHASE_5_4_SOURCE_PATHS = Object.freeze([
  "app/scripts/performance-plan-1-phase-5-4-safety-behavior.mjs",
  "app/scripts/performance-plan-1-phase-5-4-safety-behavior.test.mjs",
  "app/src/lib/auth-context.ts",
  "app/src/lib/use-aiya-state.ts",
  "app/src/lib/app-state-store.ts",
  "app/src/lib/supabase-store.ts",
  "app/src/lib/phase-85-stage-4b2-state-merge.ts",
  "app/src/lib/phase-85-stage-4b2-mutations.ts",
  "app/src/lib/phase-85-stage-5-shell-provider-state.ts",
  "app/src/lib/phase-85-stage-5-shell-authenticated-mutation.ts",
  "app/src/lib/phase-85-stage-5-shell-pwa.ts",
  "app/src/lib/phase-85-stage-5-shell-session-policy.ts",
  "app/src/app/api/app-state/route.ts",
  "app/src/app/api/shell/bootstrap/route.ts",
  "app/public/sw.js",
  ...PHASE_5_4_FOCUSED_TEST_FILES.map((path) => `app/${path}`),
  "app/src/lib/supabase-rls.integration.test.ts",
  PHASE_5_4_INPUT_EVIDENCE_PATH,
]);

const STATIC_CONTRACT_CHECKS = Object.freeze([
  {
    checkId: "authenticated_app_state_scope",
    path: "app/src/app/api/app-state/route.ts",
    requiredTokens: ["resolveAppTenantContext", "requireCapability"],
  },
  {
    checkId: "single_flight_hydration_guard",
    path: "app/src/lib/use-aiya-state.ts",
    requiredTokens: ["hydrationInFlightRef", "if (hydrationInFlightRef.current)", ".finally(()"],
  },
  {
    checkId: "stale_bootstrap_sequence_guard",
    path: "app/src/lib/phase-85-stage-5-shell-provider-state.ts",
    requiredTokens: ["action.sequence < state.requestSequence"],
  },
  {
    checkId: "mutation_revision_boundary",
    path: "app/src/lib/supabase-store.ts",
    requiredTokens: [
      "expectedConversationRevision",
      "reactivation_conflict_conversation_revision",
      "throw new AppDomainError(409",
    ],
  },
  {
    checkId: "network_only_privacy_lock",
    path: "app/public/sw.js",
    requiredTokens: ["request.mode === \"navigate\"", "networkOnly"],
    forbiddenTokens: ["BackgroundSync", "periodicsync", "syncmanager"],
  },
]);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function safeErrorClass(error) {
  return error?.name || "Error";
}

function parseVitestSummary(output) {
  const normalized = String(output ?? "").replace(/\u001b\[[0-9;]*m/g, "");
  const fileMatch = normalized.match(/Test Files\s+(?:(\d+)\s+passed)?(?:,?\s*(\d+)\s+failed)?(?:,?\s*(\d+)\s+skipped)?\s*\((\d+)\)/);
  const testMatch = normalized.match(/Tests\s+(?:(\d+)\s+passed)?(?:,?\s*(\d+)\s+failed)?(?:,?\s*(\d+)\s+skipped)?\s*\((\d+)\)/);
  return {
    testFilesPassed: Number(fileMatch?.[1] ?? 0),
    testFilesFailed: Number(fileMatch?.[2] ?? 0),
    testFilesSkipped: Number(fileMatch?.[3] ?? 0),
    testFilesTotal: Number(fileMatch?.[4] ?? 0),
    testsPassed: Number(testMatch?.[1] ?? 0),
    testsFailed: Number(testMatch?.[2] ?? 0),
    testsSkipped: Number(testMatch?.[3] ?? 0),
    testsTotal: Number(testMatch?.[4] ?? 0),
  };
}

function parseStatusEnv(output) {
  const values = {};
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function readLocalSupabaseCredentials() {
  if (!existsSync(supabaseEntrypoint)) {
    return { status: "BLOCKED", reason: "supabase_cli_missing" };
  }

  const result = spawnSync(process.execPath, [supabaseEntrypoint, "status", "-o", "env"], {
    cwd: appRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
  const values = parseStatusEnv(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  const apiUrl = values.API_URL ?? null;
  const anonKey = values.ANON_KEY ?? null;
  const serviceRoleKey = values.SERVICE_ROLE_KEY ?? null;
  if (result.status !== 0 || !apiUrl || !anonKey || !serviceRoleKey) {
    return {
      status: "BLOCKED",
      reason: "local_supabase_credentials_unavailable",
      exitCode: result.status,
      spawnErrorClass: result.error ? safeErrorClass(result.error) : null,
    };
  }
  return { status: "PASS", apiUrl, anonKey, serviceRoleKey };
}

export function runFocusedSafetyTests() {
  if (!existsSync(vitestEntrypoint)) {
    return {
      status: "BLOCKED",
      reason: "vitest_binary_missing",
      exitCode: null,
      ...parseVitestSummary(""),
      testFiles: PHASE_5_4_FOCUSED_TEST_FILES,
    };
  }

  const args = [
    "run",
    ...PHASE_5_4_FOCUSED_TEST_FILES,
    "--exclude",
    "src/lib/supabase-rls.integration.test.ts",
    "--no-file-parallelism",
    "--maxWorkers=1",
    "--reporter=default",
  ];
  const result = spawnSync(process.execPath, [vitestEntrypoint, ...args], {
    cwd: appRoot,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const summary = parseVitestSummary(output);
  const status = result.status === 0 &&
    summary.testFilesPassed === PHASE_5_4_FOCUSED_TEST_FILES.length &&
    summary.testFilesFailed === 0 &&
    summary.testFilesSkipped === 0 &&
    summary.testsPassed > 0 &&
    summary.testsFailed === 0 &&
    summary.testsSkipped === 0
    ? "PASS"
    : "BLOCKED";
  return {
    status,
    reason: status === "PASS" ? null : "focused_safety_test_failure_or_incomplete_summary",
    exitCode: result.status,
    spawnErrorClass: result.error ? safeErrorClass(result.error) : null,
    ...summary,
    testFiles: PHASE_5_4_FOCUSED_TEST_FILES,
  };
}

export async function runLocalRlsIntegration() {
  const endpoint = "http://127.0.0.1:54321/rest/v1/";
  let httpStatus = null;
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(2000) });
    httpStatus = response.status;
  } catch (error) {
    return {
      status: "BLOCKED",
      endpoint: "127.0.0.1:54321",
      httpStatus: null,
      reason: "local_supabase_unavailable",
      errorClass: safeErrorClass(error),
      integrationTestStarted: false,
    };
  }

  const credentials = readLocalSupabaseCredentials();
  if (credentials.status !== "PASS") {
    return {
      status: "BLOCKED",
      endpoint: "127.0.0.1:54321",
      httpStatus,
      reason: credentials.reason,
      integrationTestStarted: false,
      supabaseStatusExitCode: credentials.exitCode ?? null,
      spawnErrorClass: credentials.spawnErrorClass ?? null,
    };
  }

  if (!existsSync(vitestEntrypoint)) {
    return {
      status: "BLOCKED",
      endpoint: "127.0.0.1:54321",
      httpStatus,
      reason: "vitest_binary_missing",
      integrationTestStarted: false,
    };
  }

  const result = spawnSync(process.execPath, [
    vitestEntrypoint,
    "run",
    "src/lib/supabase-rls.integration.test.ts",
    "--no-file-parallelism",
    "--maxWorkers=1",
    "--reporter=default",
  ], {
    cwd: appRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      NEXT_PUBLIC_SUPABASE_URL: credentials.apiUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: credentials.anonKey,
      SUPABASE_URL: credentials.apiUrl,
      SUPABASE_SERVICE_ROLE_KEY: credentials.serviceRoleKey,
      MANU_ALLOW_REMOTE_RLS_TESTS: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 80 * 1024 * 1024,
  });
  const summary = parseVitestSummary(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  const started = !result.error;
  const passed = started && result.status === 0 &&
    summary.testFilesPassed === 1 &&
    summary.testFilesFailed === 0 &&
    summary.testFilesSkipped === 0 &&
    summary.testsPassed > 0 &&
    summary.testsFailed === 0 &&
    summary.testsSkipped === 0;
  return {
    status: passed ? "PASS" : "BLOCKED",
    endpoint: "127.0.0.1:54321",
    httpStatus,
    integrationTestStarted: started,
    integrationTestStatus: passed ? "PASS" : "BLOCKED",
    integrationTestFile: "src/lib/supabase-rls.integration.test.ts",
    integrationTestExitCode: result.status,
    spawnErrorClass: result.error ? safeErrorClass(result.error) : null,
    ...summary,
    reason: passed ? null : "local_rls_integration_suite_failed_or_incomplete_summary",
  };
}

export const probeLocalSupabase = runLocalRlsIntegration;

function staticBoundaryChecks() {
  return STATIC_CONTRACT_CHECKS.map(({ checkId, path, requiredTokens, forbiddenTokens = [] }) => {
    const source = existsSync(join(repoRoot, path)) ? readFileSync(join(repoRoot, path), "utf8") : "";
    const missingTokens = requiredTokens.filter((token) => !source.includes(token));
    const forbiddenMatches = forbiddenTokens.filter((token) => source.includes(token));
    return {
      checkId,
      path,
      status: missingTokens.length === 0 && forbiddenMatches.length === 0 ? "PASS" : "BLOCKED",
      missingTokens,
      forbiddenMatches,
    };
  });
}

export function phase54V3EvidencePath(runId) {
  const safeRunId = String(runId ?? "");
  if (!/^aiya-performance-plan1-phase5-4-safety-behavior-v3-[A-Za-z0-9._-]+$/.test(safeRunId)) {
    throw new Error("phase54_v3_run_id_invalid");
  }
  const outputPath = join(
    repoRoot,
    "docs",
    `AIYA_PERFORMANCE_PLAN_1_V3_${safeRunId}_PHASE_5_4_SAFETY_BEHAVIOR_EVIDENCE.json`,
  );
  if (relative(repoRoot, outputPath).startsWith("..")) {
    throw new Error("phase54_v3_evidence_path_invalid");
  }
  return outputPath;
}

export function phase54SourceIdentity() {
  const base = phase53SourceIdentity();
  const existing = new Set((base.sourceFiles ?? []).map((item) => item.path));
  const additions = PHASE_5_4_SOURCE_PATHS
    .filter((path) => !existing.has(path))
    .map((path) => ({ path, sha256: sha256File(join(repoRoot, path)) }));
  return {
    ...base,
    sourceFiles: [...(base.sourceFiles ?? []), ...additions],
  };
}

export function phase54PrerequisiteCheck(
  inputEvidence = readJson(join(repoRoot, PHASE_5_4_INPUT_EVIDENCE_PATH)),
) {
  const failures = [];
  if (!inputEvidence) failures.push("phase53_input_evidence_missing_or_invalid_json");
  if (inputEvidence?.planRevision !== PHASE_5_4_PLAN_REVISION) failures.push("phase53_plan_revision_invalid");
  if (inputEvidence?.stageId !== "5.3") failures.push("phase53_stage_id_invalid");
  if (inputEvidence?.runId !== PHASE_5_4_INPUT_RUN_ID) failures.push("phase53_run_id_mismatch");
  if (inputEvidence?.status !== "COMPLETE") failures.push("phase53_not_complete");
  if (inputEvidence?.outcome !== "LAYER_ATTRIBUTION_INCONCLUSIVE") failures.push("phase53_outcome_invalid");
  if (inputEvidence?.attribution?.causeConfirmed !== false) failures.push("phase53_cause_claim_present");
  if (inputEvidence?.findingDispositionChanges?.length !== 0) failures.push("phase53_finding_change_present");
  if (inputEvidence?.evidenceIntegrity?.status !== "PASS") failures.push("phase53_evidence_integrity_invalid");
  if (inputEvidence?.checkpointReconciliation?.hashChainRead !== true) failures.push("phase53_checkpoint_not_read");
  if (inputEvidence?.checkpointReconciliation?.status !== "COMPLETE") failures.push("phase53_checkpoint_not_complete");
  return {
    status: failures.length === 0 ? "PASS" : "BLOCKED",
    failures,
    inputEvidence: {
      runId: inputEvidence?.runId ?? null,
      status: inputEvidence?.status ?? null,
      outcome: inputEvidence?.outcome ?? null,
      sha256: sha256File(join(repoRoot, PHASE_5_4_INPUT_EVIDENCE_PATH)),
      checkpointReconciliation: inputEvidence?.checkpointReconciliation ?? null,
    },
  };
}

function rlsRuntimePass(rlsProbe) {
  return rlsProbe?.status === "PASS" &&
    rlsProbe.integrationTestStarted === true &&
    rlsProbe.integrationTestStatus === "PASS" &&
    rlsProbe.testFilesPassed === 1 &&
    rlsProbe.testFilesFailed === 0 &&
    rlsProbe.testFilesSkipped === 0 &&
    rlsProbe.testsPassed > 0 &&
    rlsProbe.testsFailed === 0 &&
    rlsProbe.testsSkipped === 0;
}

function buildCheckResults(testExecution, rlsProbe, staticChecks) {
  const unitPass = testExecution.status === "PASS" && staticChecks.every((check) => check.status === "PASS");
  const rlsPass = rlsRuntimePass(rlsProbe);
  const unitBasis = {
    testFiles: testExecution.testFiles,
    testFilesPassed: testExecution.testFilesPassed,
    testsPassed: testExecution.testsPassed,
    staticChecks: staticChecks.map(({ checkId, status }) => ({ checkId, status })),
  };
  return [
    {
      checkId: "auth_login_logout_session",
      status: unitPass ? "PASS" : "BLOCKED",
      basis: "Auth route, callback, session-lock, and logout policy contracts passed in the focused local suite.",
      ...unitBasis,
    },
    {
      checkId: "tenant_context_role_capability",
      status: unitPass ? "PASS" : "BLOCKED",
      basis: "Tenant membership resolution, role capability denial, assigned scope, and authenticated app-state boundaries passed in unit/static checks.",
      ...unitBasis,
    },
    {
      checkId: "state_freshness_late_response_single_flight",
      status: unitPass ? "PASS" : "BLOCKED",
      basis: "Hydration single-flight and stale bootstrap sequence guards are present and their focused reducer/state contracts passed.",
      ...unitBasis,
    },
    {
      checkId: "mutation_revision_conflict_idempotency",
      status: unitPass ? "PASS" : "BLOCKED",
      basis: "Scoped mutation, revision conflict, bounded merge, and idempotency contracts passed without broad reload or offline queue behavior.",
      ...unitBasis,
    },
    {
      checkId: "offline_privacy_reconnect",
      status: unitPass ? "PASS" : "BLOCKED",
      basis: "Offline privacy-lock, network-only navigation/API, session foreground policy, and reconnect-related shell contracts passed locally.",
      ...unitBasis,
    },
    {
      checkId: "cross_user_isolation_rls_runtime",
      status: rlsPass ? "PASS" : "BLOCKED",
      required: true,
      basis: rlsPass
        ? "The local Supabase cross-user/RLS integration suite passed with no failed or skipped tests."
        : "The real RLS/cross-user integration boundary is not verified until the local integration suite passes without skips.",
      environment: rlsProbe,
      unitCoverage: "supabase-store.test.ts and static RLS contracts passed; these do not replace runtime RLS evidence.",
    },
  ];
}

export function buildPhase54Evidence({
  inputEvidence = readJson(join(repoRoot, PHASE_5_4_INPUT_EVIDENCE_PATH)),
  inputEvidencePath = PHASE_5_4_INPUT_EVIDENCE_PATH,
  runId = PHASE_5_4_RUN_ID,
  generatedAt = new Date().toISOString(),
  sourceIdentity = phase54SourceIdentity(),
  testExecution = {
    status: "BLOCKED",
    reason: "not_run",
    testFiles: PHASE_5_4_FOCUSED_TEST_FILES,
    testFilesPassed: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
  },
  rlsProbe = {
    status: "BLOCKED",
    endpoint: "127.0.0.1:54321",
    reason: "not_run",
    integrationTestStarted: false,
  },
} = {}) {
  const prerequisite = phase54PrerequisiteCheck(inputEvidence);
  const staticChecks = staticBoundaryChecks();
  const checkResults = buildCheckResults(testExecution, rlsProbe, staticChecks);
  const status = prerequisite.status === "PASS" &&
    testExecution.status === "PASS" &&
    staticChecks.every((check) => check.status === "PASS") &&
    checkResults.every((check) => check.status === "PASS")
    ? "COMPLETE"
    : "BLOCKED";
  const outcome = status === "COMPLETE"
    ? "SAFETY_BEHAVIOR_CHECKS_COMPLETE"
    : "SAFETY_BEHAVIOR_CHECKS_BLOCKED";
  const evidence = {
    schemaVersion: PHASE_5_4_EVIDENCE_SCHEMA_VERSION,
    planRevision: PHASE_5_4_PLAN_REVISION,
    phase: "5",
    stage: PHASE_5_4_STAGE_ID,
    stageId: PHASE_5_4_STAGE_ID,
    runId,
    generatedAt,
    status,
    outcome,
    productionDecision: "NO-GO",
    executionScope: {
      purpose: "Verify safety and behavior contracts affected by the Phase 5.2 state/hydration investigation.",
      environment: "local_unit_and_static; local_rls_runtime_boundary",
      analysisOnly: true,
      inputExperimentReused: true,
      newMeasurementStarted: false,
      officialMeasurementStarted: false,
      newCausalExperimentStarted: false,
      runtimeChangeAcceptedAsFix: false,
      databaseResetStarted: false,
      migrationStarted: false,
      providerTrafficStarted: false,
      externalOperations: [],
      preservedExistingChanges: true,
      countedAsOfficialSample: false,
    },
    activeContract: {
      path: "docs/AIYA_PERFORMANCE_PLAN_1_ACTION_PLAN.md",
      revision: PHASE_5_4_PLAN_REVISION,
      historicalContentUsedAsInstruction: false,
      completedPrerequisites: [
        "4.7 COMPLETE / DIAGNOSIS_BLOCKED",
        "5.1 COMPLETE / HYPOTHESES_PRE_REGISTERED",
        "5.2 COMPLETE / REPEATABLE_PROVISIONAL_EFFECT",
        "5.3 COMPLETE / LAYER_ATTRIBUTION_INCONCLUSIVE",
      ],
      currentStage: PHASE_5_4_STAGE_ID,
      nextEligibleStage: status === "COMPLETE" ? "5.5" : "5.4 retry after local RLS boundary is available",
    },
    sourceIdentity,
    inputAttribution: {
      path: inputEvidencePath,
      runId: inputEvidence?.runId ?? null,
      status: inputEvidence?.status ?? null,
      outcome: inputEvidence?.outcome ?? null,
      sha256: prerequisite.inputEvidence.sha256,
      checkpointReconciliation: inputEvidence?.checkpointReconciliation ?? null,
    },
    prerequisite,
    testExecution,
    staticContractChecks: staticChecks,
    localSupabaseProbe: rlsProbe,
    checkResults,
    blockers: status === "COMPLETE" ? [] : [
      ...(prerequisite.failures ?? []),
      ...(testExecution.status === "PASS" ? [] : ["focused_safety_tests_not_passed"]),
      ...(rlsRuntimePass(rlsProbe)
        ? []
        : ["cross_user_rls_runtime_not_verified"]),
    ],
    findingDispositionChanges: [],
    attribution: {
      status: "NO_CAUSE_CONFIRMED",
      causeConfirmed: false,
      findingDispositionChanged: false,
    },
    deferredToLaterStages: [
      status === "COMPLETE"
        ? "5.5 remaining candidate loop is eligible after this check set."
        : "Retry the blocked local RLS/cross-user boundary before 5.5; do not promote this stage from unit tests alone.",
      "No production, hosted live-data, provider, billing, WhatsApp, or Z.ai operation was started.",
      "Plan 2 remains locked until a finding reaches the required causal disposition.",
    ],
    constraints: [
      "No offline health-data cache or mutation queue was added or enabled.",
      "Unit/static tenant tests do not substitute for runtime RLS isolation.",
      "A failed or unavailable environment is not converted to PASS by retry or omission.",
      "Credentials, cookies, tokens, raw bodies, prompts, clinical content, and device serials are excluded.",
      "Production remains NO-GO.",
    ],
    evidenceIntegrity: {
      status: "PASS",
      redactionCheck: "PASS",
      sourceIdentityPass: sourceIdentity.diffCheck === "PASS",
      inputEvidenceParsed: prerequisite.status === "PASS",
      inputEvidenceIntegrityPass: inputEvidence?.evidenceIntegrity?.status === "PASS",
      inputCheckpointHashChain: inputEvidence?.checkpointReconciliation?.hashChainRead === true,
      newMeasurementStarted: false,
      officialMeasurementStarted: false,
      newCausalExperimentStarted: false,
      databaseResetStarted: false,
      migrationStarted: false,
      historicalEvidenceRewritten: false,
      runtimeFixAccepted: false,
      findingManifestChanged: false,
    },
    closure: {
      status,
      outcome,
      phase4Closed: true,
      plan1Closed: false,
      newMeasurementStarted: false,
      newCausalExperimentStarted: false,
      runtimeFixAccepted: false,
      nextAction: status === "COMPLETE"
        ? "Proceed to 5.5 remaining candidate loop; do not accept a fix from safety checks alone."
        : "Restore local Supabase/RLS availability and rerun only the blocked cross-user boundary before proceeding to 5.5.",
    },
    checkpointReconciliation: {
      status: inputEvidence?.checkpointReconciliation?.status ?? "NOT_STARTED",
      source: "phase5-3-input-checkpoint-read-only",
      runId: inputEvidence?.checkpointReconciliation?.runId ?? null,
      eventCount: inputEvidence?.checkpointReconciliation?.eventCount ?? 0,
      hashChainRead: inputEvidence?.checkpointReconciliation?.hashChainRead === true,
      lastEventType: inputEvidence?.checkpointReconciliation?.lastEventType ?? null,
      newCheckpointCreated: false,
    },
  };
  const redaction = redactionCheck(evidence);
  evidence.evidenceIntegrity.redactionCheck = redaction.status ? "PASS" : "FAIL";
  evidence.evidenceIntegrity.status = evidence.evidenceIntegrity.redactionCheck === "PASS" &&
    evidence.evidenceIntegrity.sourceIdentityPass &&
    evidence.evidenceIntegrity.inputEvidenceIntegrityPass
    ? "PASS"
    : "BLOCKED";
  return evidence;
}

function parseArguments(argv) {
  const options = {
    descriptor: false,
    run: false,
    writeEvidence: false,
    runId: PHASE_5_4_RUN_ID,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--write-evidence") options.writeEvidence = true;
    else if (arg === "--run-id") options.runId = argv[++index];
    else throw new Error(`phase54_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify({
      phase: "5",
      stage: PHASE_5_4_STAGE_ID,
      planRevision: PHASE_5_4_PLAN_REVISION,
      inputEvidence: PHASE_5_4_INPUT_EVIDENCE_PATH,
      analysisOnly: true,
      newMeasurementStarted: false,
      focusedTestFiles: PHASE_5_4_FOCUSED_TEST_FILES,
      checks: [
        "auth_login_logout_session",
        "tenant_context_role_capability",
        "state_freshness_late_response_single_flight",
        "mutation_revision_conflict_idempotency",
        "offline_privacy_reconnect",
        "cross_user_isolation_rls_runtime",
      ],
    }, null, 2)}\n`);
    return;
  }
  if (!options.run) {
    process.stdout.write("Phase 5.4 safety and behavior checks ready. Use --descriptor or explicit --run.\n");
    return;
  }
  const testExecution = runFocusedSafetyTests();
  const rlsProbe = await runLocalRlsIntegration();
  const evidence = buildPhase54Evidence({ testExecution, rlsProbe, runId: options.runId });
  if (options.writeEvidence) {
    writeFileSync(phase54V3EvidencePath(options.runId), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
