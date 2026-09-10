import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PHASE_1_2_REDACTION_RULES,
  PHASE_1_2_SCENARIOS,
  mergePhase1AndPhase12Findings,
  validatePhase12HarnessContract,
} from "./measure-aiya-performance-phase-1-2.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(appRoot, "..");

test("phase 1.2 scenarios use canonical clientTask and active client routing", () => {
  const ids = new Set(PHASE_1_2_SCENARIOS.map((scenario) => scenario.id));
  for (const required of [
    "post_login_dashboard",
    "client_roster",
    "client_forms_workspace",
    "nutrition_workspace",
    "menu_workspace",
    "ai_chat",
    "messages",
    "alerts",
    "notifications",
  ]) {
    assert.equal(ids.has(required), true, `${required} scenario is missing`);
  }

  for (const scenario of PHASE_1_2_SCENARIOS) {
    assert.equal(scenario.path.includes("workspace="), false, `${scenario.id} uses obsolete workspace param`);
    if (scenario.id.includes("workspace")) {
      assert.match(scenario.path, /clientId=client-mert/);
      assert.match(scenario.path, /clientTask=(forms|nutrition|menu)/);
    }
  }
});

test("phase 1.2 harness contract rejects weak workspace assertions", () => {
  const contract = validatePhase12HarnessContract();
  assert.equal(contract.status, "PASS");
  assert.deepEqual(contract.failures, []);
});

test("phase 1.2 redaction policy excludes sensitive runtime content", () => {
  for (const rule of [
    "headers_not_recorded",
    "request_body_not_recorded",
    "response_body_not_recorded",
    "cookies_not_recorded",
    "prompts_not_recorded",
    "raw_clinical_content_not_recorded",
  ]) {
    assert.equal(PHASE_1_2_REDACTION_RULES.includes(rule), true, `${rule} missing`);
  }
});

test("phase 1.2 merged manifest preserves phase 1 findings and adds corrected-harness failures", () => {
  const manifest = mergePhase1AndPhase12Findings(
    {
      findings: [
        {
          id: "PERF-F2-001",
          severity: "high",
          title: "Broad state hydration",
          evidenceRefs: ["phase1.static"],
          affectedFiles: ["app/src/lib/use-aiya-state.ts"],
          phase2RequiredChange: "Bound the read path",
          requiredTests: ["bounded read"],
        },
      ],
    },
    {
      physicalAndroid: { status: "READY_FOR_CDP_CAPTURE" },
      localDiagnostic: {
        profiles: [
          {
            profileId: "desktop_chrome_persistent_warm_session",
            scenarios: [
              {
                scenarioId: "ai_chat",
                status: "FAIL",
                targetMisses: [],
                failedSampleCount: 1,
                p75: { readyMs: 300 },
              },
            ],
          },
        ],
      },
    },
  );

  assert.equal(manifest.status, "LOCKED_WITH_PHASE_1_AND_1_2_FINDINGS");
  assert.equal(manifest.findings.some((finding) => finding.id === "PERF-F2-001"), true);
  assert.equal(manifest.findings.some((finding) => finding.id === "PERF-F12-001"), true);
  assert.equal(manifest.findings.some((finding) => finding.id === "PERF-F12-002"), true);
});

test("npm package exposes the phase 1.2 audit commands", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "app", "package.json"), "utf8"));
  assert.equal(packageJson.scripts["audit:performance:phase1.2"], "node scripts/measure-aiya-performance-phase-1-2.mjs");
  assert.equal(packageJson.scripts["test:performance-phase1.2"], "node --test scripts/performance-phase-1-2.test.mjs");
});
