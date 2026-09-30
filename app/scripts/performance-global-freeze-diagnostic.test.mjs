import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  readChromeTrace,
  inspectNativeProfileFile,
  inspectNativeTraceFile,
  parseRemoteVitalsLines,
  parseArguments,
  correlateChromeTraceWithHost,
  GLOBAL_FREEZE_PHASE_DEFINITION,
  validateInteractionObservation,
  sanitizeApiRoute,
  sanitizeChromeTrace,
  summarizeNativeChromeTrace,
  summarizeChromeTrace,
  summarizeHostClockProbes,
  summarizePhaseOneArtifacts,
  summarizeHostSamples,
  GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT,
  GLOBAL_FREEZE_MAX_TRACE_EVENTS,
} from "./performance-global-freeze-diagnostic.mjs";
import {
  GLOBAL_FREEZE_WAIT_CLASSES,
  GLOBAL_FREEZE_WAIT_STATE_MARKERS,
  summarizeWaitState,
} from "./lib/aiya-global-freeze-wait-state.mjs";
import { summarizeNativeProfileAttribution } from "./lib/aiya-global-freeze-profile-analysis.mjs";
import {
  assertPhaseOneAttemptBudget,
  assertPhaseOneRunHistory,
  GLOBAL_FREEZE_WAIT_STATE_PHASE_DEFINITION,
  validatePhaseOneBlockReason,
} from "./lib/aiya-global-freeze-phase.mjs";

const sensitiveRoute = "https://aiyaworkspace.com/api/clients/11111111-2222-4333-8444-555555555555/forms?secret=never-retain";

test("global freeze plan descriptor locks the three phases and causal gates", () => {
  assert.deepEqual(GLOBAL_FREEZE_PHASE_DEFINITION.stages.map(({ stageId, prerequisites }) => ({ stageId, prerequisites })), [
    { stageId: "phase-1-aligned-live-capture", prerequisites: [] },
    { stageId: "phase-2-causal-layer-attribution", prerequisites: ["phase-1-aligned-live-capture"] },
    { stageId: "phase-3-local-fix-and-regression-proof", prerequisites: ["phase-2-causal-layer-attribution"] },
  ]);
  const validRecord = (freeze) => ({
    observationValidity: "VALID",
    clockAlignment: "ALIGNED",
    alignedTraceDurationMs: 90_000,
    alignedHostSampleCount: 90,
    hostClockUncertaintyMs: 100,
    checkpointStatus: "COMPLETE",
    checkpointRunId: "run-id",
    browserTraceSha256: "a".repeat(64),
    hostSamplesSha256: "b".repeat(64),
    interactionObservation: { freeze, keyboard: "unresponsive", navigation: "unresponsive", reload: "delayed" },
  });
  const phase1 = { phase1: { records: [validRecord("observed"), validRecord("observed"), validRecord("not_observed")] } };
  assert.equal(GLOBAL_FREEZE_PHASE_DEFINITION.stages[0].verify(phase1), true);
  assert.equal(GLOBAL_FREEZE_PHASE_DEFINITION.stages[0].verify({ phase1: { records: phase1.phase1.records.slice(0, 2) } }), false);
  assert.equal(GLOBAL_FREEZE_PHASE_DEFINITION.stages[1].verify({
    ...phase1,
    phase2: {
      status: "CAUSAL_CANDIDATE_CONFIRMED",
      repetitions: { a1: 3, b: 3, a2: 3 },
      freezeCounts: { a1: 3, b: 0, a2: 3 },
      ownerFile: "app/src/example.ts",
      ownerFunction: "refresh",
      singleVariableControl: "PASS",
    },
  }), true);
  assert.equal(GLOBAL_FREEZE_PHASE_DEFINITION.stages[1].verify({
    ...phase1,
    phase2: { status: "CAUSAL_CANDIDATE_CONFIRMED", repetitions: { a1: 3, b: 3, a2: 3 }, freezeCounts: { a1: 3, b: 1, a2: 3 }, ownerFile: "x", ownerFunction: "y", singleVariableControl: "PASS" },
  }), false);
  assert.equal(GLOBAL_FREEZE_PHASE_DEFINITION.stages[2].verify({
    phase1: phase1.phase1,
    phase2: { status: "CAUSAL_CANDIDATE_CONFIRMED" },
    phase3: {
      status: "LOCAL_FIX_VERIFIED",
      focusedTests: "PASS",
      typecheck: "PASS",
      productionBuild: "PASS",
      lintErrors: 0,
      sourceFixSha256: "c".repeat(64),
      desktopInteractionFlow: "PASS",
      androidPhysicalOutcome: "NOT_AVAILABLE",
      matchedReproductions: { beforeRecords: 3, beforeFreezeCount: 3, afterRecords: 3, afterFreezeCount: 0 },
    },
  }), true);
  assert.equal(GLOBAL_FREEZE_PHASE_DEFINITION.stages[2].verify({ phase3: { status: "LOCAL_FIX_VERIFIED" } }), false);
});

test("wait-state preflight descriptor requires a complete, hashed 12-input capture", () => {
  const phase2 = {
    status: "COMPLETE",
    traceComplete: true,
    rawTraceSha256: "a".repeat(64),
    sanitizedTraceSha256: "b".repeat(64),
    checkpointRunId: "capture-1",
    input: {
      expectedCount: 12,
      requestedCount: 12,
      pressedCount: 12,
      delivery: "DELIVERED",
      medianPressedGapMs: 350,
    },
    waitClasses: [
      "request_in_flight",
      "response_body_not_complete",
      "main_thread_busy",
      "visible_loading_after_work",
    ],
    redactionStatus: "PASS",
  };
  assert.equal(GLOBAL_FREEZE_WAIT_STATE_PHASE_DEFINITION.stages[0].verify({ phase2 }), true);
  assert.equal(GLOBAL_FREEZE_WAIT_STATE_PHASE_DEFINITION.stages[0].verify({
    phase2: { ...phase2, input: { ...phase2.input, medianPressedGapMs: null } },
  }), false);
});

test("phase one limits attempts and prevents concurrent capture starts", () => {
  assert.equal(assertPhaseOneAttemptBudget([]), 1);
  assert.equal(assertPhaseOneAttemptBudget([{ status: "INTERRUPTED" }, { status: "COMPLETE" }]), 3);
  assert.equal(assertPhaseOneAttemptBudget([{ status: "BLOCKED" }]), 2);
  assert.throws(() => assertPhaseOneAttemptBudget(Array.from({ length: 5 }, () => ({ status: "INTERRUPTED" }))), /phase1_attempt_limit_reached/);
  assert.throws(() => assertPhaseOneAttemptBudget([{ status: "RUNNING" }]), /phase1_attempt_already_running/);
  assert.throws(() => assertPhaseOneAttemptBudget(Array.from({ length: 3 }, () => ({ status: "COMPLETE" }))), /phase1_required_records_already_complete/);
});

test("phase one treats identified failed runs as attempts and rejects malformed checkpoint listings", () => {
  assert.doesNotThrow(() => assertPhaseOneRunHistory([{ runId: "run-1", status: "BLOCKED" }]));
  assert.throws(() => assertPhaseOneRunHistory([{ status: "BLOCKED" }]), /phase1_checkpoint_history_corrupt/);
});

test("host sampler identifies the deployment process by known cwd and Node executable", () => {
  assert.match(GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT, /for process_path in \/proc\/\[0-9\]\*/);
  assert.match(GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT, /readlink -f .*\/exe/);
  assert.match(GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT, /node\|nodejs/);
  assert.doesNotMatch(GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT, /pgrep -x node/);
});

test("host clock synchronization keeps the 500 ms uncertainty gate", () => {
  assert.deepEqual(summarizeHostClockProbes([
    { offsetMs: 0, roundTripMs: 20 },
    { offsetMs: 0, roundTripMs: 20 },
    { offsetMs: 490, roundTripMs: 20 },
  ]), {
    offsetMs: 0,
    uncertaintyMs: 500,
    probeCount: 3,
    roundTripMs: [20, 20, 20],
  });
  assert.throws(() => summarizeHostClockProbes([
    { offsetMs: 0, roundTripMs: 20 },
    { offsetMs: 0, roundTripMs: 20 },
    { offsetMs: 491, roundTripMs: 20 },
  ]), (error) => error.message === "host_clock_sync_uncertainty_exceeded" &&
    error.clockSync.uncertaintyMs === 501);
  assert.throws(() => summarizeHostClockProbes([
    { offsetMs: 0, roundTripMs: 20 },
    { offsetMs: 0, roundTripMs: -1 },
    { offsetMs: 0, roundTripMs: 20 },
  ]), /host_clock_probe_invalid/);
});

test("phase-one host artifact remains hashed when its browser trace is unavailable", () => {
  const hostBytes = Buffer.from(`${JSON.stringify(hostSample(1_790_256_000))}\n`);
  const result = summarizePhaseOneArtifacts({
    runId: "run-test",
    hostBytes,
    traceBytes: null,
    traceEventPayload: null,
    observationEventPayload: null,
    expectedHostSampleCount: 1,
  });
  assert.equal(result.hostSamples.length, 1);
  assert.match(result.hostSamplesSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.sanitizedTraceSha256, null);
  assert.equal(result.artifactIntegrity, false);
});

test("phase one blocker finalization accepts only closed reason codes", () => {
  assert.equal(validatePhaseOneBlockReason("authenticated_session_unavailable"), "authenticated_session_unavailable");
  assert.throws(() => validatePhaseOneBlockReason("credentials pasted into chat"), /phase1_block_reason_invalid/);
});

test("diagnostic CLI validates bounded capture and fixed observation arguments", () => {
  assert.deepEqual(parseArguments(["--inspect-native-trace", "edge-profile.json"]), {
    mode: "native-trace",
    tracePath: "edge-profile.json",
  });
  assert.equal(parseArguments(["--inspect-native-trace", "edge-profile.devtools"]).tracePath, "edge-profile.devtools");
  assert.deepEqual(parseArguments(["--inspect-native-profile", "edge-profile.json"]), {
    mode: "native-profile",
    tracePath: "edge-profile.json",
  });
  assert.deepEqual(parseArguments(["--start"]), { mode: "start" });
  assert.equal(parseArguments(["--capture-host", "run-1"]).durationSeconds, 150);
  assert.equal(parseArguments(["--capture-host", "run-1", "240"]).durationSeconds, 240);
  assert.throws(() => parseArguments(["--capture-host", "run-1", "241"]), /host_capture_duration_must_be_30_to_240_seconds/);
  assert.equal(parseArguments(["--finalize-phase1", "--blocked", "host_access_blocked"]).blockedReason, "host_access_blocked");
  assert.throws(() => parseArguments(["--finalize-phase1", "--blocked", "private explanation"]), /phase1_block_reason_invalid/);
  assert.throws(() => parseArguments(["--record-observation", "run-1", "--freeze", "observed", "--keyboard", "unresponsive", "--navigation", "private route", "--reload", "delayed"]), /interaction_observation_enum_invalid/);
});

test("interaction annotation accepts only fixed outcome values and stores no free text", () => {
  const normalized = validateInteractionObservation({
    freeze: "observed",
    keyboard: "unresponsive",
    navigation: "unresponsive",
    reload: "delayed",
    details: "never retain this",
  });
  assert.deepEqual(normalized, {
    freeze: "observed",
    keyboard: "unresponsive",
    navigation: "unresponsive",
    reload: "delayed",
  });
  assert.throws(() => validateInteractionObservation({
    freeze: "observed; phone=5551234",
    keyboard: "unresponsive",
    navigation: "unresponsive",
    reload: "delayed",
  }), /interaction_observation_enum_invalid/);
});

function hostSample(epochSeconds, { user = 100, idle = 900, availableKb = 2_000, cpuPressure = null } = {}) {
  return {
    schemaVersion: "aiya-host-vitals-v1",
    utc: new Date(epochSeconds * 1_000).toISOString().replace(".000", ""),
    epochSeconds,
    vcpu: 2,
    load1: 0.25,
    cpuTicks: { user, nice: 0, system: 0, idle, iowait: 0, irq: 0, softirq: 0, steal: 0 },
    memory: { totalKb: 4_000_000, availableKb, swapTotalKb: 0, swapFreeKb: 0 },
    swap: { inPages: 0, outPages: 0 },
    pressure: { cpuSomeAvg10Percent: cpuPressure, memorySomeAvg10Percent: null, ioSomeAvg10Percent: null },
    application: {
      processFound: true,
      processAlive: true,
      rssKb: 100_000,
      hwmKb: 120_000,
      cgroupMemoryCurrentBytes: 150_000_000,
      cgroupMemoryLimitBytes: null,
      cgroupNrThrottled: 0,
      cgroupThrottledUsec: 0,
      cgroupMemoryHighEvents: 0,
      cgroupOomKillEvents: 0,
    },
  };
}

test("trace sanitizer preserves main-thread durations and removes arbitrary event args", () => {
  const input = {
    traceEvents: [
      { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
      { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 1_000, dur: 75_000, pid: 1, tid: 7, args: { typedValue: "never-retain" } },
      { name: "ResourceSendRequest", cat: "devtools.timeline", ph: "X", ts: 2_000, dur: 4_000, pid: 1, tid: 7, args: { data: { requestId: "secret-request-id", url: sensitiveRoute } } },
    ],
  };
  const trace = sanitizeChromeTrace(input, { runId: "run-test" });
  const serialized = JSON.stringify(trace);
  assert.equal(trace.metadata.eventArgsRetained, false);
  assert.equal(trace.events[0].thread, "CrRendererMain");
  assert.equal(trace.events[0].durationMs, 75);
  assert.equal(trace.events[1].network.route, "/api/clients/:id/forms");
  assert.equal(trace.events[1].network.correlationId, "request-1");
  assert.equal(serialized.includes("never-retain"), false);
  assert.equal(serialized.includes("secret-request-id"), false);
  assert.equal(serialized.includes("11111111-2222-4333-8444-555555555555"), false);
  assert.equal(serialized.includes("secret="), false);
});

test("native input timing retains only allowlisted event metadata", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [{
    name: "EventTiming",
    cat: "devtools.timeline",
    ph: "I",
    ts: 140_000,
    pid: 1,
    tid: 7,
    args: { data: {
      type: "keydown",
      timeStamp: 1,
      processingStart: 9,
      processingEnd: 11,
      duration: 120,
      interactionId: 777,
      nodeId: 123,
      frame: "private-frame-id",
      keyCode: 65,
      typedValue: "private-health-value",
    } },
  }] });
  const serialized = JSON.stringify(trace);
  assert.deepEqual(trace.events[0].interactionTiming, {
    eventType: "keydown",
    inputDelayMs: 8,
    processingMs: 2,
    reportedDurationMs: 120,
    interactionId: "interaction-1",
  });
  assert.equal(serialized.includes("private-frame-id"), false);
  assert.equal(serialized.includes("private-health-value"), false);
  assert.equal(serialized.includes("777"), false);
  assert.equal(serialized.includes("nodeId"), false);
  assert.equal(serialized.includes("keyCode"), false);
});

test("native trace summary preserves unavailable signals and separates observed boundaries", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
    { name: "EventDispatch", cat: "devtools.timeline", ph: "X", ts: 10_000, dur: 2_000, pid: 1, tid: 7, args: { data: { type: "keydown", value: "private" } } },
    { name: "EventTiming", cat: "devtools.timeline", ph: "I", ts: 140_000, pid: 1, tid: 7, args: { data: { type: "keydown", timeStamp: 1, processingStart: 9, processingEnd: 11, duration: 120, interactionId: 9, nodeId: 5 } } },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 20_000, dur: 75_000, pid: 1, tid: 7 },
    { name: "ResourceSendRequest", cat: "devtools.timeline", ph: "I", ts: 30_000, pid: 1, tid: 7, args: { data: { requestId: "secret-id", url: sensitiveRoute, requestMethod: "GET" } } },
    { name: "ResourceReceiveResponse", cat: "devtools.timeline", ph: "I", ts: 40_000, pid: 1, tid: 7, args: { data: { requestId: "secret-id", statusCode: 200, response: { status: 200 } } } },
    { name: "ResourceSendRequest", cat: "devtools.timeline", ph: "I", ts: 50_000, pid: 1, tid: 7, args: { data: { requestId: "second-secret-id", url: "https://aiyaworkspace.com/api/app-state?token=private", requestMethod: "GET" } } },
    { name: "ResourceReceiveResponse", cat: "devtools.timeline", ph: "I", ts: 60_000, pid: 1, tid: 7, args: { data: { requestId: "second-secret-id", statusCode: 200 } } },
    { name: "ResourceFinish", cat: "devtools.timeline", ph: "I", ts: 85_000, pid: 1, tid: 7, args: { data: { requestId: "second-secret-id" } } },
  ] });
  const summary = summarizeNativeChromeTrace(trace);
  const serialized = JSON.stringify(summary);
  assert.equal(summary.input.observedDispatchCount, 1);
  assert.deepEqual(summary.input.dispatchEventTypeCounts, { keydown: 1 });
  assert.deepEqual(summary.input.observedDispatches, [{ timestampMs: 10, durationMs: 2, eventType: "keydown" }]);
  assert.equal(summary.input.slowEventTimingCount, 1);
  assert.deepEqual(summary.input.slowEventTypeCounts, { keydown: 1 });
  assert.equal(summary.input.expectedActionDelivery, "UNAVAILABLE_WITHOUT_ACTION_MARKERS");
  assert.equal(summary.network.unfinishedAtRecordedEndCount, 1);
  assert.equal(summary.network.unfinishedAtRecordedEnd[0].state, "RESPONSE_BODY_OPEN");
  assert.equal(summary.network.longestCompletedRequests[0].responseWaitMs, 10);
  assert.equal(summary.network.longestCompletedRequests[0].bodyAfterResponseMs, 25);
  assert.equal(summary.network.longestCompletedRequests[0].totalMs, 35);
  assert.equal(summary.mainThread.longTaskCount, 1);
  assert.equal(summary.visibleState.availability, "UNAVAILABLE_NO_APP_STATE_MARKERS");
  assert.equal(summary.traceCompleteness, "NOT_VERIFIABLE_FROM_JSON_PARSE");
  assert.equal(summary.interactionCorrelation, "TIMELINE_ORDER_AVAILABLE_CAUSAL_LINK_NOT_ESTABLISHED");
  assert.equal(serialized.includes("private"), false);
  assert.equal(serialized.includes("secret-id"), false);
  assert.equal(serialized.includes("second-secret-id"), false);
  assert.equal(serialized.includes("11111111-2222-4333-8444-555555555555"), false);
});

test("native trace import persists hashed redacted artifacts and leaves source untouched", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiya-native-trace-"));
  try {
    const inputPath = join(directory, "private-source-trace.json");
    const outputRoot = join(directory, "output");
    const source = Buffer.from(JSON.stringify({ traceEvents: [
      { name: "ResourceSendRequest", cat: "devtools.timeline", ph: "I", ts: 1_000, pid: 1, tid: 7, args: { data: { requestId: "private-request", url: sensitiveRoute, requestMethod: "GET", cookie: "private-cookie", body: "private-body" } } },
      { name: "EventDispatch", cat: "devtools.timeline", ph: "X", ts: 2_000, dur: 500, pid: 1, tid: 7, args: { data: { type: "input", value: "private-health-value" } } },
    ] }));
    writeFileSync(inputPath, source);
    const result = inspectNativeTraceFile(inputPath, { outputRoot });
    const sanitized = readFileSync(result.sanitizedTracePath, "utf8");
    const captureSummary = readFileSync(result.summaryPath, "utf8");
    assert.deepEqual(readFileSync(inputPath), source);
    assert.match(result.sourceTraceSha256, /^[a-f0-9]{64}$/);
    assert.match(result.sanitizedTraceSha256, /^[a-f0-9]{64}$/);
    assert.match(result.summarySha256, /^[a-f0-9]{64}$/);
    assert.equal(result.sanitizedTraceSha256, createHash("sha256").update(sanitized).digest("hex"));
    assert.equal(result.summarySha256, createHash("sha256").update(captureSummary).digest("hex"));
    for (const privateValue of [inputPath, "private-request", "private-cookie", "private-body", "private-health-value", "secret=never-retain"]) {
      assert.equal(sanitized.includes(privateValue), false);
      assert.equal(captureSummary.includes(privateValue), false);
    }
    assert.equal(JSON.parse(captureSummary).sourceTraceSha256, result.sourceTraceSha256);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("native profile analysis writes a hashed summary without modifying or copying the raw source", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiya-native-profile-"));
  try {
    const inputPath = join(directory, "private-source-trace.json.gz");
    const source = gzipSync(Buffer.from(JSON.stringify({ traceEvents: [
      { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
      { name: "Profile", cat: "disabled-by-default-v8.cpu_profiler", ph: "P", ts: 1_000, pid: 1, tid: 7, id: "private-profile-id", args: { data: { source: "Internal" } } },
      { name: "ProfileChunk", cat: "disabled-by-default-v8.cpu_profiler", ph: "P", ts: 2_000, pid: 1, tid: 8, id: "private-profile-id", args: { data: {
        cpuProfile: { nodes: [{ id: 1, callFrame: { functionName: "onInput", url: "" } }], samples: [1] },
        timeDeltas: [1_000],
      } } },
      { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 1_000, dur: 75_000, pid: 1, tid: 7 },
    ] })));
    const outputRoot = join(directory, "analysis");
    writeFileSync(inputPath, source);
    const result = inspectNativeProfileFile(inputPath, { outputRoot });
    const summary = readFileSync(result.summaryPath, "utf8");
    assert.deepEqual(readFileSync(inputPath), source);
    assert.match(result.sourceTraceSha256, /^[a-f0-9]{64}$/);
    assert.match(result.summarySha256, /^[a-f0-9]{64}$/);
    assert.equal(result.summarySha256, createHash("sha256").update(summary).digest("hex"));
    assert.equal(result.profileAttribution.sampleCount, 1);
    assert.equal(summary.includes(inputPath), false);
    assert.equal(summary.includes("private-profile-id"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CPU profiles retain safe function frames but redact query strings and external scripts", () => {
  const trace = sanitizeChromeTrace({
    traceEvents: [{
      name: "ProfileChunk",
      cat: "disabled-by-default-v8.cpu_profiler",
      ph: "P",
      ts: 10_000,
      pid: 1,
      tid: 7,
      args: { data: { cpuProfile: {
        startTime: 1,
        endTime: 4,
        nodes: [
          { id: 1, callFrame: { functionName: "handleInput", url: "https://aiyaworkspace.com/_next/static/chunks/app/dashboard/page-abc123456789.js?token=remove", lineNumber: 2, columnNumber: 3 }, children: [2] },
          { id: 2, callFrame: { functionName: "<private value>", url: "https://external.example/private.js?email=remove", lineNumber: 4, columnNumber: 0 }, children: [] },
        ],
        samples: [1, 2],
        timeDeltas: [2, 2],
      } } },
    }],
  });
  const serialized = JSON.stringify(trace);
  assert.equal(trace.profiles.length, 1);
  assert.equal(trace.profiles[0].profile.nodes[0].functionName, "handleInput");
  assert.equal(trace.profiles[0].profile.nodes[1].functionName, "<anonymous>");
  assert.equal(serialized.includes("token=remove"), false);
  assert.equal(serialized.includes("email=remove"), false);
  assert.equal(serialized.includes("private.js"), false);
});

test("profile chunks preserve cross-chunk samples, signed deltas, and process-scoped thread ownership", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
    { name: "thread_name", ph: "M", pid: 2, tid: 7, args: { name: "CrBrowserMain" } },
    { name: "Profile", cat: "disabled-by-default-v8.cpu_profiler", ph: "P", ts: 1_000_000, pid: 1, tid: 7, id: "private-profile-id", args: { data: { source: "Internal", startTime: 1 } } },
    { name: "ProfileChunk", cat: "disabled-by-default-v8.cpu_profiler", ph: "P", ts: 1_000_100, pid: 1, tid: 8, id: "private-profile-id", args: { data: {
      cpuProfile: { nodes: [
        { id: 1, callFrame: { functionName: "root", url: "https://aiyaworkspace.com/_next/static/chunks/app/dashboard/page-abc123456789.js", lineNumber: 1, columnNumber: 1 } },
        { id: 2, parent: 1, callFrame: { functionName: "handleInput", url: "https://aiyaworkspace.com/_next/static/chunks/app/dashboard/page-abc123456789.js", lineNumber: 2, columnNumber: 1 } },
        { id: 3, parent: 2, callFrame: { functionName: "onInput", url: "https://aiyaworkspace.com/_next/static/chunks/app/dashboard/page-abc123456789.js", lineNumber: 3, columnNumber: 1 } },
      ], samples: [3] },
      timeDeltas: [10],
    } } },
    { name: "ProfileChunk", cat: "disabled-by-default-v8.cpu_profiler", ph: "P", ts: 1_000_200, pid: 1, tid: 8, id: "private-profile-id", args: { data: {
      cpuProfile: { samples: [3, 2] },
      timeDeltas: [-5, 30_000],
    } } },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 1_000_000, dur: 60_000, tdur: 55_000, pid: 1, tid: 7 },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 1_000_000, dur: 500_000, pid: 2, tid: 7 },
  ] });
  const summary = summarizeNativeProfileAttribution(trace);
  const task = summary.longTasks[0];
  const serialized = JSON.stringify({ trace, summary });

  assert.equal(trace.events.find((event) => event.pid === 1 && event.tid === 7 && event.name === "RunTask").thread, "CrRendererMain");
  assert.equal(trace.events.find((event) => event.pid === 2 && event.tid === 7 && event.name === "RunTask").thread, "CrBrowserMain");
  assert.equal(trace.profiles.length, 2);
  assert.equal(trace.profiles[1].profile.nodes.length, 0);
  assert.deepEqual(trace.profiles[1].profile.samples, [3, 2]);
  assert.deepEqual(trace.profiles[1].profile.timeDeltasUs, [-5, 30_000]);
  assert.equal(trace.profiles[0].ownerThread, "CrRendererMain");
  assert.equal(trace.profiles[0].thread, "<unmapped-thread>");
  assert.equal(summary.status, "RENDERER_PROFILE_MAPPED");
  assert.equal(summary.sampleCount, 3);
  assert.equal(summary.negativeDeltaCount, 1);
  assert.equal(summary.longTaskCount, 1);
  assert.equal(summary.attributedLongTaskCount, 1);
  assert.equal(task.threadDurationMs, 55);
  assert.equal(task.topSelfFrames[0].functionName, "onInput");
  assert.equal(task.topSelfFrames[0].selfSampleMs, 30);
  assert.equal(task.topInclusiveFrames.find((frame) => frame.functionName === "root").inclusiveSampleMs, 30);
  assert.equal(task.unknownMs, 30);
  assert.equal(serialized.includes("private-profile-id"), false);
});

test("HAR and malformed trace inputs fail closed", () => {
  assert.throws(() => sanitizeChromeTrace({ log: { entries: [] } }), /har_input_rejected/);
  assert.throws(() => sanitizeChromeTrace({ traceEvents: "invalid" }), /chrome_trace_events_missing/);
});

test("native trace event cap documents long recording budget and still fails closed", () => {
  assert.equal(GLOBAL_FREEZE_MAX_TRACE_EVENTS, 1_000_000);
  assert.throws(() => sanitizeChromeTrace({
    traceEvents: new Array(GLOBAL_FREEZE_MAX_TRACE_EVENTS + 1),
  }), /trace_event_limit_exceeded/);
});

test("compressed Chrome trace imports to a new redacted file without modifying its source", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiya-global-freeze-test-"));
  try {
    const inputPath = join(directory, "trace.json.gz");
    const source = gzipSync(Buffer.from(JSON.stringify({
      traceEvents: [{ name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 0, dur: 1, pid: 1, tid: 2 }],
    })));
    writeFileSync(inputPath, source);
    const parsed = readChromeTrace(inputPath);
    assert.equal(parsed.metadata.sanitizedEventCount, 1);
    assert.deepEqual(readFileSync(inputPath), source);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("truncated persisted trace fails closed during import", () => {
  const directory = mkdtempSync(join(tmpdir(), "aiya-global-freeze-truncated-"));
  try {
    const inputPath = join(directory, "trace.json");
    writeFileSync(inputPath, '{"traceEvents":[{"name":"TimeStamp"');
    assert.throws(() => readChromeTrace(inputPath), /trace_json_invalid/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("API route allowlist drops query, client identifiers, and unknown routes", () => {
  assert.equal(sanitizeApiRoute(`${sensitiveRoute}&other=1`), "/api/clients/:id/forms");
  assert.equal(sanitizeApiRoute("http://127.0.0.1:4100/api/app-state?token=private"), "/api/app-state");
  assert.equal(sanitizeApiRoute("https://aiyaworkspace.com/dashboard?_rsc=private-value"), "<rsc>");
  assert.equal(sanitizeApiRoute("https://evil.example/patient/secret"), "<external>");
  assert.equal(sanitizeApiRoute("https://aiyaworkspace.com/api/custom/secret"), "/api/<other>");
  assert.equal(sanitizeApiRoute("https://aiyaworkspace.com/dashboard?clientId=private"), "<document>");
});

function waitStateMarker(key, timestampMs) {
  return {
    name: "TimeStamp",
    cat: "blink.user_timing",
    ph: "I",
    ts: timestampMs * 1_000,
    pid: 1,
    tid: 7,
    args: { data: { message: GLOBAL_FREEZE_WAIT_STATE_MARKERS[key], typedValue: "fixture-private-value" } },
  };
}

function waitStateNetworkEvent(name, timestampMs, requestId, { url, statusCode, canceled } = {}) {
  return {
    name,
    cat: "devtools.timeline",
    ph: "I",
    ts: timestampMs * 1_000,
    pid: 1,
    tid: 7,
    args: { data: {
      requestId,
      ...(url ? { url, requestMethod: "GET" } : {}),
      ...(statusCode ? { statusCode } : {}),
      ...(canceled === undefined ? {} : { canceled }),
      requestBody: "fixture-private-body",
      cookie: "fixture-private-cookie",
    } },
  };
}

test("wait-state summary differentiates all five boundaries and retains only fixed metadata", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
    waitStateMarker("observerReady", 50),
    waitStateMarker("requested", 100),
    waitStateMarker("pressed", 110),
    waitStateMarker("released", 111),
    waitStateMarker("handled", 112),
    waitStateMarker("heartbeat", 150),
    waitStateMarker("requested", 300),
    waitStateMarker("heartbeat", 250),
    waitStateMarker("heartbeat", 450),
    waitStateMarker("workComplete", 650),
    waitStateMarker("loadingVisible", 651),
    waitStateNetworkEvent("ResourceSendRequest", 320, "open-request", {
      url: "http://127.0.0.1:4100/api/app-state?token=private",
    }),
    waitStateNetworkEvent("ResourceSendRequest", 330, "body-request", {
      url: "http://127.0.0.1:4100/api/clients/fixture/forms?clientId=private",
    }),
    waitStateNetworkEvent("ResourceReceiveResponse", 340, "body-request", { statusCode: 200 }),
    waitStateNetworkEvent("ResourceSendRequest", 350, "canceled-request", {
      url: "http://127.0.0.1:4100/api/notifications",
    }),
    waitStateNetworkEvent("ResourceFinish", 360, "canceled-request", { canceled: true }),
    waitStateNetworkEvent("ResourceSendRequest", 370, "rsc-request", {
      url: "http://127.0.0.1:4100/dashboard?_rsc=fixture",
    }),
    waitStateNetworkEvent("ResourceReceiveResponse", 380, "rsc-request", { statusCode: 200 }),
    waitStateNetworkEvent("ResourceFinish", 390, "rsc-request"),
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 460_000, dur: 175_000, pid: 1, tid: 7 },
  ] });
  const summary = summarizeWaitState(trace, { expectedInputCount: 2 });
  assert.deepEqual(summary.waitClasses, GLOBAL_FREEZE_WAIT_CLASSES);
  assert.equal(summary.input.delivery, "NOT_OBSERVED");
  assert.equal(summary.network.requests.find((request) => request.correlationId === "request-1").state, "WAITING_FOR_HEADERS");
  assert.equal(summary.network.requests.find((request) => request.correlationId === "request-2").state, "RESPONSE_BODY_OPEN");
  assert.equal(summary.network.requests.find((request) => request.correlationId === "request-3").state, "CANCELED");
  assert.equal(summary.network.rscRequestCount, 1);
  assert.equal(summary.mainThread.status, "BUSY");
  assert.equal(summary.mainThread.longestTaskMs, 175);
  assert.equal(summary.visibleState.loadingAfterWork, true);
  const serialized = JSON.stringify({ trace, summary });
  for (const secret of ["fixture-private-value", "fixture-private-body", "fixture-private-cookie", "clientId=private", "token=private"]) {
    assert.equal(serialized.includes(secret), false);
  }
});

test("missing input markers and incomplete traces remain unavailable instead of absent", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    waitStateMarker("observerReady", 10),
    waitStateMarker("requested", 20),
  ] });
  const summary = summarizeWaitState(trace, { expectedInputCount: 1 });
  assert.equal(summary.input.delivery, "UNAVAILABLE");
  assert.equal(summary.input.timingAvailable, false);
  assert.equal(summary.waitClasses.includes("input_not_delivered"), false);

  const incomplete = summarizeWaitState(trace, { expectedInputCount: 1, traceComplete: false });
  assert.equal(incomplete.traceComplete, false);
  assert.equal(incomplete.waitClasses.includes("input_not_delivered"), false);
  assert.equal(incomplete.unavailableSignals.includes("trace_completion"), true);
});

test("trace summary reports only renderer tasks of at least 50 ms and safe network metadata", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 1_000, dur: 49_000, pid: 1, tid: 7 },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 50_000, dur: 60_000, pid: 1, tid: 7 },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 1_000, dur: 500_000, pid: 1, tid: 8 },
  ] });
  const summary = summarizeChromeTrace(trace);
  assert.equal(summary.mainThreadTaskCount, 2);
  assert.equal(summary.longTaskCount, 1);
  assert.equal(summary.longestMainThreadTasks[0].durationMs, 60);
  assert.equal(summary.profilerEnabled, false);
});

test("network timeline correlates safe API/RSC send-response-finish events", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    { name: "ResourceSendRequest", cat: "devtools.timeline", ph: "I", ts: 1_000, pid: 1, tid: 7, args: { data: { requestId: "private-id", url: "https://aiyaworkspace.com/api/app-state?token=private", requestMethod: "GET" } } },
    { name: "ResourceReceiveResponse", cat: "devtools.timeline", ph: "I", ts: 11_000, pid: 1, tid: 7, args: { data: { requestId: "private-id", statusCode: 200 } } },
    { name: "ResourceFinish", cat: "devtools.timeline", ph: "I", ts: 16_000, pid: 1, tid: 7, args: { data: { requestId: "private-id" } } },
    { name: "ResourceSendRequest", cat: "devtools.timeline", ph: "I", ts: 20_000, pid: 1, tid: 7, args: { data: { requestId: "private-rsc", url: "https://aiyaworkspace.com/dashboard?_rsc=private" } } },
    { name: "ResourceReceiveResponse", cat: "devtools.timeline", ph: "I", ts: 24_000, pid: 1, tid: 7, args: { data: { requestId: "private-rsc", statusCode: 200 } } },
  ] });
  const summary = summarizeChromeTrace(trace);
  assert.equal(summary.networkRequestCount, 2);
  assert.deepEqual(summary.networkRequests.map(({ route }) => route), ["/api/app-state", "<rsc>"]);
  assert.equal(summary.networkRequests[0].method, "GET");
  assert.equal(summary.networkRequests[0].status, 200);
  assert.equal(summary.networkRequests[0].responseWaitMs, 10);
  assert.equal(summary.networkRequests[0].bodyAfterResponseMs, 5);
  assert.equal(JSON.stringify(summary).includes("private-id"), false);
  assert.equal(JSON.stringify(summary).includes("token=private"), false);
});

test("trace and host samples align using only fixed timeline markers and epoch anchors", () => {
  const trace = sanitizeChromeTrace({ traceEvents: [
    { name: "thread_name", ph: "M", pid: 1, tid: 7, args: { name: "CrRendererMain" } },
    { name: "TimeStamp", cat: "blink.user_timing", ph: "I", ts: 1_000_000, pid: 1, tid: 7, args: { data: { message: "aiya-global-freeze-sync-start", privateText: "drop" } } },
    { name: "RunTask", cat: "devtools.timeline", ph: "X", ts: 2_600_000, dur: 80_000, pid: 1, tid: 7 },
    { name: "TimeStamp", cat: "blink.user_timing", ph: "I", ts: 3_000_000, pid: 1, tid: 7, args: { data: { message: "aiya-global-freeze-sync-end" } } },
  ] });
  const hostStartEpochMs = 1_790_256_000_000;
  const startEpochMs = hostStartEpochMs - 1_000;
  const hostSamples = [
    hostSample(hostStartEpochMs / 1_000, { user: 100, idle: 900 }),
    hostSample(hostStartEpochMs / 1_000 + 1, { user: 110, idle: 990 }),
    hostSample(hostStartEpochMs / 1_000 + 2, { user: 130, idle: 1_070 }),
    hostSample(hostStartEpochMs / 1_000 + 3, { user: 140, idle: 1_160 }),
  ];
  const alignment = correlateChromeTraceWithHost(trace, hostSamples, {
    startEpochMs,
    endEpochMs: startEpochMs + 2_000,
    hostClockOffsetMs: 1_000,
    hostClockUncertaintyMs: 125,
    minimumTraceDurationMs: 1_000,
    minimumOverlapSamples: 2,
  });
  assert.equal(alignment.status, "ALIGNED");
  assert.equal(alignment.hostClockOffsetMs, 1_000);
  assert.equal(alignment.hostClockUncertaintyMs, 125);
  assert.equal(alignment.hostSamplesDuringTrace, 3);
  assert.equal(alignment.longTaskHostCorrelations[0].hostCpuBusyPercent, 20);
  assert.equal(alignment.longTaskHostCorrelations[0].sampleDistanceMs, 400);
  assert.equal(JSON.stringify(trace).includes("privateText"), false);
  assert.throws(() => correlateChromeTraceWithHost(trace, hostSamples, {
    startEpochMs,
    endEpochMs: startEpochMs + 3_000,
    minimumTraceDurationMs: 1_000,
    minimumOverlapSamples: 2,
  }), /clock_anchor_scale_out_of_bounds/);
  assert.throws(() => correlateChromeTraceWithHost(trace, hostSamples, {
    startEpochMs,
    endEpochMs: startEpochMs + 2_000,
  }), /clock_anchor_capture_too_short/);
  assert.throws(() => correlateChromeTraceWithHost(trace, hostSamples, {
    startEpochMs,
    endEpochMs: startEpochMs + 2_000,
    hostClockOffsetMs: 1_000,
    hostClockUncertaintyMs: 501,
    minimumTraceDurationMs: 1_000,
    minimumOverlapSamples: 2,
  }), /host_clock_sync_invalid/);
});

test("host summary marks absent pressure samples unavailable instead of zero", () => {
  assert.equal(summarizeHostSamples([]).cpuPressurePeakAvg10, null);
  const summary = summarizeHostSamples([
    hostSample(1_790_256_000, { user: 100, idle: 900, availableKb: 2_000, cpuPressure: 1.5 }),
    hostSample(1_790_256_001, { user: 120, idle: 980, availableKb: 1_800, cpuPressure: 0.2 }),
  ]);
  const samples = [
    hostSample(1_790_256_000, { user: 100, idle: 900, availableKb: 2_000, cpuPressure: 1.5 }),
    hostSample(1_790_256_001, { user: 120, idle: 980, availableKb: 1_800, cpuPressure: 0.2 }),
  ];
  samples[0].swap.inPages = 50;
  samples[1].swap.inPages = 60;
  samples[0].application.cgroupThrottledUsec = 200;
  samples[1].application.cgroupThrottledUsec = 300;
  const updatedSummary = summarizeHostSamples(samples);
  assert.equal(summary.cpuPressurePeakAvg10, 1.5);
  assert.equal(summary.memoryPressurePeakAvg10, null);
  assert.equal(summary.ioPressurePeakAvg10, null);
  assert.equal(summary.hostCpuBusyPercentAverage, 20);
  assert.equal(summary.memoryAvailableKbMin, 1_800);
  assert.equal(updatedSummary.swapInPagesDelta, 10);
  assert.equal(updatedSummary.cgroupThrottledUsecDelta, 100);
  assert.equal(updatedSummary.cgroupOomKillEventsDelta, 0);
});

test("host sampler parser ignores SSH banners and rejects malformed or unsafe sample shapes", () => {
  const valid = JSON.stringify({ ...hostSample(1_790_256_000), privateText: "must-not-persist" });
  const parsed = parseRemoteVitalsLines(`SSH banner\n${valid}\n`);
  assert.equal(parsed.length, 1);
  assert.equal("privateText" in parsed[0], false);
  assert.throws(() => parseRemoteVitalsLines(valid.replace('"vcpu":2', '"vcpu":"2"')), /host_vitals_schema_invalid/);
  assert.throws(() => parseRemoteVitalsLines(valid.replace('"processAlive":true', '"processAlive":"yes"')), /host_vitals_schema_invalid/);
  assert.throws(() => parseRemoteVitalsLines('{"schemaVersion":"aiya-host-vitals-v1"'), /host_vitals_json_invalid/);
});
