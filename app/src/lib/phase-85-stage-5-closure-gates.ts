import { STAGE5_EVIDENCE_SCHEMA_VERSION } from "./phase-85-stage-5-evidence";

export const STAGE5_REQUIRED_LOCAL_GATES = [
  "production typecheck",
  "stage-5 unit/contract tests",
  "cleanNextBuildOutput",
  "production build",
] as const;

export const STAGE5_REQUIRED_REAL_DEVICE_CAPTURES = [
  "iphoneSafari",
  "iphonePwa",
  "androidChrome",
  "androidPwa",
  "offlinePrivacyLock",
] as const;

export const STAGE5_MIN_LAB_PERF_ROUTE_COUNT = 5;
export const STAGE5_MIN_RLS_TEST_COUNT = 56;

export type Stage5GateRecord = {
  status?: string;
  exitCode?: number;
};

export type Stage5VerifyEvidence = {
  closureStatus?: string;
  productionStatus?: string;
  r405?: string;
  gates?: {
    bundleBudget?: { withinBudget?: boolean };
    bundleBudgetStatus?: string;
    [gateName: string]: unknown;
  };
};

export type Stage5LabPerfEvidence = {
  schemaVersion?: string;
  evidenceType?: string;
  kind?: string;
  status?: string;
  blockers?: string[];
  routes?: Array<{
    route?: string;
    path?: string;
    sampleCount?: number;
    p75?: {
      lcpMs?: number | null;
      cls?: number | null;
      tbtMs?: number | null;
      interactionProxyMs?: number | null;
    };
    pass?: {
      lcp?: boolean;
      cls?: boolean;
      tbt?: boolean;
      interactionProxy?: boolean;
    };
  }>;
  summary?: {
    allTargetsMet?: boolean;
    failedRouteIds?: string[];
    routeCount?: number;
  };
};

export type Stage5RlsEvidence = {
  schemaVersion?: string;
  evidenceType?: string;
  status?: string;
  rlsStatus?: string;
  passed?: number;
  skipped?: number;
  failed?: number;
  total?: number;
  zeroSkipped?: boolean;
  target?: {
    kind?: string;
    projectId?: string;
    apiUrl?: string | null;
  };
  preflight?: {
    docker?: {
      status?: string;
      exitCode?: number;
    };
    localOnly?: boolean;
    envSource?: string;
    writesEnvLocal?: boolean;
    reportSecretsRedacted?: boolean;
  };
  reset?: {
    status?: string;
    exitCode?: number | null;
  };
  test?: {
    passed?: number;
    skipped?: number;
    failed?: number;
    total?: number;
    zeroSkipped?: boolean;
    minPassedRequired?: number;
    exitCode?: number;
  };
  rawReportRemoved?: boolean;
  blockers?: string[];
};

export type Stage5RealDeviceEvidence = {
  schemaVersion?: string;
  evidenceType?: string;
  status?: string;
  approvedBy?: string;
  capturedAt?: string;
  blockers?: string[];
  requiredCaptures?: Partial<Record<(typeof STAGE5_REQUIRED_REAL_DEVICE_CAPTURES)[number], boolean>> &
    Record<string, boolean | undefined>;
  deviceCaptures?: Partial<
    Record<
      (typeof STAGE5_REQUIRED_REAL_DEVICE_CAPTURES)[number],
      {
        status?: string;
        realDevice?: boolean;
        emulator?: boolean;
        routeWalk?: string[];
        artifacts?: Array<{ path?: string; sha256?: string }>;
        noClientNamesVisible?: boolean;
        protectedContentUnmounted?: boolean;
      }
    >
  >;
  normalizedArtifacts?: Partial<Record<(typeof STAGE5_REQUIRED_REAL_DEVICE_CAPTURES)[number], unknown[]>>;
};

export type Stage5DependencyEvidence = {
  schemaVersion?: string;
  evidenceType?: string;
  status?: string;
  r405Status?: string;
  productionAudit?: {
    status?: string;
    totals?: {
      total?: number;
      high?: number;
      critical?: number;
    };
    findings?: unknown[];
  };
  assertions?: Array<{ code?: string; passed?: boolean }>;
  blockers?: string[];
};

export type Stage5ClosureEvidenceInput = {
  verify?: Stage5VerifyEvidence | null;
  labPerf?: Stage5LabPerfEvidence | null;
  rls?: Stage5RlsEvidence | null;
  realDevice?: Stage5RealDeviceEvidence | null;
  dependency?: Stage5DependencyEvidence | null;
};

export type Stage5ClosureDecision = {
  stageStatus: "STAGE_5_CLOSED" | "BLOCKED";
  productionStatus: "NO-GO";
  blockers: string[];
};

function isPassedGate(value: unknown) {
  if (typeof value === "string") return value === "PASS";
  if (!value || typeof value !== "object") return false;
  const gate = value as Stage5GateRecord;
  return gate.status === "PASS" && (gate.exitCode == null || gate.exitCode === 0);
}

function hasRequiredLocalAutomationGates(verify: Stage5VerifyEvidence) {
  return STAGE5_REQUIRED_LOCAL_GATES.every((gateName) => isPassedGate(verify.gates?.[gateName]));
}

function hasPassingLabPerfEvidence(labPerf: Stage5LabPerfEvidence) {
  const routes = labPerf.routes ?? [];
  return (
    labPerf.schemaVersion === STAGE5_EVIDENCE_SCHEMA_VERSION &&
    labPerf.evidenceType === "performance" &&
    labPerf.kind === "local_lab_only" &&
    labPerf.status === "PASS" &&
    labPerf.summary?.allTargetsMet === true &&
    typeof labPerf.summary.routeCount === "number" &&
    labPerf.summary.routeCount >= STAGE5_MIN_LAB_PERF_ROUTE_COUNT &&
    (labPerf.summary.failedRouteIds?.length ?? 0) === 0 &&
    (labPerf.blockers?.length ?? 0) === 0 &&
    routes.length >= STAGE5_MIN_LAB_PERF_ROUTE_COUNT &&
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

function isLocalStage5SupabaseUrl(apiUrl: string | null | undefined) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/.test(apiUrl ?? "");
}

function hasMeaningfulZeroSkipRlsEvidence(rls: Stage5RlsEvidence) {
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
    passed >= STAGE5_MIN_RLS_TEST_COUNT &&
    typeof total === "number" &&
    total >= passed &&
    total >= STAGE5_MIN_RLS_TEST_COUNT &&
    rls.rawReportRemoved === true &&
    (rls.blockers?.length ?? 0) === 0
  );
}

function hasRequiredRealDeviceCaptures(realDevice: Stage5RealDeviceEvidence) {
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
    STAGE5_REQUIRED_REAL_DEVICE_CAPTURES.every((capture) => {
      const detail = deviceCaptures[capture];
      return (
        captures[capture] === true &&
        detail?.status === "PASS" &&
        detail.realDevice === true &&
        detail.emulator !== true &&
        Array.isArray(detail.routeWalk) &&
        detail.routeWalk.length >= STAGE5_MIN_LAB_PERF_ROUTE_COUNT &&
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

function hasResolvedDependencyEvidence(dependency: Stage5DependencyEvidence) {
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

export function evaluateStage5ClosureEvidence(input: Stage5ClosureEvidenceInput): Stage5ClosureDecision {
  const blockers: string[] = [];

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
    stageStatus: blockers.length === 0 ? "STAGE_5_CLOSED" : "BLOCKED",
    productionStatus: "NO-GO",
    blockers,
  };
}
