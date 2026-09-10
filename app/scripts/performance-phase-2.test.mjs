import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  PHASE_2_SCENARIOS,
  classifyPhase2Sample,
  sanitizeEvidenceValue,
  summarizePhase2Scenario,
  validatePhase2HarnessContract,
} from "./measure-aiya-performance-phase-2.mjs";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = resolve(appRoot, "..");

test("phase 2 scenarios use strong selectors, required reads, and 20 samples", () => {
  const contract = validatePhase2HarnessContract();
  assert.equal(contract.status, "PASS");
  assert.deepEqual(contract.failures, []);
});

test("AI Chat visible workspace is not enough when conversation list returns 401", () => {
  const scenario = PHASE_2_SCENARIOS.find((item) => item.scenarioId === "ai_chat");
  const result = classifyPhase2Sample(
    {
      sampleId: "ai-chat-401",
      authenticated: true,
      fallbackStore: false,
      demoCookieInjected: false,
      readySelectorMatched: true,
      targetUsable: true,
      taskReadyMs: 450,
      eventToNextPaintMs: 60,
      maxLongTaskMs: 90,
      requests: [{ route: "/api/ai-chat/conversations", method: "GET", status: 401, bodyFinishedMs: 25 }],
    },
    scenario,
  );
  assert.equal(result.functionalStatus, "FAIL");
  assert.equal(result.validityStatus, "FAIL");
  assert.match(result.validityProblems.join(","), /required_read_missing_or_non_2xx/);
});

test("fallback or demo sessions cannot be valid phase 2 samples", () => {
  const scenario = PHASE_2_SCENARIOS.find((item) => item.scenarioId === "post_login_dashboard");
  const result = classifyPhase2Sample(
    {
      sampleId: "fallback-dashboard",
      authenticated: true,
      fallbackStore: true,
      demoCookieInjected: true,
      readySelectorMatched: true,
      targetUsable: true,
      taskReadyMs: 300,
      eventToNextPaintMs: 80,
      maxLongTaskMs: 100,
      requests: [
        { route: "/api/shell/bootstrap", method: "GET", status: 200, bodyFinishedMs: 35 },
        { route: "/api/app-state", method: "GET", status: 200, bodyFinishedMs: 40 },
      ],
    },
    scenario,
  );
  assert.equal(result.functionalStatus, "PASS");
  assert.equal(result.validityStatus, "FAIL");
  assert.deepEqual(result.validityProblems.filter((item) => /fallback|demo/.test(item)), [
    "fallback_store_used",
    "demo_cookie_used",
  ]);
});

test("budget status is separate from functional and validity status", () => {
  const scenario = PHASE_2_SCENARIOS.find((item) => item.scenarioId === "client_roster");
  const result = classifyPhase2Sample(
    {
      sampleId: "slow-valid-roster",
      authenticated: true,
      fallbackStore: false,
      demoCookieInjected: false,
      readySelectorMatched: true,
      targetUsable: true,
      taskReadyMs: 1300,
      eventToNextPaintMs: 80,
      maxLongTaskMs: 120,
      requests: [
        { route: "/api/shell/bootstrap", method: "GET", status: 200, bodyFinishedMs: 100 },
        { route: "/api/app-state", method: "GET", status: 200, bodyFinishedMs: 250 },
        { route: "/api/clients", method: "GET", status: 200, bodyFinishedMs: 180 },
      ],
    },
    scenario,
  );
  assert.equal(result.functionalStatus, "PASS");
  assert.equal(result.validityStatus, "PASS");
  assert.equal(result.budgetStatus, "FAIL");
});

test("scenario summary keeps failed samples and computes endpoint p75 from all reads", () => {
  const scenario = PHASE_2_SCENARIOS.find((item) => item.scenarioId === "messages");
  const summary = summarizePhase2Scenario(
    [
      {
        sampleId: "valid-1",
        authenticated: true,
        fallbackStore: false,
        demoCookieInjected: false,
        readySelectorMatched: true,
        targetUsable: true,
        taskReadyMs: 500,
        eventToNextPaintMs: 80,
        maxLongTaskMs: 100,
        requests: [{ route: "/api/conversations", method: "GET", status: 200, bodyFinishedMs: 100 }],
      },
      {
        sampleId: "failed-1",
        authenticated: true,
        fallbackStore: false,
        demoCookieInjected: false,
        readySelectorMatched: true,
        targetUsable: true,
        taskReadyMs: 600,
        eventToNextPaintMs: 90,
        maxLongTaskMs: 100,
        requests: [{ route: "/api/conversations", method: "GET", status: 500, bodyFinishedMs: 120 }],
      },
    ],
    scenario,
  );
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.functionalStatus, "FAIL");
  assert.equal(summary.validityStatus, "FAIL");
  assert.equal(summary.p75.requiredReadBodyFinishedMs, 120);
});

test("evidence sanitizer redacts sensitive fields and normalizes dynamic routes", () => {
  const sanitized = sanitizeEvidenceValue({
    url: "https://example.test/api/clients/client-mert/forms?token=secret",
    headers: { authorization: "Bearer secret", cookie: "a=b" },
    prompt: "raw prompt",
    body: "raw body",
  });
  assert.equal(sanitized.url, "/api/clients/:clientId/forms");
  assert.equal(sanitized.headers.authorization, "<redacted>");
  assert.equal(sanitized.headers.cookie, "<redacted>");
  assert.equal(sanitized.prompt, "<redacted>");
  assert.equal(sanitized.body, "<redacted>");
});

test("npm package exposes phase 2 audit commands", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "app", "package.json"), "utf8"));
  assert.equal(packageJson.scripts["audit:performance:phase2"], "node scripts/measure-aiya-performance-phase-2.mjs");
  assert.equal(packageJson.scripts["test:performance-phase2"], "node --test scripts/performance-phase-2.test.mjs");
});
