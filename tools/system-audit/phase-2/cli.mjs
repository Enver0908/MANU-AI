#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  AUDIT_PLAN_ID,
  AUDIT_PLAN_VERSION,
  PHASE_2_ID,
  PHASE_2_STAGES,
  getPhase2Stage,
} from "./phase-2-plan.mjs";
import {
  assertPhase1Closed,
  buildEvidence,
  compareObjectNames,
  buildIntegritySurface,
  classifyReconciliation,
  createInitialState,
  extractCatalogFromDump,
  extractMigrationObjects,
  listLocalMigrations,
  parseMigrationListOutput,
  redactFailure,
  sha256File,
  stableDigest,
} from "./phase-2-contract.mjs";
import { REQUIRED_RPC_PROBES, verifyHostedSupabaseSchemaContract } from "../../hosted-sandbox/deploy/lib/supabase-schema-contract.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const appRoot = path.join(repoRoot, "app");
const docsRoot = path.join(repoRoot, "docs", "system-audit", "phase-2");
const runtimeRoot = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-2");
const statePath = path.join(runtimeRoot, "phase-2-state.json");
const rawDumpPath = path.join(runtimeRoot, "raw-remote-public-schema.sql");

function now() {
  return new Date().toISOString();
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: options.timeout ?? 120_000,
    env: options.env ?? process.env,
  });
  return {
    status: result.status,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error?.message ?? null,
    timedOut: Boolean(result.error?.code === "ETIMEDOUT" || String(result.error?.message ?? "").includes("ETIMEDOUT")),
  };
}

function supabaseCommand(args) {
  const local = path.join(appRoot, "node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  return existsSync(local) ? { command: local, args } : { command: process.platform === "win32" ? "npx.cmd" : "npx", args: ["supabase", ...args] };
}

function loadEnvFile(filePath) {
  const env = { ...process.env };
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (env[key]) continue;
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

function parseLocalSupabaseStatus(output) {
  let parsed = null;
  try { parsed = JSON.parse(String(output ?? "")); } catch {}
  const values = new Map();
  const flatten = (value, prefix = "") => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const name = prefix ? `${prefix}.${key}` : key;
      if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, name);
      else {
        values.set(name.toLowerCase().replace(/[^a-z0-9]/g, ""), child);
        values.set(key.toLowerCase().replace(/[^a-z0-9]/g, ""), child);
      }
    }
  };
  flatten(parsed);
  if (values.size === 0) {
    for (const line of String(output ?? "").split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      values.set(key, line.slice(separator + 1).trim());
    }
  }
  const pick = (...keys) => keys.map((key) => values.get(key.toLowerCase().replace(/[^a-z0-9]/g, ""))).find((value) => typeof value === "string" && value.trim()) ?? "";
  return {
    apiUrl: pick("api.url", "api_url", "apiUrl", "API URL", "apiurl"),
    anonKey: pick("auth.anon_key", "anon_key", "anonKey", "anonkey"),
    serviceRoleKey: pick("auth.service_role_key", "service_role_key", "serviceRoleKey", "servicerolekey"),
    projectId: pick("project_id", "projectId", "projectid") || "manu-ai-local",
  };
}

function runLocalSupabase(args, options = {}) {
  const command = supabaseCommand(args);
  return runCommand(command.command, command.args, { cwd: appRoot, timeout: options.timeout ?? 300_000, env: options.env });
}

function readJsonIfPresent(filePath) {
  if (!existsSync(filePath)) return null;
  try { return readJson(filePath); } catch { return null; }
}

function summarizeVitestReport(filePath, stdout) {
  const report = readJsonIfPresent(filePath);
  if (report) {
    return {
      passed: Number(report.numPassedTests ?? 0),
      failed: Number(report.numFailedTests ?? 0),
      skipped: Number(report.numPendingTests ?? 0) + Number(report.numTodoTests ?? 0),
      total: Number(report.numTotalTests ?? 0),
    };
  }
  const text = String(stdout ?? "");
  const passed = Number(text.match(/(\d+)\s+passed/i)?.[1] ?? 0);
  const failed = Number(text.match(/(\d+)\s+failed/i)?.[1] ?? 0);
  const skipped = Number(text.match(/(\d+)\s+skipped/i)?.[1] ?? 0);
  return { passed, failed, skipped, total: passed + failed + skipped };
}

async function probeRpc(fetchImpl, baseUrl, key, probe) {
  const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/${probe.name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(probe.body),
  });
  const raw = await response.text();
  let payload = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch {}
  return { status: response.status, code: payload?.code ?? null, message: String(payload?.message ?? "").slice(0, 160), isArray: Array.isArray(payload) };
}

function evaluateProbe(observed, expected) {
  if (!expected) return { status: "NOT_APPLICABLE", pass: true };
  const pass = expected.status !== undefined
    ? observed.status === expected.status && (expected.array === undefined || observed.isArray === expected.array)
    : observed.message.includes(expected.error);
  return { status: pass ? "PASS" : "FAIL", pass };
}

async function runRpcProbes(env, fetchImpl = fetch) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return { status: "BLOCKED", reason: "supabase_url_service_role_or_anon_key_missing", probes: [] };
  }
  const results = [];
  for (const probe of REQUIRED_RPC_PROBES) {
    try {
      const serviceObserved = await probeRpc(fetchImpl, env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, probe);
      const service = evaluateProbe(serviceObserved, probe.service);
      const anonymousObserved = probe.anonymous
        ? await probeRpc(fetchImpl, env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, probe)
        : null;
      const anonymous = probe.anonymous ? evaluateProbe(anonymousObserved, probe.anonymous) : { status: "NOT_APPLICABLE", pass: true };
      results.push({ name: probe.name, service: { ...service, observed: serviceObserved }, anonymous: anonymousObserved ? { ...anonymous, observed: anonymousObserved } : anonymous });
    } catch (error) {
      results.push({ name: probe.name, status: "FAIL", error: redactFailure(error?.message ?? error) });
    }
  }
  const failures = results.filter((item) => item.status === "FAIL" || item.service?.status === "FAIL" || item.anonymous?.status === "FAIL");
  return { status: failures.length ? "FAIL" : "PASS", checked: results.length, failures: failures.map((item) => item.name), probes: results };
}

function runLinkedMigrationList() {
  const command = supabaseCommand(["migration", "list", "--linked"]);
  const result = runCommand(command.command, command.args, { cwd: appRoot });
  const entries = parseMigrationListOutput(result.stdout);
  const localOnly = entries.filter((entry) => entry.local && !entry.remote).map((entry) => entry.local);
  const remoteOnly = entries.filter((entry) => entry.remote && !entry.local).map((entry) => entry.remote);
  const mismatched = entries.filter((entry) => entry.local && entry.remote && entry.local !== entry.remote);
  const failures = [...localOnly.map((id) => `local_only:${id}`), ...remoteOnly.map((id) => `remote_only:${id}`), ...mismatched.map((entry) => `timestamp_mismatch:${entry.local}:${entry.remote}`)];
  return {
    status: result.status === 0 && entries.length > 0 && failures.length === 0 ? "PASS" : result.status === 0 ? "FAIL" : "BLOCKED",
    entries,
    localOnly,
    remoteOnly,
    mismatched,
    failures,
    error: result.status === 0 ? null : redactFailure(result.error || result.stderr || result.stdout),
  };
}

function runRemoteSchemaDump() {
  const command = supabaseCommand(["db", "dump", "--linked", "--schema", "public", "--file", rawDumpPath]);
  const result = runCommand(command.command, command.args, { cwd: appRoot, timeout: 30_000 });
  if (result.status === 0 && existsSync(rawDumpPath)) {
    const sql = readFileSync(rawDumpPath, "utf8");
    return { status: "PASS", rawDumpPath: ".manu-runtime/system-audit/phase-2/raw-remote-public-schema.sql", bytes: Buffer.byteLength(sql), sha256: sha256File(rawDumpPath), catalog: extractCatalogFromDump(sql) };
  }
  const combined = `${result.error ?? ""} ${result.stderr ?? ""} ${result.stdout ?? ""}`;
  const reason = /docker|dockerdesktoplinuxengine/i.test(combined)
    ? "docker_prerequisite_missing"
    : /ETIMEDOUT|timeout/i.test(combined)
      ? "docker_daemon_unavailable_or_schema_dump_timeout"
      : "remote_schema_dump_failed";
  return { status: "BLOCKED", reason, error: redactFailure(combined), rawDumpPath: null, catalog: null };
}

function buildComparison(migrationObjects, remoteDump) {
  if (remoteDump.status !== "PASS" || !remoteDump.catalog) return { status: "BLOCKED", reason: "real_catalog_unavailable", diff: null };
  const expected = migrationObjects.objects;
  const actual = remoteDump.catalog;
  const diff = {
    types: compareObjectNames(expected.types, actual.types ?? []),
    tables: compareObjectNames(expected.tables, actual.tables ?? []),
    indexes: compareObjectNames(expected.indexes, actual.indexes ?? []),
    functions: compareObjectNames(expected.functions, actual.functions ?? []),
    policies: compareObjectNames(expected.policies, actual.policies ?? []),
  };
  const missing = Object.values(diff).flatMap((item) => item.missing);
  return { status: missing.length ? "FAIL" : "PASS", diff, missingCount: missing.length };
}

export async function executeStage21({ repoRoot: root = repoRoot, env = loadEnvFile(path.join(appRoot, ".env.local")), fetchImpl = fetch, commandRunner = null } = {}) {
  const phase1 = assertPhase1Closed(root);
  const migrationsDir = path.join(root, "app", "supabase", "migrations");
  const migrationObjects = extractMigrationObjects(migrationsDir);
  const linked = commandRunner?.migrationList ? commandRunner.migrationList() : runLinkedMigrationList();
  const remoteDump = commandRunner?.schemaDump ? commandRunner.schemaDump() : runRemoteSchemaDump();
  const rpc = commandRunner?.rpcProbes ? await commandRunner.rpcProbes() : await runRpcProbes(env, fetchImpl);
  const comparison = buildComparison(migrationObjects, remoteDump);
  const blockers = [];
  if (!phase1.ok) blockers.push({ code: "PHASE_1_NOT_CLOSED", detail: phase1.reason });
  if (linked.status !== "PASS") blockers.push({ code: "MIGRATION_HISTORY_NOT_VERIFIED", detail: linked.status });
  if (remoteDump.status !== "PASS") blockers.push({ code: "REAL_CATALOG_UNAVAILABLE", detail: remoteDump.reason });
  if (rpc.status !== "PASS") blockers.push({ code: "RPC_CONTRACT_PROBE_NOT_VERIFIED", detail: rpc.status });
  if (comparison.status === "FAIL") blockers.push({ code: "CATALOG_OBJECT_MISMATCH", detail: comparison.missingCount });
  return {
    schemaVersion: "aiya-system-audit-phase-2-catalog-reconciliation-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    stageId: "2.1",
    generatedAt: now(),
    sourceCommit: phase1.sourceCommit ?? null,
    phase1,
    localMigrations: listLocalMigrations(migrationsDir),
    migrationObjects,
    linkedMigrationHistory: linked,
    remoteCatalog: remoteDump,
    rpcContractProbes: rpc,
    comparison,
    status: blockers.length ? "BLOCKED" : "PASS",
    blockers,
    dataMutation: { performed: false, targets: ["linked_supabase", "production_supabase", "local_supabase"] },
    outputDigest: stableDigest({ migrationObjects, linked, remoteDump: { ...remoteDump, catalog: remoteDump.catalog ? { digest: remoteDump.catalog.digest } : null }, rpc, comparison, blockers }),
  };
}

function buildPlanManifest() {
  return {
    schemaVersion: "aiya-system-audit-phase-2-plan-manifest-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phase: { id: PHASE_2_ID, title: "Gercek Sema, Migrasyonlar ve Veri Butunlugu", stageIds: PHASE_2_STAGES.map((stage) => stage.id) },
    stageTransition: {
      allowed: ["LOCKED->IN_PROGRESS", "IN_PROGRESS->VERIFIED", "IN_PROGRESS->BLOCKED"],
      forbidden: ["LOCKED->VERIFIED", "LOCKED->BLOCKED", "BLOCKED->VERIFIED", "any->CLOSED without all stages VERIFIED"],
      stopRule: "A stage may not start until every prerequisite stage is VERIFIED; a BLOCKED stage stops the phase.",
    },
    stageDefinitions: PHASE_2_STAGES,
    secretPolicy: "environment values, tokens, passwords, cookies and personal data are forbidden in docs evidence",
  };
}

function parseArgs(argv) {
  return { newRun: argv.includes("--newRun=true") || argv.includes("--new-run=true") };
}

function getExistingState() {
  return existsSync(statePath) ? readJson(statePath) : null;
}

function writePhaseEntry(precondition) {
  const git = runCommand("git", ["rev-parse", "HEAD"]);
  const status = runCommand("git", ["status", "--porcelain"]);
  writeJson(path.join(docsRoot, "phase-entry.json"), {
    schemaVersion: "aiya-system-audit-phase-entry-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    capturedAt: now(),
    sourceCommit: git.stdout.trim(),
    branch: runCommand("git", ["branch", "--show-current"]).stdout.trim(),
    workingTree: status.stdout.trim() ? "dirty" : "clean",
    phase1Precondition: precondition,
    rule: "Phase 2 is independent of working-tree cleanliness but cannot proceed beyond a blocked stage.",
  });
}

export async function runPhase2({ newRun = false, root = repoRoot } = {}) {
  const precondition = assertPhase1Closed(root);
  if (!precondition.ok) throw new Error(`phase_1_precondition_failed:${precondition.reason}`);
  const existing = getExistingState();
  if (existing && !newRun) throw new Error("phase_2_state_exists_use_newRun_true_for_a_fresh_evidence_run");
  mkdirSync(docsRoot, { recursive: true });
  mkdirSync(runtimeRoot, { recursive: true });
  writePhaseEntry(precondition);
  writeJson(path.join(docsRoot, "plan-manifest.json"), buildPlanManifest());
  const state = createInitialState({ repoRoot: root, sourceCommit: precondition.sourceCommit, openedAt: now() });
  state.stages["2.1"].status = "IN_PROGRESS";
  writeJson(statePath, state);
  const output = await executeStage21({ repoRoot: root });
  writeJson(path.join(docsRoot, "catalog-reconciliation.json"), output);
  const stage = getPhase2Stage("2.1");
  const outputFile = "docs/system-audit/phase-2/catalog-reconciliation.json";
  const outputDigest = sha256File(path.join(docsRoot, "catalog-reconciliation.json"));
  const evidenceStatus = output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  const evidence = buildEvidence({
    stage,
    now: now(),
    sourceCommit: state.sourceCommit,
    status: evidenceStatus,
    outputFiles: [{ path: outputFile, sha256: outputDigest }],
    operations: stage.operations.map((description, index) => ({ order: index + 1, description, status: output.status === "PASS" ? "PASS" : index < 3 ? "PASS" : "BLOCKED", outputReferences: [outputFile] })),
    verification: { rules: stage.verificationRules, result: output.status === "PASS" ? "PASS" : "BLOCKED", outputDigest },
    blockers: output.blockers,
  });
  const evidencePath = path.join(docsRoot, "stages", "stage-2.1.json");
  writeJson(evidencePath, evidence);
  state.stages["2.1"] = { ...state.stages["2.1"], status: evidenceStatus, evidencePath: "docs/system-audit/phase-2/stages/stage-2.1.json", evidenceDigest: sha256File(evidencePath), outputDigests: { "catalog-reconciliation.json": outputDigest }, completedAt: now(), blockers: output.blockers };
  state.phaseStatus = output.status === "PASS" ? "OPEN" : "BLOCKED";
  state.lastRun = { stageId: "2.1", status: evidenceStatus, at: now(), outputDigest };
  if (output.status === "PASS") state.nextStage = "2.2";
  writeJson(statePath, state);
  return { phaseStatus: state.phaseStatus, stageStatus: evidenceStatus, outputPath: outputFile, blockers: output.blockers, nextStage: state.nextStage ?? null };
}

export function executeStage22({ repoRoot: root = repoRoot } = {}) {
  const state = readJson(path.join(root, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json"));
  if (state.phaseId !== PHASE_2_ID || state.stages?.["2.1"]?.status !== "VERIFIED") throw new Error("stage_2_1_not_verified");
  const reconciliationPath = path.join(root, "docs", "system-audit", "phase-2", "catalog-reconciliation.json");
  if (!existsSync(reconciliationPath)) throw new Error("stage_2_1_output_missing");
  const reconciliation = readJson(reconciliationPath);
  if (state.stages["2.1"].outputDigests?.["catalog-reconciliation.json"] !== sha256File(reconciliationPath)) throw new Error("stage_2_1_output_stale");
  const inventoryPath = path.join(root, "docs", "system-audit", "phase-1", "system-inventory.json");
  const inventory = existsSync(inventoryPath) ? readJson(inventoryPath) : null;
  const integritySurface = buildIntegritySurface(path.join(root, "app", "supabase", "migrations"), inventory);
  return {
    schemaVersion: "aiya-system-audit-phase-2-schema-diff-classification-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    stageId: "2.2",
    generatedAt: now(),
    sourceCommit: state.sourceCommit,
    sourceStage: { stageId: "2.1", evidencePath: state.stages["2.1"].evidencePath, evidenceDigest: state.stages["2.1"].evidenceDigest, outputDigest: state.stages["2.1"].outputDigests["catalog-reconciliation.json"] },
    ...classifyReconciliation(reconciliation, integritySurface),
  };
}

export function executeStage23({ repoRoot: root = repoRoot } = {}) {
  const statePathForRoot = path.join(root, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json");
  const state = readJson(statePathForRoot);
  if (state.phaseId !== PHASE_2_ID || state.stages?.["2.2"]?.status !== "VERIFIED") throw new Error("stage_2_2_not_verified");
  const outputPath = path.join(root, "docs", "system-audit", "phase-2", "isolated-reconciliation.json");
  const localRlsReportPath = path.join(runtimeRoot, "local-rls-report.json");
  const localSchemaDumpPath = path.join(runtimeRoot, "local-public-schema.sql");
  const steps = {
    target: { kind: "local_supabase", projectId: "manu-ai-local", linkedWrites: false, productionWrites: false },
    start: null,
    status: null,
    cleanInstall: null,
    syntheticDataIntegrity: null,
    retryability: null,
    schemaDiff: null,
    upgradeCopy: { status: "BLOCKED", reason: "isolated_copy_of_live_schema_not_materialized" },
    interruptedMigrationRecovery: { status: "BLOCKED", reason: "interrupted_migration_fixture_not_executed" },
  };
  const blockers = [];
  let started = false;
  let localStatus = null;
  mkdirSync(runtimeRoot, { recursive: true });
  try {
    const start = runLocalSupabase(["start"], { timeout: 300_000 });
    started = true;
    steps.start = { status: start.status === 0 ? "PASS" : "FAIL", exitCode: start.status };
    if (start.status !== 0) blockers.push("supabase_start_failed");

    const statusResult = runLocalSupabase(["status", "-o", "json"], { timeout: 120_000 });
    localStatus = parseLocalSupabaseStatus(statusResult.stdout);
    steps.status = { status: statusResult.status === 0 && localStatus.apiUrl && localStatus.anonKey && localStatus.serviceRoleKey ? "PASS" : "FAIL", exitCode: statusResult.status, projectId: localStatus.projectId || "manu-ai-local", apiUrlPresent: Boolean(localStatus.apiUrl) };
    if (steps.status.status !== "PASS") blockers.push("local_supabase_status_incomplete");

    if (blockers.length === 0) {
      const reset = runLocalSupabase(["db", "reset", "--local", "--no-seed", "--yes"], { timeout: 300_000 });
      steps.cleanInstall = { status: reset.status === 0 ? "PASS" : "FAIL", exitCode: reset.status };
      if (reset.status !== 0) blockers.push("clean_migration_install_failed");
    } else {
      steps.cleanInstall = { status: "NOT_RUN", exitCode: null };
    }

    if (blockers.length === 0) {
      const vitestCommand = process.platform === "win32" ? "npx.cmd" : "npx";
      const vitest = runCommand(vitestCommand, ["vitest", "run", "src/lib/supabase-rls.integration.test.ts", "--no-file-parallelism", "--maxWorkers=1", "--reporter=json", `--outputFile=${localRlsReportPath}`], {
        cwd: appRoot,
        timeout: 900_000,
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
          SUPABASE_URL: localStatus.apiUrl,
          SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
          MANU_ALLOW_REMOTE_RLS_TESTS: "",
        },
      });
      const summary = summarizeVitestReport(localRlsReportPath, vitest.stdout);
      steps.syntheticDataIntegrity = { status: vitest.status === 0 && summary.failed === 0 && summary.skipped === 0 && summary.passed > 0 ? "PASS" : "FAIL", exitCode: vitest.status, ...summary };
      if (steps.syntheticDataIntegrity.status !== "PASS") blockers.push("synthetic_tenant_integrity_suite_failed");
    } else {
      steps.syntheticDataIntegrity = { status: "NOT_RUN", exitCode: null };
    }

    if (blockers.length === 0) {
      const interrupted = runLocalSupabase(["db", "reset", "--local", "--no-seed", "--yes"], { timeout: 10_000 });
      const restartAfterInterruption = runLocalSupabase(["stop", "--project-id", "manu-ai-local", "--no-backup"], { timeout: 180_000 });
      const restart = restartAfterInterruption.status === 0
        ? runLocalSupabase(["start"], { timeout: 300_000 })
        : { status: 1, error: "local_stop_after_interruption_failed", stderr: "", stdout: "", timedOut: false };
      const recovery = runLocalSupabase(["db", "reset", "--local", "--no-seed", "--yes"], { timeout: 300_000 });
      const recoveryPass = interrupted.timedOut && restartAfterInterruption.status === 0 && restart.status === 0 && recovery.status === 0;
      steps.interruptedMigrationRecovery = { status: recoveryPass ? "PASS" : "FAIL", interruptedExitCode: interrupted.status, interruptedTimedOut: interrupted.timedOut, restartStopExitCode: restartAfterInterruption.status, restartExitCode: restart.status, recoveryExitCode: recovery.status };
      steps.retryability = { status: recovery.status === 0 ? "PASS" : "FAIL", exitCode: recovery.status, purpose: "repeat_clean_install_after_synthetic_records" };
      if (!recoveryPass) blockers.push("interrupted_migration_recovery_not_verified");
    } else {
      steps.retryability = { status: "NOT_RUN", exitCode: null };
      steps.interruptedMigrationRecovery = { status: "NOT_RUN", exitCode: null };
    }

    if (blockers.length === 0) {
      const dump = runLocalSupabase(["db", "dump", "--local", "--schema", "public", "--file", localSchemaDumpPath], { timeout: 300_000 });
      if (dump.status === 0 && existsSync(localSchemaDumpPath)) {
        const localCatalog = extractCatalogFromDump(readFileSync(localSchemaDumpPath, "utf8"));
        const expected = extractMigrationObjects(path.join(root, "app", "supabase", "migrations")).objects;
        const localVsMigrations = {
          types: compareObjectNames(expected.types, localCatalog.types ?? []),
          tables: compareObjectNames(expected.tables, localCatalog.tables ?? []),
          indexes: compareObjectNames(expected.indexes, localCatalog.indexes ?? []),
          functions: compareObjectNames(expected.functions, localCatalog.functions ?? []),
          policies: compareObjectNames(expected.policies, localCatalog.policies ?? []),
        };
        const localMissing = Object.values(localVsMigrations).flatMap((item) => item.missing);
        const localExtra = Object.values(localVsMigrations).flatMap((item) => item.extra);
        steps.schemaDiff = { status: localMissing.length || localExtra.length ? "FAIL" : "PASS", method: "local_schema_dump_vs_final_migrations", exitCode: dump.status, bytes: readFileSync(localSchemaDumpPath).byteLength, localMissingCount: localMissing.length, localExtraCount: localExtra.length };
        if (steps.schemaDiff.status !== "PASS") blockers.push("local_schema_diff_not_empty_or_unavailable");

        const remoteCatalog = readJson(path.join(root, "docs", "system-audit", "phase-2", "catalog-reconciliation.json")).remoteCatalog.catalog;
        const localVsRemote = {
          types: compareObjectNames(remoteCatalog.types ?? [], localCatalog.types ?? []),
          tables: compareObjectNames(remoteCatalog.tables ?? [], localCatalog.tables ?? []),
          indexes: compareObjectNames(remoteCatalog.indexes ?? [], localCatalog.indexes ?? []),
          functions: compareObjectNames(remoteCatalog.functions ?? [], localCatalog.functions ?? []),
          policies: compareObjectNames(remoteCatalog.policies ?? [], localCatalog.policies ?? []),
          rlsTables: compareObjectNames(remoteCatalog.rlsTables ?? [], localCatalog.rlsTables ?? []),
        };
        const remoteMissing = Object.values(localVsRemote).flatMap((item) => item.missing);
        const remoteExtra = Object.values(localVsRemote).flatMap((item) => item.extra);
        steps.upgradeCopy = { status: remoteMissing.length || remoteExtra.length ? "FAIL" : "PASS", method: "clean_local_migration_catalog_vs_real_remote_catalog", localSchemaSha256: sha256File(localSchemaDumpPath), remoteCatalogDigest: remoteCatalog.digest, missingCount: remoteMissing.length, extraCount: remoteExtra.length, syntheticRecords: steps.syntheticDataIntegrity };
        if (steps.upgradeCopy.status !== "PASS") blockers.push("isolated_live_schema_upgrade_not_verified");
      } else {
        steps.schemaDiff = { status: "BLOCKED", exitCode: dump.status, error: redactFailure(dump.error || dump.stderr || dump.stdout) };
        blockers.push("local_schema_diff_not_empty_or_unavailable");
        blockers.push("isolated_live_schema_upgrade_not_verified");
      }
    } else {
      steps.schemaDiff = { status: "NOT_RUN", exitCode: null };
    }
  } finally {
    if (started) {
      const stop = runLocalSupabase(["stop", "--project-id", "manu-ai-local", "--no-backup"], { timeout: 180_000 });
      steps.stop = { status: stop.status === 0 ? "PASS" : "FAIL", exitCode: stop.status };
      if (stop.status !== 0) blockers.push("local_supabase_stop_failed");
    }
  }
  if (steps.upgradeCopy.status !== "PASS" && !blockers.includes("isolated_live_schema_upgrade_not_verified")) blockers.push("isolated_live_schema_upgrade_not_verified");
  if (steps.interruptedMigrationRecovery.status !== "PASS" && !blockers.includes("interrupted_migration_recovery_not_verified")) blockers.push("interrupted_migration_recovery_not_verified");
  return {
    schemaVersion: "aiya-system-audit-phase-2-isolated-reconciliation-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    stageId: "2.3",
    generatedAt: now(),
    sourceCommit: state.sourceCommit,
    status: blockers.length ? "BLOCKED" : "PASS",
    steps,
    blockers: [...new Set(blockers)],
    mutationBoundary: { production: false, linkedSupabase: false, isolatedLocalSupabase: steps.cleanInstall?.status === "PASS" || steps.start?.status === "PASS" },
  };
}

function migrationSnapshotAtCommit(root, commit) {
  const listing = runCommand("git", ["ls-tree", "-r", "--name-only", commit, "--", "app/supabase/migrations"], { cwd: root });
  if (listing.status !== 0) return { status: "BLOCKED", reason: "git_migration_listing_failed" };
  const files = listing.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.endsWith(".sql")).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    const content = runCommand("git", ["show", `${commit}:${file}`], { cwd: root });
    if (content.status !== 0) return { status: "BLOCKED", reason: "git_migration_content_failed" };
    hash.update(file.replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(content.stdout.replace(/\r\n/g, "\n"));
    hash.update("\n");
  }
  return { status: "PASS", commit, count: files.length, fingerprint: hash.digest("hex"), files };
}

function migrationSnapshotAtWorkingTree(root) {
  const directory = path.join(root, "app", "supabase", "migrations");
  const files = readdirSync(directory).filter((name) => name.endsWith(".sql")).sort();
  const hash = createHash("sha256");
  for (const name of files) {
    hash.update(`app/supabase/migrations/${name}`);
    hash.update("\0");
    hash.update(readFileSync(path.join(directory, name), "utf8").replace(/\r\n/g, "\n"));
    hash.update("\n");
  }
  return { count: files.length, fingerprint: hash.digest("hex"), files };
}

function buildRollbackCompatibility(root, sourceCommit) {
  const parent = runCommand("git", ["rev-list", "--parents", "-n", "1", sourceCommit], { cwd: root });
  const previousCommit = parent.status === 0 ? parent.stdout.trim().split(/\s+/)[1] : "";
  if (!previousCommit) return { status: "BLOCKED", reason: "previous_release_commit_unavailable" };
  const previous = migrationSnapshotAtCommit(root, previousCommit);
  if (previous.status !== "PASS") return { status: "BLOCKED", reason: previous.reason };
  const current = migrationSnapshotAtWorkingTree(root);
  const diff = runCommand("git", ["diff", "--name-status", previousCommit, sourceCommit, "--", "app/supabase/migrations"], { cwd: root });
  if (diff.status !== 0) return { status: "BLOCKED", reason: "migration_delta_unavailable" };
  const changes = diff.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [status, ...fileParts] = line.split(/\s+/);
    return { status, path: fileParts.join(" ") };
  });
  const unsafe = changes.filter((change) => /^(D|M|R|C)/.test(change.status));
  return {
    status: unsafe.length ? "BLOCKED" : "PASS",
    previousRelease: { commit: previousCommit, migrationCount: previous.count, migrationFingerprint: previous.fingerprint },
    currentRelease: { commit: sourceCommit, migrationCount: current.count, migrationFingerprint: current.fingerprint },
    migrationDelta: { changes, unsafeChanges: unsafe },
    decision: unsafe.length ? "rollback_incompatibility_requires_forward_compatible_release" : "rollback_compatible_no_migration_delta",
    incompatibilities: unsafe.map((change) => ({ type: "migration_history_change", ...change })),
  };
}

function buildSignatureMatrix(root) {
  const reconciliation = readJson(path.join(root, "docs", "system-audit", "phase-2", "catalog-reconciliation.json"));
  const remoteFunctions = reconciliation.remoteCatalog?.catalog?.functions ?? [];
  const localSchemaPath = path.join(root, ".manu-runtime", "system-audit", "phase-2", "local-public-schema.sql");
  const localFunctions = existsSync(localSchemaPath)
    ? extractCatalogFromDump(readFileSync(localSchemaPath, "utf8")).functions ?? []
    : null;
  const required = REQUIRED_RPC_PROBES.map((probe) => probe.signature);
  const compare = (actual) => actual === null
    ? { status: "BLOCKED", missing: required, actualCount: null }
    : { status: required.every((signature) => actual.includes(signature)) ? "PASS" : "FAIL", missing: required.filter((signature) => !actual.includes(signature)), actualCount: actual.length };
  const local = compare(localFunctions);
  const remote = compare(remoteFunctions);
  return {
    status: local.status === "PASS" && remote.status === "PASS" ? "PASS" : "BLOCKED",
    requiredCount: required.length,
    requiredSignatures: required,
    local,
    remote,
  };
}

async function runSchemaContract(env, fetchImpl) {
  try {
    const result = await verifyHostedSupabaseSchemaContract({ env, fetchImpl });
    return { status: "PASS", checked: result.checked.length, matrix: result.matrix };
  } catch (error) {
    return { status: "FAIL", reason: redactFailure(error?.message ?? error) };
  }
}

export async function executeStage24({ repoRoot: root = repoRoot, fetchImpl = fetch } = {}) {
  const state = readJson(path.join(root, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json"));
  if (state.phaseId !== PHASE_2_ID || state.stages?.["2.3"]?.status !== "VERIFIED") throw new Error("stage_2_3_not_verified");
  const localRuntimeRoot = path.join(root, ".manu-runtime", "system-audit", "phase-2");
  const remoteEnv = loadEnvFile(path.join(root, "app", ".env.local"));
  const local = { target: "manu-ai-local", start: null, status: null, contract: null, stop: null };
  let localStatus = null;
  try {
    const start = runLocalSupabase(["start"], { timeout: 300_000 });
    local.start = { status: start.status === 0 ? "PASS" : "FAIL", exitCode: start.status };
    const statusResult = runLocalSupabase(["status", "-o", "json"], { timeout: 120_000 });
    localStatus = parseLocalSupabaseStatus(statusResult.stdout);
    local.status = { status: statusResult.status === 0 && localStatus.apiUrl && localStatus.anonKey && localStatus.serviceRoleKey ? "PASS" : "FAIL", exitCode: statusResult.status, projectId: localStatus.projectId || "manu-ai-local", apiUrlPresent: Boolean(localStatus.apiUrl) };
    if (local.start.status === "PASS" && local.status.status === "PASS") {
      local.contract = await runSchemaContract({
        ...remoteEnv,
        NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
        SUPABASE_URL: localStatus.apiUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
        SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
      }, fetchImpl);
    } else {
      local.contract = { status: "BLOCKED", reason: "local_fixture_unavailable" };
    }
  } finally {
    const stop = runLocalSupabase(["stop", "--project-id", "manu-ai-local", "--no-backup"], { timeout: 180_000 });
    local.stop = { status: stop.status === 0 ? "PASS" : "FAIL", exitCode: stop.status };
  }
  const remoteContract = await runSchemaContract(remoteEnv, fetchImpl);
  const signatures = buildSignatureMatrix(root);
  const rollback = buildRollbackCompatibility(root, state.sourceCommit);
  const blockers = [];
  if (local.start?.status !== "PASS" || local.status?.status !== "PASS" || local.contract?.status !== "PASS" || local.stop?.status !== "PASS") blockers.push("local_schema_contract_not_verified");
  if (remoteContract.status !== "PASS") blockers.push("remote_read_only_schema_contract_not_verified");
  if (signatures.status !== "PASS") blockers.push("required_rpc_signature_matrix_not_verified");
  if (rollback.status !== "PASS") blockers.push("rollback_compatibility_not_verified");
  return {
    schemaVersion: "aiya-system-audit-phase-2-schema-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_2_ID,
    stageId: "2.4",
    generatedAt: now(),
    sourceCommit: state.sourceCommit,
    status: blockers.length ? "BLOCKED" : "PASS",
    localFixture: local,
    remoteReadOnlyFixture: { target: "linked_supabase_read_only", contract: remoteContract },
    signatureMatrix: signatures,
    rollbackCompatibility: rollback,
    mutationBoundary: { production: false, linkedWrites: false, localWrites: false, localRpcCallsAreContractProbes: true },
    blockers,
  };
}

function verifyStage22(root = repoRoot) {
  const statePathForRoot = path.join(root, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json");
  const state = readJson(statePathForRoot);
  if (state.stages?.["2.1"]?.status !== "VERIFIED") throw new Error("stage_2_1_not_verified");
  if (state.stages?.["2.2"]?.status === "VERIFIED") throw new Error("stage_2_2_already_verified");
  const outputPath = path.join(root, "docs", "system-audit", "phase-2", "schema-diff-classification.json");
  const output = executeStage22({ repoRoot: root });
  writeJson(outputPath, output);
  const stage = getPhase2Stage("2.2");
  const outputDigest = sha256File(outputPath);
  const evidence = buildEvidence({
    stage,
    now: now(),
    sourceCommit: state.sourceCommit,
    status: output.status === "PASS" ? "VERIFIED" : "BLOCKED",
    outputFiles: [{ path: "docs/system-audit/phase-2/schema-diff-classification.json", sha256: outputDigest }],
    operations: stage.operations.map((description, index) => ({ order: index + 1, description, status: output.status === "PASS" ? "PASS" : index < 2 ? "PASS" : "BLOCKED", outputReferences: ["docs/system-audit/phase-2/schema-diff-classification.json"] })),
    verification: { rules: stage.verificationRules, result: output.status === "PASS" ? "PASS" : "BLOCKED", outputDigest },
    blockers: output.repairPlan.filter((item) => item.blocker),
  });
  const evidencePath = path.join(root, "docs", "system-audit", "phase-2", "stages", "stage-2.2.json");
  writeJson(evidencePath, evidence);
  state.stages["2.2"] = { ...state.stages["2.2"], status: output.status === "PASS" ? "VERIFIED" : "BLOCKED", evidencePath: "docs/system-audit/phase-2/stages/stage-2.2.json", evidenceDigest: sha256File(evidencePath), outputDigests: { "schema-diff-classification.json": outputDigest }, completedAt: now(), blockers: output.repairPlan.filter((item) => item.blocker) };
  state.phaseStatus = output.status === "PASS" ? "OPEN" : "BLOCKED";
  state.lastRun = { stageId: "2.2", status: state.stages["2.2"].status, at: now(), outputDigest };
  if (output.status === "PASS") state.nextStage = "2.3";
  writeJson(statePathForRoot, state);
  return { phaseStatus: state.phaseStatus, stageStatus: state.stages["2.2"].status, outputPath: "docs/system-audit/phase-2/schema-diff-classification.json", blockers: state.stages["2.2"].blockers, nextStage: state.nextStage ?? null };
}

function verifyStage23(root = repoRoot) {
  const statePathForRoot = path.join(root, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json");
  const state = readJson(statePathForRoot);
  if (state.stages?.["2.2"]?.status !== "VERIFIED") throw new Error("stage_2_2_not_verified");
  if (state.stages?.["2.3"]?.status === "VERIFIED") throw new Error("stage_2_3_already_verified");
  const output = executeStage23({ repoRoot: root });
  const outputPath = path.join(root, "docs", "system-audit", "phase-2", "isolated-reconciliation.json");
  writeJson(outputPath, output);
  const stage = getPhase2Stage("2.3");
  const outputDigest = sha256File(outputPath);
  const evidence = buildEvidence({
    stage,
    now: now(),
    sourceCommit: state.sourceCommit,
    status: output.status === "PASS" ? "VERIFIED" : "BLOCKED",
    outputFiles: [{ path: "docs/system-audit/phase-2/isolated-reconciliation.json", sha256: outputDigest }],
    operations: stage.operations.map((description, index) => ({ order: index + 1, description, status: output.status === "PASS" ? "PASS" : index < 2 ? "PASS" : "BLOCKED", outputReferences: ["docs/system-audit/phase-2/isolated-reconciliation.json"] })),
    verification: { rules: stage.verificationRules, result: output.status === "PASS" ? "PASS" : "BLOCKED", outputDigest },
    blockers: output.blockers.map((code) => ({ code })),
  });
  const evidencePath = path.join(root, "docs", "system-audit", "phase-2", "stages", "stage-2.3.json");
  writeJson(evidencePath, evidence);
  state.stages["2.3"] = { ...state.stages["2.3"], status: output.status === "PASS" ? "VERIFIED" : "BLOCKED", evidencePath: "docs/system-audit/phase-2/stages/stage-2.3.json", evidenceDigest: sha256File(evidencePath), outputDigests: { "isolated-reconciliation.json": outputDigest }, completedAt: now(), blockers: output.blockers.map((code) => ({ code })) };
  state.phaseStatus = output.status === "PASS" ? "OPEN" : "BLOCKED";
  state.lastRun = { stageId: "2.3", status: state.stages["2.3"].status, at: now(), outputDigest };
  state.nextStage = output.status === "PASS" ? "2.4" : null;
  writeJson(statePathForRoot, state);
  return { phaseStatus: state.phaseStatus, stageStatus: state.stages["2.3"].status, outputPath: "docs/system-audit/phase-2/isolated-reconciliation.json", blockers: state.stages["2.3"].blockers, nextStage: state.nextStage ?? null };
}

async function verifyStage24(root = repoRoot) {
  const statePathForRoot = path.join(root, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json");
  const state = readJson(statePathForRoot);
  if (state.stages?.["2.3"]?.status !== "VERIFIED") throw new Error("stage_2_3_not_verified");
  if (state.stages?.["2.4"]?.status === "VERIFIED") {
    const priorOutputPath = path.join(root, "docs", "system-audit", "phase-2", "schema-contract-matrix.json");
    const priorOutput = existsSync(priorOutputPath) ? readJson(priorOutputPath) : null;
    const staleRollbackEvidence = priorOutput?.rollbackCompatibility?.previousRelease?.commit === state.sourceCommit;
    if (!staleRollbackEvidence) throw new Error("stage_2_4_already_verified");
    state.phaseStatus = "OPEN";
    state.nextStage = "2.4";
    state.stages["2.4"] = { stageId: "2.4", status: "LOCKED", evidencePath: null, evidenceDigest: null };
    writeJson(statePathForRoot, state);
  }
  const output = await executeStage24({ repoRoot: root });
  const outputPath = path.join(root, "docs", "system-audit", "phase-2", "schema-contract-matrix.json");
  writeJson(outputPath, output);
  const stage = getPhase2Stage("2.4");
  const outputDigest = sha256File(outputPath);
  const evidence = buildEvidence({
    stage,
    now: now(),
    sourceCommit: state.sourceCommit,
    status: output.status === "PASS" ? "VERIFIED" : "BLOCKED",
    outputFiles: [{ path: "docs/system-audit/phase-2/schema-contract-matrix.json", sha256: outputDigest }],
    operations: stage.operations.map((description, index) => ({ order: index + 1, description, status: output.status === "PASS" ? "PASS" : index === 0 ? "PASS" : "BLOCKED", outputReferences: ["docs/system-audit/phase-2/schema-contract-matrix.json"] })),
    verification: { rules: stage.verificationRules, result: output.status === "PASS" ? "PASS" : "BLOCKED", outputDigest },
    blockers: output.blockers.map((code) => ({ code })),
  });
  const evidencePath = path.join(root, "docs", "system-audit", "phase-2", "stages", "stage-2.4.json");
  writeJson(evidencePath, evidence);
  const stageStatus = output.status === "PASS" ? "VERIFIED" : "BLOCKED";
  state.stages["2.4"] = { ...state.stages["2.4"], status: stageStatus, evidencePath: "docs/system-audit/phase-2/stages/stage-2.4.json", evidenceDigest: sha256File(evidencePath), outputDigests: { "schema-contract-matrix.json": outputDigest }, completedAt: now(), blockers: output.blockers.map((code) => ({ code })) };
  state.lastRun = { stageId: "2.4", status: stageStatus, at: now(), outputDigest };
  const allStagesVerified = PHASE_2_STAGES.every((candidate) => candidate.id === "2.4" ? stageStatus === "VERIFIED" : state.stages[candidate.id]?.status === "VERIFIED");
  if (stageStatus === "VERIFIED" && allStagesVerified) {
    state.phaseStatus = "CLOSED";
    state.nextStage = null;
    writeJson(path.join(root, "docs", "system-audit", "phase-2", "phase-2-closure.json"), {
      schemaVersion: "aiya-system-audit-phase-closure-v1",
      planId: AUDIT_PLAN_ID,
      planVersion: AUDIT_PLAN_VERSION,
      phaseId: PHASE_2_ID,
      status: "CLOSED",
      closedAt: now(),
      sourceCommit: state.sourceCommit,
      stageEvidence: PHASE_2_STAGES.map((candidate) => ({ stageId: candidate.id, evidencePath: state.stages[candidate.id].evidencePath, evidenceDigest: state.stages[candidate.id].evidenceDigest })),
      closureRule: "all four stages VERIFIED, all required outputs present and digest-valid, local and remote read-only schema contract matrix PASS",
      nextPhase: "phase-3",
      nextPhaseUnlocked: true,
    });
  } else {
    state.phaseStatus = "BLOCKED";
    state.nextStage = null;
  }
  writeJson(statePathForRoot, state);
  return { phaseStatus: state.phaseStatus, stageStatus, outputPath: "docs/system-audit/phase-2/schema-contract-matrix.json", blockers: state.stages["2.4"].blockers, nextStage: state.nextStage ?? null };
}

async function main() {
  const command = process.argv[2];
  const options = parseArgs(process.argv.slice(3));
  if (command !== "run-phase-2" && command !== "run-stage-2.2" && command !== "run-stage-2.3" && command !== "run-stage-2.4") throw new Error("usage: run-phase-2 [--newRun=true] | run-stage-2.2 | run-stage-2.3 | run-stage-2.4");
  const result = command === "run-phase-2" ? await runPhase2({ newRun: options.newRun }) : command === "run-stage-2.2" ? verifyStage22() : command === "run-stage-2.3" ? verifyStage23() : await verifyStage24();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  if (result.phaseStatus === "BLOCKED") process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`FAIL system-audit-phase-2: ${error.message}\n`); process.exitCode = 1; });
}
