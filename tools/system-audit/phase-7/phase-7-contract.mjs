import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  AUDIT_PLAN_ID,
  AUDIT_PLAN_VERSION,
  PHASE_7_ID,
  PHASE_7_STAGES,
  getPhase7Stage,
} from "./phase-7-plan.mjs";
import {
  buildReleaseIdentity,
  fingerprintMigrations,
  SW_CACHE_VERSION_PLACEHOLDER,
} from "../../../app/scripts/lib/release-identity.mjs";
import { FORBIDDEN_WORKFLOW_PATTERNS } from "../../hosted-sandbox/deploy/lib/deploy-contract.mjs";

export const STAGE_STATUSES = ["LOCKED", "IN_PROGRESS", "VERIFIED", "BLOCKED"];
export const PHASE_STATUSES = ["OPEN", "BLOCKED", "CLOSED"];

export const WORKFLOW_NAMES = [
  "hosted-sandbox-product-ci.yml",
  "hosted-sandbox-migration.yml",
  "hosted-sandbox-deploy.yml",
];

export const MUTATION_FLAG_NAMES = [
  "MANU_PRODUCTION_PILOT_STARTED",
  "MANU_ENABLE_PROVIDER_EGRESS",
  "MANU_ENABLE_CHANNEL_EGRESS",
  "MANU_ENABLE_LIVE_BILLING",
  "MANU_ENABLE_PRODUCTION_SCHEMA",
  "MANU_ALLOW_REAL_ZAI",
  "MANU_WHATSAPP_REAL_WEBHOOK_ENABLED",
  "MANU_MEDIA_REAL_PROVIDER_ENABLED",
  "MANU_ALLOW_REMOTE_RLS_TESTS",
  "MANU_HOSTED_SANDBOX_BACKUP_APPROVED",
  "MANU_HOSTED_SANDBOX_RESTORE_APPROVED",
  "MANU_HOSTED_ACTIVATION_APPROVED",
];

const TRUTHY_VALUES = new Set(["true", "1", "yes", "on"]);

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

export function sourceRecord(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) {
    return { source: relativePath, exists: false, bytes: 0, sha256: null };
  }
  return {
    source: relativePath,
    exists: true,
    bytes: statSync(filePath).size,
    sha256: sha256File(filePath),
  };
}

export function gitHead(repoRoot) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git_head_failed:${String(result.stderr || result.stdout).trim()}`);
  }
  const head = String(result.stdout || "").trim();
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error("git_head_invalid");
  return head;
}

export function gitStatus(repoRoot) {
  const result = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git_status_failed:${String(result.stderr || result.stdout).trim()}`);
  }
  const lines = String(result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  return {
    clean: lines.length === 0,
    changedPathCount: lines.length,
    changedPaths: lines.map((line) => line.slice(3).trim()).filter(Boolean),
  };
}

function readText(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

function sourceRecords(repoRoot, relativePaths) {
  return relativePaths.map((relativePath) => sourceRecord(repoRoot, relativePath));
}

function allPass(checks) {
  return checks.every((check) => check.pass === true);
}

function blockersFromChecks(checks) {
  return checks
    .filter((check) => check.pass !== true)
    .map((check) => ({ code: check.id, blocker: true, details: check.details ?? null }));
}

function orderedGateCheck(content, markers) {
  let cursor = -1;
  const positions = {};
  for (const marker of markers) {
    const position = content.indexOf(marker, cursor + 1);
    positions[marker] = position;
    if (position < 0) return { pass: false, positions };
    cursor = position;
  }
  return { pass: true, positions };
}

function workflowPath(repoRoot, root, name) {
  return path.join(repoRoot, root, name);
}

function workflowSources(repoRoot) {
  return WORKFLOW_NAMES.flatMap((name) => [
    sourceRecord(repoRoot, `.github/workflows/${name}`),
    sourceRecord(repoRoot, `tools/hosted-sandbox/deploy/workflow-templates/${name}`),
  ]);
}

function workflowContent(repoRoot, root, name) {
  return readFileSync(workflowPath(repoRoot, root, name), "utf8");
}

function staticWorkflowChecks(repoRoot) {
  const records = [];
  for (const name of WORKFLOW_NAMES) {
    const checkedInPath = `.github/workflows/${name}`;
    const templatePath = `tools/hosted-sandbox/deploy/workflow-templates/${name}`;
    const checkedIn = readText(repoRoot, checkedInPath);
    const template = readText(repoRoot, templatePath);
    records.push({
      name,
      checkedIn: sourceRecord(repoRoot, checkedInPath),
      template: sourceRecord(repoRoot, templatePath),
      byteIdentical: Boolean(checkedIn && template && checkedIn === template),
      forbiddenPatterns: FORBIDDEN_WORKFLOW_PATTERNS.filter((pattern) => pattern.test(checkedIn) || pattern.test(template)).map(String),
    });
  }
  return records;
}

function workflowHardeningChecks(repoRoot, records) {
  const checks = [];
  for (const record of records) {
    for (const kind of ["checkedIn", "template"]) {
      const content = readText(repoRoot, kind === "checkedIn" ? `.github/workflows/${record.name}` : `tools/hosted-sandbox/deploy/workflow-templates/${record.name}`);
      checks.push({
        id: `${kind}_${record.name}_permissions`,
        description: `${kind} ${record.name} uses read-only repository permissions`,
        pass: /permissions:\s*\r?\n\s+contents:\s*read\b/.test(content),
      });
      checks.push({
        id: `${kind}_${record.name}_runtime_contract`,
        description: `${kind} ${record.name} pins checkout/node, timeout, concurrency and production guard`,
        pass: content.includes("actions/checkout@v4") && content.includes("actions/setup-node@v4") && content.includes("timeout-minutes:") && content.includes("concurrency:") && content.includes("MANU_CI_NO_PRODUCTION_EFFECTS"),
      });
      checks.push({
        id: `${kind}_${record.name}_forbidden_patterns`,
        description: `${kind} ${record.name} contains no forbidden workflow patterns`,
        pass: record.forbiddenPatterns.length === 0,
      });
    }
  }
  return checks;
}

function productCiOrderCheck(repoRoot) {
  const actual = readText(repoRoot, ".github/workflows/hosted-sandbox-product-ci.yml");
  const template = readText(repoRoot, "tools/hosted-sandbox/deploy/workflow-templates/hosted-sandbox-product-ci.yml");
  const markers = [
    "npm run lint",
    "npm run typecheck",
    "npx vitest run src/lib/hosted-sandbox-release-identity.test.ts",
    "npm run build",
    "node tools/hosted-sandbox/deploy/build-release-artifact.mjs",
    "node --test --test-name-pattern",
    "node tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs",
    "node tools/hosted-sandbox/deploy/verify-nginx-template.mjs",
    "node app/scripts/verify-hosted-sandbox-contracts.mjs",
    "npm run test:audit-system:phase7",
  ];
  const actualResult = orderedGateCheck(actual, markers);
  const templateResult = orderedGateCheck(template, markers);
  return {
    pass: actualResult.pass && templateResult.pass,
    actual: actualResult,
    template: templateResult,
    markers,
  };
}

function migrationGateCheck(repoRoot) {
  const files = [
    readText(repoRoot, ".github/workflows/hosted-sandbox-migration.yml"),
    readText(repoRoot, "tools/hosted-sandbox/deploy/workflow-templates/hosted-sandbox-migration.yml"),
  ];
  const pass = files.every((content) =>
    content.includes("apply:") &&
    content.includes("type: boolean") &&
    content.includes("default: false") &&
    content.includes("if: ${{ inputs.apply }}") &&
    content.includes("environment: hosted-sandbox-migration") &&
    content.includes("MANU_HOSTED_SANDBOX_PROJECT_REF") &&
    content.includes("SUPABASE_ACCESS_TOKEN") &&
    content.includes("supabase db push --linked --include-all") &&
    !content.includes("MANU_CI_NO_PRODUCTION_EFFECTS: \"false\"")
  );
  return { pass, fileCount: files.length };
}

function deployGateCheck(repoRoot) {
  const files = [
    readText(repoRoot, ".github/workflows/hosted-sandbox-deploy.yml"),
    readText(repoRoot, "tools/hosted-sandbox/deploy/workflow-templates/hosted-sandbox-deploy.yml"),
  ];
  const pass = files.every((content) =>
    content.includes("environment: hosted-sandbox-deploy") &&
    content.includes("migration_fingerprint:") &&
    content.includes("MANU_EXPECTED_MIGRATION_FINGERPRINT") &&
    content.includes('MANU_RELEASE_ARTIFACT_REQUIRED: "true"') &&
    content.includes("node tools/hosted-sandbox/deploy/build-release-artifact.mjs") &&
    content.includes("Dry-run atomic deploy") &&
    !content.includes("--apply") &&
    !content.includes("apply-hosted-release.mjs")
  );
  return { pass, fileCount: files.length };
}

export function assertPhase6Closed(repoRoot, sourceCommit = gitHead(repoRoot)) {
  const statePath = path.join(repoRoot, ".manu-runtime", "system-audit", "phase-6", "phase-6-state.json");
  const closurePath = path.join(repoRoot, "docs", "system-audit", "phase-6", "phase-6-closure.json");
  const failures = [];
  if (!existsSync(statePath) || !existsSync(closurePath)) {
    return { ok: false, reason: "phase_6_closure_files_missing", sourceCommit, stageFailures: ["closure_files_missing"] };
  }
  const state = readJson(statePath);
  const closure = readJson(closurePath);
  for (const stageId of ["6.1", "6.2", "6.3", "6.4", "6.5"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") failures.push(`${stageId}_not_verified`);
    if (stage?.sourceCommit && stage.sourceCommit !== sourceCommit) failures.push(`${stageId}_source_commit_stale`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-6", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) failures.push(`${stageId}_output_stale:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) failures.push(`${stageId}_evidence_stale`);
    }
  }
  if (state.sourceCommit !== sourceCommit) failures.push("phase_6_state_source_commit_stale");
  if (state.phaseStatus !== "CLOSED") failures.push("phase_6_state_not_closed");
  if (closure.status !== "CLOSED" || closure.nextPhase !== "phase-7" || closure.nextPhaseUnlocked !== true) failures.push("phase_6_transition_gate_locked");
  return {
    ok: failures.length === 0,
    reason: failures.length === 0 ? null : "phase_6_not_closed_or_evidence_stale",
    sourceCommit,
    stateDigest: sha256File(statePath),
    closureDigest: sha256File(closurePath),
    stageFailures: failures,
  };
}

export function buildCiReleaseGateMatrix(repoRoot, sourceCommit, options = {}) {
  const phase6Precondition = options.phase6Precondition ?? assertPhase6Closed(repoRoot, sourceCommit);
  const workflowRecords = staticWorkflowChecks(repoRoot);
  const hardening = workflowHardeningChecks(repoRoot, workflowRecords);
  const sourceFiles = workflowSources(repoRoot);
  const templateMatch = workflowRecords.every((record) => record.byteIdentical);
  const checks = [
    { id: "phase6_transition_gate", description: "Phase 6 is CLOSED and unlocks Phase 7", pass: phase6Precondition.ok, details: phase6Precondition.stageFailures },
    { id: "workflow_inventory", description: "three checked-in workflows and three templates exist", pass: sourceFiles.every((source) => source.exists), details: sourceFiles.filter((source) => !source.exists) },
    { id: "workflow_hardening", description: "permissions, pins, timeout, concurrency and production guard are present", pass: hardening.every((check) => check.pass), details: hardening.filter((check) => !check.pass) },
    { id: "product_ci_gate_order", description: "product CI gates are present in the required order", pass: productCiOrderCheck(repoRoot).pass, details: productCiOrderCheck(repoRoot) },
    { id: "migration_apply_gate", description: "migration apply is manual, protected and false by default", pass: migrationGateCheck(repoRoot).pass, details: migrationGateCheck(repoRoot) },
    { id: "deploy_artifact_gate", description: "deploy is environment-protected, fingerprint-bound and dry-run by default", pass: deployGateCheck(repoRoot).pass, details: deployGateCheck(repoRoot) },
    { id: "workflow_template_match", description: "checked-in workflows are byte-identical to templates", pass: templateMatch, details: workflowRecords },
    { id: "local_contract_verification", description: "read-only hardening verifier and Phase 7 contract test pass", pass: options.finalGate?.pass === true, details: options.finalGate ?? { status: "NOT_RUN" } },
  ];
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-7-ci-release-gate-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    stageId: "7.1",
    status: allPass(checks) ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "PASS means local workflow and release-gate contracts agree. It is not production GO evidence.",
    workflowRecords,
    hardeningChecks: hardening,
    sourceFiles,
    checks,
    operationChecks: checks,
    blockers: blockersFromChecks(checks),
  };
  return { ...matrix, matrixDigest: stableDigest({ ...matrix, generatedAt: null, matrixDigest: null }) };
}

function buildIdentityEnv(sourceCommit) {
  const env = {
    ...process.env,
    NODE_ENV: "production",
    MANU_CI_NO_PRODUCTION_EFFECTS: "true",
    MANU_RELEASE_ENVIRONMENT: "hosted-sandbox",
    MANU_RELEASE_COMMIT_SHA: sourceCommit,
  };
  for (const key of ["MANU_RELEASE_ID", "MANU_RELEASE_BUILT_AT", "MANU_RELEASE_COMPATIBILITY_VERSION", "SIRIUSAI_APP_DEPLOYMENT_VERSION", "NEXT_PUBLIC_SIRIUSAI_APP_VERSION"]) {
    delete env[key];
  }
  return env;
}

export function deriveAuditReleaseIdentity(repoRoot, sourceCommit) {
  return buildReleaseIdentity({ repoRoot, env: buildIdentityEnv(sourceCommit) });
}

function redactedUrlMetadata(repoRoot) {
  const profiles = [];
  for (const relativePath of ["app/.env.local", "app/.env.local.example"]) {
    const content = readText(repoRoot, relativePath);
    const keys = [];
    let supabase = null;
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      keys.push(key);
      if (key === "NEXT_PUBLIC_SUPABASE_URL" || key === "SUPABASE_URL") {
        try {
          const parsed = new URL(match[2].trim().replace(/^['"]|['"]$/g, ""));
          supabase = { protocol: parsed.protocol, host: parsed.host, projectRef: parsed.hostname.split(".")[0] || null };
        } catch {
          supabase = { invalid: true };
        }
      }
    }
    profiles.push({ source: relativePath, exists: Boolean(content), keyCount: [...new Set(keys)].length, supabase });
  }
  return profiles;
}

function identityContractCheck(repoRoot) {
  const health = readText(repoRoot, "app/src/app/api/health/release/route.ts");
  const clientIdentity = readText(repoRoot, "app/src/lib/release-identity.ts");
  const serviceWorker = readText(repoRoot, "app/public/sw.js");
  const schemaProbe = readText(repoRoot, "tools/hosted-sandbox/deploy/lib/supabase-schema-contract.mjs");
  const deploy = readText(repoRoot, "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs");
  const releaseArtifact = readText(repoRoot, "app/scripts/build-release-artifact.mjs");
  const identityFields = ["releaseId", "commitSha", "migrationFingerprint", "compatibilityVersion"];
  const pass = identityFields.every((field) => health.includes(field) && clientIdentity.includes(field) && deploy.includes(field) && releaseArtifact.includes(field)) &&
    serviceWorker.includes(SW_CACHE_VERSION_PLACEHOLDER) &&
    schemaProbe.includes("REQUIRED_RPC_PROBES") &&
    schemaProbe.includes("signature:");
  return { pass, fields: identityFields, sources: [
    sourceRecord(repoRoot, "app/src/app/api/health/release/route.ts"),
    sourceRecord(repoRoot, "app/src/lib/release-identity.ts"),
    sourceRecord(repoRoot, "app/public/sw.js"),
    sourceRecord(repoRoot, "tools/hosted-sandbox/deploy/lib/supabase-schema-contract.mjs"),
    sourceRecord(repoRoot, "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs"),
    sourceRecord(repoRoot, "app/scripts/build-release-artifact.mjs"),
  ] };
}

function workflowReleaseBindingCheck(repoRoot) {
  const migration = readText(repoRoot, ".github/workflows/hosted-sandbox-migration.yml");
  const deploy = readText(repoRoot, ".github/workflows/hosted-sandbox-deploy.yml");
  return {
    pass: migration.includes("inputs.commit_sha") && migration.includes("build-release-artifact.mjs") && deploy.includes("inputs.commit_sha") && deploy.includes("migration_fingerprint") && deploy.includes("MANU_RELEASE_ARTIFACT_REQUIRED: \"true\""),
    migration: { commitInput: migration.includes("inputs.commit_sha"), fingerprintArtifact: migration.includes("build-release-artifact.mjs") },
    deploy: { commitInput: deploy.includes("inputs.commit_sha"), fingerprintInput: deploy.includes("migration_fingerprint"), artifactRequired: deploy.includes("MANU_RELEASE_ARTIFACT_REQUIRED: \"true\"") },
  };
}

function readProductionDecision(repoRoot) {
  const relativePath = "docs/PRODUCTION_READINESS_STAGE_1_FINAL_DECISION.json";
  const filePath = path.join(repoRoot, relativePath);
  if (!existsSync(filePath)) return { exists: false, productionDecision: null, ownerActionsRequired: [], liveActionsExecuted: [], mustNotClaim: [] };
  const decision = readJson(filePath);
  return {
    exists: true,
    source: sourceRecord(repoRoot, relativePath),
    productionDecision: decision.productionDecision ?? null,
    ownerActionsRequired: Array.isArray(decision.ownerActionsRequired) ? decision.ownerActionsRequired : [],
    liveActionsExecuted: Array.isArray(decision.liveActionsExecuted) ? decision.liveActionsExecuted : [],
    mustNotClaim: Array.isArray(decision.mustNotClaim) ? decision.mustNotClaim : [],
    codexActionsAfterOwnerCompletion: Array.isArray(decision.codexActionsAfterOwnerCompletion) ? decision.codexActionsAfterOwnerCompletion : [],
  };
}

export function mutationPolicySnapshot(env = process.env) {
  return Object.fromEntries(MUTATION_FLAG_NAMES.map((key) => [key, { enabled: TRUTHY_VALUES.has(String(env[key] ?? "").trim().toLowerCase()) }]));
}

export function buildTargetEnvironmentReconciliationMatrix(repoRoot, sourceCommit, options = {}) {
  const identity = options.identity ?? deriveAuditReleaseIdentity(repoRoot, sourceCommit);
  const migrations = fingerprintMigrations(repoRoot);
  const decision = readProductionDecision(repoRoot);
  const sourceControl = gitStatus(repoRoot);
  const mutationPolicy = options.mutationPolicy ?? mutationPolicySnapshot();
  const identityContracts = identityContractCheck(repoRoot);
  const workflowBinding = workflowReleaseBindingCheck(repoRoot);
  const checks = [
    { id: "ci_release_gate_verified", description: "7.1 CI release gate evidence is VERIFIED", pass: options.ciStageVerified === true, details: options.ciStageDetails ?? null },
    { id: "release_identity_derived", description: "release identity and sorted migration fingerprint derive from current HEAD", pass: identity.commitSha === sourceCommit && identity.migrationFingerprint === migrations.fingerprint && /^[a-f0-9]{40}$/.test(identity.commitSha) && /^[a-f0-9]{64}$/.test(identity.migrationFingerprint), details: { identity, migrations } },
    { id: "identity_contracts_reconciled", description: "health, client, service worker and schema/deploy contracts carry release identity fields", pass: identityContracts.pass, details: identityContracts },
    { id: "workflow_release_binding", description: "migration and deploy workflows bind commit, fingerprint and artifact", pass: workflowBinding.pass, details: workflowBinding },
    { id: "production_decision_preserved", description: "authoritative production decision remains NO-GO with owner actions and no live actions", pass: decision.exists && decision.productionDecision === "NO-GO" && decision.ownerActionsRequired.length > 0 && decision.liveActionsExecuted.length === 0 && decision.mustNotClaim.length > 0, details: decision },
    { id: "target_probe_not_run", description: "target probe is explicitly NOT_RUN_BY_POLICY and no egress is attempted", pass: options.targetProbe?.status === "NOT_RUN_BY_POLICY", details: options.targetProbe ?? { status: "NOT_RUN" } },
    { id: "source_and_mutation_inventory", description: "working-tree state and effective mutation flags are recorded without secret values", pass: Object.values(mutationPolicy).every((item) => item.enabled === false), details: { sourceControl, mutationPolicy } },
    { id: "phase7_contract_verification", description: "Phase 7 contract test passes after reconciliation", pass: options.finalGate?.pass === true, details: options.finalGate ?? { status: "NOT_RUN" } },
  ];
  const targetProbe = options.targetProbe ?? { status: "NOT_RUN_BY_POLICY", httpCalls: 0, supabaseCalls: 0, sshCalls: 0, providerCalls: 0, channelCalls: 0, reason: "local_phase_boundary" };
  const releaseBlockers = [
    ...(sourceControl.clean ? [] : [{ code: "dirty_working_tree", ownerControlled: true, details: sourceControl.changedPaths }]),
    ...(decision.ownerActionsRequired.length ? [{ code: "owner_actions_required", ownerControlled: true, details: decision.ownerActionsRequired } ] : []),
    { code: "target_probe_not_run_by_policy", ownerControlled: true, details: "current production evidence requires separate authorized target operation" },
    { code: "explicit_production_release_approval_required", ownerControlled: true, details: "productionDecision=NO-GO" },
  ];
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-7-target-environment-reconciliation-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    stageId: "7.2",
    status: allPass(checks) ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "PASS means release identity, target contract and owner handoff data reconcile locally. Release blockers remain NO-GO evidence.",
    identity,
    migrations,
    targetProbe,
    targetMetadata: { envProfiles: redactedUrlMetadata(repoRoot), workflowEnvironments: ["hosted-sandbox-migration", "hosted-sandbox-deploy"] },
    productionDecision: decision,
    sourceControl,
    mutationPolicy,
    releaseBlockers,
    checks,
    operationChecks: checks,
    sourceFiles: [
      sourceRecord(repoRoot, "app/scripts/lib/release-identity.mjs"),
      sourceRecord(repoRoot, "app/src/lib/release-identity.ts"),
      sourceRecord(repoRoot, "app/src/app/api/health/release/route.ts"),
      sourceRecord(repoRoot, "tools/hosted-sandbox/deploy/lib/supabase-schema-contract.mjs"),
      sourceRecord(repoRoot, "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs"),
      sourceRecord(repoRoot, "tools/system-audit/lib/environment.mjs"),
      sourceRecord(repoRoot, "docs/PRODUCTION_READINESS_STAGE_1_FINAL_DECISION.json"),
    ],
    blockers: blockersFromChecks(checks),
  };
  return { ...matrix, matrixDigest: stableDigest({ ...matrix, generatedAt: null, matrixDigest: null }) };
}

export function buildReleaseGateMatrix(repoRoot, sourceCommit, options = {}) {
  const identity = options.identity ?? deriveAuditReleaseIdentity(repoRoot, sourceCommit);
  const commands = options.commandResults ?? [];
  const commandPass = commands.length > 0 && commands.every((command) => command.status === "PASS");
  const artifact = options.artifact ?? null;
  const checks = [
    { id: "target_reconciliation_verified", description: "7.2 target reconciliation is VERIFIED", pass: options.targetStageVerified === true, details: options.targetStageDetails ?? null },
    { id: "local_ci_commands_pass", description: "lint, typecheck and hosted oracle commands pass", pass: options.localCiPass === true, details: options.localCiResults ?? null },
    { id: "production_build_identity_pass", description: "production build and service-worker identity boundary pass", pass: options.buildPass === true, details: options.buildResult ?? null },
    { id: "archive_identity_and_hash_pass", description: "archive manifest identity and SHA-256 pass", pass: Boolean(artifact?.pass), details: artifact },
    { id: "deploy_machinery_and_verifiers_pass", description: "filtered deploy tests, workflow, nginx and hosted verifiers pass", pass: options.verifierPass === true, details: options.verifierResults ?? null },
    { id: "smoke_dry_run_pass", description: "smoke checker runs in explicit dry-run mode", pass: options.smokePass === true, details: options.smokeResult ?? null },
    { id: "atomic_dry_run_pass", description: "artifact-required atomic deploy dry-run passes in isolated temp root", pass: options.atomicPass === true, details: options.atomicResult ?? null },
    { id: "all_release_gate_commands_pass", description: "all recorded release-gate commands pass", pass: commandPass, details: commands },
  ];
  const matrix = {
    schemaVersion: "aiya-system-audit-phase-7-release-gate-matrix-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    stageId: "7.3",
    status: allPass(checks) ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "PASS means local release gates, artifact identity and isolated dry-run activation pass. It is not production GO evidence.",
    identity,
    artifact,
    commandResults: commands,
    checks,
    operationChecks: checks,
    blockers: blockersFromChecks(checks),
    sourceFiles: sourceRecords(repoRoot, [
      "tools/hosted-sandbox/deploy/build-release-artifact.mjs",
      "tools/hosted-sandbox/deploy/deploy-hosted-release.mjs",
      "tools/hosted-sandbox/deploy/run-smoke-check.mjs",
      "tools/hosted-sandbox/deploy/hosted-sandbox-deploy.test.mjs",
      "tools/hosted-sandbox/deploy/verify-workflow-hardening.mjs",
      "tools/hosted-sandbox/deploy/verify-nginx-template.mjs",
      "app/scripts/verify-hosted-sandbox-contracts.mjs",
    ]),
  };
  return { ...matrix, matrixDigest: stableDigest({ ...matrix, generatedAt: null, matrixDigest: null }) };
}

function stageDigestFailures(repoRoot, state, sourceCommit) {
  const failures = [];
  for (const stageId of ["7.1", "7.2", "7.3"]) {
    const stage = state.stages?.[stageId];
    if (!stage || stage.status !== "VERIFIED") failures.push(`${stageId}_not_verified`);
    if (stage?.sourceCommit !== sourceCommit) failures.push(`${stageId}_source_commit_stale`);
    for (const [name, digest] of Object.entries(stage?.outputDigests ?? {})) {
      const outputPath = path.join(repoRoot, "docs", "system-audit", "phase-7", name);
      if (!existsSync(outputPath) || sha256File(outputPath) !== digest) failures.push(`${stageId}_output_stale:${name}`);
    }
    if (stage?.evidencePath) {
      const evidencePath = path.join(repoRoot, stage.evidencePath);
      if (!existsSync(evidencePath) || sha256File(evidencePath) !== stage.evidenceDigest) failures.push(`${stageId}_evidence_stale`);
    }
  }
  return failures;
}

export function buildPhase7ClosureMatrix(repoRoot, state, sourceCommit, options = {}) {
  const failures = stageDigestFailures(repoRoot, state, sourceCommit);
  const targetMatrix = options.targetMatrix ?? null;
  const releaseMatrix = options.releaseMatrix ?? null;
  const decision = readProductionDecision(repoRoot);
  const mutationPolicy = options.mutationPolicy ?? mutationPolicySnapshot();
  const checks = [
    { id: "technical_stages_verified", description: "7.1, 7.2 and 7.3 are VERIFIED", pass: failures.filter((item) => item.endsWith("_not_verified")).length === 0, details: failures },
    { id: "stage_digests_valid", description: "all prior stage output and evidence digests match", pass: failures.length === 0, details: failures },
    { id: "source_identity_reconciled", description: "current source commit, target identity and plan manifest agree", pass: targetMatrix?.sourceCommit === sourceCommit && targetMatrix?.identity?.commitSha === sourceCommit && options.planManifestSourceCommit === sourceCommit, details: { targetSourceCommit: targetMatrix?.sourceCommit ?? null, identityCommitSha: targetMatrix?.identity?.commitSha ?? null, planManifestSourceCommit: options.planManifestSourceCommit ?? null } },
    { id: "phase7_contract_test", description: "final Phase 7 contract test passes", pass: options.finalContractTest?.status === "PASS", details: options.finalContractTest ?? null },
    { id: "release_gate_consistent", description: "release-gate command summary and artifact identity remain PASS and consistent", pass: releaseMatrix?.status === "PASS" && releaseMatrix?.identity?.commitSha === sourceCommit && releaseMatrix?.commandResults?.every((item) => item.status === "PASS"), details: releaseMatrix ? { status: releaseMatrix.status, identity: releaseMatrix.identity, commandResults: releaseMatrix.commandResults } : null },
    { id: "production_decision_preserved", description: "production decision stays NO-GO, owner actions exist, live actions are empty and must-not-claim is intact", pass: decision.productionDecision === "NO-GO" && decision.ownerActionsRequired.length > 0 && decision.liveActionsExecuted.length === 0 && decision.mustNotClaim.length > 0, details: decision },
    { id: "mutation_boundary_and_blockers", description: "mutation flags are closed and deferred release blockers are recorded", pass: Object.values(mutationPolicy).every((item) => item.enabled === false) && (targetMatrix?.releaseBlockers?.length ?? 0) > 0, details: { mutationPolicy, deferredBlockers: targetMatrix?.releaseBlockers ?? [] } },
  ];
  return {
    schemaVersion: "aiya-system-audit-phase-7-closure-evidence-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    status: allPass(checks) ? "PASS" : "BLOCKED",
    generatedAt: new Date().toISOString(),
    sourceCommit,
    interpretation: "Technical closure does not change the production NO-GO decision or execute owner-controlled live actions.",
    checks,
    blockers: blockersFromChecks(checks),
    productionDecision: decision,
    mutationPolicy,
    deferredReleaseBlockers: targetMatrix?.releaseBlockers ?? [],
    closureRule: "all three technical stages VERIFIED, every digest valid, final contract/release gate PASS, NO-GO decision preserved and mutation boundary closed",
    nextPhase: null,
    nextPhaseUnlocked: false,
  };
}

export function createInitialState(sourceCommit, openedAt = new Date().toISOString()) {
  return {
    schemaVersion: "aiya-system-audit-phase-7-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    sourceCommit,
    openedAt,
    phaseStatus: "OPEN",
    nextStage: "7.1",
    stages: Object.fromEntries(PHASE_7_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      sourceCommit,
      evidencePath: null,
      evidenceDigest: null,
      outputDigests: {},
      blockers: [],
      operationResults: [],
    }])),
  };
}

export function assertCanBeginStage(state, stageId) {
  const stage = getPhase7Stage(stageId);
  const current = state.stages?.[stageId];
  if (!current) throw new Error(`phase_7_stage_state_missing:${stageId}`);
  if (current.status === "VERIFIED") throw new Error(`phase_7_stage_already_verified:${stageId}`);
  if (current.status === "IN_PROGRESS") throw new Error(`phase_7_stage_already_started:${stageId}`);
  for (const prerequisite of stage.prerequisiteStageIds) {
    if (prerequisite === "phase-6-closed") {
      if (state.phaseId !== PHASE_7_ID) throw new Error(`phase_7_invalid_state:${stageId}`);
      continue;
    }
    if (state.stages?.[prerequisite]?.status !== "VERIFIED") throw new Error(`phase_7_stage_prerequisite_not_verified:${stageId}:${prerequisite}`);
  }
}

export function buildStageEvidence({ stageId, sourceCommit, status, outputFiles, operations, verification, blockers = [] }) {
  const stage = getPhase7Stage(stageId);
  const evidence = {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: `${PHASE_7_ID}-${stageId}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 17)}`,
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_7_ID,
    stageId,
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
