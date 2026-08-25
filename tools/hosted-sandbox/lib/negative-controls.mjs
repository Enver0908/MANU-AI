import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DEMO_TENANT_UUID, fingerprintMigrations, sha256Buffer } from "./identity.mjs";

const FORBIDDEN_DIFF_PATHS = new Set([
  "package.json",
  "app/package.json",
  "app/package-lock.json",
  ".github/workflows/execution-governance.yml",
  "tools/execution-governance/governance-cli.mjs"
]);

export function evaluateShaBinding(actualSha, expectedSha) {
  if (actualSha !== expectedSha) {
    return { ok: false, reason: `SHA mismatch: expected ${expectedSha}, actual ${actualSha}` };
  }
  return { ok: true };
}

export function evaluateUnauthorizedDiff(changedPaths, allowedPaths) {
  const allowed = new Set(allowedPaths);
  const unauthorized = changedPaths.filter((item) => !allowed.has(item) || FORBIDDEN_DIFF_PATHS.has(item));
  if (unauthorized.length) {
    return { ok: false, reason: `unauthorized diff paths: ${unauthorized.join(", ")}` };
  }
  return { ok: true };
}

export function evaluateDemoTenantSource(sourceText) {
  if (sourceText.includes(DEMO_TENANT_UUID)) {
    return { ok: false, reason: `demo tenant UUID ${DEMO_TENANT_UUID} present in inspected source` };
  }
  return { ok: true };
}

export function runNegativeControls(repoRoot) {
  const failures = [];
  const actualSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const wrongSha = evaluateShaBinding(actualSha, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  if (wrongSha.ok) failures.push("wrong SHA control did not fail");

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), "hs-neg-mig-"));
  const emptyMigrations = path.join(tempRoot, "app", "supabase", "migrations");
  mkdirSync(emptyMigrations, { recursive: true });
  try {
    fingerprintMigrations(tempRoot);
    failures.push("missing migration control did not fail");
  } catch (error) {
    if (!String(error.message).includes("empty") && !String(error.message).includes("missing")) {
      failures.push(`missing migration control produced unexpected error: ${error.message}`);
    }
  }

  const demoSource = `tenant_id: ${DEMO_TENANT_UUID}\n`;
  const demo = evaluateDemoTenantSource(demoSource);
  if (demo.ok) failures.push("demo tenant control did not fail");

  const unauthorized = evaluateUnauthorizedDiff(
    ["app/package.json", "docs/execution-governance/allowed.md"],
    ["docs/execution-governance/allowed.md"]
  );
  if (unauthorized.ok) failures.push("unauthorized diff control did not fail");

  writeFileSync(path.join(tempRoot, "probe.txt"), sha256Buffer(Buffer.from("negative-control")), "utf8");

  if (failures.length) {
    throw new Error(`negative controls failed: ${failures.join("; ")}`);
  }
  return {
    wrongSha: "FAIL_CLOSED",
    missingMigration: "FAIL_CLOSED",
    demoTenant: "FAIL_CLOSED",
    unauthorizedDiff: "FAIL_CLOSED"
  };
}
