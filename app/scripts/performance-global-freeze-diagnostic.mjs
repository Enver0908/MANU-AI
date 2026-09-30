#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { gunzipSync } from "node:zlib";
import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectPhaseRuns,
  openPhaseRun,
  readPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  GLOBAL_FREEZE_PHASE_DEFINITION,
  GLOBAL_FREEZE_MAX_ATTEMPTS,
  GLOBAL_FREEZE_REQUIRED_RECORDS,
  GLOBAL_FREEZE_PHASE_ID,
  GLOBAL_FREEZE_SCHEMA_VERSION,
  assertPhaseOneAttemptBudget,
  assertPhaseOneRunHistory,
  validatePhaseOneBlockReason,
} from "./lib/aiya-global-freeze-phase.mjs";
import {
  GLOBAL_FREEZE_WAIT_STATE_MARKERS,
  summarizeWaitState,
} from "./lib/aiya-global-freeze-wait-state.mjs";
import { summarizeNativeProfileAttribution } from "./lib/aiya-global-freeze-profile-analysis.mjs";
export { GLOBAL_FREEZE_PHASE_DEFINITION };

export const GLOBAL_FREEZE_MAX_COMPRESSED_BYTES = 64 * 1024 * 1024;
export const GLOBAL_FREEZE_MAX_TRACE_EVENTS = 1_000_000;
export const GLOBAL_FREEZE_MAX_PROFILE_NODES = 250_000;
export const GLOBAL_FREEZE_MAX_PROFILE_SAMPLES = 1_000_000;
export const GLOBAL_FREEZE_DEFAULT_HOST_CAPTURE_SECONDS = 150;
export const GLOBAL_FREEZE_HOST_CAPTURE_MAX_SECONDS = 240;
export const GLOBAL_FREEZE_HOST_CLOCK_MAX_UNCERTAINTY_MS = 500;
export const GLOBAL_FREEZE_SSH_ALIAS = "siriusai.store";
export const GLOBAL_FREEZE_LIVE_RELEASE_URL = "https://aiyaworkspace.com/api/health/release";
export const GLOBAL_FREEZE_CHECKPOINT_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".manu-runtime",
  "phase-execution",
);
export const GLOBAL_FREEZE_NATIVE_TRACE_ROOT = join(
  dirname(GLOBAL_FREEZE_CHECKPOINT_ROOT),
  "native-traces",
);
export const GLOBAL_FREEZE_SOURCE_FILES = Object.freeze([
  "app/src/components/dashboard-app.tsx",
  "app/src/components/dashboard/authenticated-shell-boundary.tsx",
  "app/src/components/dashboard/shell-provider.tsx",
  "app/src/lib/auth-context.ts",
  "app/src/lib/dashboard-server-auth.ts",
  "app/src/lib/phase-52-diagnostic.ts",
  "app/src/lib/performance-diagnostic.ts",
  "app/src/lib/use-aiya-state.ts",
  "app/src/lib/use-shell-dirty-registration.ts",
  "app/src/lib/use-stage-4b-inbox.ts",
  "app/src/lib/use-stage-4b2-messaging.ts",
  "app/src/lib/use-stage-6-client-workspace.ts",
  "app/src/lib/supabase-store.ts",
  "app/next.config.ts",
  "app/scripts/performance-global-freeze-diagnostic.mjs",
  "app/scripts/performance-global-freeze-diagnostic.test.mjs",
  "app/scripts/lib/aiya-global-freeze-phase.mjs",
]);

const SAFE_EVENT_NAMES = new Set([
  "Commit",
  "EvaluateScript",
  "EventDispatch",
  "EventTiming",
  "FireAnimationFrame",
  "FireIdleCallback",
  "FunctionCall",
  "Layout",
  "MajorGC",
  "MinorGC",
  "NavigationStart",
  "Paint",
  "PrePaint",
  "Profile",
  "ProfileChunk",
  "Program",
  "ResourceFinish",
  "ResourceReceiveResponse",
  "ResourceSendRequest",
  "RunTask",
  "Task",
  "TimeStamp",
  "ThreadControllerImpl::RunTask",
  "TimerFire",
  "ThreadPool_RunTask",
  "TracingStartedInPage",
  "UpdateLayoutTree",
  "V8.Execute",
  "v8.compile",
  "firstContentfulPaint",
  "largestContentfulPaint::Candidate",
  "react_commit",
  "shell_context_state_committed",
]);

const SAFE_APP_EVENT = /^(?:inbox|messaging)_[a-z0-9_]{1,60}$/;
const SAFE_INPUT_EVENT_TYPES = new Set([
  "beforeinput",
  "click",
  "input",
  "keydown",
  "keyup",
  "mousedown",
  "pointerdown",
  "pointerup",
  "touchend",
  "touchstart",
]);
const SAFE_PHASES = new Set(["B", "E", "X", "I", "i", "P", "R", "s", "t", "f"]);
const SAFE_CATEGORIES = new Set([
  "blink",
  "blink.user_timing",
  "cc",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-v8.cpu_profiler",
  "latencyInfo",
  "loading",
  "netlog",
  "renderer.scheduler",
  "toplevel",
  "v8",
]);
const THREAD_NAMES = new Set([
  "CrBrowserMain",
  "CrRendererMain",
  "Compositor",
  "DedicatedWorker",
  "IOThread",
  "Service Worker",
  "ThreadPoolForegroundWorker",
  "V8WorkerThread",
]);
const ROUTE_ALLOWLIST = new Set([
  "/api/alerts",
  "/api/app-state",
  "/api/auth/password-login",
  "/api/conversations",
  "/api/notifications",
  "/api/session/activity",
  "/api/shell/bootstrap",
  "/api/shell/preferences",
  "/api/shell/version",
]);
const LOCAL_SYNTHETIC_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CLOCK_MARKERS = new Set([
  "aiya-global-freeze-sync-start",
  "aiya-global-freeze-sync-end",
]);
const WAIT_STATE_MARKERS = new Set(Object.values(GLOBAL_FREEZE_WAIT_STATE_MARKERS));

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function safeFunctionName(value) {
  if (typeof value !== "string" || value.length > 100) return "<anonymous>";
  return /^[A-Za-z_$][A-Za-z0-9_$.:<>-]{0,99}$/.test(value) ? value : "<anonymous>";
}

function safeScriptLabel(value) {
  if (typeof value !== "string" || value.length > 2_048) return "<script>";
  let url;
  try {
    url = new URL(value);
  } catch {
    return "<script>";
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) return "<script>";
  if (url.hostname !== "aiyaworkspace.com" || !url.pathname.startsWith("/_next/static/")) {
    return "<external-script>";
  }
  const path = url.pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, "<id>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hash>");
  return path.slice(0, 240);
}

export function sanitizeApiRoute(value) {
  if (typeof value !== "string" || value.length > 4_096) return "<route>";
  let url;
  try {
    url = new URL(value, "https://aiyaworkspace.com");
  } catch {
    return "<route>";
  }
  if (url.hostname !== "aiyaworkspace.com" && !LOCAL_SYNTHETIC_HOSTS.has(url.hostname)) {
    return "<external>";
  }
  const path = url.pathname;
  if (ROUTE_ALLOWLIST.has(path)) return path;
  if (/^\/api\/clients\/[^/]+$/.test(path)) return "/api/clients/:id";
  if (/^\/api\/clients\/[^/]+\/forms$/.test(path)) return "/api/clients/:id/forms";
  if (/^\/api\/clients\/[^/]+\/food-rule-profile$/.test(path)) {
    return "/api/clients/:id/food-rule-profile";
  }
  if (path.startsWith("/api/")) return "/api/<other>";
  if (url.searchParams.has("_rsc")) return "<rsc>";
  if (path.startsWith("/_next/static/")) return safeScriptLabel(url.href);
  return "<document>";
}

function sanitizeProfile(profile) {
  if (!isRecord(profile) || !Array.isArray(profile.samples)) {
    return null;
  }
  const rawNodes = Array.isArray(profile.nodes) ? profile.nodes : [];
  if (rawNodes.length > GLOBAL_FREEZE_MAX_PROFILE_NODES) {
    throw new Error("trace_profile_node_limit_exceeded");
  }
  const nodes = rawNodes.flatMap((node) => {
    if (!isRecord(node) || !Number.isInteger(node.id) || !isRecord(node.callFrame)) return [];
    return [{
      id: node.id,
      parent: Number.isInteger(node.parent) ? node.parent : null,
      functionName: safeFunctionName(node.callFrame.functionName),
      script: safeScriptLabel(node.callFrame.url),
      line: Number.isInteger(node.callFrame.lineNumber) ? node.callFrame.lineNumber : null,
      column: Number.isInteger(node.callFrame.columnNumber) ? node.callFrame.columnNumber : null,
      children: Array.isArray(node.children) ? node.children.filter(Number.isInteger) : [],
    }];
  });
  const samples = profile.samples.map((id) => Number.isInteger(id) ? id : null);
  const timeDeltas = Array.isArray(profile.timeDeltas)
    ? profile.timeDeltas.map((value) => Number.isFinite(value) ? value : null)
    : [];
  return {
    startTimeUs: Number.isFinite(profile.startTime) ? profile.startTime : null,
    endTimeUs: Number.isFinite(profile.endTime) ? profile.endTime : null,
    nodes,
    samples,
    timeDeltasUs: timeDeltas,
  };
}

function profileFromEvent(event) {
  const data = event?.args?.data;
  if (!isRecord(data) || !isRecord(data.cpuProfile)) return null;
  return sanitizeProfile({
    ...data.cpuProfile,
    timeDeltas: Array.isArray(data.timeDeltas) ? data.timeDeltas : data.cpuProfile.timeDeltas,
  });
}

function routeFromEvent(event) {
  const data = event?.args?.data;
  if (!isRecord(data)) return null;
  const url = data.url ?? data.request?.url;
  return typeof url === "string" ? sanitizeApiRoute(url) : null;
}

function rawRequestId(event) {
  const data = event?.args?.data;
  const value = data?.requestId ?? data?.request?.requestId;
  return typeof value === "string" || Number.isInteger(value) ? String(value) : null;
}

function safeNetworkMethod(event) {
  const data = event?.args?.data;
  const method = data?.requestMethod ?? data?.method ?? data?.request?.method;
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method)
    ? method
    : null;
}

function safeNetworkStatus(event) {
  const data = event?.args?.data;
  const status = data?.statusCode ?? data?.response?.status;
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function safeNetworkOutcome(event) {
  if (event?.name !== "ResourceFinish") return null;
  const data = event?.args?.data;
  if (data?.canceled === true) return "canceled";
  if (data?.didFail === true) return "failed";
  return "finished";
}

function clockMarkerFromEvent(event) {
  if (event?.name !== "TimeStamp") return null;
  const message = event?.args?.data?.message;
  return CLOCK_MARKERS.has(message) ? message : null;
}

function waitStateMarkerFromEvent(event) {
  if (event?.name !== "TimeStamp") return null;
  const message = event?.args?.data?.message;
  return WAIT_STATE_MARKERS.has(message) ? message : null;
}

function eventName(value) {
  if (typeof value !== "string") return null;
  if (SAFE_EVENT_NAMES.has(value) || SAFE_APP_EVENT.test(value)) return value;
  return "<event>";
}

function safeInputEventType(event) {
  if (event?.name !== "EventDispatch" && event?.name !== "EventTiming") return null;
  const data = event?.args?.data;
  const type = data?.type ?? data?.eventType ?? event?.args?.type;
  return SAFE_INPUT_EVENT_TYPES.has(type) ? type : null;
}

function safeInteractionTiming(event, interactionIds) {
  if (event?.name !== "EventTiming") return null;
  const data = event?.args?.data;
  const type = safeInputEventType(event);
  if (type === null) return null;
  const timeStamp = data?.timeStamp;
  const processingStart = data?.processingStart;
  const processingEnd = data?.processingEnd;
  const duration = data?.duration;
  const rawInteractionId = data?.interactionId;
  let interactionId = null;
  if (Number.isSafeInteger(rawInteractionId) && rawInteractionId > 0) {
    if (!interactionIds.has(rawInteractionId)) {
      interactionIds.set(rawInteractionId, `interaction-${interactionIds.size + 1}`);
    }
    interactionId = interactionIds.get(rawInteractionId);
  }
  const inputDelayMs = Number.isFinite(timeStamp) && Number.isFinite(processingStart) &&
    processingStart >= timeStamp
    ? Number((processingStart - timeStamp).toFixed(3))
    : null;
  const processingMs = Number.isFinite(processingStart) && Number.isFinite(processingEnd) &&
    processingEnd >= processingStart
    ? Number((processingEnd - processingStart).toFixed(3))
    : null;
  return {
    eventType: type,
    inputDelayMs,
    processingMs,
    reportedDurationMs: Number.isFinite(duration) && duration >= 0
      ? Number(duration.toFixed(3))
      : null,
    interactionId,
  };
}

export function sanitizeChromeTrace(input, { runId = null } = {}) {
  if (!isRecord(input) || !Array.isArray(input.traceEvents)) {
    if (isRecord(input) && isRecord(input.log) && Array.isArray(input.log.entries)) {
      throw new Error("har_input_rejected_do_not_import_network_bodies");
    }
    throw new Error("chrome_trace_events_missing");
  }
  if (input.traceEvents.length > GLOBAL_FREEZE_MAX_TRACE_EVENTS) {
    throw new Error("trace_event_limit_exceeded");
  }

  const threadLabels = new Map();
  for (const event of input.traceEvents) {
    if (event?.ph !== "M" || event?.name !== "thread_name" || !Number.isInteger(event.tid)) continue;
    const name = event?.args?.name;
    threadLabels.set(`${event.pid}:${event.tid}`, THREAD_NAMES.has(name) ? name : "<other-thread>");
  }

  const profileIds = new Map();
  const profileHeaders = new Map();
  const profileKeyFor = (event) => {
    if (!Number.isInteger(event?.pid)) return null;
    const value = event.id ?? (isRecord(event.id2) ? event.id2.global ?? event.id2.local : event.id2);
    if (typeof value !== "string" && !Number.isSafeInteger(value)) return null;
    return `${event.pid}:${typeof value}:${value}`;
  };
  for (const event of input.traceEvents) {
    if (event?.name !== "Profile" || event?.ph !== "P" || !Number.isInteger(event.tid)) continue;
    const key = profileKeyFor(event);
    if (key === null) continue;
    const profileId = `profile-${profileIds.size + 1}`;
    profileIds.set(key, profileId);
    const source = event.args?.data?.source;
    profileHeaders.set(key, {
      profileId,
      ownerThread: threadLabels.get(`${event.pid}:${event.tid}`) ?? "<unmapped-thread>",
      startedAtMs: Number((event.ts / 1_000).toFixed(3)),
      source: ["Internal", "Inspector", "SelfProfiling"].includes(source) ? source : null,
    });
  }

  const requestIds = new Map();
  const requestRoutes = new Map();
  const interactionIds = new Map();
  let nextRequestId = 0;
  const events = [];
  const profiles = [];
  let droppedEventCount = 0;
  let profileNodeCount = 0;
  let profileSampleCount = 0;
  for (const event of input.traceEvents) {
    if (!isRecord(event) || !SAFE_PHASES.has(event.ph) || !Number.isFinite(event.ts)) {
      droppedEventCount += 1;
      continue;
    }
    if (event.ph === "M") continue;
    const name = eventName(event.name);
    if (name === null) {
      droppedEventCount += 1;
      continue;
    }
    const normalized = {
      name,
      category: typeof event.cat === "string" && SAFE_CATEGORIES.has(event.cat) ? event.cat : "<other>",
      phase: event.ph,
      timestampMs: Number((event.ts / 1_000).toFixed(3)),
      pid: Number.isInteger(event.pid) ? event.pid : null,
      tid: Number.isInteger(event.tid) ? event.tid : null,
      thread: Number.isInteger(event.tid)
        ? threadLabels.get(`${event.pid}:${event.tid}`) ?? "<unmapped-thread>"
        : "<unmapped-thread>",
    };
    if (Number.isFinite(event.dur) && event.dur >= 0) {
      normalized.durationMs = Number((event.dur / 1_000).toFixed(3));
    }
    if (Number.isFinite(event.tdur) && event.tdur >= 0) {
      normalized.threadDurationMs = Number((event.tdur / 1_000).toFixed(3));
    }
    const inputEventType = safeInputEventType(event);
    if (inputEventType !== null) normalized.inputEventType = inputEventType;
    const interactionTiming = safeInteractionTiming(event, interactionIds);
    if (interactionTiming !== null) normalized.interactionTiming = interactionTiming;
    const rawId = rawRequestId(event);
    const routeForEvent = routeFromEvent(event);
    if (routeForEvent !== null && rawId !== null) requestRoutes.set(rawId, routeForEvent);
    const route = routeForEvent ?? (rawId === null ? null : requestRoutes.get(rawId));
    if (route !== null && route !== undefined) {
      let correlationId = null;
      if (rawId !== null) {
        if (!requestIds.has(rawId)) requestIds.set(rawId, `request-${++nextRequestId}`);
        correlationId = requestIds.get(rawId);
      }
      const method = safeNetworkMethod(event);
      const status = safeNetworkStatus(event);
      const outcome = safeNetworkOutcome(event);
      normalized.network = { route, correlationId, method, status, outcome };
    }
    const clockMarker = clockMarkerFromEvent(event);
    if (clockMarker) normalized.clockMarker = clockMarker;
    const waitStateMarker = waitStateMarkerFromEvent(event);
    if (waitStateMarker) normalized.waitStateMarker = waitStateMarker;
    events.push(normalized);

    const profile = profileFromEvent(event);
    if (profile !== null) {
      profileNodeCount += profile.nodes.length;
      profileSampleCount += profile.samples.length;
      if (profileNodeCount > GLOBAL_FREEZE_MAX_PROFILE_NODES ||
        profileSampleCount > GLOBAL_FREEZE_MAX_PROFILE_SAMPLES) {
        throw new Error("trace_profile_total_limit_exceeded");
      }
      const profileKey = profileKeyFor(event);
      const header = profileKey === null ? null : profileHeaders.get(profileKey);
      profiles.push({
        profileId: header?.profileId ?? null,
        processId: normalized.pid,
        timestampMs: normalized.timestampMs,
        thread: normalized.thread,
        ownerThread: header?.ownerThread ?? null,
        startedAtMs: header?.startedAtMs ?? null,
        source: header?.source ?? null,
        profile,
      });
    }
  }

  return {
    schemaVersion: "aiya-chrome-freeze-trace-v1",
    runId: typeof runId === "string" ? runId : null,
    metadata: {
      originalEventCount: input.traceEvents.length,
      sanitizedEventCount: events.length,
      droppedEventCount,
      profileChunkCount: profiles.length,
      eventArgsRetained: false,
      screenshotsRetained: false,
      sourceContentRetained: false,
    },
    events,
    profiles,
  };
}

export function readChromeTrace(filePath, { runId = null } = {}) {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("trace_input_must_be_regular_file");
  if (stat.size <= 0 || stat.size > GLOBAL_FREEZE_MAX_COMPRESSED_BYTES) {
    throw new Error("trace_input_size_out_of_range");
  }
  const bytes = readFileSync(filePath);
  return parseChromeTraceBytes(bytes, { runId });
}

function parseChromeTraceBytes(bytes, { runId = null } = {}) {
  const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b
    ? gunzipSync(bytes, { maxOutputLength: 256 * 1024 * 1024 })
    : bytes;
  let input;
  try {
    input = JSON.parse(decoded.toString("utf8"));
  } catch {
    throw new Error("trace_json_invalid");
  }
  return sanitizeChromeTrace(input, { runId });
}

function readChromeTraceWithHash(filePath) {
  const stat = lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("trace_input_must_be_regular_file");
  if (stat.size <= 0 || stat.size > GLOBAL_FREEZE_MAX_COMPRESSED_BYTES) {
    throw new Error("trace_input_size_out_of_range");
  }
  const bytes = readFileSync(filePath);
  if (bytes.length !== stat.size) throw new Error("trace_input_changed_during_read");
  return { trace: parseChromeTraceBytes(bytes), sourceSha256: sha256(bytes) };
}

export function summarizeChromeTrace(trace) {
  if (!isRecord(trace) || !Array.isArray(trace.events) || !Array.isArray(trace.profiles)) {
    throw new Error("sanitized_trace_shape_invalid");
  }
  const tasks = trace.events
    .filter((event) => ["RunTask", "Task", "ThreadControllerImpl::RunTask", "ThreadPool_RunTask"].includes(event.name))
    .filter((event) => event.thread === "CrRendererMain" && Number.isFinite(event.durationMs))
    .map(({ timestampMs, durationMs, name }) => ({ timestampMs, durationMs, name }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const longTasks = tasks.filter((task) => task.durationMs >= 50);
  const network = trace.events
    .filter((event) => event.network)
    .map((event) => ({ timestampMs: event.timestampMs, ...event.network, name: event.name }));
  const requests = new Map();
  for (const event of trace.events) {
    if (!event.network?.correlationId) continue;
    const key = event.network.correlationId;
    const request = requests.get(key) ?? {
      correlationId: key,
      route: event.network.route,
      method: null,
      status: null,
      requestStartMs: null,
      responseStartMs: null,
      finishMs: null,
    };
    if (event.network.method) request.method = event.network.method;
    if (event.network.status) request.status = event.network.status;
    if (event.name === "ResourceSendRequest") request.requestStartMs ??= event.timestampMs;
    if (event.name === "ResourceReceiveResponse") request.responseStartMs ??= event.timestampMs;
    if (event.name === "ResourceFinish") request.finishMs ??= event.timestampMs;
    requests.set(key, request);
  }
  const networkRequests = [...requests.values()].map((request) => ({
    ...request,
    responseWaitMs: request.requestStartMs !== null && request.responseStartMs !== null
      ? Number((request.responseStartMs - request.requestStartMs).toFixed(3))
      : null,
    bodyAfterResponseMs: request.responseStartMs !== null && request.finishMs !== null
      ? Number((request.finishMs - request.responseStartMs).toFixed(3))
      : null,
    totalMs: request.requestStartMs !== null && request.finishMs !== null
      ? Number((request.finishMs - request.requestStartMs).toFixed(3))
      : null,
  })).sort((a, b) => (a.requestStartMs ?? Infinity) - (b.requestStartMs ?? Infinity));
  const profileSampleCount = trace.profiles.reduce((total, item) => total + item.profile.samples.length, 0);
  const threadNames = [...new Set(trace.events.map((event) => event.thread))].sort();
  const clockMarkers = trace.events
    .filter((event) => CLOCK_MARKERS.has(event.clockMarker))
    .map(({ clockMarker, timestampMs }) => ({ marker: clockMarker, timestampMs }));
  return {
    runId: trace.runId,
    metadata: trace.metadata,
    threadNames,
    mainThreadTaskCount: tasks.length,
    longTaskCount: longTasks.length,
    longestMainThreadTasks: [...longTasks].sort((a, b) => b.durationMs - a.durationMs).slice(0, 20),
    networkEventCount: network.length,
    networkEvents: network,
    networkRequestCount: networkRequests.length,
    networkRequests,
    clockMarkers,
    profileChunkCount: trace.profiles.length,
    profileSampleCount,
    profilerEnabled: trace.profiles.length > 0,
  };
}

export function summarizeNativeChromeTrace(trace) {
  if (!isRecord(trace) || !Array.isArray(trace.events) || !Array.isArray(trace.profiles) ||
    trace.metadata?.eventArgsRetained !== false) {
    throw new Error("native_trace_summary_requires_sanitized_trace");
  }
  const chrome = summarizeChromeTrace(trace);
  const waitState = summarizeWaitState(trace, { traceComplete: false });
  const dispatchEvents = trace.events.filter((event) =>
    event.name === "EventDispatch" && event.inputEventType);
  const dispatchEventTypeCounts = {};
  for (const event of dispatchEvents) {
    dispatchEventTypeCounts[event.inputEventType] = (dispatchEventTypeCounts[event.inputEventType] ?? 0) + 1;
  }
  const observedDispatches = dispatchEvents
    .map(({ timestampMs, durationMs, inputEventType }) => ({ timestampMs, durationMs: durationMs ?? null, eventType: inputEventType }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const eventTimings = trace.events
    .filter((event) => event.interactionTiming)
    .map(({ timestampMs, interactionTiming }) => ({ timestampMs, ...interactionTiming }))
    .sort((a, b) => a.timestampMs - b.timestampMs);
  const slowEventTypeCounts = {};
  for (const event of eventTimings) {
    slowEventTypeCounts[event.eventType] = (slowEventTypeCounts[event.eventType] ?? 0) + 1;
  }
  const timedRequests = waitState.network.requests.map((request) => ({
    ...request,
    responseWaitMs: request.requestStartMs !== null && request.responseStartMs !== null
      ? Number((request.responseStartMs - request.requestStartMs).toFixed(3))
      : null,
    bodyAfterResponseMs: request.responseStartMs !== null && request.finishMs !== null
      ? Number((request.finishMs - request.responseStartMs).toFixed(3))
      : null,
    totalMs: request.requestStartMs !== null && request.finishMs !== null
      ? Number((request.finishMs - request.requestStartMs).toFixed(3))
      : null,
  }));
  const requestsAtEnd = timedRequests.filter((request) =>
    request.state === "WAITING_FOR_HEADERS" || request.state === "RESPONSE_BODY_OPEN");
  const visibleStateAvailable = waitState.visibleState.loadingVisibleCount > 0 ||
    waitState.visibleState.contentReadyCount > 0 || waitState.visibleState.workCompleteCount > 0;
  let windowStartMs = null;
  let windowEndMs = null;
  for (const event of trace.events) {
    if (!Number.isFinite(event.timestampMs)) continue;
    windowStartMs = windowStartMs === null ? event.timestampMs : Math.min(windowStartMs, event.timestampMs);
    windowEndMs = windowEndMs === null ? event.timestampMs : Math.max(windowEndMs, event.timestampMs);
  }

  return {
    schemaVersion: "aiya-global-freeze-native-trace-summary-v1",
    traceCompleteness: "NOT_VERIFIABLE_FROM_JSON_PARSE",
    traceWindowMs: windowStartMs === null ? null : Number((windowEndMs - windowStartMs).toFixed(3)),
    input: {
      expectedActionCount: null,
      observedDispatchCount: dispatchEvents.length,
      dispatchEventTypeCounts,
      observedDispatches: observedDispatches.slice(0, 50),
      slowEventTimingCount: eventTimings.length,
      slowEventTypeCounts,
      slowEventTimings: eventTimings.slice(0, 50),
      expectedActionDelivery: "UNAVAILABLE_WITHOUT_ACTION_MARKERS",
    },
    network: {
      requestCount: waitState.network.requestCount,
      rscRequestCount: waitState.network.rscRequestCount,
      unfinishedAtRecordedEndCount: requestsAtEnd.length,
      unfinishedAtRecordedEnd: requestsAtEnd.slice(0, 25),
      longestCompletedRequests: timedRequests
        .filter((request) => request.totalMs !== null)
        .sort((a, b) => b.totalMs - a.totalMs)
        .slice(0, 20),
      lifecycleCoverage: waitState.network.requestCount > 0 ? "OBSERVED" : "UNAVAILABLE",
    },
    mainThread: {
      taskCount: chrome.mainThreadTaskCount,
      longTaskCount: chrome.longTaskCount,
      longestLongTasks: chrome.longestMainThreadTasks,
      profileAttribution: summarizeNativeProfileAttribution(trace),
      observation: chrome.longTaskCount > 0
        ? "LONG_TASKS_OBSERVED_DURING_RECORDING"
        : "NO_LONG_TASK_OBSERVED_NOT_PROOF_OF_RESPONSIVENESS",
    },
    visibleState: visibleStateAvailable
      ? {
        availability: "APP_MARKERS_OBSERVED",
        ...waitState.visibleState,
        loadingAfterWork: waitState.visibleState.workCompleteCount > 0 &&
          waitState.visibleState.loadingVisibleCount > 0
          ? waitState.visibleState.loadingAfterWork
          : null,
      }
      : { availability: "UNAVAILABLE_NO_APP_STATE_MARKERS" },
    interactionCorrelation: "TIMELINE_ORDER_AVAILABLE_CAUSAL_LINK_NOT_ESTABLISHED",
    limitations: [
      "Missing input events do not prove that an expected action was not delivered.",
      "Unfinished requests are only missing a completion event at the recorded trace end.",
      "Browser events, requests, and long tasks share a trace timeline; temporal proximity alone does not prove causation.",
      "No host process, database, or real-time visible loading measurement is included.",
    ],
  };
}

export function inspectNativeTraceFile(tracePath, { outputRoot = GLOBAL_FREEZE_NATIVE_TRACE_ROOT } = {}) {
  const { trace, sourceSha256 } = readChromeTraceWithHash(tracePath);
  const summary = summarizeNativeChromeTrace(trace);
  const captureId = `aiya-edge-native-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID()}`;
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  const outputDirectory = join(outputRoot, captureId);
  mkdirSync(outputDirectory, { mode: 0o700 });
  const sanitizedBytes = Buffer.from(`${JSON.stringify(trace)}\n`);
  const sanitizedTracePath = join(outputDirectory, "trace.redacted.json");
  writeFileSync(sanitizedTracePath, sanitizedBytes, { flag: "wx", mode: 0o600 });
  const summaryDocument = {
    schemaVersion: "aiya-global-freeze-native-capture-v1",
    captureId,
    sourceTraceSha256: sourceSha256,
    sanitizedTraceSha256: sha256(sanitizedBytes),
    sanitizedArtifact: "trace.redacted.json",
    summary,
  };
  const summaryBytes = Buffer.from(`${JSON.stringify(summaryDocument, null, 2)}\n`);
  const summaryPath = join(outputDirectory, "capture-summary.json");
  writeFileSync(summaryPath, summaryBytes, { flag: "wx", mode: 0o600 });
  return {
    captureId,
    outputDirectory,
    sanitizedTracePath,
    summaryPath,
    sourceTraceSha256: sourceSha256,
    sanitizedTraceSha256: summaryDocument.sanitizedTraceSha256,
    summarySha256: sha256(summaryBytes),
    summary,
  };
}

export function inspectNativeProfileFile(tracePath, {
  outputRoot = join(GLOBAL_FREEZE_NATIVE_TRACE_ROOT, "profile-analysis"),
} = {}) {
  const { trace, sourceSha256 } = readChromeTraceWithHash(tracePath);
  const analysisId = `aiya-profile-analysis-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID()}`;
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  const outputDirectory = join(outputRoot, analysisId);
  mkdirSync(outputDirectory, { mode: 0o700 });
  const profileAttribution = summarizeNativeProfileAttribution(trace);
  const bytes = Buffer.from(`${JSON.stringify({
    schemaVersion: "aiya-global-freeze-native-profile-analysis-v1",
    analysisId,
    sourceTraceSha256: sourceSha256,
    profileAttribution,
  }, null, 2)}\n`);
  const summaryPath = join(outputDirectory, "profile-analysis.json");
  writeFileSync(summaryPath, bytes, { flag: "wx", mode: 0o600 });
  return {
    analysisId,
    summaryPath,
    sourceTraceSha256: sourceSha256,
    summarySha256: sha256(bytes),
    profileAttribution,
  };
}

function hostCpuBusyPercentAt(samples, index) {
  if (index <= 0 || index >= samples.length) return null;
  const before = samples[index - 1].cpuTicks;
  const after = samples[index].cpuTicks;
  const totalBefore = Object.values(before).reduce((sum, value) => sum + value, 0);
  const totalAfter = Object.values(after).reduce((sum, value) => sum + value, 0);
  const deltaTotal = totalAfter - totalBefore;
  const deltaIdle = (after.idle + after.iowait) - (before.idle + before.iowait);
  return deltaTotal > 0 ? Number(((deltaTotal - deltaIdle) / deltaTotal * 100).toFixed(2)) : null;
}

export function correlateChromeTraceWithHost(trace, hostSamples, {
  startEpochMs,
  endEpochMs,
  hostClockOffsetMs = 0,
  hostClockUncertaintyMs = 0,
  minimumTraceDurationMs = 80_000,
  minimumOverlapSamples = 80,
} = {}) {
  if (!Number.isSafeInteger(startEpochMs) || !Number.isSafeInteger(endEpochMs) || endEpochMs <= startEpochMs) {
    throw new Error("clock_anchor_epoch_invalid");
  }
  if (!Number.isSafeInteger(hostClockOffsetMs) || !Number.isSafeInteger(hostClockUncertaintyMs) ||
    hostClockUncertaintyMs < 0 || hostClockUncertaintyMs > GLOBAL_FREEZE_HOST_CLOCK_MAX_UNCERTAINTY_MS) {
    throw new Error("host_clock_sync_invalid");
  }
  const markers = trace.events.filter((event) => CLOCK_MARKERS.has(event.clockMarker));
  const start = markers.filter((event) => event.clockMarker === "aiya-global-freeze-sync-start");
  const end = markers.filter((event) => event.clockMarker === "aiya-global-freeze-sync-end");
  if (start.length !== 1 || end.length !== 1 || end[0].timestampMs <= start[0].timestampMs) {
    throw new Error("clock_anchor_trace_markers_invalid");
  }
  const traceDurationMs = end[0].timestampMs - start[0].timestampMs;
  if (traceDurationMs < minimumTraceDurationMs) throw new Error("clock_anchor_capture_too_short");
  const epochDurationMs = endEpochMs - startEpochMs;
  const scale = epochDurationMs / traceDurationMs;
  if (scale < 0.99 || scale > 1.01) throw new Error("clock_anchor_scale_out_of_bounds");
  if (!Array.isArray(hostSamples) || hostSamples.length < 2) throw new Error("host_capture_samples_missing");

  const epochAtTraceTime = (timestampMs) =>
    startEpochMs + (timestampMs - start[0].timestampMs) * scale + hostClockOffsetMs;
  const traceTimes = trace.events.map((event) => event.timestampMs).filter(Number.isFinite);
  const traceStartEpochMs = epochAtTraceTime(Math.min(...traceTimes));
  const traceEndEpochMs = epochAtTraceTime(Math.max(...traceTimes));
  const selectedTasks = summarizeChromeTrace(trace).longestMainThreadTasks;
  const longTaskHostCorrelations = selectedTasks.map((task) => {
    const targetEpochMs = epochAtTraceTime(task.timestampMs);
    let nearestIndex = 0;
    for (let index = 1; index < hostSamples.length; index += 1) {
      if (Math.abs(hostSamples[index].epochSeconds * 1_000 - targetEpochMs) <
        Math.abs(hostSamples[nearestIndex].epochSeconds * 1_000 - targetEpochMs)) nearestIndex = index;
    }
    const sample = hostSamples[nearestIndex];
    return {
      taskTimestampMs: task.timestampMs,
      taskDurationMs: task.durationMs,
      sampleUtc: sample.utc,
      sampleDistanceMs: Math.round(Math.abs(sample.epochSeconds * 1_000 - targetEpochMs)),
      hostCpuBusyPercent: hostCpuBusyPercentAt(hostSamples, nearestIndex),
      memoryAvailableKb: sample.memory.availableKb,
      cpuPressureAvg10Percent: sample.pressure.cpuSomeAvg10Percent,
      memoryPressureAvg10Percent: sample.pressure.memorySomeAvg10Percent,
      ioPressureAvg10Percent: sample.pressure.ioSomeAvg10Percent,
    };
  });
  const hostSamplesDuringTrace = hostSamples.filter((sample) => {
    const epoch = sample.epochSeconds * 1_000;
    return epoch >= traceStartEpochMs && epoch <= traceEndEpochMs;
  }).length;
  if (hostSamplesDuringTrace < minimumOverlapSamples) throw new Error("host_trace_overlap_below_minimum");
  return {
    status: "ALIGNED",
    startEpochMs,
    endEpochMs,
    hostClockOffsetMs,
    hostClockUncertaintyMs,
    traceDurationMs: Number(traceDurationMs.toFixed(3)),
    clockScalePartsPerMillion: Math.round((scale - 1) * 1_000_000),
    traceStartUtc: new Date(traceStartEpochMs).toISOString(),
    traceEndUtc: new Date(traceEndEpochMs).toISOString(),
    hostSamplesDuringTrace,
    minimumOverlapSamples,
    longTaskHostCorrelations,
  };
}

export const GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT = String.raw`#!/usr/bin/env bash
set -u
duration="$1"
app_pid=""
for process_path in /proc/[0-9]*; do
  candidate="$(basename "$process_path")"
  working_dir="$(readlink -f "$process_path/cwd" 2>/dev/null || true)"
  case "$working_dir" in
    /opt/manu-ai/current/app|/opt/manu-ai/releases/*/app)
      executable="$(basename "$(readlink -f "$process_path/exe" 2>/dev/null || true)")"
      case "$executable" in node|nodejs) app_pid="$candidate"; break ;; esac
      ;;
  esac
done
cgroup_path=""
if [ -n "$app_pid" ]; then
  cgroup_path="$(awk -F: '$1 == "0" { print $3; exit }' "/proc/$app_pid/cgroup" 2>/dev/null || true)"
fi
if [ -n "$cgroup_path" ]; then cgroup_root="/sys/fs/cgroup$cgroup_path"; else cgroup_root="/__aiya_cgroup_unavailable__"; fi
psi_avg10() {
  awk '$1 == "some" { for (i = 2; i <= NF; i++) { split($i, pair, "="); if (pair[1] == "avg10") { print pair[2]; exit } } }' "/proc/pressure/$1" 2>/dev/null || printf 'null\n'
}
proc_value() {
  if [ ! -r "/proc/$1/status" ]; then printf 'null\n'; return; fi
  awk -v name="$2:" '$1 == name { print $2; found=1; exit } END { if (!found) print "null" }' "/proc/$1/status"
}
cgroup_value() {
  if [ ! -r "$cgroup_root/$1" ]; then printf 'null\n'; return; fi
  awk -v key="$2" '$1 == key { print $2; found=1; exit } END { if (!found) print "null" }' "$cgroup_root/$1"
}
cgroup_scalar() {
  value="$(cat "$cgroup_root/$1" 2>/dev/null || true)"
  case "$value" in ''|*[!0-9]*) printf 'null\n' ;; *) printf '%s\n' "$value" ;; esac
}
count=0
while [ "$count" -lt "$duration" ]; do
  psi_cpu="$(psi_avg10 cpu)"
  psi_memory="$(psi_avg10 memory)"
  psi_io="$(psi_avg10 io)"
  read -r _ cpu_user cpu_nice cpu_system cpu_idle cpu_iowait cpu_irq cpu_softirq cpu_steal _ < /proc/stat
  load1="$(awk '{ print $1 }' /proc/loadavg)"
  read -r memory_total memory_available swap_total swap_free < <(awk '/^MemTotal:/ { total=$2 } /^MemAvailable:/ { available=$2 } /^SwapTotal:/ { swap_total=$2 } /^SwapFree:/ { swap_free=$2 } END { print total+0, available+0, swap_total+0, swap_free+0 }' /proc/meminfo)
  read -r swap_in swap_out < <(awk '/^pswpin / { in_pages=$2 } /^pswpout / { out_pages=$2 } END { print in_pages+0, out_pages+0 }' /proc/vmstat)
  memory_current="$(cgroup_scalar memory.current)"
  memory_limit="$(cgroup_scalar memory.max)"
  app_rss="null"
  app_hwm="null"
  app_alive=false
  if [ -n "$app_pid" ] && [ -r "/proc/$app_pid/status" ]; then
    app_rss="$(proc_value "$app_pid" VmRSS)"
    app_hwm="$(proc_value "$app_pid" VmHWM)"
    app_alive=true
  fi
  printf '{"schemaVersion":"aiya-host-vitals-v1","utc":"%s","epochSeconds":%s,"vcpu":%s,"load1":%s,"cpuTicks":{"user":%s,"nice":%s,"system":%s,"idle":%s,"iowait":%s,"irq":%s,"softirq":%s,"steal":%s},"memory":{"totalKb":%s,"availableKb":%s,"swapTotalKb":%s,"swapFreeKb":%s},"swap":{"inPages":%s,"outPages":%s},"pressure":{"cpuSomeAvg10Percent":%s,"memorySomeAvg10Percent":%s,"ioSomeAvg10Percent":%s},"application":{"processFound":%s,"processAlive":%s,"rssKb":%s,"hwmKb":%s,"cgroupMemoryCurrentBytes":%s,"cgroupMemoryLimitBytes":%s,"cgroupNrThrottled":%s,"cgroupThrottledUsec":%s,"cgroupMemoryHighEvents":%s,"cgroupOomKillEvents":%s}}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(date +%s)" "$(nproc)" "$load1" \
    "$cpu_user" "$cpu_nice" "$cpu_system" "$cpu_idle" "$cpu_iowait" "$cpu_irq" "$cpu_softirq" "$cpu_steal" \
    "$memory_total" "$memory_available" "$swap_total" "$swap_free" "$swap_in" "$swap_out" \
    "$psi_cpu" "$psi_memory" "$psi_io" "$([ -n "$app_pid" ] && printf true || printf false)" "$app_alive" "$app_rss" "$app_hwm" \
    "$memory_current" "$memory_limit" "$(cgroup_value cpu.stat nr_throttled)" "$(cgroup_value cpu.stat throttled_usec)" \
    "$(cgroup_value memory.events high)" "$(cgroup_value memory.events oom_kill)"
  count=$((count + 1))
  [ "$count" -ge "$duration" ] || sleep 1
done`;

function repoRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

function gitText(args) {
  return execFileSync("git", ["--no-optional-locks", ...args], {
    cwd: repoRoot(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function checkRemoteHostScriptSyntax() {
  try {
    execFileSync("ssh", [
      "-T",
      "-o", "BatchMode=yes",
      "-o", "StrictHostKeyChecking=yes",
      "-o", "ConnectTimeout=8",
      GLOBAL_FREEZE_SSH_ALIAS,
      "bash", "-n",
    ], {
      input: GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
      timeout: 10_000,
      windowsHide: true,
    });
  } catch (error) {
    const reason = Number.isInteger(error?.status) ? `exit_${error.status}` : String(error?.code || "ssh_check_failed");
    throw new Error(`remote_host_script_syntax_check_failed:${reason}`);
  }
}

export function summarizeHostClockProbes(probes) {
  if (!Array.isArray(probes) || probes.length !== 3 || probes.some((probe) =>
    !isRecord(probe) || !Number.isSafeInteger(probe.offsetMs) ||
    !Number.isSafeInteger(probe.roundTripMs) || probe.roundTripMs < 0)) {
    throw new Error("host_clock_probe_invalid");
  }
  const offsets = probes.map(({ offsetMs }) => offsetMs).sort((a, b) => a - b);
  const offsetMs = offsets[1];
  const probeSpreadMs = Math.max(...probes.map(({ offsetMs: value }) => Math.abs(value - offsetMs)));
  const uncertaintyMs = Math.max(...probes.map(({ roundTripMs }) => Math.ceil(roundTripMs / 2))) + probeSpreadMs;
  if (uncertaintyMs > GLOBAL_FREEZE_HOST_CLOCK_MAX_UNCERTAINTY_MS) {
    const error = new Error("host_clock_sync_uncertainty_exceeded");
    error.clockSync = {
      probeCount: probes.length,
      roundTripMs: probes.map(({ roundTripMs }) => roundTripMs),
      uncertaintyMs,
    };
    throw error;
  }
  return {
    offsetMs,
    uncertaintyMs,
    probeCount: probes.length,
    roundTripMs: probes.map(({ roundTripMs }) => roundTripMs),
  };
}

async function readHostClockLine(lines, closed, timeoutMs) {
  let timeout;
  try {
    const result = await Promise.race([
      lines.next(),
      closed.then((exit) => ({ processExit: exit })),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("host_clock_probe_timeout")), timeoutMs);
      }),
    ]);
    if (result.processExit) throw new Error(result.processExit.error
      ? "host_clock_ssh_process_unavailable"
      : "host_clock_ssh_process_closed");
    if (result.done) throw new Error("host_clock_probe_stream_closed");
    return result.value;
  } finally {
    clearTimeout(timeout);
  }
}

async function syncRemoteHostClock() {
  const remoteCommand = "printf 'READY\\n'; while IFS= read -r request; do [ \"$request\" = probe ] || exit 2; date +%s%3N; done";
  const ssh = spawn("ssh", [
    "-T",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "ConnectTimeout=8",
    GLOBAL_FREEZE_SSH_ALIAS,
    remoteCommand,
  ], {
    stdio: ["pipe", "pipe", "ignore"],
    windowsHide: true,
  });
  const lines = createInterface({ input: ssh.stdout, crlfDelay: Infinity });
  const lineIterator = lines[Symbol.asyncIterator]();
  const closed = new Promise((resolve) => {
    ssh.once("error", (error) => resolve({ error }));
    ssh.once("close", (code, signal) => resolve({ code, signal }));
  });
  const probes = [];
  try {
    if (await readHostClockLine(lineIterator, closed, 15_000) !== "READY") {
      throw new Error("host_clock_probe_ready_invalid");
    }
    for (let index = 0; index < 3; index += 1) {
      const localStartMs = Date.now();
      await new Promise((resolve, reject) => {
        ssh.stdin.write("probe\n", "utf8", (error) => error ? reject(error) : resolve());
      });
      const output = await readHostClockLine(lineIterator, closed, 5_000);
      const localEndMs = Date.now();
      const remoteEpochMs = Number(output);
      if (!/^\d{13}$/.test(output) || !Number.isSafeInteger(remoteEpochMs)) {
        throw new Error("host_clock_probe_invalid");
      }
      const roundTripMs = localEndMs - localStartMs;
      probes.push({
        offsetMs: Math.round(remoteEpochMs - (localStartMs + localEndMs) / 2),
        roundTripMs,
      });
    }
    ssh.stdin.end();
    let shutdownTimeout;
    const exit = await Promise.race([
      closed,
      new Promise((resolve) => {
        shutdownTimeout = setTimeout(() => resolve({ timeout: true }), 5_000);
      }),
    ]);
    clearTimeout(shutdownTimeout);
    if (exit.timeout) throw new Error("host_clock_ssh_shutdown_timeout");
    if (exit.error || exit.code !== 0) throw new Error("host_clock_ssh_process_failed");
    return summarizeHostClockProbes(probes);
  } catch (error) {
    ssh.kill();
    throw error;
  } finally {
    lines.close();
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function summarizePhaseOneArtifacts({
  runId,
  hostBytes,
  traceBytes,
  traceEventPayload,
  observationEventPayload,
  expectedHostSampleCount,
}) {
  let hostSamples = [];
  let hostSamplesSha256 = null;
  let sanitizedTraceSha256 = null;
  let trace = null;

  if (Buffer.isBuffer(hostBytes)) {
    hostSamplesSha256 = sha256(hostBytes);
    try {
      hostSamples = parseRemoteVitalsLines(hostBytes.toString("utf8"));
    } catch {
      hostSamples = [];
    }
  }
  if (Buffer.isBuffer(traceBytes)) {
    sanitizedTraceSha256 = sha256(traceBytes);
    try {
      trace = JSON.parse(traceBytes.toString("utf8"));
    } catch {
      trace = null;
    }
  }

  const artifactIntegrity = trace?.schemaVersion === "aiya-chrome-freeze-trace-v1" &&
    trace.runId === runId && traceEventPayload?.sanitizedSha256 === sanitizedTraceSha256 &&
    observationEventPayload?.browserTraceSha256 === sanitizedTraceSha256 &&
    observationEventPayload?.hostSamplesSha256 === hostSamplesSha256 &&
    expectedHostSampleCount === hostSamples.length;
  return { hostSamples, hostSamplesSha256, sanitizedTraceSha256, artifactIntegrity };
}

function safeFailureCode(error, fallback) {
  const message = String(error?.message || "");
  return /^[a-z0-9_:-]{1,100}$/i.test(message) ? message : fallback;
}

function currentSourceIdentity(liveRelease) {
  const files = GLOBAL_FREEZE_SOURCE_FILES.map((path) => ({
    path,
    sha256: sha256(readFileSync(join(repoRoot(), path))),
  }));
  return {
    phaseId: GLOBAL_FREEZE_PHASE_ID,
    phaseSchemaVersion: GLOBAL_FREEZE_SCHEMA_VERSION,
    fixtureClass: "user_confirmed_synthetic_test_data",
    captureTargetOrigin: "https://aiyaworkspace.com",
    branch: gitText(["branch", "--show-current"]),
    head: gitText(["rev-parse", "HEAD"]),
    sourceFiles: files,
    sourceFingerprint: sha256(JSON.stringify(files)),
    liveRelease: {
      releaseId: String(liveRelease.releaseId),
      commitSha: String(liveRelease.commitSha),
      migrationFingerprint: String(liveRelease.migrationFingerprint),
    },
    measurements: {
      browser: "Chrome DevTools Performance runtime trace; screenshots and resource contents disabled",
      host: `SSH ${GLOBAL_FREEZE_SSH_ALIAS}; read-only procfs, cgroup, and pressure counters`,
      officialPerformanceAcceptance: false,
    },
  };
}

async function readLiveRelease() {
  const response = await fetch(GLOBAL_FREEZE_LIVE_RELEASE_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`live_release_http_${response.status}`);
  const value = await response.json();
  if (value?.status !== "ok" || !/^[a-f0-9]{40}$/.test(String(value.commitSha ?? "")) ||
    !/^[a-f0-9]{64}$/.test(String(value.migrationFingerprint ?? "")) ||
    typeof value.releaseId !== "string") {
    throw new Error("live_release_identity_invalid");
  }
  return value;
}

function markRunStale(runId, identity, currentIdentity) {
  const run = openCurrentRunForStoredIdentity(runId, identity);
  try {
    run.append("capture.identity.stale", {
      expectedSourceFingerprint: identity.sourceFingerprint,
      currentSourceFingerprint: currentIdentity.sourceFingerprint,
      expectedReleaseCommit: identity.liveRelease.commitSha,
      currentReleaseCommit: currentIdentity.liveRelease.commitSha,
    }, { status: "STALE" });
  } finally {
    run.close();
  }
}

function diagnosticDirectory(runId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(String(runId ?? ""))) {
    throw new Error("diagnostic_run_id_invalid");
  }
  const root = process.env.LOCALAPPDATA || join(process.env.USERPROFILE || "", ".cache");
  if (!root) throw new Error("local_diagnostic_directory_unavailable");
  return join(root, "MANU-AI", "diagnostics", "global-freeze", runId);
}

export function parseRemoteVitalsLines(text) {
  if (typeof text !== "string") throw new Error("host_vitals_output_invalid");
  const output = [];
  let previousEpochSeconds = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('{"schemaVersion":"aiya-host-vitals-v1"')) continue;
    let sample;
    try {
      sample = JSON.parse(line);
    } catch {
      throw new Error("host_vitals_json_invalid");
    }
    validateHostSample(sample);
    if (previousEpochSeconds !== null && sample.epochSeconds <= previousEpochSeconds) {
      throw new Error("host_vitals_time_order_invalid");
    }
    previousEpochSeconds = sample.epochSeconds;
    output.push({
      schemaVersion: sample.schemaVersion,
      utc: sample.utc,
      epochSeconds: sample.epochSeconds,
      vcpu: sample.vcpu,
      load1: sample.load1,
      cpuTicks: Object.fromEntries(["user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal"]
        .map((key) => [key, sample.cpuTicks[key]])),
      memory: Object.fromEntries(["totalKb", "availableKb", "swapTotalKb", "swapFreeKb"]
        .map((key) => [key, sample.memory[key]])),
      swap: { inPages: sample.swap.inPages, outPages: sample.swap.outPages },
      pressure: Object.fromEntries(["cpuSomeAvg10Percent", "memorySomeAvg10Percent", "ioSomeAvg10Percent"]
        .map((key) => [key, sample.pressure[key]])),
      application: Object.fromEntries([
        "processFound", "processAlive", "rssKb", "hwmKb", "cgroupMemoryCurrentBytes",
        "cgroupMemoryLimitBytes", "cgroupNrThrottled", "cgroupThrottledUsec",
        "cgroupMemoryHighEvents", "cgroupOomKillEvents",
      ].map((key) => [key, sample.application[key]])),
    });
  }
  return output;
}

export function validateInteractionObservation(value) {
  const allowed = {
    freeze: new Set(["observed", "not_observed"]),
    keyboard: new Set(["responsive", "unresponsive", "not_tested"]),
    navigation: new Set(["responsive", "unresponsive", "not_tested"]),
    reload: new Set(["responsive", "delayed", "not_tested"]),
  };
  if (!isRecord(value) || Object.entries(allowed).some(([key, values]) => !values.has(value[key]))) {
    throw new Error("interaction_observation_enum_invalid");
  }
  return Object.fromEntries(Object.keys(allowed).map((key) => [key, value[key]]));
}

function finiteOrNull(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function validateHostSample(sample) {
  const cpuFields = ["user", "nice", "system", "idle", "iowait", "irq", "softirq", "steal"];
  const numericValues = [
    sample?.load1,
    ...cpuFields.map((key) => sample?.cpuTicks?.[key]),
    sample?.memory?.totalKb,
    sample?.memory?.availableKb,
    sample?.memory?.swapTotalKb,
    sample?.memory?.swapFreeKb,
    sample?.swap?.inPages,
    sample?.swap?.outPages,
    sample?.pressure?.cpuSomeAvg10Percent,
    sample?.pressure?.memorySomeAvg10Percent,
    sample?.pressure?.ioSomeAvg10Percent,
    sample?.application?.rssKb,
    sample?.application?.hwmKb,
    sample?.application?.cgroupMemoryCurrentBytes,
    sample?.application?.cgroupMemoryLimitBytes,
    sample?.application?.cgroupNrThrottled,
    sample?.application?.cgroupThrottledUsec,
    sample?.application?.cgroupMemoryHighEvents,
    sample?.application?.cgroupOomKillEvents,
  ];
  if (sample?.schemaVersion !== "aiya-host-vitals-v1" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(sample.utc) ||
    !Number.isInteger(sample.epochSeconds) || !Number.isInteger(sample.vcpu) || sample.vcpu < 1 ||
    !isRecord(sample.cpuTicks) || !isRecord(sample.memory) || !isRecord(sample.swap) ||
    !isRecord(sample.pressure) || !isRecord(sample.application) ||
    !numericValues.every(finiteOrNull) ||
    typeof sample.application.processFound !== "boolean" ||
    typeof sample.application.processAlive !== "boolean") {
    throw new Error("host_vitals_schema_invalid");
  }
}

export function summarizeHostSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return { status: "NO_SAMPLES", sampleCount: 0, cpuPressurePeakAvg10: null, memoryPressurePeakAvg10: null, ioPressurePeakAvg10: null };
  }
  const pressure = (resource) => {
    const values = samples.map((sample) => sample.pressure?.[`${resource}SomeAvg10Percent`])
      .filter((value) => Number.isFinite(value));
    return values.length ? Number(Math.max(...values).toFixed(3)) : null;
  };
  const available = samples.map((sample) => sample.memory.availableKb).filter(Number.isFinite);
  const counterDelta = (counter) => {
    const first = samples.find((sample) => Number.isFinite(counter(sample)));
    const last = [...samples].reverse().find((sample) => Number.isFinite(counter(sample)));
    return first && last ? Math.max(0, counter(last) - counter(first)) : null;
  };
  const cpuSamples = samples.slice(1).flatMap((sample, index) => {
    const before = samples[index].cpuTicks;
    const after = sample.cpuTicks;
    const idleBefore = before.idle + before.iowait;
    const idleAfter = after.idle + after.iowait;
    const totalBefore = Object.values(before).reduce((sum, value) => sum + value, 0);
    const totalAfter = Object.values(after).reduce((sum, value) => sum + value, 0);
    const deltaTotal = totalAfter - totalBefore;
    const deltaIdle = idleAfter - idleBefore;
    return deltaTotal > 0 ? [{ at: sample.utc, busyPercent: Number(((deltaTotal - deltaIdle) / deltaTotal * 100).toFixed(2)) }] : [];
  });
  const loads = samples.map((sample) => sample.load1).filter(Number.isFinite);
  return {
    status: "SAMPLED",
    sampleCount: samples.length,
    sampleStartUtc: samples[0].utc ?? null,
    sampleEndUtc: samples.at(-1).utc ?? null,
    vcpu: Number.isInteger(samples[0].vcpu) ? samples[0].vcpu : null,
    load1Peak: loads.length ? Math.max(...loads) : null,
    hostCpuBusyPercentPeak: cpuSamples.length ? Math.max(...cpuSamples.map(({ busyPercent }) => busyPercent)) : null,
    hostCpuBusyPercentAverage: cpuSamples.length
      ? Number((cpuSamples.reduce((sum, item) => sum + item.busyPercent, 0) / cpuSamples.length).toFixed(2))
      : null,
    memoryAvailableKbMin: available.length ? Math.min(...available) : null,
    swapInPagesDelta: counterDelta((sample) => sample.swap.inPages),
    swapOutPagesDelta: counterDelta((sample) => sample.swap.outPages),
    appProcessFound: samples.some((sample) => sample.application.processFound === true),
    appProcessMissingCount: samples.filter((sample) => sample.application.processAlive === false).length,
    cgroupNrThrottledDelta: counterDelta((sample) => sample.application.cgroupNrThrottled),
    cgroupThrottledUsecDelta: counterDelta((sample) => sample.application.cgroupThrottledUsec),
    cgroupMemoryHighEventsDelta: counterDelta((sample) => sample.application.cgroupMemoryHighEvents),
    cgroupOomKillEventsDelta: counterDelta((sample) => sample.application.cgroupOomKillEvents),
    cpuPressurePeakAvg10: pressure("cpu"),
    memoryPressurePeakAvg10: pressure("memory"),
    ioPressurePeakAvg10: pressure("io"),
  };
}

async function startDiagnostic() {
  const liveRelease = await readLiveRelease();
  const identity = currentSourceIdentity(liveRelease);
  const existing = inspectPhaseRuns({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID });
  assertPhaseOneRunHistory(existing);
  const sameIdentityRuns = existing.filter((run) => {
    const checkpoint = readPhaseRun({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID, runId: run.runId });
    return JSON.stringify(checkpoint.manifest.identitySummary) === JSON.stringify(identity);
  });
  const attemptNumber = assertPhaseOneAttemptBudget(sameIdentityRuns);
  const opened = openPhaseRun({
    root: GLOBAL_FREEZE_CHECKPOINT_ROOT,
    phaseId: GLOBAL_FREEZE_PHASE_ID,
    phaseSchemaVersion: GLOBAL_FREEZE_SCHEMA_VERSION,
    identity,
    metadata: { identitySummary: identity },
    newRun: true,
  });
  if (opened.action !== "RUN" || !opened.run) throw new Error(`diagnostic_checkpoint_${opened.action.toLowerCase()}`);
  const run = opened.run;
  run.append("environment.preflight", {
    attemptNumber,
    maximumAttempts: GLOBAL_FREEZE_MAX_ATTEMPTS,
    requiredValidRecords: GLOBAL_FREEZE_REQUIRED_RECORDS,
    branch: identity.branch,
    head: identity.head,
    sourceFingerprint: identity.sourceFingerprint,
    sourceFiles: identity.sourceFiles,
    liveRelease: identity.liveRelease,
    hostAlias: GLOBAL_FREEZE_SSH_ALIAS,
    browserTracePolicy: "screenshots_off_resource_contents_off",
  }, { status: "RUNNING" });
  const runId = run.runId;
  run.close();
  return { runId, identity };
}

function remoteCaptureDuration(argv) {
  const value = argv[0] == null ? GLOBAL_FREEZE_DEFAULT_HOST_CAPTURE_SECONDS : Number(argv[0]);
  if (!Number.isInteger(value) || value < 30 || value > GLOBAL_FREEZE_HOST_CAPTURE_MAX_SECONDS) {
    throw new Error(`host_capture_duration_must_be_30_to_${GLOBAL_FREEZE_HOST_CAPTURE_MAX_SECONDS}_seconds`);
  }
  return value;
}

async function runHostCapture(runId, durationSeconds) {
  const stored = readPhaseRun({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID, runId });
  if (stored.manifest.status === "COMPLETE") throw new Error("diagnostic_checkpoint_already_complete");
  const identity = stored.manifest.identitySummary;
  if (identity?.phaseId !== GLOBAL_FREEZE_PHASE_ID || identity?.captureTargetOrigin !== "https://aiyaworkspace.com") {
    throw new Error("diagnostic_checkpoint_identity_invalid");
  }
  const liveRelease = await readLiveRelease();
  const currentIdentity = currentSourceIdentity(liveRelease);
  if (JSON.stringify(currentIdentity) !== JSON.stringify(identity)) {
    markRunStale(runId, identity, currentIdentity);
    throw new Error("diagnostic_capture_identity_changed");
  }
  let hostClockSync;
  try {
    hostClockSync = await syncRemoteHostClock();
  } catch (error) {
    const checkpoint = openCurrentRunForStoredIdentity(runId, identity);
    try {
      checkpoint.append("host.clock_sync.failed", {
        failureCode: safeFailureCode(error, "host_clock_sync_failed"),
        probe: isRecord(error?.clockSync) ? {
          probeCount: Number.isInteger(error.clockSync.probeCount) ? error.clockSync.probeCount : null,
          roundTripMs: Array.isArray(error.clockSync.roundTripMs)
            ? error.clockSync.roundTripMs.filter(Number.isFinite).slice(0, 3)
            : [],
          uncertaintyMs: Number.isFinite(error.clockSync.uncertaintyMs) ? error.clockSync.uncertaintyMs : null,
        } : null,
      }, { status: "INTERRUPTED" });
    } finally {
      checkpoint.close();
    }
    throw error;
  }
  const clockCheckpoint = openCurrentRunForStoredIdentity(runId, identity);
  try {
    clockCheckpoint.append("host.clock_sync.completed", hostClockSync, { status: "RUNNING" });
  } finally {
    clockCheckpoint.close();
  }
  const localDirectory = diagnosticDirectory(runId);
  mkdirSync(localDirectory, { recursive: true, mode: 0o700 });
  const outputPath = join(localDirectory, "host-vitals.jsonl");
  const descriptor = openSync(outputPath, "wx", 0o600);
  const ssh = spawn("ssh", [
    "-T",
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=yes",
    "-o", "ConnectTimeout=8",
    "-o", "ServerAliveInterval=15",
    "-o", "ServerAliveCountMax=3",
    GLOBAL_FREEZE_SSH_ALIAS,
    "bash", "-s", "--", String(durationSeconds),
  ], { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
  ssh.stdout.setEncoding("utf8");
  let pending = "";
  let sampleCount = 0;
  let sampleWriteError = null;
  ssh.stdout.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith('{"schemaVersion":"aiya-host-vitals-v1"')) continue;
      try {
        const [sample] = parseRemoteVitalsLines(line);
        if (!sample) continue;
        writeFileSync(descriptor, `${JSON.stringify(sample)}\n`, { encoding: "utf8" });
        if (sampleCount === 0) {
          process.stdout.write(`${JSON.stringify({ state: "host_capture_started", hostSampleUtc: sample.utc })}\n`);
        }
        sampleCount += 1;
      } catch (error) {
        sampleWriteError = error;
        ssh.kill();
      }
    }
  });
  ssh.stdin.end(GLOBAL_FREEZE_REMOTE_VITALS_SCRIPT + "\n");

  return new Promise((resolveCapture, rejectCapture) => {
    const timeout = setTimeout(() => ssh.kill(), (durationSeconds + 20) * 1_000);
    let settled = false;
    const finish = (code, signal, spawnError = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      pending = "";
      let summary;
      let artifactError = null;
      try {
        fsyncSync(descriptor);
        summary = summarizeHostSamples(parseRemoteVitalsLines(readFileSync(outputPath, "utf8")));
      } catch (error) {
        artifactError = error;
      } finally {
        closeSync(descriptor);
      }
      const complete = !spawnError && !sampleWriteError && !artifactError && code === 0 && sampleCount >= durationSeconds - 3;
      try {
        const checkpoint = openCurrentRunForStoredIdentity(runId, identity);
        try {
        checkpoint.append(complete ? "host.capture.completed" : "host.capture.incomplete", {
          sampleArtifact: "host-vitals.jsonl",
          sampleCount,
          durationSeconds,
          sshExitCode: Number.isInteger(code) ? code : null,
          sshSignal: typeof signal === "string" ? signal : null,
          failureCode: spawnError ? "ssh_spawn_failed" : sampleWriteError ? "sample_write_failed" : artifactError ? "sample_artifact_invalid" : null,
          summary: summary ?? summarizeHostSamples([]),
        }, { status: complete ? "RUNNING" : "INTERRUPTED" });
        } finally {
          checkpoint.close();
        }
      } catch (error) {
        return rejectCapture(error);
      }
      if (!complete) {
        return rejectCapture(spawnError ?? sampleWriteError ?? artifactError ?? new Error(`host_capture_incomplete:${code ?? signal ?? "unknown"}:${sampleCount}`));
      }
      resolveCapture({ outputPath, sampleCount, summary });
    };
    ssh.once("error", (error) => finish(null, null, error));
    ssh.once("close", (code, signal) => finish(code, signal));
    ssh.stdin.on("error", () => {});
  });
}

function openCurrentRunForStoredIdentity(runId, identity) {
  const opened = openPhaseRun({
    root: GLOBAL_FREEZE_CHECKPOINT_ROOT,
    phaseId: GLOBAL_FREEZE_PHASE_ID,
    phaseSchemaVersion: GLOBAL_FREEZE_SCHEMA_VERSION,
    identity,
    metadata: { identitySummary: identity },
    runId,
  });
  if (opened.action !== "RUN" || !opened.run) {
    throw new Error(`diagnostic_checkpoint_${opened.action.toLowerCase()}`);
  }
  return opened.run;
}

async function inspectTraceFile(tracePath, runId, clockAnchors) {
  const checkpoint = readPhaseRun({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID, runId });
  if (checkpoint.manifest.status === "COMPLETE") throw new Error("diagnostic_checkpoint_already_complete");
  if (!checkpoint.events.some((event) => event.type === "host.capture.completed")) {
    throw new Error("host_capture_not_complete");
  }
  const identity = checkpoint.manifest.identitySummary;
  const clockSyncEvent = checkpoint.events.filter((event) => event.type === "host.clock_sync.completed").at(-1);
  if (!clockSyncEvent) throw new Error("host_clock_sync_missing");
  const liveRelease = await readLiveRelease();
  const current = currentSourceIdentity(liveRelease);
  if (JSON.stringify(current) !== JSON.stringify(identity)) {
    markRunStale(runId, identity, current);
    throw new Error("diagnostic_capture_identity_changed");
  }

  let trace;
  let sourceSha256 = null;
  try {
    const stat = lstatSync(tracePath);
    if (stat.isFile() && !stat.isSymbolicLink() && stat.size > 0 &&
      stat.size <= GLOBAL_FREEZE_MAX_COMPRESSED_BYTES) {
      sourceSha256 = sha256(readFileSync(tracePath));
    }
    trace = readChromeTrace(tracePath, { runId });
  } catch (error) {
    const opened = openCurrentRunForStoredIdentity(runId, identity);
    try {
      opened.append("browser.trace.import.rejected", {
        sourceSha256,
        reasonCode: safeFailureCode(error, "trace_import_rejected"),
      }, { status: "INTERRUPTED" });
    } finally {
      opened.close();
    }
    throw error;
  }
  const hostPath = join(diagnosticDirectory(runId), "host-vitals.jsonl");
  const hostSamples = parseRemoteVitalsLines(readFileSync(hostPath, "utf8"));
  let alignment;
  try {
    alignment = correlateChromeTraceWithHost(trace, hostSamples, {
      ...clockAnchors,
      hostClockOffsetMs: clockSyncEvent.payload.offsetMs,
      hostClockUncertaintyMs: clockSyncEvent.payload.uncertaintyMs,
    });
  } catch (error) {
    const opened = openCurrentRunForStoredIdentity(runId, identity);
    try {
      opened.append("browser.trace.alignment.rejected", {
        sourceSha256,
        reasonCode: safeFailureCode(error, "trace_alignment_failed"),
      }, { status: "INTERRUPTED" });
    } finally {
      opened.close();
    }
    throw error;
  }
  const summary = { ...summarizeChromeTrace(trace), host: summarizeHostSamples(hostSamples), alignment };
  const outputDirectory = diagnosticDirectory(runId);
  mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
  const sanitizedPath = join(outputDirectory, "browser-trace.redacted.json");
  const sanitizedJson = `${JSON.stringify(trace)}\n`;
  writeFileSync(sanitizedPath, sanitizedJson, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const outputSha256 = sha256(Buffer.from(sanitizedJson));
  const opened = openCurrentRunForStoredIdentity(runId, identity);
  try {
    opened.append("browser.trace.sanitized", {
      sourceSha256,
      sanitizedSha256: outputSha256,
      sampleArtifact: "browser-trace.redacted.json",
      summary,
    }, { status: "RUNNING" });
  } finally {
    opened.close();
  }
  return { runId, artifact: "browser-trace.redacted.json", sanitizedSha256: outputSha256, summary };
}

async function recordInteractionObservation(runId, observationValue) {
  const observation = validateInteractionObservation(observationValue);
  const stored = readPhaseRun({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID, runId });
  if (stored.manifest.status === "COMPLETE") throw new Error("diagnostic_checkpoint_already_complete");
  if (stored.events.some((event) => event.type === "interaction.observation")) {
    throw new Error("interaction_observation_already_recorded");
  }
  if (!stored.events.some((event) => event.type === "host.capture.completed") ||
    !stored.events.some((event) => event.type === "browser.trace.sanitized")) {
    throw new Error("aligned_capture_not_complete");
  }
  const identity = stored.manifest.identitySummary;
  const liveRelease = await readLiveRelease();
  const current = currentSourceIdentity(liveRelease);
  if (JSON.stringify(current) !== JSON.stringify(identity)) {
    markRunStale(runId, identity, current);
    throw new Error("diagnostic_capture_identity_changed");
  }
  const outputDirectory = diagnosticDirectory(runId);
  const browserTracePath = join(outputDirectory, "browser-trace.redacted.json");
  const hostSamplesPath = join(outputDirectory, "host-vitals.jsonl");
  const browserTraceSha256 = sha256(readFileSync(browserTracePath));
  const hostSamplesSha256 = sha256(readFileSync(hostSamplesPath));
  const latestTraceEvent = stored.events.filter((event) => event.type === "browser.trace.sanitized").at(-1);
  if (latestTraceEvent?.payload?.sanitizedSha256 !== browserTraceSha256) {
    throw new Error("sanitized_trace_hash_mismatch");
  }
  const opened = openCurrentRunForStoredIdentity(runId, identity);
  try {
    opened.append("interaction.observation", {
      ...observation,
      browserTraceSha256,
      hostSamplesSha256,
      observedAtUtc: new Date().toISOString(),
  }, { status: "COMPLETE" });
  } finally {
    opened.close();
  }
  return { runId, status: "COMPLETE", interactionObservation: observation };
}

function readPhaseOneAttempts(identity) {
  const inspected = inspectPhaseRuns({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID });
  assertPhaseOneRunHistory(inspected);
  const sameIdentity = inspected.map((run) => ({ summary: run,
    checkpoint: readPhaseRun({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID, runId: run.runId }),
  })).filter(({ checkpoint }) => JSON.stringify(checkpoint.manifest.identitySummary) === JSON.stringify(identity));
  if (sameIdentity.length > GLOBAL_FREEZE_MAX_ATTEMPTS) throw new Error("phase1_attempt_limit_exceeded");
  return sameIdentity;
}

function buildPhaseOneAttempt({ summary: runSummary, checkpoint }, identity) {
  const events = checkpoint.events;
  const eventOf = (type) => events.filter((event) => event.type === type).at(-1) ?? null;
  const hostEvent = eventOf("host.capture.completed");
  const traceEvent = eventOf("browser.trace.sanitized");
  const observationEvent = eventOf("interaction.observation");
  const clockEvent = eventOf("host.clock_sync.completed");
  const directory = diagnosticDirectory(runSummary.runId);
  let hostBytes = null;
  let traceBytes = null;
  try {
    hostBytes = readFileSync(join(directory, "host-vitals.jsonl"));
  } catch {
    hostBytes = null;
  }
  try {
    traceBytes = readFileSync(join(directory, "browser-trace.redacted.json"));
  } catch {
    traceBytes = null;
  }
  const artifacts = summarizePhaseOneArtifacts({
    runId: runSummary.runId,
    hostBytes,
    traceBytes,
    traceEventPayload: traceEvent?.payload,
    observationEventPayload: observationEvent?.payload,
    expectedHostSampleCount: hostEvent?.payload?.sampleCount,
  });
  const { hostSamples, hostSamplesSha256, sanitizedTraceSha256, artifactIntegrity } = artifacts;
  const alignment = traceEvent?.payload?.summary?.alignment ?? null;
  const observation = observationEvent?.payload ?? null;
  const validity = [
    checkpoint.manifest.status === "COMPLETE",
    Boolean(hostEvent),
    Boolean(traceEvent),
    Boolean(observation),
    Boolean(clockEvent),
    artifactIntegrity,
    hostEvent?.payload?.sampleCount >= 147,
    alignment?.status === "ALIGNED",
    alignment?.traceDurationMs >= 80_000,
    alignment?.hostSamplesDuringTrace >= 80,
    clockEvent?.payload?.uncertaintyMs <= GLOBAL_FREEZE_HOST_CLOCK_MAX_UNCERTAINTY_MS,
  ].every(Boolean);
  const failureCodes = events
    .filter((event) => /\.incomplete$|\.rejected$|\.failed$/.test(event.type))
    .map((event) => ({ eventType: event.type, reasonCode: event.payload?.failureCode ?? event.payload?.reasonCode ?? null }));
  return {
    checkpointRunId: runSummary.runId,
    checkpointStatus: checkpoint.manifest.status,
    observationValidity: validity ? "VALID" : "INVALID",
    clockAlignment: alignment?.status ?? "UNAVAILABLE",
    alignedTraceDurationMs: alignment?.traceDurationMs ?? null,
    alignedHostSampleCount: alignment?.hostSamplesDuringTrace ?? null,
    hostClockUncertaintyMs: clockEvent?.payload?.uncertaintyMs ?? null,
    sourceFingerprint: identity.sourceFingerprint,
    liveRelease: identity.liveRelease,
    browserTraceSha256: traceEvent?.payload?.sourceSha256 ?? null,
    sanitizedTraceSha256,
    hostSamplesSha256,
    hostSampleCount: hostSamples.length,
    hostSummary: hostEvent?.payload?.summary ?? null,
    traceSummary: traceEvent?.payload?.summary ?? null,
    interactionObservation: observation ? {
      freeze: observation.freeze,
      keyboard: observation.keyboard,
      navigation: observation.navigation,
      reload: observation.reload,
    } : null,
    failureCodes,
  };
}

function summarizePriorIdentityFailures(identity) {
  const inspected = inspectPhaseRuns({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID });
  assertPhaseOneRunHistory(inspected);
  return inspected.flatMap((summary) => {
    const checkpoint = readPhaseRun({ root: GLOBAL_FREEZE_CHECKPOINT_ROOT, phaseId: GLOBAL_FREEZE_PHASE_ID, runId: summary.runId });
    if (JSON.stringify(checkpoint.manifest.identitySummary) === JSON.stringify(identity)) return [];
    const failures = checkpoint.events
      .filter((event) => /\.(?:incomplete|rejected|failed)$/.test(event.type))
      .map((event) => ({
        eventType: /^[a-z0-9_.-]{1,100}$/i.test(event.type) ? event.type : "unclassified.failure",
        reasonCode: /^[a-z0-9_.:-]{1,100}$/i.test(String(event.payload?.failureCode ?? event.payload?.reasonCode ?? ""))
          ? String(event.payload.failureCode ?? event.payload.reasonCode)
          : "unclassified_failure",
      }));
    if (checkpoint.events.some((event) => event.type === "host.capture.completed" &&
      event.payload?.summary?.appProcessFound === false)) {
      failures.push({ eventType: "host.capture.completed", reasonCode: "application_process_not_found" });
    }
    if (failures.length === 0) return [];
    return [{
      checkpointRunId: summary.runId,
      checkpointStatus: summary.status,
      sourceFingerprint: checkpoint.manifest.identitySummary?.sourceFingerprint ?? null,
      failureCodes: failures,
    }];
  });
}

async function finalizePhaseOne(blockedReason = null) {
  const identity = currentSourceIdentity(await readLiveRelease());
  const attempts = readPhaseOneAttempts(identity).map((attempt) => buildPhaseOneAttempt(attempt, identity));
  const validRecords = attempts.filter((attempt) => attempt.observationValidity === "VALID");
  if (validRecords.length !== GLOBAL_FREEZE_REQUIRED_RECORDS && !blockedReason) {
    throw new Error(`phase1_requires_exactly_${GLOBAL_FREEZE_REQUIRED_RECORDS}_valid_records_or_explicit_blocker:${validRecords.length}`);
  }
  if (blockedReason && validRecords.length === GLOBAL_FREEZE_REQUIRED_RECORDS) {
    throw new Error("phase1_blocker_not_allowed_after_valid_completion");
  }
  if (validRecords.length === GLOBAL_FREEZE_REQUIRED_RECORDS) {
    const phase1Pass = GLOBAL_FREEZE_PHASE_DEFINITION.stages[0].verify({ phase1: { records: validRecords } });
    if (!phase1Pass) throw new Error("phase1_descriptor_gate_failed");
  }
  const observedFreezeCount = validRecords.filter((record) => record.interactionObservation.freeze === "observed").length;
  const outcome = blockedReason ? `BLOCKED_${blockedReason.toUpperCase()}` : observedFreezeCount >= 2
    ? "FREEZE_REPRODUCED_IN_AT_LEAST_TWO_OF_THREE"
    : observedFreezeCount === 0
      ? "FREEZE_NOT_REPRODUCED_IN_THREE"
      : "SINGLE_FREEZE_OBSERVATION_REQUIRES_PHASE2_DECISION";
  const evidenceId = `aiya-global-freeze-phase-1-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID()}`;
  const evidence = {
    schemaVersion: "aiya-global-freeze-phase-1-evidence-v1",
    evidenceId,
    createdAtUtc: new Date().toISOString(),
    status: blockedReason ? "BLOCKED" : "COMPLETE",
    outcome,
    blockerReason: blockedReason,
    plan: "docs/AIYA_GLOBAL_FREEZE_ACTION_PLAN.md",
    identity,
    priorIdentityFailureAttempts: summarizePriorIdentityFailures(identity),
    attemptCount: attempts.length,
    validRecordCount: validRecords.length,
    observedFreezeCount,
    attempts,
    phase2Eligible: !blockedReason && validRecords.length === GLOBAL_FREEZE_REQUIRED_RECORDS && observedFreezeCount >= 2,
    plan1Status: "COMPLETE / DIAGNOSIS_BLOCKED",
    plan2EligibleFindings: 0,
    production: "NO-GO",
    rawTraceOrHostSamplesEmbedded: false,
  };
  const evidencePath = join(repoRoot(), "docs", `${evidenceId}_EVIDENCE.json`);
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  return { evidenceId, evidencePath, outcome, attemptCount: attempts.length, validRecordCount: validRecords.length };
}

export function parseArguments(argv) {
  if (argv[0] === "--check-host-script" && argv.length === 1) return { mode: "host-script-check" };
  if (argv[0] === "--inspect-native-trace" && argv.length === 2) {
    return { mode: "native-trace", tracePath: argv[1] };
  }
  if (argv[0] === "--inspect-native-profile" && argv.length === 2) {
    return { mode: "native-profile", tracePath: argv[1] };
  }
  if (argv[0] === "--finalize-phase1" && argv.length === 1) return { mode: "finalize-phase1", blockedReason: null };
  if (argv[0] === "--finalize-phase1" && argv.length === 3 && argv[1] === "--blocked") {
    return { mode: "finalize-phase1", blockedReason: validatePhaseOneBlockReason(argv[2]) };
  }
  if (argv[0] === "--start" && argv.length === 1) return { mode: "start" };
  if (argv[0] === "--capture-host" && argv.length >= 2 && argv.length <= 3) {
    return { mode: "host", runId: argv[1], durationSeconds: remoteCaptureDuration(argv.slice(2)) };
  }
  if (argv[0] === "--inspect-trace" && argv.length === 8 && argv[2] === "--run-id" &&
    argv[4] === "--start-epoch-ms" && argv[6] === "--end-epoch-ms") {
    const startEpochMs = Number(argv[5]);
    const endEpochMs = Number(argv[7]);
    if (!Number.isSafeInteger(startEpochMs) || !Number.isSafeInteger(endEpochMs)) {
      throw new Error("clock_anchor_epoch_invalid");
    }
    return { mode: "trace", tracePath: argv[1], runId: argv[3], clockAnchors: { startEpochMs, endEpochMs } };
  }
  if (argv[0] === "--record-observation" && argv.length === 10 &&
    argv[2] === "--freeze" && argv[4] === "--keyboard" &&
    argv[6] === "--navigation" && argv[8] === "--reload") {
    return {
      mode: "observation",
      runId: argv[1],
      observation: validateInteractionObservation({ freeze: argv[3], keyboard: argv[5], navigation: argv[7], reload: argv[9] }),
    };
  }
  throw new Error("usage: node performance-global-freeze-diagnostic.mjs --check-host-script | --inspect-native-trace <saved-trace-file> | --inspect-native-profile <saved-trace-file> | --start | --capture-host <run-id> [duration-seconds] | --inspect-trace <trace.json[.gz]> --run-id <run-id> --start-epoch-ms <number> --end-epoch-ms <number> | --record-observation <run-id> --freeze <observed|not_observed> --keyboard <responsive|unresponsive|not_tested> --navigation <responsive|unresponsive|not_tested> --reload <responsive|delayed|not_tested> | --finalize-phase1 [--blocked <authenticated_session_unavailable|host_access_blocked|browser_trace_harness_blocked|attempt_budget_exhausted>]");
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "finalize-phase1") {
    const result = await finalizePhaseOne(options.blockedReason);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (options.mode === "host-script-check") {
    checkRemoteHostScriptSyntax();
    process.stdout.write(`${JSON.stringify({ status: "PASS", check: "remote_bash_syntax", hostAlias: GLOBAL_FREEZE_SSH_ALIAS })}\n`);
    return;
  }
  if (options.mode === "native-trace") {
    const result = inspectNativeTraceFile(options.tracePath);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (options.mode === "native-profile") {
    const result = inspectNativeProfileFile(options.tracePath);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (options.mode === "start") {
    const started = await startDiagnostic();
    process.stdout.write(`${JSON.stringify({ runId: started.runId, liveRelease: started.identity.liveRelease, sourceFingerprint: started.identity.sourceFingerprint }, null, 2)}\n`);
    return;
  }
  if (options.mode === "host") {
    const captured = await runHostCapture(options.runId, options.durationSeconds);
    process.stdout.write(`${JSON.stringify({ runId: options.runId, sampleCount: captured.sampleCount, summary: captured.summary }, null, 2)}\n`);
    return;
  }
  if (options.mode === "observation") {
    const result = await recordInteractionObservation(options.runId, options.observation);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const result = await inspectTraceFile(options.tracePath, options.runId, options.clockAnchors);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    process.stderr.write(`${safeFailureCode(error, "diagnostic_failed")}\n`);
    process.exitCode = 1;
  });
}
