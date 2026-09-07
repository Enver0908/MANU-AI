#!/usr/bin/env node
/**
 * Stage 5 closure evaluator.
 * This script does not create evidence. It reads evidence artifacts and fails
 * closed unless every local, RLS, real-device, performance, and R-405 gate is present.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { STAGE5_EVIDENCE_SCHEMA_VERSION } from "./lib/stage-5-evidence.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, "..");
const repoRoot = join(appRoot, "..");
const docsRoot = join(repoRoot, "docs");

const paths = {
  verify: join(docsRoot, "PHASE_85_STAGE_5_SHELL_VERIFY_REPORT.json"),
  dependency: join(docsRoot, "PHASE_85_STAGE_5_DEPENDENCY_SECURITY_REPORT.json"),
  labPerf: join(docsRoot, "PHASE_85_STAGE_5_LAB_PERF_REPORT.json"),
  rls: join(docsRoot, "PHASE_85_STAGE_5_RLS_ZERO_SKIP_REPORT.json"),
  realDevice: join(docsRoot, "PHASE_85_STAGE_5_REAL_DEVICE_EVIDENCE_STATUS.json"),
  decision: join(docsRoot, "PHASE_85_STAGE_5_CLOSURE_DECISION.json"),
};

const REQUIRED_LOCAL_GATES = [
  "production typecheck",
  "stage-5 unit/contract tests",
  "cleanNextBuildOutput",
  "production build",
];
const REQUIRED_REAL_DEVICE_CAPTURES = [
  "iphoneSafari",
  "iphonePwa",
  "androidChrome",
  "androidPwa",
  "offlinePrivacyLock",
];
const MIN_LAB_PERF_ROUTE_COUNT = 5;
const MIN_RLS_TEST_COUNT = 56;

function readJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function isPassedGate(value) {
  if (typeof value === "string") return value === "PASS";
  if (!value || typeof value !== "object") return false;
  return value.status === "PASS" && (value.exitCode == null || value.exitCode === 0);
}

function hasRequiredLocalAutomationGates(verify) {
  return REQUIRED_LOCAL_GATES.every((gateName) => isPassedGate(verify.gates?.[gateName]));
}

function hasPassingLabPerfEvidence(labPerf) {
  const routes = labPerf.routes ?? [];
  return (
    labPerf.schemaVersion === STAGE5_EVIDENCE_SCHEMA_VERSION &&
    labPerf.evidenceType === "performance" &&
    labPerf.kind === "local_lab_only" &&
    labPerf.status === "PASS" &&
    labPerf.summary?.allTargetsMet === true &&
    typeof labPerf.summary.routeCount === "number" &&
    labPerf.summary.routeCount >= MIN_LAB_PERF_ROUTE_COUNT &&
    (labPerf.summary.failedRouteIds?.length ?? 0) === 0 &&
    (labPerf.blockers?.length ?? 0) === 0 &&
    routes.length >= MIN_LAB_PERF_ROUTE_COUNT &&
    routes.every((route) => {
      const p75 = route.p75 ?? {};
      const pass = route.pass ?? {};
      return (
        typeof route.route === "string" &&
        typeof route.path === "string" &&
        typeof route.sampleCount === "number" &&
        route.sampleCount > 0 &&
        typeof p75.lcpMs === "number" &&
        typeof p75.cls === "number" &&
        typeof p75.tbtMs === "number" &&
        typeof p75.interactionProxyMs === "number" &&
        pass.lcp === true &&
        pass.cls === true &&
        pass.tbt === true &&
        pass.interactionProxy === true
      );
    })
  );
}

function isLocalStage5SupabaseUrl(apiUrl) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/.test(apiUrl ?? "");
}

function hasMeaningfulZeroSkipRlsEvidence(rls) {
  const passed = rls.test?.passed ?? rls.passed;
  const skipped = rls.test?.skipped ?? rls.skipped;
  const failed = rls.test?.failed ?? rls.failed;
  const total = rls.test?.total ?? rls.total;
  const zeroSkipped = rls.test?.zeroSkipped ?? rls.zeroSkipped;

  return (
    rls.schemaVersion === STAGE5_EVIDENCE_SCHEMA_VERSION &&
    rls.evidenceType === "rls" &&
    rls.status === "PASS" &&
    rls.rlsStatus === "zero_skip_passed" &&
    rls.target?.kind === "local_supabase" &&
    rls.target.projectId === "manu-ai-local" &&
    isLocalStage5SupabaseUrl(rls.target.apiUrl) &&
    rls.preflight?.docker?.status === "PASS" &&
    rls.preflight.localOnly === true &&
    rls.preflight.envSource === "child_process_only" &&
    rls.preflight.writesEnvLocal === false &&
    rls.preflight.reportSecretsRedacted === true &&
    rls.reset?.status === "PASS" &&
    (rls.reset.exitCode == null || rls.reset.exitCode === 0) &&
    zeroSkipped === true &&
    skipped === 0 &&
    failed === 0 &&
    typeof passed === "number" &&
    passed >= MIN_RLS_TEST_COUNT &&
    typeof total === "number" &&
    total >= passed &&
    total >= MIN_RLS_TEST_COUNT &&
    rls.rawReportRemoved === true &&
    (rls.blockers?.length ?? 0) === 0
  );
}

function hasRequiredRealDeviceCaptures(realDevice) {
  const captures = realDevice.requiredCaptures ?? {};
  const deviceCaptures = realDevice.deviceCaptures ?? {};
  const normalizedArtifacts = realDevice.normalizedArtifacts ?? {};
  return (
    realDevice.schemaVersion === STAGE5_EVIDENCE_SCHEMA_VERSION &&
    realDevice.evidenceType === "real_device" &&
    typeof realDevice.approvedBy === "string" &&
    realDevice.approvedBy.length > 0 &&
    typeof realDevice.capturedAt === "string" &&
    !Number.isNaN(Date.parse(realDevice.capturedAt)) &&
    (realDevice.blockers?.length ?? 0) === 0 &&
    REQUIRED_REAL_DEVICE_CAPTURES.every((capture) => {
      const detail = deviceCaptures[capture];
      return (
        captures[capture] === true &&
        detail?.status === "PASS" &&
        detail.realDevice === true &&
        detail.emulator !== true &&
        Array.isArray(detail.routeWalk) &&
        detail.routeWalk.length >= MIN_LAB_PERF_ROUTE_COUNT &&
        Array.isArray(detail.artifacts) &&
        detail.artifacts.length > 0 &&
        Array.isArray(normalizedArtifacts[capture]) &&
        (normalizedArtifacts[capture]?.length ?? 0) > 0
      );
    }) &&
    deviceCaptures.offlinePrivacyLock?.noClientNamesVisible === true &&
    deviceCaptures.offlinePrivacyLock?.protectedContentUnmounted === true
  );
}

function hasResolvedDependencyEvidence(dependency) {
  const auditTotals = dependency.productionAudit?.totals ?? {};
  const assertions = dependency.assertions ?? [];
  return (
    dependency.schemaVersion === STAGE5_EVIDENCE_SCHEMA_VERSION &&
    dependency.evidenceType === "dependency" &&
    dependency.status === "PASS" &&
    dependency.r405Status === "technically_resolved" &&
    dependency.productionAudit?.status === "PASS" &&
    (auditTotals.total ?? 1) === 0 &&
    (auditTotals.high ?? 1) === 0 &&
    (auditTotals.critical ?? 1) === 0 &&
    (dependency.productionAudit?.findings?.length ?? 1) === 0 &&
    assertions.length > 0 &&
    assertions.every((assertion) => assertion.passed === true) &&
    (dependency.blockers?.length ?? 0) === 0
  );
}

function evaluate(input) {
  const blockers = [];

  if (!input.verify) {
    blockers.push("stage5_verify_report_missing");
  } else {
    if (input.verify.closureStatus !== "LOCAL_AUTOMATION_COMPLETE_DEDICATED_GATES_EVALUATED_SEPARATELY") {
      blockers.push("stage5_verify_local_automation_not_complete");
    }
    if (input.verify.productionStatus !== "NO-GO") {
      blockers.push("stage5_verify_must_not_claim_production_go");
    }
    if (!hasRequiredLocalAutomationGates(input.verify)) {
      blockers.push("stage5_verify_required_local_gates_not_passed");
    }
    if (input.verify.gates?.bundleBudgetStatus !== "PASS" || input.verify.gates?.bundleBudget?.withinBudget !== true) {
      blockers.push("stage5_bundle_budget_not_passed");
    }
  }

  if (!input.labPerf) {
    blockers.push("stage5_lab_perf_report_missing");
  } else if (!hasPassingLabPerfEvidence(input.labPerf)) {
    blockers.push("stage5_lab_perf_targets_not_passed");
  }

  if (!input.rls) {
    blockers.push("stage5_rls_zero_skip_report_missing");
  } else if (!hasMeaningfulZeroSkipRlsEvidence(input.rls)) {
    blockers.push("stage5_rls_zero_skip_not_passed");
  }

  if (!input.realDevice) {
    blockers.push("stage5_real_device_evidence_missing");
  } else if (input.realDevice.status !== "APPROVED" || !hasRequiredRealDeviceCaptures(input.realDevice)) {
    blockers.push("stage5_real_device_evidence_not_approved");
  }

  if (!input.dependency) {
    blockers.push("stage5_dependency_security_report_missing");
  } else if (!hasResolvedDependencyEvidence(input.dependency)) {
    blockers.push("r405_dependency_security_not_resolved");
  }

  return {
    generatedAt: new Date().toISOString(),
    stageStatus: blockers.length === 0 ? "STAGE_5_CLOSED" : "BLOCKED",
    productionStatus: "NO-GO",
    blockers,
    evidencePaths: paths,
  };
}

const input = {
  verify: readJson(paths.verify),
  dependency: readJson(paths.dependency),
  labPerf: readJson(paths.labPerf),
  rls: readJson(paths.rls),
  realDevice: readJson(paths.realDevice),
};

const decision = evaluate(input);
mkdirSync(dirname(paths.decision), { recursive: true });
writeFileSync(paths.decision, `${JSON.stringify(decision, null, 2)}\n`, "utf8");

if (decision.stageStatus !== "STAGE_5_CLOSED") {
  console.error("[stage-5-closure] BLOCKED");
  for (const blocker of decision.blockers) {
    console.error(`- ${blocker}`);
  }
  process.exit(1);
}

console.log("[stage-5-closure] STAGE_5_CLOSED; production remains NO-GO until separate launch gates close.");
