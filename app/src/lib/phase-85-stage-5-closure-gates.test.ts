import { describe, expect, it } from "vitest";
import { evaluateStage5ClosureEvidence } from "./phase-85-stage-5-closure-gates";

const passingVerify = {
  closureStatus: "LOCAL_AUTOMATION_COMPLETE_DEDICATED_GATES_EVALUATED_SEPARATELY",
  productionStatus: "NO-GO",
  gates: {
    "production typecheck": { status: "PASS", exitCode: 0 },
    "stage-5 unit/contract tests": { status: "PASS", exitCode: 0 },
    cleanNextBuildOutput: { status: "PASS" },
    "production build": { status: "PASS", exitCode: 0 },
    bundleBudgetStatus: "PASS",
    bundleBudget: { withinBudget: true },
  },
};

const passingDependency = {
  schemaVersion: "stage5-evidence-v2",
  evidenceType: "dependency",
  status: "PASS",
  r405Status: "technically_resolved",
  productionAudit: {
    status: "PASS",
    totals: { total: 0, high: 0, critical: 0 },
    findings: [],
  },
  assertions: [{ code: "production_audit_zero_vulnerabilities", passed: true }],
  blockers: [],
};

const passingLabPerf = {
  schemaVersion: "stage5-evidence-v2",
  evidenceType: "performance",
  kind: "local_lab_only",
  status: "PASS",
  blockers: [],
  routes: ["home", "clients", "messages", "ai_chat", "settings"].map((route) => ({
    route,
    path: route === "home" ? "/dashboard" : `/dashboard/${route}`,
    sampleCount: 10,
    p75: { lcpMs: 1200, cls: 0, tbtMs: 20, interactionProxyMs: 20 },
    pass: { lcp: true, cls: true, tbt: true, interactionProxy: true },
  })),
  summary: { allTargetsMet: true, failedRouteIds: [], routeCount: 5 },
};
const passingRls = {
  schemaVersion: "stage5-evidence-v2",
  evidenceType: "rls",
  status: "PASS",
  rlsStatus: "zero_skip_passed",
  productionStatus: "NO-GO",
  target: {
    kind: "local_supabase",
    projectId: "manu-ai-local",
    apiUrl: "http://127.0.0.1:54321",
  },
  preflight: {
    docker: { status: "PASS", exitCode: 0 },
    localOnly: true,
    envSource: "child_process_only",
    writesEnvLocal: false,
    reportSecretsRedacted: true,
  },
  reset: { status: "PASS", exitCode: 0 },
  test: { passed: 56, skipped: 0, failed: 0, total: 56, zeroSkipped: true, minPassedRequired: 56, exitCode: 0 },
  passed: 56,
  skipped: 0,
  failed: 0,
  total: 56,
  zeroSkipped: true,
  rawReportRemoved: true,
  blockers: [],
};
const passingRealDevice = {
  schemaVersion: "stage5-evidence-v2",
  evidenceType: "real_device",
  status: "APPROVED",
  approvedBy: "QA Owner",
  capturedAt: "2026-08-04T12:00:00.000Z",
  blockers: [],
  requiredCaptures: {
    iphoneSafari: true,
    iphonePwa: true,
    androidChrome: true,
    androidPwa: true,
    offlinePrivacyLock: true,
  },
  deviceCaptures: {
    iphoneSafari: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      routeWalk: ["/dashboard", "/dashboard?section=clients", "/dashboard?section=messages", "/dashboard/ai-chat", "/dashboard/settings"],
      artifacts: [{ path: "stage-5-real-device/iphone-safari.png", sha256: "hash" }],
    },
    iphonePwa: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      routeWalk: ["/dashboard", "/dashboard?section=clients", "/dashboard?section=messages", "/dashboard/ai-chat", "/dashboard/settings"],
      artifacts: [{ path: "stage-5-real-device/iphone-pwa.png", sha256: "hash" }],
    },
    androidChrome: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      routeWalk: ["/dashboard", "/dashboard?section=clients", "/dashboard?section=messages", "/dashboard/ai-chat", "/dashboard/settings"],
      artifacts: [{ path: "stage-5-real-device/android-chrome.png", sha256: "hash" }],
    },
    androidPwa: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      routeWalk: ["/dashboard", "/dashboard?section=clients", "/dashboard?section=messages", "/dashboard/ai-chat", "/dashboard/settings"],
      artifacts: [{ path: "stage-5-real-device/android-pwa.png", sha256: "hash" }],
    },
    offlinePrivacyLock: {
      status: "PASS",
      realDevice: true,
      emulator: false,
      routeWalk: ["/dashboard", "/dashboard?section=clients", "/dashboard?section=messages", "/dashboard/ai-chat", "/dashboard/settings"],
      artifacts: [{ path: "stage-5-real-device/offline-privacy-lock.png", sha256: "hash" }],
      noClientNamesVisible: true,
      protectedContentUnmounted: true,
    },
  },
  normalizedArtifacts: {
    iphoneSafari: [{ path: "stage-5-real-device/iphone-safari.png", sha256: "hash" }],
    iphonePwa: [{ path: "stage-5-real-device/iphone-pwa.png", sha256: "hash" }],
    androidChrome: [{ path: "stage-5-real-device/android-chrome.png", sha256: "hash" }],
    androidPwa: [{ path: "stage-5-real-device/android-pwa.png", sha256: "hash" }],
    offlinePrivacyLock: [{ path: "stage-5-real-device/offline-privacy-lock.png", sha256: "hash" }],
  },
};

describe("phase-85-stage-5-closure-gates", () => {
  it("fails closed when external Stage 5 closure evidence is missing", () => {
    const decision = evaluateStage5ClosureEvidence({ verify: passingVerify });

    expect(decision.stageStatus).toBe("BLOCKED");
    expect(decision.productionStatus).toBe("NO-GO");
    expect(decision.blockers).toEqual(
      expect.arrayContaining([
        "stage5_lab_perf_report_missing",
        "stage5_rls_zero_skip_report_missing",
        "stage5_real_device_evidence_missing",
        "stage5_dependency_security_report_missing",
      ]),
    );
  });

  it("closes Stage 5 only with zero-skip RLS, passed lab targets, approved real devices, and resolved dependency evidence", () => {
    const decision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: passingLabPerf,
      rls: passingRls,
      realDevice: passingRealDevice,
      dependency: passingDependency,
    });

    expect(decision).toEqual({ stageStatus: "STAGE_5_CLOSED", productionStatus: "NO-GO", blockers: [] });
  });

  it("does not accept stale automation reports, skipped RLS, target misses, pending devices, or failed dependency evidence", () => {
    const decision = evaluateStage5ClosureEvidence({
      verify: { ...passingVerify, closureStatus: "PASS" },
      labPerf: {
        ...passingLabPerf,
        status: "TARGET_MISS_REPORTED",
        blockers: ["lab_perf_target_miss"],
        summary: { allTargetsMet: false, failedRouteIds: ["ai_chat"], routeCount: 5 },
      },
      rls: {
        ...passingRls,
        test: { passed: 1, skipped: 55, failed: 0, total: 56, zeroSkipped: false, minPassedRequired: 56 },
        skipped: 55,
        zeroSkipped: false,
      },
      realDevice: { status: "PENDING", requiredCaptures: { iphoneSafari: true } },
      dependency: { ...passingDependency, status: "FAIL", blockers: ["production_audit_zero_vulnerabilities"] },
    });

    expect(decision.blockers).toEqual(
      expect.arrayContaining([
        "stage5_verify_local_automation_not_complete",
        "stage5_lab_perf_targets_not_passed",
        "stage5_rls_zero_skip_not_passed",
        "stage5_real_device_evidence_not_approved",
        "r405_dependency_security_not_resolved",
      ]),
    );
  });

  it("does not accept partial real-device captures or empty zero-skip RLS reports", () => {
    const decision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: passingLabPerf,
      rls: {
        ...passingRls,
        test: { passed: 0, skipped: 0, failed: 0, total: 0, zeroSkipped: true, minPassedRequired: 56 },
        passed: 0,
        total: 0,
      },
      realDevice: {
        status: "APPROVED",
        requiredCaptures: {
          iphoneSafari: true,
        },
      },
      dependency: passingDependency,
    });

    expect(decision.blockers).toEqual(
      expect.arrayContaining([
        "stage5_rls_zero_skip_not_passed",
        "stage5_real_device_evidence_not_approved",
      ]),
    );
  });

  it("requires production typecheck tests build and clean build output gates in the verify report", () => {
    const decision = evaluateStage5ClosureEvidence({
      verify: {
        ...passingVerify,
        gates: {
          bundleBudgetStatus: "PASS",
          bundleBudget: { withinBudget: true },
        },
      },
      labPerf: passingLabPerf,
      rls: passingRls,
      realDevice: passingRealDevice,
      dependency: passingDependency,
    });

    expect(decision.blockers).toContain("stage5_verify_required_local_gates_not_passed");
  });

  it("does not accept legacy lab perf or emulator-only real-device reports", () => {
    const decision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: { status: "PASS", summary: { allTargetsMet: true, failedRouteIds: [], routeCount: 5 } },
      rls: passingRls,
      realDevice: {
        ...passingRealDevice,
        deviceCaptures: {
          ...passingRealDevice.deviceCaptures,
          iphoneSafari: { ...passingRealDevice.deviceCaptures.iphoneSafari, emulator: true },
        },
      },
      dependency: passingDependency,
    });

    expect(decision.blockers).toEqual(
      expect.arrayContaining(["stage5_lab_perf_targets_not_passed", "stage5_real_device_evidence_not_approved"]),
    );
  });

  it("does not accept legacy or remote RLS reports even when they claim PASS and zero skips", () => {
    const legacyDecision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: passingLabPerf,
      rls: { status: "PASS", passed: 56, skipped: 0, failed: 0, total: 56, zeroSkipped: true },
      realDevice: passingRealDevice,
      dependency: passingDependency,
    });
    const remoteDecision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: passingLabPerf,
      rls: {
        ...passingRls,
        target: { kind: "remote_supabase", projectId: "prod", apiUrl: "https://example.supabase.co" },
      },
      realDevice: passingRealDevice,
      dependency: passingDependency,
    });
    const dirtyResetDecision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: passingLabPerf,
      rls: { ...passingRls, reset: { status: "NOT_RUN", exitCode: null } },
      realDevice: passingRealDevice,
      dependency: passingDependency,
    });

    expect(legacyDecision.blockers).toContain("stage5_rls_zero_skip_not_passed");
    expect(remoteDecision.blockers).toContain("stage5_rls_zero_skip_not_passed");
    expect(dirtyResetDecision.blockers).toContain("stage5_rls_zero_skip_not_passed");
  });

  it("does not accept env-style R-405 acceptance semantics without technical dependency resolution", () => {
    const decision = evaluateStage5ClosureEvidence({
      verify: passingVerify,
      labPerf: passingLabPerf,
      rls: passingRls,
      realDevice: passingRealDevice,
      dependency: {
        ...passingDependency,
        r405Status: "accepted",
      },
    });

    expect(decision).toEqual({
      stageStatus: "BLOCKED",
      productionStatus: "NO-GO",
      blockers: ["r405_dependency_security_not_resolved"],
    });
  });
});
