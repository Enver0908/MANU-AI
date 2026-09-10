#!/usr/bin/env node
/**
 * AIya Performance Phase 2 harness.
 *
 * This phase records valid-measurement readiness, causal attribution gates, and
 * local remediation eligibility. It must not deploy, push, run remote
 * migrations, seed live data, capture raw payloads, or treat fallback results as
 * authenticated performance evidence.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const evidencePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_2_EVIDENCE.json");
const combinedManifestPath = join(docsRoot, "AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json");
const phase1EvidencePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json");
const phase12EvidencePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json");
const phase1ManifestPath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_1_FINDING_MANIFEST.json");
const phase2ScopePath = join(docsRoot, "AIYA_PERFORMANCE_PHASE_2_EXECUTION_SCOPE.md");

export const PHASE_2_BUDGETS = {
  loginToDashboardReadyP75Ms: 3000,
  warmNavigationReadyP75Ms: 1000,
  warmNavigationReadyP95Ms: 2000,
  eventToNextPaintP75Ms: 200,
  eventToNextPaintP95Ms: 500,
  requiredReadBodyFinishedP75Ms: 900,
  initialDashboardLcpP75Ms: 2500,
  clsMax: 0.1,
  maxForegroundLongTaskMs: 500,
  slowNetworkTaskReadyP75Ms: 4000,
};

export const PHASE_2_SCENARIOS = [
  {
    scenarioId: "post_login_dashboard",
    startRoute: "/login",
    expectedRoute: "/dashboard",
    userAction: "submit_password_login",
    requiredReadySelector: '[data-testid="authenticated-shell"]',
    requiredReads: ["/api/shell/bootstrap", "/api/app-state"],
    allowedMutations: ["/api/auth/password-login", "/api/session/activity"],
    forbiddenMutations: [],
    budget: "loginToDashboardReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "client_roster",
    startRoute: "/dashboard",
    expectedRoute: "/dashboard?section=clients",
    userAction: "click_shell_clients",
    requiredReadySelector: '[data-testid="client-roster"]',
    requiredReads: ["/api/shell/bootstrap", "/api/app-state", "/api/clients"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: [],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "client_forms_workspace",
    startRoute: "/dashboard?section=clients",
    expectedRoute: "/dashboard?section=clients&clientTask=forms",
    userAction: "click_client_forms_task",
    requiredReadySelector: '[data-testid="client-form-panel"]',
    requiredReads: ["/api/clients/:clientId", "/api/clients/:clientId/forms"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/clients/:clientId/forms:POST"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "nutrition_workspace",
    startRoute: "/dashboard?section=clients",
    expectedRoute: "/dashboard?section=clients&clientTask=nutrition",
    userAction: "click_client_nutrition_task",
    requiredReadySelector: '[data-testid="active-nutrition-plan-panel"]',
    requiredReads: ["/api/clients/:clientId", "/api/clients/:clientId/food-rule-profile"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/clients/:clientId/food-rule-profile:POST"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "menu_workspace",
    startRoute: "/dashboard?section=clients",
    expectedRoute: "/dashboard?section=clients&clientTask=menu",
    userAction: "click_client_menu_task",
    requiredReadySelector: '[data-testid="menu-workflow-panel"]',
    requiredReads: ["/api/clients/:clientId", "/api/clients/:clientId/menu-plans"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/clients/:clientId/menu-plans:POST"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "messages",
    startRoute: "/dashboard",
    expectedRoute: "/dashboard?section=messages",
    userAction: "click_shell_messages",
    requiredReadySelector: '[data-testid="messaging-panel"]',
    requiredReads: ["/api/conversations"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/messages/manual"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "alerts",
    startRoute: "/dashboard",
    expectedRoute: "/dashboard?section=alerts",
    userAction: "click_shell_alerts",
    requiredReadySelector: '[data-testid="alerts-panel"]',
    requiredReads: ["/api/alerts"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/notifications/:id/acknowledge"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "notifications",
    startRoute: "/dashboard",
    expectedRoute: "/dashboard?section=notifications",
    userAction: "click_shell_notifications",
    requiredReadySelector: '[data-testid="notifications-panel"]',
    requiredReads: ["/api/notifications"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/notifications/:id/complete-review"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
  {
    scenarioId: "ai_chat",
    startRoute: "/dashboard",
    expectedRoute: "/dashboard/ai-chat",
    userAction: "click_ai_chat_entry",
    requiredReadySelector: '[data-testid="ai-chat-workspace"]',
    requiredReads: ["/api/ai-chat/conversations"],
    allowedMutations: ["/api/session/activity"],
    forbiddenMutations: ["/api/ai-chat/conversations:POST"],
    budget: "warmNavigationReadyP75Ms",
    sampleCount: 20,
  },
];

export const SENSITIVE_FIELD_DENYLIST = [
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "token",
  "password",
  "secret",
  "prompt",
  "raw",
  "email",
  "phone",
  "patient",
  "clientName",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, ...(options.env ?? {}) },
    timeout: options.timeout ?? 30_000,
  });
  return {
    command: [command, ...args].join(" "),
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function sha256File(path) {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeRoute(input) {
  const value = String(input ?? "");
  let pathname = value;
  try {
    pathname = new URL(value, "https://local.invalid").pathname;
  } catch {
    pathname = value.split("?")[0];
  }
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\bclient-[a-z0-9_-]+\b/gi, ":clientId")
    .replace(/\bchat-[a-z0-9_-]+\b/gi, ":chatId")
    .replace(/\brun-[a-z0-9_-]+\b/gi, ":runId")
    .replace(/\bmsg-[a-z0-9_-]+\b/gi, ":messageId")
    .replace(/\/[0-9]+(?=\/|$)/g, "/:id");
}

export function sanitizeEvidenceValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeEvidenceValue);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      SENSITIVE_FIELD_DENYLIST.some((part) => normalizedKey.includes(part.toLowerCase())) ||
      /^(request|response)?body$/i.test(key) ||
      /^(request|response)?content$/i.test(key)
    ) {
      output[key] = "<redacted>";
    } else if (
      (normalizedKey.includes("url") || normalizedKey.includes("route")) ||
      (normalizedKey.includes("path") && typeof item === "string" && /^(https?:\/\/|\/api\/|\/dashboard|\/login|\/auth)/.test(item))
    ) {
      output[key] = normalizeRoute(item);
    } else {
      output[key] = sanitizeEvidenceValue(item);
    }
  }
  return output;
}

function percentile(values, p) {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const index = Math.max(0, Math.min(usable.length - 1, Math.ceil((p / 100) * usable.length) - 1));
  return usable[index];
}

function routeMatches(actual, expected) {
  const normalizedActual = normalizeRoute(actual);
  const normalizedExpected = normalizeRoute(expected);
  return normalizedActual === normalizedExpected || normalizedActual.startsWith(`${normalizedExpected}/`);
}

export function classifyPhase2Sample(sample, scenario) {
  const requiredReads = scenario.requiredReads ?? [];
  const requests = sample.requests ?? [];
  const failedRequests = requests.filter((request) => {
    if (request.failure) return true;
    if (request.status == null) return true;
    return request.status < 200 || request.status >= 400;
  });
  const missingReads = requiredReads.filter(
    (expected) =>
      !requests.some(
        (request) =>
          request.method === "GET" &&
          routeMatches(request.route, expected) &&
          request.status >= 200 &&
          request.status < 300 &&
          Number.isFinite(request.bodyFinishedMs),
      ),
  );
  const forbiddenMutations = (scenario.forbiddenMutations ?? []).filter((expected) =>
    requests.some((request) => request.method !== "GET" && routeMatches(request.route, expected.split(":")[0])),
  );
  const functionalStatus =
    sample.readySelectorMatched === true && sample.targetUsable === true && missingReads.length === 0 ? "PASS" : "FAIL";
  const validityProblems = [];
  if (!sample.authenticated) validityProblems.push("not_authenticated");
  if (sample.fallbackStore === true) validityProblems.push("fallback_store_used");
  if (sample.demoCookieInjected === true) validityProblems.push("demo_cookie_used");
  if (missingReads.length) validityProblems.push("required_read_missing_or_non_2xx");
  if (failedRequests.length) validityProblems.push("failed_request_observed");
  if (forbiddenMutations.length) validityProblems.push("forbidden_mutation_observed");
  if (!Number.isFinite(sample.taskReadyMs)) validityProblems.push("task_ready_missing");
  if (!Number.isFinite(sample.eventToNextPaintMs)) validityProblems.push("event_to_next_paint_missing");
  const budgetProblems = [];
  const budgetMs = PHASE_2_BUDGETS[scenario.budget] ?? null;
  if (budgetMs != null && Number.isFinite(sample.taskReadyMs) && sample.taskReadyMs > budgetMs) {
    budgetProblems.push(`${scenario.budget}:${sample.taskReadyMs}>${budgetMs}`);
  }
  if (Number.isFinite(sample.eventToNextPaintMs) && sample.eventToNextPaintMs > PHASE_2_BUDGETS.eventToNextPaintP95Ms) {
    budgetProblems.push(`eventToNextPaint:${sample.eventToNextPaintMs}>${PHASE_2_BUDGETS.eventToNextPaintP95Ms}`);
  }
  if (Number.isFinite(sample.maxLongTaskMs) && sample.maxLongTaskMs > PHASE_2_BUDGETS.maxForegroundLongTaskMs) {
    budgetProblems.push(`maxLongTask:${sample.maxLongTaskMs}>${PHASE_2_BUDGETS.maxForegroundLongTaskMs}`);
  }
  return {
    sampleId: sample.sampleId,
    functionalStatus,
    validityStatus: validityProblems.length ? "FAIL" : "PASS",
    budgetStatus: budgetProblems.length ? "FAIL" : "PASS",
    missingReads,
    failedRequestCount: failedRequests.length,
    forbiddenMutations,
    validityProblems,
    budgetProblems,
  };
}

export function summarizePhase2Scenario(samples, scenario) {
  const classifications = samples.map((sample) => classifyPhase2Sample(sample, scenario));
  const taskReadyValues = samples.map((sample) => sample.taskReadyMs);
  const eventValues = samples.map((sample) => sample.eventToNextPaintMs);
  const requiredReadValues = samples.flatMap((sample) =>
    (sample.requests ?? [])
      .filter((request) =>
        (scenario.requiredReads ?? []).some((expected) => request.method === "GET" && routeMatches(request.route, expected)),
      )
      .map((request) => request.bodyFinishedMs),
  );
  return {
    scenarioId: scenario.scenarioId,
    sampleCount: samples.length,
    functionalStatus: classifications.every((item) => item.functionalStatus === "PASS") ? "PASS" : "FAIL",
    validityStatus: classifications.every((item) => item.validityStatus === "PASS") ? "PASS" : "FAIL",
    budgetStatus: classifications.every((item) => item.budgetStatus === "PASS") ? "PASS" : "FAIL",
    p75: {
      taskReadyMs: percentile(taskReadyValues, 75),
      eventToNextPaintMs: percentile(eventValues, 75),
      requiredReadBodyFinishedMs: percentile(requiredReadValues, 75),
    },
    p95: {
      taskReadyMs: percentile(taskReadyValues, 95),
      eventToNextPaintMs: percentile(eventValues, 95),
    },
    classifications,
  };
}

export function validatePhase2HarnessContract() {
  const failures = [];
  const ids = new Set(PHASE_2_SCENARIOS.map((scenario) => scenario.scenarioId));
  for (const required of [
    "post_login_dashboard",
    "client_roster",
    "client_forms_workspace",
    "nutrition_workspace",
    "menu_workspace",
    "messages",
    "alerts",
    "notifications",
    "ai_chat",
  ]) {
    if (!ids.has(required)) failures.push(`${required}:missing`);
  }
  for (const scenario of PHASE_2_SCENARIOS) {
    if (scenario.requiredReadySelector === "main") failures.push(`${scenario.scenarioId}:weak_ready_selector`);
    if (!scenario.requiredReads?.length) failures.push(`${scenario.scenarioId}:missing_required_reads`);
    if (scenario.sampleCount < 20) failures.push(`${scenario.scenarioId}:insufficient_sample_count`);
    for (const mutation of scenario.forbiddenMutations ?? []) {
      if (!mutation.startsWith("/api/")) failures.push(`${scenario.scenarioId}:forbidden_mutation_not_api`);
    }
  }
  const negativeAiChat = classifyPhase2Sample(
    {
      sampleId: "negative-ai-chat-401",
      authenticated: true,
      fallbackStore: false,
      demoCookieInjected: false,
      readySelectorMatched: true,
      targetUsable: true,
      taskReadyMs: 400,
      eventToNextPaintMs: 80,
      maxLongTaskMs: 100,
      requests: [{ route: "/api/ai-chat/conversations", method: "GET", status: 401, bodyFinishedMs: 30 }],
    },
    PHASE_2_SCENARIOS.find((scenario) => scenario.scenarioId === "ai_chat"),
  );
  if (negativeAiChat.validityStatus !== "FAIL" || negativeAiChat.functionalStatus !== "FAIL") {
    failures.push("negative_ai_chat_401_not_failed");
  }
  const fallbackDashboard = classifyPhase2Sample(
    {
      sampleId: "negative-fallback-dashboard",
      authenticated: true,
      fallbackStore: true,
      demoCookieInjected: false,
      readySelectorMatched: true,
      targetUsable: true,
      taskReadyMs: 300,
      eventToNextPaintMs: 80,
      maxLongTaskMs: 100,
      requests: [
        { route: "/api/shell/bootstrap", method: "GET", status: 200, bodyFinishedMs: 20 },
        { route: "/api/app-state", method: "GET", status: 200, bodyFinishedMs: 20 },
      ],
    },
    PHASE_2_SCENARIOS.find((scenario) => scenario.scenarioId === "post_login_dashboard"),
  );
  if (fallbackDashboard.validityStatus !== "FAIL") failures.push("fallback_store_not_failed");
  return { status: failures.length ? "FAIL" : "PASS", failures };
}

function collectGitEvidence() {
  const branch = run("git", ["branch", "--show-current"]);
  const status = run("git", ["status", "--short", "--branch"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const upstream = run("git", ["rev-parse", "HEAD@{u}"]);
  const log = run("git", ["log", "-8", "--oneline", "--decorate"]);
  const remotes = run("git", ["remote", "-v"]);
  const branchVv = run("git", ["branch", "-vv"]);
  const diffCheck = run("git", ["diff", "--check"]);
  const remoteSymref = run("git", ["ls-remote", "--symref", "origin", "HEAD", "refs/heads/codex/production-readiness-stage-1"]);
  return {
    branch: branch.stdout,
    statusShortBranch: status.stdout,
    head: head.stdout,
    upstreamHead: upstream.status === 0 ? upstream.stdout : null,
    log: log.stdout,
    remotes: remotes.stdout,
    branchVv: branchVv.stdout,
    diffCheck: { status: diffCheck.status, output: diffCheck.stdout || diffCheck.stderr },
    remoteSymref: remoteSymref.stdout,
  };
}

async function collectLiveReleaseEvidence() {
  const endpoints = [
    "https://aiyaworkspace.com/api/health/release",
    "https://admin.aiyaworkspace.com/api/health/release",
  ];
  const results = [];
  for (const endpoint of endpoints) {
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const parsed = await response.json();
      results.push({
        endpoint,
        status: response.status,
        durationMs: Date.now() - startedAt,
        releaseId: parsed.releaseId ?? null,
        commitSha: parsed.commitSha ?? parsed.commit ?? null,
        migrationFingerprint: parsed.migrationFingerprint ?? null,
        compatibilityVersion: parsed.compatibilityVersion ?? null,
      });
    } catch (error) {
      results.push({
        endpoint,
        status: "FETCH_FAILED",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

function collectHistoricalEvidence() {
  const phase1 = readJson(phase1EvidencePath);
  const phase12 = readJson(phase12EvidencePath);
  const phase1Manifest = readJson(phase1ManifestPath);
  const combined = readJson(combinedManifestPath);
  return {
    files: [
      { path: relative(repoRoot, phase1EvidencePath).replaceAll("\\", "/"), sha256: sha256File(phase1EvidencePath) },
      { path: relative(repoRoot, phase12EvidencePath).replaceAll("\\", "/"), sha256: sha256File(phase12EvidencePath) },
      { path: relative(repoRoot, phase1ManifestPath).replaceAll("\\", "/"), sha256: sha256File(phase1ManifestPath) },
      { path: relative(repoRoot, combinedManifestPath).replaceAll("\\", "/"), sha256: sha256File(combinedManifestPath) },
      { path: relative(repoRoot, phase2ScopePath).replaceAll("\\", "/"), sha256: sha256File(phase2ScopePath) },
    ],
    phase1: {
      status: phase1?.status ?? null,
      sourceHead: phase1?.sourceHead ?? null,
      findingCount: phase1Manifest?.findings?.length ?? null,
    },
    phase12: {
      status: phase12?.status ?? null,
      sourceHead: phase12?.sourceHead ?? null,
      physicalAndroidStatus: phase12?.physicalAndroid?.status ?? null,
    },
    combined: {
      status: combined?.status ?? null,
      productionDecision: combined?.productionDecision ?? null,
      findingIds: (combined?.findings ?? []).map((finding) => finding.id),
    },
  };
}

function collectLocalPrerequisites() {
  const docker = run("docker", ["--version"]);
  const supabase = run("npx", ["supabase", "--version"], { cwd: appRoot, timeout: 60_000 });
  const supabaseStatus = run("npx", ["supabase", "status"], { cwd: appRoot, timeout: 60_000 });
  return {
    docker: { status: docker.status, stdout: docker.stdout, stderr: docker.stderr },
    supabaseCli: { status: supabase.status, stdout: supabase.stdout, stderr: supabase.stderr },
    supabaseStatus: {
      status: supabaseStatus.status,
      stdout: supabaseStatus.stdout,
      stderr: supabaseStatus.stderr,
      interpretedStatus: supabaseStatus.status === 0 ? "LOCAL_SUPABASE_RUNNING" : "LOCAL_SUPABASE_NOT_RUNNING_OR_DOCKER_UNAVAILABLE",
    },
    envFiles: {
      appEnvLocalPresent: existsSync(join(appRoot, ".env.local")),
      appEnvPresent: existsSync(join(appRoot, ".env")),
      supabaseConfigPresent: existsSync(join(appRoot, "supabase", "config.toml")),
    },
  };
}

function collectAndroidEvidence() {
  run("adb", ["start-server"]);
  const devices = run("adb", ["devices", "-l"]);
  const hasDevice = /\bdevice\b/.test(devices.stdout.replace(/^List of devices attached\s*/i, ""));
  const model = hasDevice ? run("adb", ["shell", "getprop", "ro.product.model"]).stdout : null;
  const androidVersion = hasDevice ? run("adb", ["shell", "getprop", "ro.build.version.release"]).stdout : null;
  const chromePackage = hasDevice ? run("adb", ["shell", "dumpsys", "package", "com.android.chrome"]).stdout : "";
  const chromeVersionName = chromePackage.match(/versionName=([^\r\n]+)/)?.[1] ?? null;
  const unixSockets = hasDevice ? run("adb", ["shell", "cat", "/proc/net/unix"]).stdout : "";
  const devtoolsRemotePresent = /devtools_remote/i.test(unixSockets);
  return {
    status: hasDevice && devtoolsRemotePresent ? "READY_FOR_CDP_CAPTURE" : hasDevice ? "CONNECTED_DEBUG_TARGET_NOT_READY" : "BLOCKED_NO_DEVICE",
    adbDevices: devices.stdout.replace(/[A-Z0-9]{8,}/g, "<device-id-redacted>"),
    model,
    androidVersion,
    chromeVersionName,
    devtoolsRemotePresent,
    note: "Device readiness is not a physical Android Chrome/PWA performance PASS without authenticated scenario capture.",
  };
}

function buildStageLedger(input) {
  const sourceIdentity = {
    branch: input.git.branch,
    head: input.git.head,
    upstreamHead: input.git.upstreamHead,
    liveRelease: input.liveRelease.map((item) => ({
      endpoint: item.endpoint,
      releaseId: item.releaseId ?? null,
      commitSha: item.commitSha ?? null,
      migrationFingerprint: item.migrationFingerprint ?? null,
    })),
  };
  return [
    {
      stageId: "2.1",
      status: "COMPLETE",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["Phase 1 evidence", "Phase 1.2 evidence", "combined finding manifest"],
      performedActions: [
        "Collected current git identity and live release identity",
        "Computed hashes for historical performance evidence files",
        "Confirmed Phase 1 and Phase 1.2 remain historical inputs",
      ],
      verificationResults: {
        gitHead: input.git.head,
        worktree: input.git.statusShortBranch,
        liveEndpointsOk: input.liveRelease.every((item) => item.status === 200),
        historicalHashesPresent: input.historical.files.every((file) => Boolean(file.sha256)),
      },
      outputEvidence: ["historicalEvidence.files", "git", "liveRelease"],
      blockingReason: null,
    },
    {
      stageId: "2.2",
      status: input.harnessContract.status === "PASS" ? "COMPLETE" : "FAILED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.1"],
      performedActions: [
        "Validated strong scenario selectors",
        "Required 2xx authenticated reads for ready state",
        "Ran in-process negative controls for AI Chat 401 and fallback-store samples",
      ],
      verificationResults: input.harnessContract,
      outputEvidence: ["phase2Scenarios", "harnessContract"],
      blockingReason: input.harnessContract.status === "PASS" ? null : "phase_2_harness_contract_failed",
    },
    {
      stageId: "2.3",
      status:
        input.localPrerequisites.supabaseStatus.interpretedStatus === "LOCAL_SUPABASE_RUNNING" ? "BLOCKED" : "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.2"],
      performedActions: [
        "Checked Docker, Supabase CLI, local config, and local Supabase status",
        "Did not reset, seed, migrate, or mutate any database",
      ],
      verificationResults: input.localPrerequisites,
      outputEvidence: ["localPrerequisites"],
      blockingReason:
        input.localPrerequisites.supabaseStatus.interpretedStatus === "LOCAL_SUPABASE_RUNNING"
          ? "local_real_supabase_fixture_and_authenticated_password_login_not_prepared_in_this_safe_run"
          : "local_supabase_not_running_or_docker_daemon_unavailable",
    },
    {
      stageId: "2.4",
      status: "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.3"],
      performedActions: ["Recorded that hosted synthetic account preparation requires separate external-system approval"],
      verificationResults: { externalApprovalPresent: false },
      outputEvidence: [],
      blockingReason: "hosted_synthetic_account_requires_separate_external_system_approval",
    },
    {
      stageId: "2.5",
      status: "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.3", "2.4"],
      performedActions: ["Checked physical Android ADB and Chrome DevTools readiness"],
      verificationResults: input.android,
      outputEvidence: ["android"],
      blockingReason:
        input.android.status === "READY_FOR_CDP_CAPTURE"
          ? "android_ready_but_authenticated_hosted_or_local_capture_not_available_without_prior_stage_completion"
          : "physical_android_cdp_capture_not_ready",
    },
    {
      stageId: "2.6",
      status: "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.5"],
      performedActions: ["No causal attribution run executed because valid authenticated baseline is unavailable"],
      verificationResults: { validAuthenticatedBaselinePresent: false },
      outputEvidence: [],
      blockingReason: "valid_authenticated_baseline_required_before_causal_attribution",
    },
    {
      stageId: "2.7",
      status: "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.6"],
      performedActions: ["No runtime remediation applied"],
      verificationResults: { runtimeChangesApplied: false },
      outputEvidence: [],
      blockingReason: "root_cause_not_proven",
    },
    {
      stageId: "2.8",
      status: "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.7"],
      performedActions: ["No before/after comparison executed because no remediation candidate exists"],
      verificationResults: { beforeAfterAvailable: false },
      outputEvidence: [],
      blockingReason: "local_remediation_not_available",
    },
    {
      stageId: "2.9",
      status: "BLOCKED",
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      sourceIdentity,
      prerequisiteEvidence: ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8"],
      performedActions: ["Final closure marked blocked because mandatory Phase 2 stages are blocked"],
      verificationResults: { closureOutcome: "PERFORMANCE_BLOCKED" },
      outputEvidence: [relative(repoRoot, evidencePath).replaceAll("\\", "/")],
      blockingReason: "mandatory_phase_2_evidence_chain_incomplete",
    },
  ];
}

function buildFindings(historical) {
  const prior = readJson(combinedManifestPath);
  return {
    generatedAt: new Date().toISOString(),
    status: "PHASE_2_BLOCKED_WITH_PRIOR_FINDINGS",
    productionDecision: "NO-GO",
    phase2Outcome: "PERFORMANCE_BLOCKED",
    phase2BlockingReasons: [
      "local_real_supabase_authenticated_baseline_unavailable",
      "hosted_synthetic_account_requires_separate_approval",
      "physical_android_ready_but_no_authenticated_capture",
      "root_cause_not_proven",
    ],
    findings: (prior?.findings ?? []).map((finding) => ({
      ...finding,
      phase2Status:
        finding.id === "PERF-F12-001" ? "MEASUREMENT_GATE_ENFORCED_PENDING_AUTHENTICATED_2XX" : "PENDING_VALID_AUTHENTICATED_REPRODUCTION",
    })),
    historicalEvidence: historical,
  };
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sanitizeEvidenceValue(value), null, 2)}\n`, "utf8");
}

export async function buildPhase2Evidence() {
  const startedAt = new Date().toISOString();
  const git = collectGitEvidence();
  const liveRelease = await collectLiveReleaseEvidence();
  const historical = collectHistoricalEvidence();
  const harnessContract = validatePhase2HarnessContract();
  const localPrerequisites = collectLocalPrerequisites();
  const android = collectAndroidEvidence();
  const finishedAt = new Date().toISOString();
  const stageInput = {
    startedAt,
    finishedAt,
    git,
    liveRelease,
    historical,
    harnessContract,
    localPrerequisites,
    android,
  };
  const stageLedger = buildStageLedger(stageInput);
  const blockers = stageLedger.filter((stage) => ["BLOCKED", "FAILED"].includes(stage.status)).map((stage) => ({
    stageId: stage.stageId,
    blockingReason: stage.blockingReason,
  }));
  return {
    phase: "AIya Performance Phase 2 - Valid Measurement, Root Cause, and Local Remediation",
    generatedAt: finishedAt,
    startedAt,
    sourceHead: git.head,
    productionDecision: "NO-GO",
    outcome: blockers.length ? "PERFORMANCE_BLOCKED" : "LOCAL_REMEDIATION_VERIFIED",
    status: blockers.length ? "BLOCKED" : "COMPLETE",
    constraints: {
      externalSystemMutation: "NOT_EXECUTED",
      liveSeedOrReset: "NOT_EXECUTED",
      remoteMigration: "NOT_EXECUTED",
      productionDeploy: "NOT_EXECUTED",
      pushPrMerge: "NOT_EXECUTED",
      providerOrChannelEgress: "NOT_EXECUTED",
      runtimeUiApiChange: "NOT_EXECUTED",
      rawPayloadTraceHarCookieTokenPromptClinicalCapture: "NOT_EXECUTED",
    },
    phase2Scenarios: PHASE_2_SCENARIOS,
    budgets: PHASE_2_BUDGETS,
    git,
    liveRelease,
    historicalEvidence: historical,
    harnessContract,
    localPrerequisites,
    android,
    stageLedger,
    blockers,
    findingManifestUpdate: buildFindings(historical),
  };
}

async function main() {
  const evidence = await buildPhase2Evidence();
  writeJson(evidencePath, evidence);
  writeJson(combinedManifestPath, evidence.findingManifestUpdate);
  console.log(`wrote ${relative(repoRoot, evidencePath).replaceAll("\\", "/")}`);
  console.log(`updated ${relative(repoRoot, combinedManifestPath).replaceAll("\\", "/")}`);
  console.log(`outcome ${evidence.outcome}`);
  if (evidence.outcome !== "LOCAL_REMEDIATION_VERIFIED") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
