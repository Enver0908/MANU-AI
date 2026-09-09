import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_5_ID, PHASE_5_STAGES } from "./phase-5-plan.mjs";

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

function walk(root, relative = "", output = []) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return output;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (["node_modules", ".next", ".manu-runtime"].includes(entry.name)) continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(root, child, output);
    else if (entry.isFile()) output.push(child);
  }
  return output;
}

function relativePosix(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function readText(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function sourceRecord(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return { source: relativePath, exists: false, bytes: 0, sha256: null };
  return { source: relativePath, exists: true, bytes: statSync(filePath).size, sha256: sha256File(filePath) };
}

function exactFileSources(repoRoot, relativePaths) {
  return relativePaths.map((source) => ({ path: source, text: readText(repoRoot, source) }));
}

function sourceFilesByPattern(repoRoot, directory, expression) {
  const absoluteRoot = path.join(repoRoot, directory);
  return walk(absoluteRoot)
    .filter((relative) => expression.test(relative) && /\.(ts|tsx|mjs)$/.test(relative))
    .map((relative) => {
      const absolute = path.join(absoluteRoot, relative);
      return { path: relativePosix(repoRoot, absolute), text: readFileSync(absolute, "utf8") };
    });
}

function allPass(checks) {
  return checks.every((check) => check.pass === true);
}

function markerCheck(id, description, sources, pattern) {
  const evidence = sources.filter((source) => pattern.test(source.text)).map((source) => source.path);
  return { id, description, pass: evidence.length > 0, evidence };
}

function normalizeApiPath(value) {
  return String(value ?? "")
    .replace(/\$\{[^}]+\}/g, "*")
    .replace(/\[\.\.\.[^\]]+\]/g, "*")
    .replace(/\[[^\]]+\]/g, "*")
    .split("?")[0]
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "") || "/";
}

function listPageSources(repoRoot) {
  return sourceFilesByPattern(repoRoot, "app/src/app", /(^|[\\/])page\.tsx$/).sort((a, b) => a.path.localeCompare(b.path));
}

function listApiRouteSources(repoRoot) {
  const files = sourceFilesByPattern(repoRoot, "app/src/app/api", /(^|[\\/])route\.ts$/);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function routePathFromSource(source) {
  const normalizedSource = String(source).replace(/\\/g, "/");
  const relative = normalizedSource.replace(/^app\/src\/app/, "").replace(/\/route\.ts$/, "");
  const apiPath = relative.replace(/\/api(?=\/|$)/, "/api");
  return normalizeApiPath(apiPath);
}

function listFrontendSources(repoRoot) {
  const files = [
    ...sourceFilesByPattern(repoRoot, "app/src/components", /\.(ts|tsx)$/),
    ...sourceFilesByPattern(repoRoot, "app/src/lib", /\.(ts|tsx)$/),
    ...sourceFilesByPattern(repoRoot, "app/src/app", /\.(ts|tsx)$/),
  ];
  return files
    .filter((source) => !/(^|[\\/])route\.ts$/.test(source.path) && !/\.test\.(ts|tsx)$/.test(source.path))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function extractFrontendApiCalls(sources) {
  const calls = [];
  const pattern = /["'`]((?:\/api\/)[^"'`\s]*)/g;
  for (const source of sources) {
    for (const match of source.text.matchAll(pattern)) {
      const raw = match[1];
      // The service-worker policy file registers pathname prefixes; these are
      // cache exclusions, not browser API calls that need a route handler.
      if (
        source.path.endsWith("app/src/lib/phase-85-stage-5-shell-pwa.ts") &&
        (raw.endsWith("/") || raw === "/api/auth")
      ) {
        continue;
      }
      const canonical = normalizeApiPath(raw);
      if (!canonical.startsWith("/api/")) continue;
      calls.push({ source: source.path, raw, canonical });
    }
  }
  return [...new Map(calls.map((call) => [`${call.source}:${call.raw}`, call])).values()].sort((a, b) => {
    return `${a.canonical}:${a.source}`.localeCompare(`${b.canonical}:${b.source}`);
  });
}

function buildApiRouteMap(routeSources) {
  return new Map(routeSources.map((source) => [routePathFromSource(source.path), source.path]));
}

export function buildFrontendBackendContractMatrix(repoRoot) {
  const pages = listPageSources(repoRoot);
  const routes = listApiRouteSources(repoRoot);
  const frontendSources = listFrontendSources(repoRoot);
  const apiCalls = extractFrontendApiCalls(frontendSources);
  const routeMap = buildApiRouteMap(routes);
  const endpointReconciliation = apiCalls.map((call) => ({
    ...call,
    routeSource: routeMap.get(call.canonical) ?? null,
    pass: routeMap.has(call.canonical),
  }));

  const clientSources = frontendSources.filter((source) => /^\s*["']use client["']/.test(source.text));
  const forbiddenClientImports = clientSources.flatMap((source) => {
    const matches = source.text.match(/getSupabaseAdminClient|process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_URL)|createClient\([^\n]{0,160}SERVICE_ROLE_KEY/gi) ?? [];
    return matches.map((match) => ({ source: source.path, marker: match }));
  });
  const contractSources = exactFileSources(repoRoot, [
    "app/src/components/dashboard/shell-provider.tsx",
    "app/src/lib/use-aiya-state.ts",
    "app/src/lib/use-ai-chat.ts",
    "app/src/app/api/shell/bootstrap/route.ts",
    "app/src/app/api/app-state/route.ts",
    "app/src/app/api/auth/password-login/route.ts",
    "app/src/app/api/admin/auth/password-login/route.ts",
  ]);
  const checks = [
    { id: "page_inventory", pass: pages.length >= 18, count: pages.length, minimum: 18 },
    { id: "api_route_inventory", pass: routes.length >= 100, count: routes.length, minimum: 100 },
    { id: "frontend_api_paths_reconciled", pass: endpointReconciliation.every((entry) => entry.pass), unresolved: endpointReconciliation.filter((entry) => !entry.pass) },
    markerCheck("shell_bootstrap_contract", "shell bootstrap fetch and route", contractSources, /\/api\/shell\/bootstrap|shellBoundedJsonResponse/),
    markerCheck("app_state_contract", "app-state fetch and route", contractSources, /\/api\/app-state|API_NO_STORE_HEADERS/),
    markerCheck("auth_route_contract", "customer and admin password auth routes", contractSources, /signInWithPassword|setSession/),
    markerCheck("structured_auth_errors", "stable structured auth errors", contractSources, /NextResponse\.json\(\{\s*error/),
    markerCheck("client_state_merge", "frontend response merge contract", contractSources, /replaceFromApi|mergeStage6MutationFromApi|mergeConversation/),
    {
      id: "client_server_boundary",
      pass: forbiddenClientImports.length === 0,
      forbiddenClientImports,
    },
  ];
  const blockers = checks.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true, details: check.unresolved ?? check.forbiddenClientImports ?? null }));
  const sourcePaths = [...new Set([
    ...pages.map((source) => source.path),
    ...routes.map((source) => source.path),
    ...frontendSources.map((source) => source.path),
  ])].sort();
  return {
    schemaVersion: "aiya-system-audit-phase-5-frontend-backend-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_5_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    inventory: { pageCount: pages.length, apiRouteCount: routes.length, frontendSourceCount: frontendSources.length },
    pages: pages.map((source) => sourceRecord(repoRoot, source.path)),
    routes: routes.map((source) => ({ ...sourceRecord(repoRoot, source.path), canonicalPath: routePathFromSource(source.path) })),
    apiCalls: endpointReconciliation,
    checks,
    blockers,
    sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)),
    matrixDigest: stableDigest({ inventory: { pageCount: pages.length, apiRouteCount: routes.length, frontendSourceCount: frontendSources.length }, apiCalls: endpointReconciliation, checks, blockers }),
  };
}

export function buildAuthUserFlowMatrix(repoRoot) {
  const sourcePaths = [
    "app/src/app/login/page.tsx",
    "app/src/app/admin/page.tsx",
    "app/src/app/onboarding/page.tsx",
    "app/src/app/auth/callback/route.ts",
    "app/src/components/customer-login-form.tsx",
    "app/src/components/admin-login-form.tsx",
    "app/src/components/onboarding-claim-panel.tsx",
    "app/src/app/api/auth/password-login/route.ts",
    "app/src/app/api/auth/magic-link/route.ts",
    "app/src/app/api/auth/password-reset/route.ts",
    "app/src/app/api/auth/password/route.ts",
    "app/src/app/api/admin/auth/password-login/route.ts",
    "app/src/app/api/admin/auth/magic-link/route.ts",
    "app/src/app/api/admin/auth/password-reset/route.ts",
    "app/src/app/api/commercial/onboarding/status/route.ts",
    "app/src/app/api/commercial/onboarding/claim/route.ts",
    "app/src/lib/dashboard-server-auth.ts",
    "app/src/lib/commercial-admin-access.ts",
    "app/src/lib/demo-fixture-access.ts",
    "app/src/app/api/demo-login/route.ts",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const checks = [
    markerCheck("customer_password_login", "customer password form and route", sources, /customer-login-form|\/api\/auth\/password-login/),
    markerCheck("customer_magic_link", "customer magic link form and route", sources, /\/api\/auth\/magic-link|verifyOtp|exchangeCodeForSession/),
    markerCheck("customer_recovery", "customer password reset", sources, /\/api\/auth\/password-reset/),
    markerCheck("admin_password_login", "admin password login and allowlist", sources, /\/api\/admin\/auth\/password-login|evaluateAdminAllowlistAccess/),
    markerCheck("admin_magic_link", "admin magic link and callback", sources, /\/api\/admin\/auth\/magic-link|admin_access_denied/),
    markerCheck("callback_redirect", "callback session exchange and safe redirect", sources, /exchangeCodeForSession|verifyOtp|sanitizePostAuthRedirectPath|\/dashboard/),
    markerCheck("dashboard_auth_gate", "dashboard membership/profile/entitlement gate", sources, /resolveCustomerSessionFacts|tenant_memberships|deriveCustomerAuthRedirect|entitlementStatus/),
    markerCheck("onboarding_claim_flow", "onboarding status/password/claim flow", sources, /\/api\/commercial\/onboarding\/status|\/api\/auth\/password|\/api\/commercial\/onboarding\/claim/),
    markerCheck("auth_error_contract", "auth not configured and invalid credential errors", sources, /auth_not_configured|invalid_credentials/),
    markerCheck("local_demo_boundary", "local-only demo login boundary", sources, /NODE_ENV.*development|isLocalhostHostname|isLocalDemoLoginAllowed|localhost/),
  ];
  const missingSources = sources.filter((source) => !source.text).map((source) => source.path);
  checks.push({ id: "required_auth_sources_exist", pass: missingSources.length === 0, missingSources });
  const blockers = checks.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true, details: check.missingSources ?? null }));
  return {
    schemaVersion: "aiya-system-audit-phase-5-auth-user-flow-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_5_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    checks,
    flowOrder: ["customer-password", "customer-magic-link", "callback", "dashboard-gate", "onboarding-claim", "admin-password", "admin-magic-link", "logout-recovery"],
    sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)),
    blockers,
    matrixDigest: stableDigest({ checks, flowOrder: ["customer-password", "customer-magic-link", "callback", "dashboard-gate", "onboarding-claim", "admin-password", "admin-magic-link", "logout-recovery"], sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)), blockers }),
  };
}

export function buildAuthenticatedShellMatrix(repoRoot) {
  const shellSources = [
    "app/src/components/dashboard/shell-provider.tsx",
    "app/src/components/dashboard/authenticated-shell-boundary.tsx",
    "app/src/components/dashboard-app.tsx",
    "app/src/lib/use-aiya-state.ts",
    "app/src/app/api/shell/bootstrap/route.ts",
    "app/src/app/api/shell/preferences/route.ts",
    "app/src/app/api/shell/clients/route.ts",
    "app/src/app/api/session/activity/route.ts",
    "app/src/app/api/app-state/route.ts",
    "app/src/app/dashboard/settings/page.tsx",
    "app/src/app/dashboard/more/page.tsx",
  ];
  const sources = exactFileSources(repoRoot, shellSources);
  const phase5ShellTests = sourceFilesByPattern(repoRoot, "app/src/lib", /^phase-85-stage-5-shell-.*\.test\.ts$/).map((source) => source.path).sort();
  const checks = [
    markerCheck("bootstrap_route", "authenticated shell bootstrap route", sources, /\/api\/shell\/bootstrap|resolveShellReadAccountContext|shellBoundedJsonResponse/),
    markerCheck("session_activity", "server session activity guard", sources, /session\/activity|assertShellSessionActivity|resolveShellForegroundSessionAction/),
    markerCheck("active_client_precedence", "URL preference active client precedence", sources, /resolveEffectiveShellActiveClientId|activeClientId/),
    markerCheck("mutation_contract", "authenticated mutation and request headers", sources, /authenticatedMutationFetch|requestId|expectedRevision/),
    markerCheck("dirty_navigation", "dirty registry and navigation confirmation", sources, /dirty|Dirty|canNavigateAway|requestDirty/),
    markerCheck("no_store_bounded", "no-store and bounded shell response", sources, /no-store|shellBoundedJsonResponse|SHELL_BOOTSTRAP_MAX_PAYLOAD_BYTES/),
    markerCheck("settings_more_surfaces", "settings and more canonical routes", sources, /settings|more|SettingsPageClient|MorePageClient/),
    markerCheck("windowed_state", "windowed app-state hydration", sources, /\/api\/app-state|view=windowed|loadSupabaseWindowedDashboardPayload/),
    { id: "stage5_shell_test_inventory", pass: phase5ShellTests.length >= 10, count: phase5ShellTests.length, minimum: 10 },
  ];
  const missingSources = sources.filter((source) => !source.text).map((source) => source.path);
  checks.push({ id: "required_shell_sources_exist", pass: missingSources.length === 0, missingSources });
  const blockers = checks.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true, details: check.missingSources ?? null }));
  return {
    schemaVersion: "aiya-system-audit-phase-5-authenticated-shell-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_5_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    checks,
    phase5ShellTests,
    sourceFiles: shellSources.map((source) => sourceRecord(repoRoot, source)),
    blockers,
    matrixDigest: stableDigest({ checks, phase5ShellTests, sourceFiles: shellSources.map((source) => sourceRecord(repoRoot, source)), blockers }),
  };
}

export function buildRealBackendBrowserSmokeMatrix(repoRoot, smokeResult) {
  const sourcePaths = [
    "tools/system-audit/phase-5/real-backend-smoke.mjs",
    "app/src/app/api/demo-login/route.ts",
    "app/src/lib/demo-fixture-access.ts",
    "app/src/app/dashboard/layout.tsx",
    "app/src/app/api/shell/bootstrap/route.ts",
    "app/src/app/api/app-state/route.ts",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const checks = [
    markerCheck("smoke_harness_local_only", "smoke harness asserts local target", sources, /127\.0\.0\.1:54321|localhost:54321|localOnly/),
    markerCheck("fallback_gate", "fallback and demo gate are explicit", sources, /MANU_DEV_FALLBACK_STORE|MANU_ALLOW_PUBLIC_DEMO_LOGIN|isLocalDemoLoginAllowed/),
    markerCheck("real_backend_read_paths", "shell and app-state real backend reads", sources, /\/api\/shell\/bootstrap|\/api\/app-state|isSupabaseStoreConfigured/),
    markerCheck("provider_egress_closed", "provider egress remains closed", sources, /MANU_ALLOW_REAL_ZAI|MANU_WHATSAPP_REAL_WEBHOOK_ENABLED|realProvider/),
    { id: "production_build_local_env_passed", description: "production build completed after local backend env was loaded", pass: smokeResult?.steps?.productionBuild?.status === "PASS" },
  ];
  const missingSources = sources.filter((source) => !source.text).map((source) => source.path);
  checks.push({ id: "smoke_sources_exist", pass: missingSources.length === 0, missingSources });
  const blockers = [
    ...checks.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true, details: check.missingSources ?? null })),
    ...(smokeResult?.status === "PASS" ? [] : [{ code: "real_backend_browser_smoke_failed", blocker: true, details: smokeResult?.blockers ?? ["smoke_result_missing"] }]),
  ];
  return {
    schemaVersion: "aiya-system-audit-phase-5-real-backend-browser-smoke-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_5_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    target: { kind: "local_supabase", apiUrl: "http://127.0.0.1:54321", linkedSupabase: false, production: false },
    smoke: smokeResult ?? null,
    checks,
    blockers,
    sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)),
    matrixDigest: stableDigest({ target: { kind: "local_supabase", linkedSupabase: false, production: false }, smoke: smokeResult ?? null, checks, blockers }),
  };
}

export function createInitialState({ repoRoot, sourceCommit, openedAt }) {
  return {
    schemaVersion: "aiya-system-audit-phase-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_5_ID,
    repoRoot,
    sourceCommit,
    openedAt,
    phaseStatus: "OPEN",
    stages: Object.fromEntries(PHASE_5_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      evidencePath: null,
      evidenceDigest: null,
      outputDigests: {},
      blockers: [],
    }])),
    nextStage: "5.1",
  };
}

export function assertPhase4Closed(repoRoot) {
  const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-4", "phase-4-state.json");
  const closurePath = path.join(repoRoot, "docs", "system-audit", "phase-4", "phase-4-closure.json");
  if (!existsSync(statePath) || !existsSync(closurePath)) return { ok: false, reason: "phase_4_closure_files_missing", stageFailures: [] };
  const state = readJson(statePath);
  const closure = readJson(closurePath);
  const stageFailures = [];
  for (const stageId of ["4.1", "4.2", "4.3", "4.4", "4.5"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") stageFailures.push(`stage_${stageId}_not_verified`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-4", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) stageFailures.push(`stage_${stageId}_output_stale:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) stageFailures.push(`stage_${stageId}_evidence_stale`);
    }
  }
  const ok = state.phaseStatus === "CLOSED" && closure.status === "CLOSED" && closure.nextPhase === "phase-5" && closure.nextPhaseUnlocked === true && stageFailures.length === 0;
  return {
    ok,
    reason: ok ? null : "phase_4_not_closed_or_evidence_stale",
    stateDigest: sha256File(statePath),
    closureDigest: sha256File(closurePath),
    sourceCommit: state.sourceCommit,
    stageFailures,
  };
}

export function assertCanBeginStage(state, stageId) {
  const stage = PHASE_5_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`unsupported_phase_5_stage:${stageId}`);
  const current = state.stages?.[stageId];
  if (!current) throw new Error(`phase_5_stage_state_missing:${stageId}`);
  if (current.status === "VERIFIED") throw new Error(`phase_5_stage_already_verified:${stageId}`);
  if (current.status === "IN_PROGRESS") throw new Error(`phase_5_stage_already_started:${stageId}`);
  for (const prerequisite of stage.prerequisiteStageIds) {
    if (prerequisite === "phase-4-closed") continue;
    if (state.stages?.[prerequisite]?.status !== "VERIFIED") {
      throw new Error(`phase_5_stage_prerequisite_not_verified:${stageId}:${prerequisite}`);
    }
  }
}

export function buildEvidence({ stage, sourceCommit, status, outputFiles, operations, verification, blockers = [] }) {
  const evidence = {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: `${PHASE_5_ID}-${stage.id}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17)}`,
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_5_ID,
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

export function phase5OutputPath(repoRoot, name) {
  return path.join(repoRoot, "docs", "system-audit", "phase-5", name);
}

export function phase5EvidencePath(repoRoot, stageId) {
  return path.join(repoRoot, "docs", "system-audit", "phase-5", "stages", `stage-${stageId}.json`);
}
