#!/usr/bin/env node
/**
 * Stage 5 RLS evidence gate.
 * Creates a clean local Supabase target, resets the database, runs the RLS
 * integration suite without skips, and writes a v2 closure artifact.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  appRoot,
  buildStage5EvidenceHeader,
  docsRoot,
  runCapture,
} from "./lib/stage-5-evidence.mjs";

const rawPath = join(docsRoot, "PHASE_85_STAGE_5_RLS_RAW_VITEST_REPORT.json");
const reportPath = join(docsRoot, "PHASE_85_STAGE_5_RLS_ZERO_SKIP_REPORT.json");
const MIN_PASSED_RLS_TESTS = 56;
const LOCAL_API_URL_PATTERN = /^http:\/\/(?:127\.0\.0\.1|localhost):54321(?:\/)?$/;
const PROJECT_ID = "manu-ai-local";

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function dockerCommand() {
  return process.platform === "win32" ? "docker.exe" : "docker";
}

function readRawSummary() {
  if (!existsSync(rawPath)) return null;
  try {
    const raw = JSON.parse(readFileSync(rawPath, "utf8"));
    const failures = [];
    for (const suite of raw.testResults ?? []) {
      for (const assertion of suite.assertionResults ?? []) {
        if (assertion.status !== "failed") continue;
        failures.push({
          file: suite.name ?? null,
          title: [...(assertion.ancestorTitles ?? []), assertion.title].filter(Boolean).join(" > "),
          failureMessages: assertion.failureMessages ?? [],
        });
      }
    }
    return {
      passed: Number(raw.numPassedTests ?? 0),
      failed: Number(raw.numFailedTests ?? 0),
      skipped: Number(raw.numPendingTests ?? 0) + Number(raw.numTodoTests ?? 0),
      total: Number(raw.numTotalTests ?? 0),
      failures,
    };
  } catch {
    return null;
  }
}

function runSupabase(args, options = {}) {
  return runCapture(npxCommand(), ["supabase", ...args], {
    cwd: appRoot,
    timeoutMs: options.timeoutMs ?? 180_000,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
    env: options.env,
  });
}

function tail(result) {
  return `${result?.stdout ?? ""}${result?.stderr ?? ""}`.slice(-6_000);
}

function redactSensitive(value, secrets = []) {
  let redacted = String(value ?? "");
  for (const secret of secrets.filter(Boolean)) {
    redacted = redacted.split(secret).join("[redacted-secret]");
  }
  return redacted
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-jwt]")
    .replace(/postgresql:\/\/([^:\s]+):([^@\s]+)@/gi, "postgresql://$1:[redacted]@");
}

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function flattenStatus(value, prefix = "", output = new Map()) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flattenStatus(child, flatKey, output);
    } else {
      output.set(normalizeKey(flatKey), child);
      output.set(normalizeKey(key), child);
    }
  }
  return output;
}

function pickStatusValue(flat, aliases) {
  for (const alias of aliases) {
    const value = flat.get(normalizeKey(alias));
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseTextStatus(text) {
  const pick = (pattern) => text.match(pattern)?.[1]?.trim() ?? null;
  return {
    apiUrl: pick(/API URL:\s*(\S+)/i),
    dbUrl: pick(/DB URL:\s*(\S+)/i),
    anonKey: pick(/anon key:\s*(\S+)/i),
    serviceRoleKey: pick(/service_role key:\s*(\S+)/i),
  };
}

function parseStatus(result) {
  try {
    const parsed = JSON.parse(result.stdout);
    const flat = flattenStatus(parsed);
    return {
      apiUrl: pickStatusValue(flat, ["api.url", "api_url", "API URL", "API_URL"]),
      dbUrl: pickStatusValue(flat, ["db.url", "db_url", "DB URL", "DB_URL"]),
      anonKey: pickStatusValue(flat, ["auth.anon_key", "anon_key", "anon key", "ANON_KEY"]),
      serviceRoleKey: pickStatusValue(flat, [
        "auth.service_role_key",
        "service_role_key",
        "service_role key",
        "SERVICE_ROLE_KEY",
      ]),
    };
  } catch {
    return parseTextStatus(`${result.stdout}\n${result.stderr}`);
  }
}

function publicTarget(status) {
  return {
    kind: "local_supabase",
    projectId: PROJECT_ID,
    apiUrl: status.apiUrl ?? null,
    dbUrl: status.dbUrl ? redactSensitive(status.dbUrl) : null,
  };
}

function writeReport(report) {
  mkdirSync(docsRoot, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function buildReport({ status, summary, blockers, steps, localStatus, stopResult, outputTail }) {
  return {
    ...buildStage5EvidenceHeader("rls", "npm run test:stage-5-rls"),
    status,
    rlsStatus: status === "PASS" ? "zero_skip_passed" : "blocked",
    productionStatus: "NO-GO",
    target: localStatus ? publicTarget(localStatus) : { kind: "local_supabase", projectId: PROJECT_ID },
    preflight: {
      docker: steps.docker,
      supabaseCli: steps.supabaseCli,
      localOnly: true,
      envSource: "child_process_only",
      writesEnvLocal: false,
      reportSecretsRedacted: true,
    },
    reset: steps.reset,
    test: {
      ...summary,
      zeroSkipped: summary.skipped === 0,
      minPassedRequired: MIN_PASSED_RLS_TESTS,
      exitCode: steps.vitest?.exitCode ?? 1,
    },
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    total: summary.total,
    zeroSkipped: summary.skipped === 0,
    rawReportRemoved: !existsSync(rawPath),
    cleanup: {
      supabaseStop: stopResult
        ? {
            status: stopResult.status === 0 ? "PASS" : "FAIL",
            exitCode: stopResult.status,
          }
        : null,
    },
    blockers,
    outputTail,
    evidencePath: reportPath,
  };
}

function addBlocker(blockers, code) {
  if (!blockers.includes(code)) blockers.push(code);
}

mkdirSync(docsRoot, { recursive: true });
if (existsSync(rawPath)) rmSync(rawPath, { force: true });

const blockers = [];
const steps = {};
let localStatus = null;
let stopResult = null;
let outputTail = "";
let started = false;
let summary = { passed: 0, failed: 1, skipped: 0, total: 0, failures: [] };

const supabaseCli = runSupabase(["--version"], { timeoutMs: 60_000 });
steps.supabaseCli = {
  status: supabaseCli.status === 0 ? "PASS" : "FAIL",
  exitCode: supabaseCli.status,
  version: supabaseCli.status === 0 ? supabaseCli.stdout.trim() : null,
};
if (supabaseCli.status !== 0) addBlocker(blockers, "supabase_cli_unavailable");

const docker = runCapture(dockerCommand(), ["version", "--format", "json"], {
  cwd: appRoot,
  timeoutMs: 60_000,
});
let dockerServerVersion = null;
try {
  dockerServerVersion = JSON.parse(docker.stdout).Server?.Version ?? null;
} catch {
  dockerServerVersion = null;
}
steps.docker = {
  status: docker.status === 0 ? "PASS" : "FAIL",
  exitCode: docker.status,
  serverVersion: dockerServerVersion,
};
outputTail += tail(docker);
if (docker.status !== 0) addBlocker(blockers, "docker_preflight_failed");

try {
  if (blockers.length === 0) {
    const start = runSupabase(["start"], { timeoutMs: 300_000 });
    started = true;
    steps.start = { status: start.status === 0 ? "PASS" : "FAIL", exitCode: start.status };
    outputTail += tail(start);
    if (start.status !== 0) addBlocker(blockers, "supabase_start_failed");
  }

  if (blockers.length === 0) {
    const statusResult = runSupabase(["status", "-o", "json"], { timeoutMs: 120_000 });
    steps.status = { status: statusResult.status === 0 ? "PASS" : "FAIL", exitCode: statusResult.status };
    localStatus = parseStatus(statusResult);
    outputTail += tail(statusResult);

    const hasCredentials = localStatus.apiUrl && localStatus.anonKey && localStatus.serviceRoleKey;
    if (statusResult.status !== 0 || !hasCredentials || !LOCAL_API_URL_PATTERN.test(localStatus.apiUrl ?? "")) {
      addBlocker(blockers, "supabase_status_missing_local_credentials");
    }
  }

  if (blockers.length === 0) {
    const reset = runSupabase(["db", "reset", "--local"], { timeoutMs: 300_000 });
    steps.reset = { status: reset.status === 0 ? "PASS" : "FAIL", exitCode: reset.status };
    outputTail += tail(reset);
    if (reset.status !== 0) addBlocker(blockers, "supabase_db_reset_failed");
  } else {
    steps.reset = { status: "NOT_RUN", exitCode: null };
  }

  if (blockers.length === 0) {
    const vitestEnv = {
      NEXT_PUBLIC_SUPABASE_URL: localStatus.apiUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: localStatus.anonKey,
      SUPABASE_URL: localStatus.apiUrl,
      SUPABASE_SERVICE_ROLE_KEY: localStatus.serviceRoleKey,
      MANU_ALLOW_REMOTE_RLS_TESTS: "",
    };
    const vitest = runCapture(
      npxCommand(),
      [
        "vitest",
        "run",
        "src/lib/supabase-rls.integration.test.ts",
        "--reporter=json",
        `--outputFile=${rawPath}`,
      ],
      {
        cwd: appRoot,
        timeoutMs: 900_000,
        maxBuffer: 80 * 1024 * 1024,
        env: vitestEnv,
      },
    );
    steps.vitest = { status: vitest.status === 0 ? "PASS" : "FAIL", exitCode: vitest.status };
    outputTail += tail(vitest);
    summary = readRawSummary() ?? { passed: 0, failed: 1, skipped: 0, total: 0, failures: [] };

    if (vitest.status !== 0 || summary.failed !== 0) addBlocker(blockers, "rls_suite_failed");
    if (summary.skipped !== 0) addBlocker(blockers, "rls_suite_has_skips");
    if (summary.passed < MIN_PASSED_RLS_TESTS || summary.total < MIN_PASSED_RLS_TESTS) {
      addBlocker(blockers, "rls_suite_below_minimum_count");
    }
  }
} finally {
  if (started) {
    stopResult = runSupabase(["stop", "--project-id", PROJECT_ID, "--no-backup"], { timeoutMs: 180_000 });
    outputTail += tail(stopResult);
    if (stopResult.status !== 0) addBlocker(blockers, "supabase_stop_failed");
  }
  if (existsSync(rawPath)) rmSync(rawPath, { force: true });
}

const reportStatus =
  blockers.length === 0 &&
  summary.failed === 0 &&
  summary.skipped === 0 &&
  summary.passed >= MIN_PASSED_RLS_TESTS
    ? "PASS"
    : "BLOCKED";

const secrets = [localStatus?.anonKey, localStatus?.serviceRoleKey];
const report = buildReport({
  status: reportStatus,
  summary,
  blockers,
  steps,
  localStatus,
  stopResult,
  outputTail: redactSensitive(outputTail, secrets).slice(-6_000),
});

writeReport(report);

if (report.status !== "PASS") {
  console.error("[stage-5-rls] BLOCKED");
  for (const blocker of blockers) {
    console.error(`- ${blocker}`);
  }
  process.exit(1);
}

console.log("[stage-5-rls] PASS clean local Supabase zero-skip RLS evidence written.");
