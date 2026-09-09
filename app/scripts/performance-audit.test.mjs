import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BUDGETS,
  REDACTION_KEYS,
  SCENARIOS,
  buildPhase2FindingManifest,
} from "./measure-aiya-performance.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(appRoot, "..");

test("performance scenarios cover the user-reported slow surfaces", () => {
  const ids = new Set(SCENARIOS.map((scenario) => scenario.id));
  for (const required of [
    "dashboard_overview",
    "client_forms_workspace",
    "nutrition_workspace",
    "menu_workspace",
    "ai_chat",
  ]) {
    assert.equal(ids.has(required), true, `${required} scenario is missing`);
  }
  assert.equal(SCENARIOS.every((scenario) => scenario.readySelector && scenario.actionSelector), true);
});

test("performance budgets are explicit and finite", () => {
  for (const [key, value] of Object.entries(BUDGETS)) {
    assert.equal(Number.isFinite(value), true, `${key} must be finite`);
    assert.equal(value > 0, true, `${key} must be positive`);
  }
});

test("redaction policy rejects sensitive capture categories", () => {
  for (const required of ["authorization", "cookie", "token", "password", "prompt", "body", "raw", "content"]) {
    assert.equal(REDACTION_KEYS.includes(required), true, `${required} redaction key is missing`);
  }
});

test("phase 2 manifest locks concrete file-scoped findings from observed evidence", () => {
  const manifest = buildPhase2FindingManifest(
    {
      observations: [
        { id: "app_state_initial_full_hydration", status: "OBSERVED" },
        { id: "background_polling_surfaces", status: "OBSERVED" },
        { id: "dashboard_static_import_surface", status: "OBSERVED" },
      ],
    },
    {
      scenarios: [
        {
          profileId: "desktop_chrome_lab",
          scenarioId: "dashboard_overview",
          targetMisses: ["dashboardReadyP75Ms:4000>3000"],
          samples: [],
        },
      ],
    },
  );
  assert.equal(manifest.status, "LOCKED_WITH_FINDINGS");
  assert.equal(manifest.findings.length >= 4, true);
  assert.equal(manifest.findings.every((finding) => finding.affectedFiles.length > 0), true);
  assert.match(manifest.phase2ScopeRule, /Phase 1 evidence/);
});

test("npm package exposes the phase 1 audit commands", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "app", "package.json"), "utf8"));
  assert.equal(packageJson.scripts["audit:performance:phase1"], "node scripts/measure-aiya-performance.mjs");
  assert.equal(packageJson.scripts["test:performance-audit"], "node --test scripts/performance-audit.test.mjs");
});
