import assert from "node:assert/strict";
import test from "node:test";
import {
  PHASE_4_5_4_6_ENVIRONMENTS,
  androidSurfaceIsReady,
  buildPhase45Evidence,
  phase45EnvironmentUnits,
  phase45StageStatuses,
  phase45V3EvidencePath,
} from "./performance-plan-1-phase-4-5-4-6.mjs";

test("4.5/4.6 keeps hosted, Android Chrome, and PWA units separate", () => {
  const units = phase45EnvironmentUnits();
  assert.deepEqual(PHASE_4_5_4_6_ENVIRONMENTS, [
    "hosted",
    "android_chrome",
    "android_pwa",
  ]);
  assert.equal(units.length, 27);
  assert.equal(units[0].unitKey, "hosted:J1:r1");
  assert.equal(units.at(-1).unitKey, "android_pwa:J3:r3");
  assert.ok(units.every((unit) => unit.countedAsOfficialSample === false));
});

test("Android PWA acceptance requires standalone display mode and service-worker control", () => {
  const base = {
    origin: "https://65-21-52-249.sslip.io",
    online: true,
    displayModeStandalone: true,
    serviceWorkerControlled: true,
  };
  assert.equal(androidSurfaceIsReady(base, {
    expectedOrigin: base.origin,
    standaloneRequired: true,
  }), true);
  assert.equal(androidSurfaceIsReady({ ...base, serviceWorkerControlled: false }, {
    expectedOrigin: base.origin,
    standaloneRequired: true,
  }), false);
  assert.equal(androidSurfaceIsReady({ ...base, displayModeStandalone: false }, {
    expectedOrigin: base.origin,
    standaloneRequired: false,
  }), true);
  assert.equal(androidSurfaceIsReady(base, {
    expectedOrigin: base.origin,
    standaloneRequired: false,
  }), false);
});

test("stage scheduler does not promote a missing environment", () => {
  const results = phase45EnvironmentUnits().map((unit) => ({
    ...unit,
    observationValidity: "VALID",
    validSample: true,
    functionalOutcome: "SUCCESS",
  }));
  const complete = phase45StageStatuses({
    hostedPreflightStatus: "PASS",
    devicePreflightStatus: "PASS",
    results,
  });
  assert.equal(complete["4.5"], "COMPLETE");
  assert.equal(complete["4.6"], "COMPLETE");

  const blocked = phase45StageStatuses({
    hostedPreflightStatus: "PASS",
    devicePreflightStatus: "BLOCKED",
    results: results.filter((result) => result.environment === "hosted"),
  });
  assert.equal(blocked["4.5"], "COMPLETE");
  assert.equal(blocked["4.6"], "BLOCKED");
});

test("evidence keeps credentials and device runtime handles out of the artifact", () => {
  const secretEmail = "test-owner@example.invalid";
  const secretPassword = "test-password-only";
  const evidence = buildPhase45Evidence({
    status: "BLOCKED",
    outcome: "ENVIRONMENT_OBSERVATIONS_BLOCKED",
    runId: "aiya-performance-plan1-phase4-5-4-6-v3-test",
    sourceIdentity: { head: "a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a" },
    preflights: {
      hosted: {
        status: "PASS",
        origin: "https://65-21-52-249.sslip.io",
        email: secretEmail,
        password: secretPassword,
      },
      device: {
        status: "BLOCKED",
        reason: "device_not_ready",
        runtime: { serial: "must-not-be-recorded" },
      },
      androidPwa: { status: "NOT_RUN", reason: null },
    },
    results: [],
  }, { secretValues: [secretEmail, secretPassword, "must-not-be-recorded"] });
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes(secretEmail), false);
  assert.equal(serialized.includes(secretPassword), false);
  assert.equal(serialized.includes("must-not-be-recorded"), false);
  assert.equal(evidence.evidenceIntegrity.redactionCheck, "PASS");
});

test("environment evidence path rejects traversal", () => {
  assert.throws(() => phase45V3EvidencePath("../unsafe"), /run_id_invalid/);
  assert.match(
    phase45V3EvidencePath("environment-run-1"),
    /AIYA_PERFORMANCE_PLAN_1_V3_environment-run-1_ENVIRONMENT_EVIDENCE\.json$/,
  );
});

