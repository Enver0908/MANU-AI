import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  readChromeTrace,
  parseRemoteVitalsLines,
  parseArguments,
  correlateChromeTraceWithHost,
  GLOBAL_FREEZE_PHASE_DEFINITION,
  validateInteractionObservation,
  sanitizeApiRoute,
  sanitizeChromeTrace,
  summarizeChromeTrace,
  summarizeHostClockProbes,
  summarizePhaseOneArtifacts,
  summarizeHostSamples,
  GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT,
} from "./performance-global-freeze-diagnostic.mjs";
import {
  assertPhaseOneAttemptBudget,
  assertPhaseOneRunHistory,
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

test("HAR and malformed trace inputs fail closed", () => {
  assert.throws(() => sanitizeChromeTrace({ log: { entries: [] } }), /har_input_rejected/);
  assert.throws(() => sanitizeChromeTrace({ traceEvents: "invalid" }), /chrome_trace_events_missing/);
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

test("API route allowlist drops query, client identifiers, and unknown routes", () => {
  assert.equal(sanitizeApiRoute(`${sensitiveRoute}&other=1`), "/api/clients/:id/forms");
  assert.equal(sanitizeApiRoute("https://aiyaworkspace.com/dashboard?_rsc=private-value"), "<rsc>");
  assert.equal(sanitizeApiRoute("https://evil.example/patient/secret"), "<external>");
  assert.equal(sanitizeApiRoute("https://aiyaworkspace.com/api/custom/secret"), "/api/<other>");
  assert.equal(sanitizeApiRoute("https://aiyaworkspace.com/dashboard?clientId=private"), "<document>");
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
