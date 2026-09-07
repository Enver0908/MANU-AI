import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ACTIVATION_APPROVAL_KEYS,
  IOS_PHYSICAL_DEVICE_STATUS,
  assertActivationApprovals,
} from "./lib/activation-contract.mjs";
import { runHostedActivation } from "./run-hosted-activation.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("HS-ACCEPT-001 dry-run activation sequence completes locally", async () => {
  const result = await runHostedActivation({
    apply: false,
    env: {
      ...process.env,
      MANU_CI_NO_PRODUCTION_EFFECTS: "true",
      MANU_DEPLOY_TEXT_POINTER: "true",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_URL: "",
    },
  });
  assert.equal(result.report.mode, "dry-run");
  assert.equal(result.report.steps.migration_fingerprint, "PASS");
  assert.equal(result.report.iosPhysicalDevice, IOS_PHYSICAL_DEVICE_STATUS);
  assert.equal(result.report.productionStatus, "NO-GO");
});

test("HS-ACCEPT-001 apply requires all activation approvals", () => {
  assert.throws(() => assertActivationApprovals({}, { apply: true }));
  const env = {};
  for (const key of Object.values(ACTIVATION_APPROVAL_KEYS)) {
    env[key] = "true";
  }
  assertActivationApprovals(env, { apply: true });
});

test("HS-ACCEPT-003 iPhone remains waived not executed", async () => {
  const result = await runHostedActivation({ apply: false, env: { MANU_DEPLOY_TEXT_POINTER: "true" } });
  assert.equal(result.report.iosPhysicalDevice, IOS_PHYSICAL_DEVICE_STATUS);
});
