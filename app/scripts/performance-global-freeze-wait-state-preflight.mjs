#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createPhaseRun } from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  GLOBAL_FREEZE_WAIT_STATE_PHASE_DEFINITION,
  GLOBAL_FREEZE_WAIT_STATE_PHASE_ID,
  GLOBAL_FREEZE_WAIT_STATE_SCHEMA_VERSION,
} from "./lib/aiya-global-freeze-phase.mjs";
import {
  GLOBAL_FREEZE_WAIT_CLASSES,
  GLOBAL_FREEZE_WAIT_STATE_MARKERS,
  summarizeWaitState,
} from "./lib/aiya-global-freeze-wait-state.mjs";
import { readChromeTrace, sanitizeChromeTrace } from "./performance-global-freeze-diagnostic.mjs";

const INPUT_COUNT = 12;
const INPUT_INTERVAL_MS = 350;
const FIXTURE_VERSION = "wait-state-local-browser-fixture-v1";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function markerScript() {
  return `
    (() => {
      const button = document.querySelector("#trigger");
      const mark = (name) => console.timeStamp("aiya-wait-" + name);
      const controllers = [];
      let handled = 0;
      document.addEventListener("pointerdown", (event) => {
        if (event.target === button) mark("input-pressed");
      }, true);
      document.addEventListener("pointerup", (event) => {
        if (event.target === button) mark("input-released");
      }, true);
      button.addEventListener("click", () => {
        handled += 1;
        mark("input-handled");
        if (handled === 2) {
          fetch("/api/alerts").then((response) => response.json()).then(() => {
            mark("work-complete");
            if (document.querySelector("#loading").getClientRects().length > 0) {
              mark("loading-visible");
            }
          });
        }
        if (handled === 4) fetch("/dashboard?_rsc=fixture").catch(() => {});
        if (handled === 6) {
          const until = performance.now() + 175;
          while (performance.now() < until) {}
        }
        if (handled === 8) {
          const controller = new AbortController();
          controllers.push(controller);
          fetch("/api/notifications", { signal: controller.signal }).catch(() => {});
          setTimeout(() => controller.abort(), 60);
        }
        if (handled === 12) {
          const headerWait = new AbortController();
          const bodyWait = new AbortController();
          controllers.push(headerWait, bodyWait);
          fetch("/api/app-state", { signal: headerWait.signal }).catch(() => {});
          fetch("/api/clients/fixture/forms", { signal: bodyWait.signal }).catch(() => {});
        }
      });
      window.__waitStateFixture = {
        abortPending: () => controllers.forEach((controller) => controller.abort()),
      };
      mark("observer-ready");
      mark("loading-visible");
      setInterval(() => mark("heartbeat"), 100);
    })();
  `;
}

function createFixtureServer() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Local wait-state fixture</title></head>
    <body><button id="trigger" type="button">Continue</button>
    <div id="loading" role="status">Loading</div><script>${markerScript()}</script></body></html>`;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    response.setHeader("cache-control", "no-store");
    if (path === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    if (path === "/api/app-state") {
      const timer = setTimeout(() => {
        if (!response.destroyed) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end("{}", "utf8");
        }
      }, 15_000);
      response.once("close", () => clearTimeout(timer));
      return;
    }
    if (path === "/api/clients/fixture/forms") {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"partial":');
      return;
    }
    if (path === "/api/alerts") {
      setTimeout(() => {
        if (!response.destroyed) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end('{"ok":true}');
        }
      }, 60);
      return;
    }
    if (path === "/api/notifications") {
      setTimeout(() => {
        if (!response.destroyed) {
          response.writeHead(200, { "content-type": "application/json" });
          response.end("{}");
        }
      }, 2_000);
      return;
    }
    if (path === "/dashboard") {
      response.writeHead(200, { "content-type": "text/x-component" });
      response.end("fixture-rsc");
      return;
    }
    response.writeHead(404);
    response.end();
  });
  return server;
}

async function readTraceStream(cdp, stream) {
  const chunks = [];
  for (;;) {
    const part = await cdp.send("IO.read", { handle: stream });
    chunks.push(Buffer.from(part.data, part.base64Encoded ? "base64" : "utf8"));
    if (part.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  return Buffer.concat(chunks);
}

function sourceIdentity() {
  const files = [
    "app/scripts/performance-global-freeze-diagnostic.mjs",
    "app/scripts/performance-global-freeze-diagnostic.test.mjs",
    "app/scripts/performance-global-freeze-wait-state-preflight.mjs",
    "app/scripts/lib/aiya-global-freeze-phase.mjs",
    "app/scripts/lib/aiya-global-freeze-wait-state.mjs",
  ];
  const hashes = Object.fromEntries(files.map((path) => [path, sha256(readFileSync(join(REPO_ROOT, path)))]));
  return {
    commitSha: execFileSync("git", ["--no-optional-locks", "-C", REPO_ROOT, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim(),
    sourceHashes: hashes,
    sourceFingerprint: sha256(Buffer.from(JSON.stringify(hashes))),
  };
}

function checkSensitiveRedaction() {
  const sensitiveValues = ["fixture-cookie-value", "fixture-prompt-value", "fixture-health-value", "fixture-typed-value"];
  const probe = sanitizeChromeTrace({ traceEvents: [{
    name: "TimeStamp",
    cat: "blink.user_timing",
    ph: "I",
    ts: 1_000,
    pid: 1,
    tid: 1,
    args: { data: {
      message: "unapproved-marker",
      cookie: sensitiveValues[0],
      prompt: sensitiveValues[1],
      healthValue: sensitiveValues[2],
      typedValue: sensitiveValues[3],
    } },
  }] });
  const serialized = JSON.stringify(probe);
  if (sensitiveValues.some((value) => serialized.includes(value)) || probe.metadata.eventArgsRetained !== false) {
    throw new Error("wait_state_sensitive_redaction_failed");
  }
  return "PASS";
}

async function run() {
  const nowId = new Date().toISOString().replaceAll(/[-:.]/g, "");
  const captureId = `aiya-global-freeze-wait-state-${nowId}-${randomUUID()}`;
  const localRoot = process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? ".", "AppData", "Local");
  const artifactDirectory = join(localRoot, "MANU-AI", "wait-state-preflight", captureId);
  mkdirSync(artifactDirectory, { recursive: true, mode: 0o700 });
  const identity = sourceIdentity();
  const fixtureIdentity = {
    version: FIXTURE_VERSION,
    inputCount: INPUT_COUNT,
    targetIntervalMs: INPUT_INTERVAL_MS,
    networkCases: ["no_headers", "body_open", "canceled", "completed", "rsc"],
    loadingRemainsVisible: true,
    mainThreadBlockMs: 175,
  };
  const fixtureFingerprint = sha256(Buffer.from(JSON.stringify(fixtureIdentity)));
  const server = createFixtureServer();
  let browser = null;
  let checkpoint = null;
  let result = null;
  try {
    await new Promise((resolveListen, rejectListen) => {
      server.once("error", rejectListen);
      server.listen(0, "127.0.0.1", resolveListen);
    });
    const address = server.address();
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const browserVersion = browser.version();
    const playwrightVersion = JSON.parse(readFileSync(new URL("../node_modules/playwright/package.json", import.meta.url), "utf8")).version;
    const checkpointRoot = join(artifactDirectory, "checkpoints");
    checkpoint = createPhaseRun({
      root: checkpointRoot,
      phaseId: GLOBAL_FREEZE_WAIT_STATE_PHASE_ID,
      phaseSchemaVersion: GLOBAL_FREEZE_WAIT_STATE_SCHEMA_VERSION,
      identity: {
        commitSha: identity.commitSha,
        sourceFingerprint: identity.sourceFingerprint,
        fixtureFingerprint,
        browserVersion,
        playwrightVersion,
      },
      metadata: {
        identitySummary: {
          commitSha: identity.commitSha,
          sourceFingerprint: identity.sourceFingerprint,
          fixtureFingerprint,
          browserVersion,
          playwrightVersion,
        },
      },
    });
    checkpoint.append("wait-state.fixture.started", {
      fixtureVersion: FIXTURE_VERSION,
      expectedInputCount: INPUT_COUNT,
      targetIntervalMs: INPUT_INTERVAL_MS,
    });

    await cdp.send("Tracing.start", {
      transferMode: "ReturnAsStream",
      categories: "devtools.timeline,blink.user_timing,loading",
    });
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "load" });
    const scheduleStart = performance.now();
    for (let index = 0; index < INPUT_COUNT; index += 1) {
      const deadline = scheduleStart + index * INPUT_INTERVAL_MS;
      const remaining = deadline - performance.now();
      if (remaining > 0) await new Promise((resolveDelay) => setTimeout(resolveDelay, remaining));
      await page.evaluate((marker) => console.timeStamp(marker), GLOBAL_FREEZE_WAIT_STATE_MARKERS.requested);
      await page.locator("#trigger").click();
    }
    await page.waitForTimeout(250);

    const traceComplete = new Promise((resolveTrace) => cdp.once("Tracing.tracingComplete", resolveTrace));
    await cdp.send("Tracing.end");
    const traceResult = await traceComplete;
    if (!traceResult.stream) throw new Error("wait_state_trace_stream_missing");
    const rawBytes = await readTraceStream(cdp, traceResult.stream);
    const rawPath = join(artifactDirectory, "browser-trace.json");
    writeFileSync(rawPath, rawBytes, { flag: "wx", mode: 0o600 });
    const rawTraceSha256 = sha256(rawBytes);
    checkpoint.append("wait-state.raw-trace.persisted", {
      artifact: "browser-trace.json",
      byteCount: rawBytes.length,
      sha256: rawTraceSha256,
    });

    const sanitizedTrace = readChromeTrace(rawPath, { runId: captureId });
    const summary = summarizeWaitState(sanitizedTrace, { expectedInputCount: INPUT_COUNT, traceComplete: true });
    const redactionStatus = checkSensitiveRedaction();
    const sanitizedBytes = Buffer.from(`${JSON.stringify(sanitizedTrace)}\n`);
    const sanitizedPath = join(artifactDirectory, "browser-trace.redacted.json");
    writeFileSync(sanitizedPath, sanitizedBytes, { flag: "wx", mode: 0o600 });
    const sanitizedTraceSha256 = sha256(sanitizedBytes);
    checkpoint.append("wait-state.sanitized-trace.persisted", {
      artifact: "browser-trace.redacted.json",
      sha256: sanitizedTraceSha256,
      summary,
    });

    result = {
      status: "COMPLETE",
      traceComplete: true,
      rawTraceSha256,
      sanitizedTraceSha256,
      checkpointRunId: checkpoint.runId,
      input: summary.input,
      waitClasses: summary.waitClasses,
      redactionStatus,
    };
    if (!GLOBAL_FREEZE_WAIT_STATE_PHASE_DEFINITION.stages[0].verify({ phase2: result })) {
      throw new Error("wait_state_preflight_gate_failed");
    }
    checkpoint.append("wait-state.preflight.completed", result, { status: "COMPLETE" });
    result = {
      ...result,
      captureId,
      commitSha: identity.commitSha,
      sourceHashes: identity.sourceHashes,
      sourceFingerprint: identity.sourceFingerprint,
      fixtureIdentity,
      fixtureFingerprint,
      browserVersion,
      playwrightVersion,
      rawTracePath: rawPath,
      rawTraceBytes: rawBytes.length,
      sanitizedTracePath: sanitizedPath,
      checkpointPath: checkpointRoot,
      summary,
      classifierCodes: GLOBAL_FREEZE_WAIT_CLASSES,
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const candidateCode = String(error?.message ?? "");
    const reasonCode = /^[a-z0-9_:-]{1,100}$/i.test(candidateCode) ? candidateCode : "wait_state_preflight_failed";
    if (checkpoint && checkpoint.status === "RUNNING") {
      checkpoint.append("wait-state.preflight.blocked", { reasonCode }, { status: "BLOCKED" });
    }
    process.stdout.write(`${JSON.stringify({
      status: "CAPTURE_PREFLIGHT_BLOCKED",
      captureId,
      reasonCode,
      checkpointRunId: checkpoint?.runId ?? null,
      artifactDirectory,
      ...(result?.rawTraceSha256 ? { rawTraceSha256: result.rawTraceSha256 } : {}),
    }, null, 2)}\n`);
    process.exitCode = 1;
  } finally {
    if (checkpoint) checkpoint.close();
    if (browser) await browser.close().catch(() => {});
    if (server.listening) {
      const closed = new Promise((resolveClose) => server.close(resolveClose));
      server.closeAllConnections?.();
      await closed;
    }
  }
}

run().catch(() => {
  process.stderr.write("wait_state_preflight_start_failed\n");
  process.exitCode = 1;
});
