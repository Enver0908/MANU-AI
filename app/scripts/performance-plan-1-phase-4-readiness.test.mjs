import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  collectPhase4MeasurementIdentity,
  evaluateOrderedStageLedger,
  PHASE_4_FINDING_IDS,
  PHASE_4_IDENTITY_PATHS,
  PHASE_4_READINESS_STAGE_IDS,
  phase4ReadinessClosure,
  redactionCheck,
  sanitizePhase4Evidence,
} from "./lib/performance-plan-1-phase-4-contract.mjs";
import {
  disconnectCdpBrowser,
  PHASE_4_SCENARIOS,
  PHASE_4_SAMPLE_COUNT,
} from "./performance-plan-1-phase-4.mjs";

const appRoot = join(import.meta.dirname, "..");
const repoRoot = join(appRoot, "..");

test("Phase 4 readiness keeps the locked five findings and ordered H1-H4 stages", () => {
  assert.deepEqual(PHASE_4_FINDING_IDS, [
    "PERF-F2-001",
    "PERF-F2-002",
    "PERF-F2-003",
    "PERF-F12-001",
    "PERF-F12-002",
  ]);
  assert.deepEqual(PHASE_4_READINESS_STAGE_IDS, ["H1", "H2", "H3", "H4"]);
  assert.equal(existsSync(join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_PHASE_4_READINESS_ACTION_PLAN.md")), true);
});

test("Phase 4 readiness cannot close on a blocked stage even when test commands pass", () => {
  const stages = PHASE_4_READINESS_STAGE_IDS.map((stageId) => ({
    stageId,
    status: stageId === "H3" ? "BLOCKED" : "COMPLETE",
  }));
  const closure = phase4ReadinessClosure({
    stageLedger: stages,
    tests: [{ status: "PASS" }],
    evidenceIntegrity: { status: "PASS" },
  });
  assert.equal(closure.status, "BLOCKED");
  assert.equal(closure.outcome, "READINESS_BLOCKED");
  assert.ok(closure.blockers.includes("stage_not_complete:H3"));
});

test("Phase 4 readiness closure requires exact stage order and no duplicate stages", () => {
  const result = evaluateOrderedStageLedger([
    { stageId: "H1", status: "COMPLETE" },
    { stageId: "H1", status: "COMPLETE" },
    { stageId: "H3", status: "COMPLETE" },
    { stageId: "H4", status: "COMPLETE" },
  ]);
  assert.equal(result.status, "FAIL");
  assert.ok(result.failures.includes("stage_order_mismatch:H2"));
  assert.ok(result.failures.includes("duplicate_stage_id"));
});

test("Phase 4 readiness identity records hashes without recording credentials", () => {
  const identity = collectPhase4MeasurementIdentity({ repoRoot });
  assert.ok(identity.sourceFingerprint);
  assert.ok(identity.files.some((file) => file.path.endsWith("performance-plan-1-phase-4.mjs")));
  assert.equal(identity.fixture.phase3EvidenceFixtureHash, null);
  assert.equal(JSON.stringify(identity).includes("password"), false);
});

test("Phase 4 readiness sanitizer redacts secrets while preserving the nine-scenario contract", () => {
  assert.equal(PHASE_4_SCENARIOS.length, 9);
  assert.equal(PHASE_4_SAMPLE_COUNT, 20);
  const sanitized = sanitizePhase4Evidence(
    {
      credential: "approved-secret-value",
      nested: { access_token: "opaque-token", body: "raw content" },
      serviceRoleKeyPresent: true,
      metric: { bodyFinishedMs: 902 },
    },
    "",
    ["approved-secret-value"],
  );
  assert.equal(sanitized.credential, "<redacted>");
  assert.equal(sanitized.nested.access_token, "<redacted>");
  assert.equal(sanitized.nested.body, "<redacted>");
  assert.equal(sanitized.serviceRoleKeyPresent, true);
  assert.equal(sanitized.metric.bodyFinishedMs, 902);
  assert.equal(redactionCheck(sanitized, ["approved-secret-value"]).status, true);
  assert.ok(PHASE_4_IDENTITY_PATHS.includes("app/package-lock.json"));
});

test("Phase 4 readiness requires the real hosted authentication preflight", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4-readiness.mjs", import.meta.url), "utf8");
  assert.match(source, /hostedAuthentication = await verifyHostedAccess\(configuredHosted\)/);
  assert.match(source, /hostedAuthentication\.status === "PASS"/);
  assert.match(source, /password-login plus shell-bootstrap preflight/);
});

test("Phase 4 readiness records the measurement-start binding contract", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4-readiness.mjs", import.meta.url), "utf8");
  assert.match(source, /measurementStartBindingEvidence\(\)/);
  assert.match(source, /const h4Status/);
  assert.match(source, /measurementStartBinding/);
  assert.match(source, /REQUIRED_BEFORE_BASELINE_STAGE_4_1/);
  assert.match(source, /baselineLauncherBinding/);
});

test("Phase 4 Android readiness opens the installed PWA independently and monitors the phone", () => {
  const source = readFileSync(new URL("./performance-plan-1-phase-4-readiness.mjs", import.meta.url), "utf8");
  const baselineSource = readFileSync(new URL("./performance-plan-1-phase-4.mjs", import.meta.url), "utf8");
  assert.match(source, /connectPhase4AndroidCdp/);
  assert.match(source, /launchAndroidChromeTarget\(/);
  assert.match(source, /navigateAndroidChromeHostedTarget\(/);
  assert.match(source, /launchInstalledPwa\(safeAndroidTarget, runtime\)/);
  assert.match(source, /readiness:pwa_target_poll_/);
  assert.match(source, /navigator\.onLine === true/);
  assert.match(baselineSource, /after_adb_authorization/);
  assert.match(baselineSource, /after_cdp_forward/);
  assert.match(baselineSource, /cdp_normal_tab_navigation/);
  assert.match(baselineSource, /android_connection_lost_during_measurement/);
  assert.match(baselineSource, /monkey\", \"-p\", pwa\.packageName/);
});

test("Phase 4 CDP cleanup disconnects without closing the remote Android browser", () => {
  let closeCount = 0;
  const browser = {
    _connection: {
      toImpl(value) {
        assert.equal(value, browser);
        return { _connection: { close: () => closeCount++ } };
      },
    },
  };
  disconnectCdpBrowser(browser);
  assert.equal(closeCount, 1);
});

test("Phase 4 canonical evidence remains blocked until the four-environment baseline exists", () => {
  const evidencePath = join(repoRoot, "docs", "AIYA_PERFORMANCE_PLAN_1_PHASE_4_EVIDENCE.json");
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  assert.equal(evidence.status, "BLOCKED");
  assert.equal(evidence.outcome, "PERFORMANCE_BLOCKED");
  assert.equal(evidence.productionDecision, "NO-GO");
});
