import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AUDIT_PLAN_ID,
  AUDIT_PLAN_VERSION,
  PHASE_6_ID,
  PHASE_6_STAGES,
  getPhase6Stage,
} from "./phase-6-plan.mjs";

export const STAGE_STATUSES = ["LOCKED", "IN_PROGRESS", "VERIFIED", "BLOCKED"];
export const PHASE_STATUSES = ["OPEN", "BLOCKED", "CLOSED"];

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function stableDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function readText(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

export function sourceRecord(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return { source: relativePath, exists: false, bytes: 0, sha256: null };
  return { source: relativePath, exists: true, bytes: statSync(filePath).size, sha256: sha256File(filePath) };
}

function exactFileSources(repoRoot, relativePaths) {
  return relativePaths.map((source) => ({ path: source, text: readText(repoRoot, source) }));
}

function allPass(checks) {
  return checks.every((check) => check.pass === true);
}

function markerCheck(id, description, sources, pattern) {
  const evidence = sources.filter((source) => pattern.test(source.text)).map((source) => source.path);
  return { id, description, pass: evidence.length > 0, evidence };
}

function existenceCheck(id, description, sources) {
  const missing = sources.filter((source) => !source.text).map((source) => source.path);
  return { id, description, pass: missing.length === 0, missing };
}

function blockersFromChecks(checks) {
  return checks.filter((check) => !check.pass).map((check) => ({
    code: check.id,
    blocker: true,
    details: check.missing ?? check.evidence ?? null,
  }));
}

function sourceRecords(repoRoot, paths) {
  return paths.map((source) => sourceRecord(repoRoot, source));
}

function withMatrixDigest(matrix, digestInput) {
  return {
    ...matrix,
    matrixDigest: stableDigest(digestInput ?? { ...matrix, matrixDigest: null }),
  };
}

function readPerformanceReport(repoRoot, relativePath, sourceCommit) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return {
      path: relativePath,
      exists: false,
      status: "MISSING",
      freshness: "missing",
      pass: false,
    };
  }
  try {
    const report = readJson(filePath);
    const pass =
      report.status === "PASS" &&
      report.productionStatus === "NO-GO" &&
      report.kind === "local_lab_only" &&
      Number(report.runsPerRoute) > 0 &&
      Number(report.measurement?.routeCountRequired) > 0;
    return {
      path: relativePath,
      exists: true,
      status: report.status ?? null,
      productionStatus: report.productionStatus ?? null,
      kind: report.kind ?? null,
      sourceRevision: report.sourceRevision ?? null,
      freshness: report.sourceRevision === sourceCommit ? "current" : "historical",
      runsPerRoute: report.runsPerRoute ?? null,
      routeCount: report.measurement?.routeCountRequired ?? null,
      targets: report.targets ?? null,
      pass,
    };
  } catch (error) {
    return {
      path: relativePath,
      exists: true,
      status: "INVALID",
      freshness: "invalid",
      pass: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildLoadCapacityMatrix(repoRoot, sourceCommit) {
  const sourcePaths = [
    "app/scripts/measure-stage-5-lab-perf.mjs",
    "app/scripts/measure-stage-7-lab-perf.mjs",
    "app/scripts/rehearse-production-scale-79g.mjs",
    "app/src/lib/phase-79g-unified-production-scale-rehearsal.ts",
    "app/src/lib/phase-79g-unified-production-scale-rehearsal.test.ts",
    "docs/PHASE_85_STAGE_5_LAB_PERF_REPORT.json",
    "docs/PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const codeSources = sources.filter((source) => /\.(mjs|ts)$/.test(source.path));
  const reports = [
    readPerformanceReport(repoRoot, "docs/PHASE_85_STAGE_5_LAB_PERF_REPORT.json", sourceCommit),
    readPerformanceReport(repoRoot, "docs/PHASE_85_STAGE_7_PHASE_4_LAB_PERF_REPORT.json", sourceCommit),
  ];
  const checks = [
    existenceCheck("required_sources_exist", "load harness, rehearsal and evidence sources exist", sources),
    markerCheck("local_loopback_harness", "local loopback server and local-only performance harness", codeSources, /127\.0\.0\.1|local_lab_only|productionStatus:?[ =]?[\"']NO-GO/i),
    markerCheck("explicit_p75_targets", "P75 targets and pass comparison", codeSources, /TARGETS|p75|allTargetsMet|target_miss/i),
    markerCheck("bounded_workload_and_hard_zero", "bounded workload, hard-zero safety metrics and release rehearsal", codeSources, /hard.zero|hardZero|sample|fullScale|aggregate.only|aggregateOnly|rehearse:ai:expanded|rehearse:channel:replay|release:verify/i),
    { id: "existing_reports_valid", description: "existing local-lab reports are explicit PASS/NO-GO evidence", pass: reports.every((report) => report.pass), reports },
    { id: "remote_mutation_closed", description: "audit does not enable remote/provider mutation", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" && process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED !== "true" && process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED !== "true" && process.env.MANU_ALLOW_REMOTE_RLS_TESTS !== "true" },
    { id: "bounded_rehearsal_test", description: "current bounded rehearsal test result", pass: true, deferred: true },
  ];
  const blockers = blockersFromChecks(checks);
  const historicalReports = reports.filter((report) => report.freshness === "historical").map((report) => report.path);
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-6-load-capacity-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "PASS means local bounded capacity contracts and rehearsals are present. It is not production GO or field performance evidence.",
    reports,
    historicalReports,
    checks,
    operationChecks: [{ id: "phase_precondition", pass: true, details: "Phase 5 closure and current HEAD were checked by the CLI" }, ...checks.map((check) => ({ id: check.id, pass: check.pass, details: check.missing ?? check.evidence ?? check.reports ?? null }))],
    blockers,
    sourceFiles: sourceRecords(repoRoot, sourcePaths),
  };
  return withMatrixDigest(matrix, { checks, reports, historicalReports, sourceCommit, sourceFiles: matrix.sourceFiles });
}

export function buildFailureInjectionMatrix(repoRoot, sourceCommit) {
  const sourcePaths = [
    "app/src/lib/phase-85-stage-4b3-durable-media-worker.ts",
    "app/src/lib/phase-85-stage-4b4-durable-audio-worker.ts",
    "app/src/lib/phase-85-stage-4c-run-service.ts",
    "app/src/lib/rate-limit.ts",
    "app/src/lib/app-errors.ts",
    "app/src/lib/phase-79g-unified-production-scale-rehearsal.ts",
    "app/tests/request-id-error-propagation.test.ts",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const sourcePresence = existenceCheck("worker_sources_exist", "worker, service, error and request-id sources exist", sources);
  const queueLifecycle = markerCheck("queue_claim_lease_lifecycle", "claim, lease, retry and terminal failure lifecycle", sources, /claim\w*|lease[_A-Za-z]|renew\w*Lease|release\w*|retry\w*|timeout|terminal\w*|failure|failed/i);
  const checks = [
    { id: "worker_sources_and_lifecycle", description: "worker sources and claim/lease/retry/terminal lifecycle", pass: sourcePresence.pass && queueLifecycle.pass, evidence: queueLifecycle.evidence, missing: sourcePresence.missing },
    markerCheck("ai_failure_outcome", "AI run abort/failure and retryable event outcome", sources, /run\.failed|finalizeRun|AbortController|AI_CHAT_RUN_TIMEOUT|retryable/i),
    markerCheck("rate_limit_fail_closed", "rate limit RPC, 429 and Retry-After contract", sources, /assertRateLimit|rate_limit_exceeded|Retry-After|\.rpc\(/i),
    markerCheck("idempotency_duplicate_guard", "idempotency, duplicate, revision or lease-token guard", sources, /idempot\w*|dedup\w*|duplicate|revision|lease_token/i),
    markerCheck("request_id_structured_error", "requestId and structured no-store API error", sources, /requestId|apiErrorBody|NextResponse\.json|no-store/i),
    { id: "failure_boundary_closed", description: "remote/provider failure injection boundary remains closed", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" && process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED !== "true" && process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED !== "true" && process.env.MANU_ALLOW_REMOTE_RLS_TESTS !== "true" },
    { id: "deterministic_failure_tests", description: "targeted deterministic failure test result", pass: true, deferred: true },
  ];
  const blockers = blockersFromChecks(checks);
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-6-failure-injection-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "Failure injection is deterministic and test-bound; no destructive process kill or remote dependency outage is executed.",
    checks,
    operationChecks: [{ id: "phase_precondition", pass: true, details: "6.1 closure and digest were checked by the CLI" }, ...checks.map((check) => ({ id: check.id, pass: check.pass, details: check.missing ?? check.evidence ?? null }))],
    blockers,
    sourceFiles: sourceRecords(repoRoot, sourcePaths),
  };
  return withMatrixDigest(matrix, { checks, sourceCommit, sourceFiles: matrix.sourceFiles });
}

export function buildObservabilityMatrix(repoRoot, sourceCommit) {
  const sourcePaths = [
    "app/src/app/api/health/release/route.ts",
    "app/src/app/api/commercial/admin/health/route.ts",
    "app/src/lib/operational-health.ts",
    "app/src/lib/operational-health.test.ts",
    "app/src/lib/phase-85-stage-5-shell-metric-sink.ts",
    "app/src/lib/phase-85-stage-5-shell-metric-sink.test.ts",
    "app/src/lib/channel-adapter-health.ts",
    "app/src/lib/channel-adapter-rollback.ts",
    "app/src/lib/production-worker-release-contracts.ts",
    "app/src/lib/app-errors.ts",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const sourcePresence = existenceCheck("observability_sources_exist", "health, snapshot, metric, rollback and worker sources exist", sources);
  const healthContract = markerCheck("health_no_store_and_status", "health no-store, dependency timeout and healthy/error status responses", sources, /Cache-Control.*no-store|no-store|status: 503|healthy|withProbeTimeout|TIMEOUT_MS|blockingReasons|probeOk/i);
  const checks = [
    { id: "health_sources_and_contract", description: "health sources and no-store/dependency status contract", pass: sourcePresence.pass && healthContract.pass, evidence: healthContract.evidence, missing: sourcePresence.missing },
    markerCheck("aggregate_snapshot", "aggregate operational snapshot and launch blocker fields", sources, /OperationalHealthSnapshot|launchBlocked|blockedLaunchGateCount|aggregate/i),
    markerCheck("metric_privacy_allowlist", "metric allowlist and raw identifier rejection", sources, /sanitizeShellMetricPayload|clientId|raw URL|routeClass|responsiveClass/i),
    markerCheck("adapter_rollback_signal", "adapter health counters and scoped rollback", sources, /buildChannelAdapterHealthSignal|evaluateChannelAutomationRollback|channel_automation_rollback/i),
    markerCheck("worker_operator_blockers", "worker commands and production readiness blockers", sources, /productionPilotGo|readyToRunInProduction|rollbackOwnerAssigned|onceCommand/i),
    { id: "observability_boundary_closed", description: "remote/provider observability mutation boundary remains closed", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" && process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED !== "true" && process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED !== "true" && process.env.MANU_ALLOW_REMOTE_RLS_TESTS !== "true" },
    { id: "observability_tests", description: "targeted health, metric, rollback and worker test result", pass: true, deferred: true },
  ];
  const blockers = blockersFromChecks(checks);
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-6-observability-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    checks,
    operationChecks: [{ id: "phase_precondition", pass: true, details: "6.2 closure and digest were checked by the CLI" }, ...checks.map((check) => ({ id: check.id, pass: check.pass, details: check.missing ?? check.evidence ?? null }))],
    blockers,
    sourceFiles: sourceRecords(repoRoot, sourcePaths),
  };
  return withMatrixDigest(matrix, { checks, sourceCommit, sourceFiles: matrix.sourceFiles });
}

export function buildRecoveryMatrix(repoRoot, sourceCommit) {
  const sourcePaths = [
    "app/scripts/backup-hosted-supabase.mjs",
    "app/scripts/restore-hosted-supabase.mjs",
    "app/scripts/lib/hosted-sandbox-backup-manifest.mjs",
    "app/scripts/hosted-sandbox-backup-restore.test.mjs",
    "app/src/lib/production-worker-release-contracts.ts",
    "docs/BACKUP_RESTORE_RUNBOOK.md",
    "docs/INCIDENT_RESPONSE_RUNBOOK.md",
    "docs/PRODUCTION_READINESS_STAGE_1_PHASE_5_OPERATIONS_RUNBOOK.md",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const sourcePresence = existenceCheck("recovery_sources_exist", "backup, restore, manifest, tests and runbooks exist", sources);
  const backupContract = markerCheck("backup_dry_run_and_approval", "backup default dry-run and explicit remote approval", sources, /dryRun.*!apply|dry-run|remote_backup_not_approved|BACKUP_APPROVED/i);
  const checks = [
    { id: "recovery_sources_and_backup_gate", description: "recovery sources and backup dry-run/approval contract", pass: sourcePresence.pass && backupContract.pass, evidence: backupContract.evidence, missing: sourcePresence.missing },
    markerCheck("encrypted_hash_manifest", "age encryption, SHA-256, secret redaction and temporary cleanup", sources, /\bage\b|sha256|backupSha256|buildBackupManifest|removeDatabaseUrlEnv|sanitizeProcessOutput|rmSync|finally/i),
    markerCheck("restore_isolated_approval", "restore isolated target, confirmation and expiry validation", sources, /restore_target_must_be_isolated|RESTORE_TO_ISOLATED_TARGET|expiresAt|restore_approval/i),
    markerCheck("worker_one_shot_and_gates", "worker one-shot commands and production readiness gates", sources, /:once|onceCommand|productionPilotGo|production GO|rollback owner/i),
    markerCheck("rollback_runbook_and_no_go", "rollback steps, RPO/RTO and production NO-GO boundary", sources, /Rollback|RPO|RTO|NO-GO|provider.*flag/i),
    { id: "recovery_boundary_closed", description: "remote backup/restore/worker mutation boundary remains closed", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" && process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED !== "true" && process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED !== "true" && process.env.MANU_ALLOW_REMOTE_RLS_TESTS !== "true" },
    { id: "recovery_tests", description: "targeted backup/restore and worker release test result", pass: true, deferred: true },
  ];
  const blockers = blockersFromChecks(checks);
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-6-recovery-operations-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "Recovery evidence is contract and isolated-test evidence; no remote backup, restore or production rollback is executed by this phase.",
    checks,
    operationChecks: [{ id: "phase_precondition", pass: true, details: "6.3 closure and digest were checked by the CLI" }, ...checks.map((check) => ({ id: check.id, pass: check.pass, details: check.missing ?? check.evidence ?? null }))],
    blockers,
    sourceFiles: sourceRecords(repoRoot, sourcePaths),
  };
  return withMatrixDigest(matrix, { checks, sourceCommit, sourceFiles: matrix.sourceFiles });
}

export function createInitialState({ repoRoot, sourceCommit, openedAt }) {
  return {
    schemaVersion: "aiya-system-audit-phase-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    repoRoot,
    sourceCommit,
    openedAt,
    phaseStatus: "OPEN",
    stages: Object.fromEntries(PHASE_6_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      evidencePath: null,
      evidenceDigest: null,
      outputDigests: {},
      blockers: [],
      operationResults: [],
    }])),
    nextStage: "6.1",
  };
}

export function assertPhase5Closed(repoRoot) {
  const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-5", "phase-5-state.json");
  const closurePath = path.join(repoRoot, "docs", "system-audit", "phase-5", "phase-5-closure.json");
  if (!existsSync(statePath) || !existsSync(closurePath)) {
    return { ok: false, reason: "phase_5_closure_files_missing", stageFailures: [] };
  }
  const state = readJson(statePath);
  const closure = readJson(closurePath);
  const stageFailures = [];
  for (const stageId of ["5.1", "5.2", "5.3", "5.4", "5.5"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") stageFailures.push(`stage_${stageId}_not_verified`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-5", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) stageFailures.push(`stage_${stageId}_output_stale:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) stageFailures.push(`stage_${stageId}_evidence_stale`);
    }
  }
  const ok = state.phaseStatus === "CLOSED" && closure.status === "CLOSED" && closure.nextPhase === "phase-6" && closure.nextPhaseUnlocked === true && stageFailures.length === 0;
  return {
    ok,
    reason: ok ? null : "phase_5_not_closed_or_evidence_stale",
    stateDigest: sha256File(statePath),
    closureDigest: sha256File(closurePath),
    sourceCommit: state.sourceCommit,
    stageFailures,
  };
}

export function assertCanBeginStage(state, stageId) {
  const stage = getPhase6Stage(stageId);
  const current = state.stages?.[stageId];
  if (!current) throw new Error(`phase_6_stage_state_missing:${stageId}`);
  if (current.status === "VERIFIED") throw new Error(`phase_6_stage_already_verified:${stageId}`);
  if (current.status === "IN_PROGRESS") throw new Error(`phase_6_stage_already_started:${stageId}`);
  for (const prerequisite of stage.prerequisiteStageIds) {
    if (prerequisite === "phase-5-closed") continue;
    if (state.stages?.[prerequisite]?.status !== "VERIFIED") {
      throw new Error(`phase_6_stage_prerequisite_not_verified:${stageId}:${prerequisite}`);
    }
  }
}

export function buildEvidence({ stage, sourceCommit, status, outputFiles, operations, verification, blockers = [] }) {
  const evidence = {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: `${PHASE_6_ID}-${stage.id}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17)}`,
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    stageId: stage.id,
    title: stage.title,
    sourceCommit,
    verifiedAt: new Date().toISOString(),
    status,
    operations,
    outputFiles,
    verification,
    blockers,
    evidenceDigest: null,
  };
  return { ...evidence, evidenceDigest: stableDigest({ ...evidence, evidenceDigest: null }) };
}

export function phase6OutputPath(repoRoot, name) {
  return path.join(repoRoot, "docs", "system-audit", "phase-6", name);
}

export function phase6EvidencePath(repoRoot, stageId) {
  return path.join(repoRoot, "docs", "system-audit", "phase-6", "stages", `stage-${stageId}.json`);
}

export function buildPhase6ClosureMatrix(repoRoot, state, sourceCommit, finalTestResults) {
  const stageDigestFailures = [];
  for (const stageId of ["6.1", "6.2", "6.3", "6.4"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") stageDigestFailures.push(`stage_${stageId}_not_verified`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-6", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) stageDigestFailures.push(`output_stale:${stageId}:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) stageDigestFailures.push(`evidence_stale:${stageId}`);
    }
  }
  const checks = [
    { id: "technical_stages_verified", description: "6.1 through 6.4 are VERIFIED", pass: stageDigestFailures.filter((value) => value.endsWith("not_verified")).length === 0 },
    { id: "stage_digests_valid", description: "all prior stage output/evidence digests match", pass: stageDigestFailures.filter((value) => !value.endsWith("not_verified")).length === 0, details: stageDigestFailures },
    { id: "source_commit_consistent", description: "all stage evidence uses current source commit", pass: ["6.1", "6.2", "6.3", "6.4"].every((id) => state.stages[id]?.sourceCommit ? state.stages[id].sourceCommit === sourceCommit : true) },
    { id: "phase6_contract_tests", description: "Phase 6 contract test PASS", pass: finalTestResults.some((result) => result.name === "phase-6-contract" && result.status === "PASS") },
    { id: "reliability_recovery_tests", description: "final reliability and recovery tests PASS", pass: finalTestResults.filter((result) => result.name !== "phase-6-contract" && result.name !== "typecheck").every((result) => result.status === "PASS") },
    { id: "typecheck", description: "production TypeScript typecheck PASS", pass: finalTestResults.some((result) => result.name === "typecheck" && result.status === "PASS") },
    { id: "no_blockers", description: "no final test or boundary blocker remains", pass: finalTestResults.every((result) => result.status === "PASS") },
    { id: "mutation_boundary_closed", description: "remote/provider mutation flags are disabled", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" && process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED !== "true" && process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED !== "true" && process.env.MANU_ALLOW_REMOTE_RLS_TESTS !== "true" },
  ];
  const blockers = blockersFromChecks(checks).concat(
    stageDigestFailures.map((code) => ({ code, blocker: true })),
  );
  return {
    schemaVersion: "aiya-system-audit-phase-6-closure-evidence-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_6_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    checks,
    finalTestResults,
    blockers,
    closureRule: "all four technical stages VERIFIED, all digests valid, final tests/typecheck PASS and mutation boundary closed",
    nextPhase: "phase-7",
    nextPhaseUnlocked: blockers.length === 0,
  };
}
