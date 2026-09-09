import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_4_ID, PHASE_4_STAGES } from "./phase-4-plan.mjs";

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
  return {
    source: relativePath,
    exists: true,
    bytes: statSync(filePath).size,
    sha256: sha256File(filePath),
  };
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

function markerCheck(id, description, sources, pattern) {
  const sourceText = sources.map((source) => source.text).join("\n");
  return {
    id,
    description,
    pass: pattern.test(sourceText),
    evidence: sources.filter((source) => pattern.test(source.text)).map((source) => source.path),
  };
}

function allPass(checks) {
  return checks.every((check) => check.pass === true);
}

function expectedReleaseWorkers() {
  return [
    { id: "media-stage4b3", command: "worker:media:stage4b3", onceCommand: "worker:media:stage4b3:once" },
    { id: "media-lifecycle", command: "worker:media:lifecycle", onceCommand: "worker:media:lifecycle:once" },
    { id: "audio-stage4b4", command: "worker:audio:stage4b4", onceCommand: "worker:audio:stage4b4:once" },
    { id: "audio-lifecycle-stage4b4", command: "worker:audio:lifecycle:stage4b4", onceCommand: "worker:audio:lifecycle:stage4b4:once" },
    { id: "ai-chat-stage4c", command: "worker:ai-chat:stage4c", onceCommand: "worker:ai-chat:stage4c:once" },
    { id: "ai-chat-lifecycle-stage4c", command: "worker:ai-chat:lifecycle:stage4c", onceCommand: "worker:ai-chat:lifecycle:stage4c:once" },
  ];
}

function extractReleaseManifestWorkers(manifestSource) {
  const block = manifestSource.match(/const PRODUCTION_STAGE_1_PHASE_5_WORKERS\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) return [];
  return [...block[1].matchAll(/\{\s*id:\s*"([^"]+)"[\s\S]*?command:\s*"npm run ([^"]+)"[\s\S]*?onceCommand:\s*"npm run ([^"]+)"/g)]
    .map((match) => ({ id: match[1], command: match[2], onceCommand: match[3] }));
}

export function buildWorkerContractMatrix(repoRoot) {
  const packageJsonPath = path.join(repoRoot, "app", "package.json");
  const packageJson = existsSync(packageJsonPath) ? JSON.parse(readFileSync(packageJsonPath, "utf8")) : { scripts: {} };
  const manifestSource = readText(repoRoot, "app/scripts/build-release-artifact.mjs");
  const manifestWorkers = extractReleaseManifestWorkers(manifestSource);
  const expectedWorkers = expectedReleaseWorkers();
  const manifestReconciliation = expectedWorkers.map((expected) => {
    const actual = manifestWorkers.find((worker) => worker.id === expected.id);
    const normalScript = packageJson.scripts?.[expected.command];
    const onceScript = packageJson.scripts?.[expected.onceCommand];
    return {
      id: expected.id,
      manifest: actual ?? null,
      packageScripts: {
        command: expected.command,
        commandPresent: typeof normalScript === "string",
        onceCommand: expected.onceCommand,
        onceCommandPresent: typeof onceScript === "string",
      },
      pass: Boolean(actual && actual.command === expected.command && actual.onceCommand === expected.onceCommand && normalScript && onceScript),
    };
  });

  const wrapperPaths = [...new Set(manifestReconciliation.flatMap((entry) => {
    const script = packageJson.scripts?.[entry.packageScripts.command];
    const match = typeof script === "string" ? script.match(/scripts\/([^\s]+\.mjs)/) : null;
    return match ? ["app/scripts/" + match[1]] : [];
  }))];
  const wrappers = wrapperPaths.map((source) => {
    const text = readText(repoRoot, source);
    const checks = {
      exists: Boolean(text),
      onceFlag: /--once|process\.argv\.includes\(["']--once/.test(text),
      childProcess: /spawnSync|spawn\(/.test(text),
      failureExit: /process\.exit\(.*1|result\.status\s*!==\s*0/.test(text),
      intervalOrForwarding: /interval|forwardedArgs|setTimeout/.test(text),
    };
    return { source, checks, pass: Object.values(checks).every(Boolean) };
  });

  const processingPaths = [
    "app/src/lib/phase-85-stage-4b3-durable-media-worker.ts",
    "app/src/lib/phase-85-stage-4b4-durable-audio-worker.ts",
    "app/src/lib/phase-85-stage-4b4-durable-transcript-bridge-worker.ts",
    "app/src/lib/phase-85-stage-4c-run-service.ts",
  ];
  const lifecyclePaths = [
    "app/src/lib/phase-85-stage-4b3-media-lifecycle-saga.ts",
    "app/src/lib/phase-85-stage-4b4-audio-lifecycle.ts",
    "app/src/lib/phase-85-stage-4c-lifecycle.ts",
  ];
  const processingSources = exactFileSources(repoRoot, processingPaths);
  const lifecycleSources = exactFileSources(repoRoot, lifecyclePaths);
  const processingChecks = [
    markerCheck("claim", "processing worker queue claim", processingSources, /\bclaim\w*\b/i),
    markerCheck("lease", "lease token or lease renewal", processingSources, /lease[_A-Za-z]|renew\w*Lease|renew.*lease/i),
    markerCheck("completion", "completion or terminal outcome", processingSources, /complete\w*|terminal\w*|finalize\w*/i),
    markerCheck("failure", "failure outcome", processingSources, /fail\w*|failure\w*/i),
    markerCheck("retry", "retry or retryable outcome", processingSources, /retry\w*|retry_scheduled/i),
    markerCheck("idempotency", "idempotency, revision or duplicate guard", processingSources, /idempot\w*|dedup\w*|revision\w*|already/i),
  ];
  const lifecycleChecks = [
    markerCheck("retention", "retention or purge lifecycle", lifecycleSources, /retention|purge|expired|expiry/i),
    markerCheck("objectOperation", "object deletion or lifecycle operation", lifecycleSources, /deleteObject|object.?operation|deletion|revoke/i),
    markerCheck("lease", "lifecycle operation lease", lifecycleSources, /lease[_A-Za-z]|claim\w*|release\w*/i),
    markerCheck("audit", "lifecycle audit or privacy review", lifecycleSources, /audit|privacyReview|legalHold/i),
  ];

  const cliPaths = [
    "app/src/lib/phase-85-stage-4b3-durable-media-worker-cli.ts",
    "app/src/lib/phase-85-stage-4b3-media-lifecycle-worker-cli.ts",
    "app/src/lib/phase-85-stage-4b4-durable-audio-worker-cli.ts",
    "app/src/lib/phase-85-stage-4b4-durable-admission-worker-cli.ts",
    "app/src/lib/phase-85-stage-4b4-durable-transcript-bridge-worker-cli.ts",
    "app/src/lib/phase-85-stage-4b4-audio-lifecycle-worker-cli.ts",
    "app/src/lib/phase-85-stage-4c-run-worker-cli.ts",
    "app/src/lib/phase-85-stage-4c-lifecycle-worker-cli.ts",
  ];
  const cliSources = exactFileSources(repoRoot, cliPaths);
  const cliChecks = cliSources.map((source) => {
    const usesSupabaseClient = /createClient\(/.test(source.text);
    const checks = {
      exists: Boolean(source.text),
      workerIdentity: /workerId|WORKER_ID/.test(source.text),
      onceMode: /--once|const once/.test(source.text),
      failureExit: /process\.exit\(1\)/.test(source.text),
      serverOnlyClient: !usesSupabaseClient || (/SUPABASE_SERVICE_ROLE_KEY/.test(source.text) && /persistSession:\s*false/.test(source.text)),
    };
    return { source: source.path, checks, pass: Object.values(checks).every(Boolean) };
  });

  const checks = [
    { id: "release_manifest_reconciled", pass: manifestReconciliation.every((entry) => entry.pass) },
    { id: "wrapper_contracts", pass: wrappers.length === wrapperPaths.length && wrappers.every((wrapper) => wrapper.pass) },
    { id: "processing_contracts", pass: allPass(processingChecks) },
    { id: "lifecycle_contracts", pass: allPass(lifecycleChecks) },
    { id: "cli_contracts", pass: cliChecks.length === cliPaths.length && cliChecks.every((entry) => entry.pass) },
  ];
  const blockers = checks.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true }));
  const sourceFiles = [...new Set([
    "app/package.json",
    "app/scripts/build-release-artifact.mjs",
    ...wrapperPaths,
    ...processingPaths,
    ...lifecyclePaths,
    ...cliPaths,
  ])].map((source) => sourceRecord(repoRoot, source));
  return {
    schemaVersion: "aiya-system-audit-phase-4-worker-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_4_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    scanRoot: "app worker entries and durable worker implementations",
    releaseWorkers: manifestReconciliation,
    wrappers,
    processingChecks,
    lifecycleChecks,
    cliChecks,
    checks,
    blockers,
    sourceFiles,
    matrixDigest: stableDigest({ manifestReconciliation, wrappers, processingChecks, lifecycleChecks, cliChecks, checks, blockers }),
  };
}

export function buildMessagingContractMatrix(repoRoot) {
  const sourcePaths = [
    "app/src/app/api/whatsapp/webhook/route.ts",
    "app/src/app/api/commercial/webhook/route.ts",
    "app/src/lib/whatsapp-real-contracts.ts",
    "app/src/lib/whatsapp-real-store.ts",
    "app/src/lib/whatsapp-cloud-payload-normalizer.ts",
    "app/src/lib/phase-85-if-c-channel-event-normalizer.ts",
    "app/src/lib/phase-85-if-c-channel-event-ledger.ts",
    "app/src/lib/phase-85-if-c-channel-event-routing.ts",
    "app/src/lib/phase-85-stage-4b2-messaging-integration.ts",
    "app/src/lib/phase-85-stage-4b2-receipt-lifecycle.ts",
    "app/src/lib/channel-adapters.ts",
    "app/src/lib/channel-mock-delivery-ledger.ts",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const checks = [
    markerCheck("signature_and_challenge", "raw webhook signature and challenge gate", sources, /verifyWhatsAppWebhookSignature|evaluateWhatsAppWebhookChallenge/),
    markerCheck("payload_normalization", "canonical event payload normalization", sources, /normalizeChannelEventBatch|normalize.*Payload|canonical/i),
    markerCheck("ledger_idempotency", "provider event ledger and duplicate suppression", sources, /providerEventId|idempotencyKey|ledger|duplicate/i),
    markerCheck("tenant_routing", "tenant/account routing and identity resolution", sources, /routeChannelEvent|tenantId|accountBindingId/),
    markerCheck("quarantine", "unknown or ambiguous identity quarantine", sources, /quarantine|unknown|ambiguous/i),
    markerCheck("delivery_receipt", "receipt state and delivery transitions", sources, /receipt|delivery|accepted|delivered|read/i),
    markerCheck("retry_policy", "temporary/permanent/ambiguous retry policy", sources, /retry|temporary_provider_failure|ambiguous_transport_unknown/i),
    markerCheck("real_egress_gate", "explicit real WhatsApp egress gate", sources, /isRealWhatsAppWebhookEnabled|MANU_WHATSAPP_REAL_WEBHOOK_ENABLED/),
  ];
  const routeSources = exactFileSources(repoRoot, [sourcePaths[0], sourcePaths[1]]);
  const routeChecks = routeSources.map((source) => ({
    source: source.path,
    signatureOrProviderGate: /signature|constructWebhookEvent|isRealWhatsAppWebhookEnabled/.test(source.text),
    structuredResponse: /NextResponse\.json/.test(source.text),
    pass: /NextResponse\.json/.test(source.text) && /signature|constructWebhookEvent|isRealWhatsAppWebhookEnabled/.test(source.text),
  }));
  const allMessagingText = sources.map((source) => source.text).join("\n");
  const externalCalls = [...allMessagingText.matchAll(/\bfetch\s*\(/g)].length;
  const externalEgressCheck = {
    id: "external_egress_guarded",
    pass: externalCalls === 0 || /isRealWhatsAppWebhookEnabled|MANU_WHATSAPP_REAL_WEBHOOK_ENABLED/.test(allMessagingText),
    externalCallCount: externalCalls,
  };
  const realEgressDisabled = process.env.MANU_WHATSAPP_REAL_WEBHOOK_ENABLED !== "true";
  const checksWithRoutes = [...checks, { id: "route_contracts", pass: routeChecks.every((route) => route.pass) }, externalEgressCheck, { id: "real_egress_disabled_for_audit", pass: realEgressDisabled }];
  const blockers = checksWithRoutes.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true }));
  return {
    schemaVersion: "aiya-system-audit-phase-4-messaging-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_4_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    checks: checksWithRoutes,
    routeChecks,
    externalEgress: { callCount: externalCalls, enabledForAudit: !realEgressDisabled },
    sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)),
    blockers,
    matrixDigest: stableDigest({ checksWithRoutes, routeChecks, externalCalls, blockers, sourcePaths: sourcePaths.map((source) => sourceRecord(repoRoot, source)) }),
  };
}

export function buildAiContractMatrix(repoRoot) {
  const sourcePaths = [
    "app/src/lib/ai-provider.ts",
    "app/src/lib/phase-75-zai-provider-gate.ts",
    "app/src/lib/phase-85-stage-4c-provider.ts",
    "app/src/lib/phase-85-stage-4c-context-gateway.ts",
    "app/src/lib/phase-85-stage-4c-run-service.ts",
    "app/src/lib/phase-85-stage-4c-store.ts",
    "app/src/lib/phase-85-stage-4c-run-event-multiplexer.ts",
    "app/src/lib/phase-85-stage-4c-run-worker-cli.ts",
  ];
  const sources = exactFileSources(repoRoot, sourcePaths);
  const checks = [
    markerCheck("bounded_provider_context", "bounded provider context allowlist", sources, /allowed|allowlist|MAX_.*SEGMENT|assertAllowedKeys|context\.segments/i),
    markerCheck("raw_input_rejected", "raw prompt/capsule rejection or safe metadata", sources, /raw prompt|raw_prompt|rawPrompt|safe metadata|providerMetadata|promptCompletion/i),
    markerCheck("risk_routing", "red/yellow/green risk routing", sources, /riskLevel|no_provider|yellow_internal_draft|green_autopilot|red risk/i),
    markerCheck("provider_egress_gate", "explicit provider egress gate", sources, /MANU_ALLOW_REAL_ZAI|real_provider_disabled|ai_chat_real_provider_disabled|provider.*disabled/i),
    markerCheck("timeout_retry_abort", "timeout, retry and abort/deadline", sources, /retry|timeout|AbortController|deadline|AI_CHAT_RUN_TIMEOUT/i),
    markerCheck("source_validation", "source-backed claim and answer validation", sources, /allowedSourceIds|validateDietitianChatSourcedAnswer|insufficientEvidence|conflictingEvidence/i),
    markerCheck("job_lease_lifecycle", "AI job claim lease completion/failure", sources, /claimNextAiChatJob|renewJobLease|completeAiChatJob|failAiChatJob/i),
    markerCheck("run_event_ordering", "run event sequence and realtime catch-up", sources, /sequenceNumber|catchUp|RUN_EVENT_CATCH_UP_LIMIT|pollDelay/i),
    markerCheck("raw_retention_zero", "raw prompt/completion retention policy", sources, /rawPromptCompletionRetention|raw prompt\/completion|no raw prompt/i),
  ];
  const allSourceText = sources.map((source) => source.text).join("\n");
  const externalCalls = [...allSourceText.matchAll(/\bfetch\s*\(/g)].length;
  const externalEgressCheck = {
    id: "no_ungated_ai_fetch",
    pass: externalCalls === 0 || /MANU_ALLOW_REAL_ZAI|ai_chat_real_provider_disabled/.test(allSourceText),
    externalCallCount: externalCalls,
  };
  const checksWithEgress = [...checks, externalEgressCheck, { id: "real_zai_disabled_for_audit", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" }];
  const blockers = checksWithEgress.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true }));
  return {
    schemaVersion: "aiya-system-audit-phase-4-ai-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_4_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    checks: checksWithEgress,
    providerBoundary: {
      model: "glm-5.3-flash-gated",
      realEgressEnabledForAudit: process.env.MANU_ALLOW_REAL_ZAI === "true",
      rawPromptCompletionRetention: 0,
    },
    sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)),
    blockers,
    matrixDigest: stableDigest({ checksWithEgress, sourcePaths: sourcePaths.map((source) => sourceRecord(repoRoot, source)), blockers }),
  };
}

export function buildMediaContractMatrix(repoRoot) {
  const mediaSources = sourceFilesByPattern(repoRoot, "app/src/lib", /^phase-85-stage-4b[34]-.*\.ts$/);
  const securitySource = exactFileSources(repoRoot, ["app/src/lib/production-ai-media-security-migration-contract.test.ts"]);
  const sources = [...mediaSources, ...securitySource];
  const allSourceText = sources.map((source) => source.text).join("\n");
  const checks = [
    markerCheck("admission_validation", "media/audio admission validation", sources, /admission|validate|canonicalize|supported.*mime/i),
    markerCheck("content_hash", "content hash authority", sources, /contentSha256|content_sha256|sha256/i),
    markerCheck("sanitized_object_key", "sanitized tenant-bound storage object key", sources, /sanitized.*ObjectKey|sanitized.*object|buildStage4B[34].*ObjectKey|sanitize/i),
    markerCheck("bounded_transport", "bounded download or range transport", sources, /range|content-range|bounded|stream|byteRange/i),
    markerCheck("provider_gate", "vision/transcription provider gate", sources, /provider.?gate|providerMode|real.*provider|mock.*provider/i),
    markerCheck("durable_claim_lease", "durable media/audio claim and lease", sources, /claim.*work|claim.*media|lease[_A-Za-z]|renew.*lease/i),
    markerCheck("retry_and_quality", "retry, quality and review terminal outcome", sources, /retry|quality|review_required|rejectionReasons|terminalStatus/i),
    markerCheck("observation_validation", "observation/transcript validation and source authority", sources, /observation|transcript|source.?authority|validate.*Observation/i),
    markerCheck("retention_and_delete", "retention revoke purge and object delete", sources, /retention|expiresAt|deleteObject|purge|revoked|expired/i),
  ];
  const realProviderFlags = [...allSourceText.matchAll(/MANU_ALLOW_REAL_[A-Z_]+|REAL_[A-Z_]+_ENABLED/g)].map((match) => match[0]);
  const externalCalls = [...allSourceText.matchAll(/\bfetch\s*\(/g)].length;
  const checksWithBoundary = [
    ...checks,
    { id: "real_media_provider_disabled_for_audit", pass: process.env.MANU_ALLOW_REAL_ZAI !== "true" && process.env.MANU_MEDIA_REAL_PROVIDER_ENABLED !== "true" },
    { id: "external_transport_guarded", pass: externalCalls === 0 || /provider.?gate|MANU_ALLOW_REAL|mock/i.test(allSourceText) },
  ];
  const blockers = checksWithBoundary.filter((check) => !check.pass).map((check) => ({ code: check.id, blocker: true }));
  const sourcePaths = sources.map((source) => source.path).sort();
  return {
    schemaVersion: "aiya-system-audit-phase-4-media-contract-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_4_ID,
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    checks: checksWithBoundary,
    mediaSurface: {
      sourceCount: sourcePaths.length,
      realProviderFlags: [...new Set(realProviderFlags)].sort(),
      externalCallCount: externalCalls,
    },
    sourceFiles: sourcePaths.map((source) => sourceRecord(repoRoot, source)),
    blockers,
    matrixDigest: stableDigest({ checksWithBoundary, sourcePaths: sourcePaths.map((source) => sourceRecord(repoRoot, source)), blockers }),
  };
}

export function createInitialState({ repoRoot, sourceCommit, openedAt }) {
  return {
    schemaVersion: "aiya-system-audit-phase-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_4_ID,
    repoRoot,
    sourceCommit,
    openedAt,
    phaseStatus: "OPEN",
    stages: Object.fromEntries(PHASE_4_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      evidencePath: null,
      evidenceDigest: null,
      outputDigests: {},
      blockers: [],
    }])),
    nextStage: "4.1",
  };
}

export function assertPhase3Closed(repoRoot) {
  const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-3", "phase-3-state.json");
  const closurePath = path.join(repoRoot, "docs", "system-audit", "phase-3", "phase-3-closure.json");
  if (!existsSync(statePath) || !existsSync(closurePath)) return { ok: false, reason: "phase_3_closure_files_missing", stageFailures: [] };
  const state = readJson(statePath);
  const closure = readJson(closurePath);
  const stageFailures = [];
  for (const stageId of ["3.1", "3.2", "3.3", "3.4"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") stageFailures.push("stage_" + stageId + "_not_verified");
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-3", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) stageFailures.push("stage_" + stageId + "_output_stale:" + name);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) stageFailures.push("stage_" + stageId + "_evidence_stale");
    }
  }
  const ok = state.phaseStatus === "CLOSED" && closure.status === "CLOSED" && closure.nextPhase === "phase-4" && closure.nextPhaseUnlocked === true && stageFailures.length === 0;
  return {
    ok,
    reason: ok ? null : "phase_3_not_closed_or_evidence_stale",
    stateDigest: sha256File(statePath),
    closureDigest: sha256File(closurePath),
    sourceCommit: state.sourceCommit,
    stageFailures,
  };
}

export function assertCanBeginStage(state, stageId) {
  const stage = PHASE_4_STAGES.find((candidate) => candidate.id === stageId);
  if (!stage) throw new Error("unsupported_phase_4_stage:" + stageId);
  const current = state.stages?.[stageId];
  if (!current) throw new Error("phase_4_stage_state_missing:" + stageId);
  if (current.status === "VERIFIED") throw new Error("phase_4_stage_already_verified:" + stageId);
  if (current.status === "IN_PROGRESS") throw new Error("phase_4_stage_already_started:" + stageId);
  for (const prerequisite of stage.prerequisiteStageIds) {
    if (prerequisite === "phase-3-closed") continue;
    if (state.stages?.[prerequisite]?.status !== "VERIFIED") throw new Error("phase_4_stage_prerequisite_not_verified:" + stageId + ":" + prerequisite);
  }
}

export function buildEvidence({ stage, sourceCommit, status, outputFiles, operations, verification, blockers = [] }) {
  const evidence = {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: PHASE_4_ID + "-" + stage.id + "-" + new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17),
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_4_ID,
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

export function phase4OutputPath(repoRoot, name) {
  return path.join(repoRoot, "docs", "system-audit", "phase-4", name);
}

export function phase4EvidencePath(repoRoot, stageId) {
  return path.join(repoRoot, "docs", "system-audit", "phase-4", "stages", "stage-" + stageId + ".json");
}
