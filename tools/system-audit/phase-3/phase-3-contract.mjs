import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_3_ID, PHASE_3_STAGES } from "./phase-3-plan.mjs";

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
  writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function walk(root, relative = "", output = []) {
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) return output;
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".manu-runtime") continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) walk(root, child, output);
    else if (entry.isFile()) output.push(child);
  }
  return output;
}

function relativePosix(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function routePathFromSource(source) {
  const suffix = "/route.ts";
  const route = source.startsWith("app/src/app/api/") ? source.slice("app/src/app".length) : source;
  return route.endsWith(suffix) ? route.slice(0, -suffix.length) : route;
}

function sourceLine(source, needle) {
  const index = source.indexOf(needle);
  return index < 0 ? null : source.slice(0, index).split(/\r?\n/).length;
}

function exportedMethods(source) {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)]
    .map((match) => match[1])
    .sort();
}

function extractLiteralCalls(source, method) {
  return [...source.matchAll(new RegExp(`\\.${method}\\(\\s*[\\"']([^\\"']+)[\\"']`, "g"))]
    .map((match) => match[1])
    .sort();
}

const TENANT_ROUTE_PREFIXES = [
  "/api/account/",
  "/api/alerts",
  "/api/app-state",
  "/api/client-form-schemas",
  "/api/clients",
  "/api/context-intake/",
  "/api/conversations",
  "/api/dietitian/",
  "/api/handoffs/",
  "/api/internal-copilot/",
  "/api/messages/",
  "/api/notifications",
  "/api/operational-foundation",
  "/api/simulator",
];

function classifyRoute(source) {
  const route = routePathFromSource(source);
  if (route.startsWith("/api/ai-chat/")) return "tenant-ai-chat";
  if (route.startsWith("/api/shell/") || route === "/api/session/activity") return "tenant-shell";
  if (route.startsWith("/api/commercial/admin/")) return "commercial-admin";
  if (route.startsWith("/api/admin/auth/")) return "admin-auth";
  if (route.startsWith("/api/auth/")) return "customer-auth";
  if (route === "/api/auth-state") return "session-state";
  if (route === "/api/commercial/webhook" || route === "/api/whatsapp/webhook") return "webhook";
  if (route === "/api/health/release") return "release-health";
  if (route === "/api/commercial/billing-portal") return "tenant-commercial";
  if (
    route === "/api/commercial/mobile-install-audit" ||
    route === "/api/commercial/onboarding/claim" ||
    route === "/api/commercial/onboarding/status"
  ) return "authenticated-commercial";
  if (route === "/api/commercial/checkout" || route === "/api/commercial/invite-status") return "public-commercial";
  if (route === "/api/contact/leads") return "public-contact";
  if (route === "/api/demo-login" || route === "/api/demo-logout") return "local-demo";
  if (TENANT_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) return "tenant-app";
  return "unknown";
}

function routeMarkers(source) {
  return {
    aiChatWrapper: /withAiChatRoute/.test(source),
    appTenantContext: /resolveAppTenantContext/.test(source),
    accountTenantContext: /resolveAccountTenantContext/.test(source),
    shellContext: /resolveShell(ReadAccountContext|SessionActivityContext)/.test(source),
    adminAccess: /evaluateCommercialAdminAccess/.test(source),
    adminAllowlistSession: /evaluateCommercialAdminAllowlistSessionAccess/.test(source),
    serverAuthClient: /createSupabaseServerClient|createSupabaseServerReadOnlyClient/.test(source),
    mutableAuthClient: /createMutableSupabaseServerClient/.test(source),
    authenticatedUserLookup: /\.auth\.getUser\(\)/.test(source),
    serviceRoleClient: /getSupabaseAdminClient\(\)|SUPABASE_SERVICE_ROLE_KEY/.test(source),
    requestBody: /request\.json\(\)|request\.formData\(\)|request\.text\(\)/.test(source),
    queryInput: /nextUrl\.searchParams|url\.searchParams|searchParams\.get/.test(source),
    inputParser: /parse[A-Z][A-Za-z0-9]*(Body|Query|Param)|validate[A-Z][A-Za-z0-9]*(Request|Create|Body)/.test(source),
    aiChatResponse: /aiChatJsonResponse|aiChatErrorResponse/.test(source),
    shellResponse: /shellJsonResponse|shellBoundedJsonResponse|shellErrorResponse/.test(source),
    authErrorResponse: /authErrorResponse/.test(source),
    domainErrorResponse: /domainErrorResponse/.test(source),
    apiErrorResponse: /apiErrorResponse|apiErrorBody|createApiRequestId/.test(source),
    nextResponseJson: /NextResponse\.json/.test(source),
    responseSerializer: /NextResponse\.json|Response\.json|new NextResponse|new Response|stage6JsonResponse|conversationApiJsonResponse|shellJsonResponse|shellBoundedJsonResponse|aiChatJsonResponse/.test(source),
    noStoreHeader: /API_NO_STORE_HEADERS|Cache-Control["']?\s*:\s*["']no-store|no-store/.test(source),
    sameOrigin: /isCommercialAdminSameOriginRequest/.test(source),
    webhookSignature: /verifyWhatsAppWebhookSignature|constructWebhookEvent|extractWebhookPayloadAndSecret|isCanonicalMockWebhookGateEnabled/.test(source),
    localDemoGate: /isLocalDemoLoginAllowed|isSupabaseStoreConfigured/.test(source),
    releaseIdentity: /resolveReleaseIdentity/.test(source),
    validation: /validate[A-Z]|invalid_json|safeParse|rejectUnknownFields|assertPlainObject/.test(source),
  };
}

function clientIdentityFindings(source) {
  const findings = [];
  const patterns = [
    { code: "client_tenant_identity", expression: /(?:body|payload|input|form|record)\??\.(?:tenantId|tenant_id)/g },
    { code: "client_user_identity", expression: /(?:body|payload|input|form|record)\??\.(?:userId|user_id|authUserId|auth_user_id)/g },
    { code: "client_dietitian_identity", expression: /(?:body|payload|input|form|record)\??\.(?:dietitianId|dietitian_id)/g },
    { code: "client_identity_form_field", expression: /(?:formData|form)\.get\(\s*["'](?:tenantId|tenant_id|userId|user_id|authUserId|auth_user_id|dietitianId|dietitian_id)["']/g },
  ];
  for (const pattern of patterns) {
    if (pattern.expression.test(source)) findings.push({ code: pattern.code, line: sourceLine(source, source.match(pattern.expression)?.[0] ?? "") });
  }
  return findings;
}

function expectedContract(contractClass) {
  const common = { verificationScenario: "phase-3.1.api-contract" };
  switch (contractClass) {
    case "tenant-ai-chat":
      return { ...common, authGate: "withAiChatRoute", tenantBoundary: "resolveAppTenantContext", responseContract: "ai-chat" };
    case "tenant-shell":
      return { ...common, authGate: "resolveShell*AccountContext", tenantBoundary: "resolveAccountTenantContext", responseContract: "shell" };
    case "commercial-admin":
      return { ...common, authGate: "evaluateCommercialAdminAccess_or_allowlist_session", tenantBoundary: "admin-allowlist", responseContract: "admin-json" };
    case "tenant-app":
      return { ...common, authGate: "resolveAppTenantContext_or_account_context", tenantBoundary: "verified-membership", responseContract: "api-json" };
    case "tenant-commercial":
      return { ...common, authGate: "resolveAccountTenantContext", tenantBoundary: "verified-membership", responseContract: "api-json" };
    case "admin-auth":
      return { ...common, authGate: "admin-email-allowlist", tenantBoundary: "auth-session", responseContract: "auth-json" };
    case "customer-auth":
      return { ...common, authGate: "Supabase-auth-provider", tenantBoundary: "auth-session", responseContract: "auth-json" };
    case "session-state":
      return { ...common, authGate: "Supabase-server-auth", tenantBoundary: "verified-user", responseContract: "auth-json" };
    case "authenticated-commercial":
      return { ...common, authGate: "Supabase-server-auth", tenantBoundary: "verified-user", responseContract: "api-json" };
    case "public-commercial":
      return { ...common, authGate: "invite-token-and-rate-limit", tenantBoundary: "commercial-invite", responseContract: "api-json" };
    case "public-contact":
      return { ...common, authGate: "validated-public-form-and-rate-limit", tenantBoundary: "public-lead", responseContract: "api-json" };
    case "webhook":
      return { ...common, authGate: "signature-or-canonical-secret", tenantBoundary: "ingress-queue", responseContract: "webhook-json" };
    case "release-health":
      return { ...common, authGate: "release-identity-read-only", tenantBoundary: "public-health", responseContract: "health-json" };
    case "local-demo":
      return { ...common, authGate: "localhost-development-gate", tenantBoundary: "local-demo-only", responseContract: "demo-response" };
    default:
      return { ...common, authGate: null, tenantBoundary: null, responseContract: null };
  }
}

function evaluateRoute(route) {
  const { contractClass, markers, methods, identityFindings } = route;
  const findings = [];
  if (contractClass === "unknown") findings.push({ code: "route_class_unknown", blocker: true });
  if (methods.length === 0) findings.push({ code: "http_method_export_missing", blocker: true });
  if (identityFindings.length > 0) {
    for (const finding of identityFindings) findings.push({ ...finding, blocker: true });
  }

  const gateOk = {
    "tenant-ai-chat": markers.aiChatWrapper,
    "tenant-shell": markers.shellContext,
    "commercial-admin": markers.adminAccess || markers.adminAllowlistSession,
    "tenant-app": markers.appTenantContext || markers.accountTenantContext,
    "tenant-commercial": markers.accountTenantContext,
    "admin-auth": markers.adminAccess || markers.adminAllowlistSession || /evaluateAdminAllowlistAccess/.test(route.sourceText),
    "customer-auth": markers.mutableAuthClient || markers.serverAuthClient || /getSupabaseConfig|createClient/.test(route.sourceText),
    "session-state": markers.serverAuthClient && markers.authenticatedUserLookup,
    "authenticated-commercial": markers.serverAuthClient && markers.authenticatedUserLookup,
    "public-commercial": markers.serviceRoleClient && markers.validation,
    "public-contact": markers.serviceRoleClient && markers.validation,
    "webhook": markers.webhookSignature,
    "release-health": markers.releaseIdentity,
    "local-demo": markers.localDemoGate,
    unknown: false,
  }[contractClass];
  if (!gateOk) findings.push({ code: "required_auth_or_ingress_gate_missing", blocker: true });

  const responseOk = {
    "tenant-ai-chat": markers.responseSerializer,
    "tenant-shell": markers.responseSerializer,
    "commercial-admin": markers.responseSerializer,
    "tenant-app": markers.responseSerializer,
    "tenant-commercial": markers.responseSerializer,
    "admin-auth": markers.responseSerializer,
    "customer-auth": markers.responseSerializer,
    "session-state": markers.responseSerializer,
    "authenticated-commercial": markers.responseSerializer,
    "public-commercial": markers.responseSerializer,
    "public-contact": markers.responseSerializer,
    "webhook": markers.responseSerializer,
    "release-health": markers.responseSerializer,
    "local-demo": markers.responseSerializer,
    unknown: false,
  }[contractClass];
  if (!responseOk) findings.push({ code: "response_serializer_missing", blocker: true });

  return {
    status: findings.some((finding) => finding.blocker) ? "BLOCKED" : "PASS",
    findings,
    gateVerified: Boolean(gateOk),
    responseVerified: Boolean(responseOk),
  };
}

export function buildApiContractMatrix(repoRoot) {
  const apiRoot = path.join(repoRoot, "app", "src", "app", "api");
  const routeFiles = walk(apiRoot)
    .filter((file) => path.basename(file) === "route.ts")
    .map((file) => path.join(apiRoot, file))
    .sort();
  const routes = routeFiles.map((absolutePath) => {
    const source = readFileSync(absolutePath, "utf8");
    const sourcePath = relativePosix(repoRoot, absolutePath);
    const contractClass = classifyRoute(sourcePath);
    const markers = routeMarkers(source);
    const route = {
      source: sourcePath,
      routePath: routePathFromSource(sourcePath),
      methods: exportedMethods(source),
      contractClass,
      expected: expectedContract(contractClass),
      markers,
      directDatabaseTargets: [...new Set([...extractLiteralCalls(source, "from"), ...extractLiteralCalls(source, "rpc")])].sort(),
      identityFindings: clientIdentityFindings(source),
      sourceBytes: statSync(absolutePath).size,
      sourceSha256: sha256File(absolutePath),
    };
    return { ...route, evaluation: evaluateRoute({ ...route, sourceText: source }) };
  });
  const blockers = routes.flatMap((route) => route.evaluation.findings.map((finding) => ({ source: route.source, ...finding })));
  const counts = {
    routeCount: routes.length,
    methodCount: routes.reduce((total, route) => total + route.methods.length, 0),
    classCount: new Set(routes.map((route) => route.contractClass)).size,
    protectedRouteCount: routes.filter((route) => !["release-health", "public-contact", "public-commercial", "webhook", "local-demo", "customer-auth", "admin-auth"].includes(route.contractClass)).length,
    blockerCount: blockers.length,
  };
  return {
    schemaVersion: "aiya-system-audit-phase-3-api-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_3_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    scanRoot: "app/src/app/api",
    counts,
    routes,
    blockers,
    matrixDigest: stableDigest({ counts, routes: routes.map(({ source, routePath, methods, contractClass, expected, markers, directDatabaseTargets, identityFindings, sourceSha256, evaluation }) => ({ source, routePath, methods, contractClass, expected, markers, directDatabaseTargets, identityFindings, sourceSha256, evaluation })) }),
  };
}

function readText(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

export function buildIdentityContractMatrix(repoRoot, testResults = []) {
  const supabase = readText(repoRoot, "app/src/lib/supabase.ts");
  const mutableAuth = readText(repoRoot, "app/src/lib/phase-85-stage-4d-auth-server.ts");
  const adminAccess = readText(repoRoot, "app/src/lib/commercial-admin-access.ts");
  const adminConsole = readText(repoRoot, "app/src/lib/phase-84f-admin-console.ts");
  const authContext = readText(repoRoot, "app/src/lib/auth-context.ts");
  const sourceFiles = [
    "app/src/lib/supabase.ts",
    "app/src/lib/phase-85-stage-4d-auth-server.ts",
    "app/src/lib/commercial-admin-access.ts",
    "app/src/lib/phase-84f-admin-console.ts",
    "app/src/lib/auth-context.ts",
  ];
  const checks = [
    { id: "anon_server_client", pass: /createServerClient\(config\.url, config\.anonKey/.test(supabase) },
    { id: "service_role_server_only", pass: /createClient\(url, serviceRoleKey/.test(supabase) && !/SUPABASE_SERVICE_ROLE_KEY/.test(readText(repoRoot, "app/src/components/admin-login-form.tsx")) },
    { id: "service_client_session_disabled", pass: /persistSession:\s*false/.test(supabase) && /autoRefreshToken:\s*false/.test(supabase) },
    { id: "mutable_cookie_adapter_server_side", pass: /cookies\(\)/.test(mutableAuth) && /applyAuthMutations/.test(mutableAuth) },
    { id: "admin_user_lookup", pass: /supabase\.auth\.getUser\(\)/.test(adminAccess) },
    { id: "admin_allowlist_gate", pass: /evaluateAdminAllowlistAccess/.test(adminAccess) && /resolveAdminEmailAllowlist/.test(adminAccess) },
    { id: "admin_default_owner", pass: /olkuenver@gmail\.com/.test(adminConsole) },
    { id: "admin_default_contact", pass: /DEFAULT_ADMIN_ALLOWLIST_EMAILS/.test(adminConsole) && /AIYA_PUBLIC_CONTACT_EMAIL/.test(adminConsole) },
    { id: "tenant_membership_verified", pass: /tenant_memberships/.test(authContext) && /resolveUniqueTenantMembership/.test(authContext) },
    { id: "session_claim_verified", pass: /readVerifiedSessionIdFromAccessToken/.test(authContext) && /session_claim_missing/.test(authContext) },
  ];
  const publicClientFiles = walk(path.join(repoRoot, "app", "src", "components"))
    .map((file) => path.join(repoRoot, "app", "src", "components", file));
  const serviceKeyLeaks = publicClientFiles
    .filter((filePath) => /\.(ts|tsx|js|jsx)$/.test(filePath))
    .map((filePath) => ({ source: relativePosix(repoRoot, filePath), sourceText: readFileSync(filePath, "utf8") }))
    .filter(({ sourceText }) => /process\.env\.SUPABASE_SERVICE_ROLE_KEY|createClient\([^\n]+serviceRoleKey|serviceRoleKey\s*[:=]\s*process\.env/i.test(sourceText))
    .map(({ source }) => ({ source, code: "service_role_reference_in_client_component" }));
  const failedChecks = checks.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true }));
  const failedTests = testResults.filter((result) => result.status !== "PASS").map((result) => ({ code: `test:${result.name}`, blocker: true }));
  const blockers = [...failedChecks, ...serviceKeyLeaks.map((finding) => ({ ...finding, blocker: true })), ...failedTests];
  return {
    schemaVersion: "aiya-system-audit-phase-3-identity-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_3_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    checks,
    sourceFiles: sourceFiles.map((source) => ({ source, sha256: sha256File(path.join(repoRoot, source)) })),
    serviceKeyLeaks,
    testResults,
    blockers,
    matrixDigest: stableDigest({ checks, sourceFiles, serviceKeyLeaks, testResults, blockers }),
  };
}

export function buildTenantSecurityMatrix(repoRoot, apiMatrix, runtimeResults = [], phase2Evidence = {}) {
  const staticFindings = [];
  for (const route of apiMatrix.routes) {
    if (["tenant-ai-chat", "tenant-shell", "tenant-app", "tenant-commercial", "authenticated-commercial"].includes(route.contractClass)) {
      if (route.evaluation.status !== "PASS") staticFindings.push({ source: route.source, code: "protected_route_contract_failed", blocker: true });
      if (route.identityFindings.length > 0) staticFindings.push({ source: route.source, code: "client_identity_used_as_authority", blocker: true });
    }
  }
  const phase2Checks = [
    { id: "schema_diff", pass: phase2Evidence.schemaDiff?.status === "PASS" },
    { id: "isolated_reconciliation", pass: phase2Evidence.isolated?.status === "PASS" },
    { id: "schema_contract", pass: phase2Evidence.contract?.status === "PASS" },
  ];
  const runtimeFailures = runtimeResults.filter((result) => result.status !== "PASS").map((result) => ({ code: `runtime:${result.name}`, blocker: true }));
  const blockers = [
    ...staticFindings,
    ...phase2Checks.filter((check) => !check.pass).map((check) => ({ code: `phase2:${check.id}`, blocker: true })),
    ...runtimeFailures,
  ];
  return {
    schemaVersion: "aiya-system-audit-phase-3-tenant-security-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_3_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    routeCoverage: {
      protectedRoutes: apiMatrix.routes.filter((route) => ["tenant-ai-chat", "tenant-shell", "tenant-app", "tenant-commercial", "authenticated-commercial"].includes(route.contractClass)).length,
      staticFindings,
    },
    phase2Checks,
    runtimeResults,
    mutationBoundary: {
      production: false,
      linkedSupabase: false,
      localFixture: true,
    },
    blockers,
    matrixDigest: stableDigest({ staticFindings, phase2Checks, runtimeResults, blockers }),
  };
}

export function createInitialState({ repoRoot, sourceCommit, openedAt }) {
  return {
    schemaVersion: "aiya-system-audit-phase-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_3_ID,
    repoRoot,
    sourceCommit,
    openedAt,
    phaseStatus: "OPEN",
    stages: Object.fromEntries(PHASE_3_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      evidencePath: null,
      evidenceDigest: null,
      outputDigests: {},
      blockers: [],
    }])),
    nextStage: "3.1",
  };
}

export function assertPhase2Closed(repoRoot) {
  const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-2", "phase-2-state.json");
  const closurePath = path.join(repoRoot, "docs", "system-audit", "phase-2", "phase-2-closure.json");
  if (!existsSync(statePath) || !existsSync(closurePath)) return { ok: false, reason: "phase_2_closure_files_missing" };
  const state = readJson(statePath);
  const closure = readJson(closurePath);
  const stageIds = ["2.1", "2.2", "2.3", "2.4"];
  const stageFailures = [];
  for (const stageId of stageIds) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") stageFailures.push(`stage_${stageId}_not_verified`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-2", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) stageFailures.push(`stage_${stageId}_output_stale:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) stageFailures.push(`stage_${stageId}_evidence_stale`);
    }
  }
  const ok = state.phaseStatus === "CLOSED" && closure.status === "CLOSED" && closure.nextPhaseUnlocked === true && stageFailures.length === 0;
  return { ok, reason: ok ? null : "phase_2_not_closed_or_evidence_stale", stateDigest: sha256File(statePath), closureDigest: sha256File(closurePath), sourceCommit: state.sourceCommit, stageFailures };
}

export function assertCanBeginStage(state, stageId) {
  const stage = PHASE_3_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error(`unsupported_phase_3_stage:${stageId}`);
  const current = state.stages?.[stageId];
  if (!current) throw new Error(`phase_3_stage_state_missing:${stageId}`);
  if (current.status === "VERIFIED") throw new Error(`phase_3_stage_already_verified:${stageId}`);
  if (current.status === "IN_PROGRESS") throw new Error(`phase_3_stage_already_started:${stageId}`);
  for (const prerequisite of stage.prerequisiteStageIds) {
    if (prerequisite === "phase-2-closed") continue;
    if (state.stages?.[prerequisite]?.status !== "VERIFIED") throw new Error(`phase_3_stage_prerequisite_not_verified:${stageId}:${prerequisite}`);
  }
}

export function buildEvidence({ stage, sourceCommit, status, outputFiles, operations, verification, blockers = [] }) {
  const evidence = {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: `${PHASE_3_ID}-${stage.id}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17)}`,
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_3_ID,
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

export function phase3OutputPath(repoRoot, name) {
  return path.join(repoRoot, "docs", "system-audit", "phase-3", name);
}

export function phase3EvidencePath(repoRoot, stageId) {
  return path.join(repoRoot, "docs", "system-audit", "phase-3", "stages", `stage-${stageId}.json`);
}
