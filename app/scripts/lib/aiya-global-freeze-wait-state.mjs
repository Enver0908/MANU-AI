const INPUT_MARKERS = Object.freeze({
  observerReady: "aiya-wait-observer-ready",
  requested: "aiya-wait-input-requested",
  pressed: "aiya-wait-input-pressed",
  released: "aiya-wait-input-released",
  handled: "aiya-wait-input-handled",
});

export const GLOBAL_FREEZE_WAIT_STATE_MARKERS = Object.freeze({
  ...INPUT_MARKERS,
  heartbeat: "aiya-wait-heartbeat",
  loadingVisible: "aiya-wait-loading-visible",
  contentReady: "aiya-wait-content-ready",
  workComplete: "aiya-wait-work-complete",
});

export const GLOBAL_FREEZE_WAIT_CLASSES = Object.freeze([
  "input_not_delivered",
  "request_in_flight",
  "response_body_not_complete",
  "main_thread_busy",
  "visible_loading_after_work",
]);

const MAIN_THREAD_TASKS = new Set([
  "RunTask",
  "Task",
  "ThreadControllerImpl::RunTask",
  "ThreadPool_RunTask",
]);

function markerTimes(events, marker) {
  return events
    .filter((event) => event.waitStateMarker === marker && Number.isFinite(event.timestampMs))
    .map((event) => event.timestampMs)
    .sort((a, b) => a - b);
}

function median(values) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Number(((values[middle - 1] + values[middle]) / 2).toFixed(3))
    : values[middle];
}

function networkSummary(events) {
  const requests = new Map();
  for (const event of events) {
    const network = event.network;
    if (!network?.correlationId) continue;
    const request = requests.get(network.correlationId) ?? {
      correlationId: network.correlationId,
      route: network.route,
      method: null,
      status: null,
      requestStartMs: null,
      responseStartMs: null,
      finishMs: null,
      outcome: null,
    };
    request.method ??= network.method;
    request.status ??= network.status;
    if (event.name === "ResourceSendRequest") request.requestStartMs ??= event.timestampMs;
    if (event.name === "ResourceReceiveResponse") request.responseStartMs ??= event.timestampMs;
    if (event.name === "ResourceFinish") {
      request.finishMs ??= event.timestampMs;
      request.outcome ??= network.outcome ?? "finished";
    }
    requests.set(network.correlationId, request);
  }

  const items = [...requests.values()].sort((a, b) =>
    (a.requestStartMs ?? Infinity) - (b.requestStartMs ?? Infinity));
  for (const request of items) {
    if (request.outcome === "canceled") request.state = "CANCELED";
    else if (request.outcome === "failed") request.state = "FAILED";
    else if (request.finishMs !== null) request.state = "COMPLETE";
    else if (request.responseStartMs !== null) request.state = "RESPONSE_BODY_OPEN";
    else if (request.requestStartMs !== null) request.state = "WAITING_FOR_HEADERS";
    else request.state = "UNAVAILABLE";
  }
  return items;
}

export function summarizeWaitState(trace, {
  expectedInputCount = null,
  traceComplete = true,
  heartbeatGapThresholdMs = 150,
  longTaskThresholdMs = 50,
} = {}) {
  if (!trace || !Array.isArray(trace.events) || trace.metadata?.eventArgsRetained !== false) {
    throw new Error("wait_state_requires_sanitized_trace");
  }
  if (expectedInputCount !== null &&
    (!Number.isSafeInteger(expectedInputCount) || expectedInputCount < 0 || expectedInputCount > 1_000)) {
    throw new Error("wait_state_expected_input_count_invalid");
  }

  const events = trace.events;
  const times = Object.fromEntries(Object.entries(GLOBAL_FREEZE_WAIT_STATE_MARKERS)
    .map(([key, marker]) => [key, markerTimes(events, marker)]));
  const requested = times.requested;
  const pressed = times.pressed;
  const inputGapsMs = pressed.slice(1).map((time, index) => Number((time - pressed[index]).toFixed(3)));
  const requestToPressMs = requested.slice(0, Math.min(requested.length, pressed.length))
    .map((time, index) => Number((pressed[index] - time).toFixed(3)))
    .filter((duration) => duration >= 0);
  const inputTimingAvailable = times.observerReady.length > 0 &&
    requested.length > 0 && pressed.length > 0 && traceComplete;
  const inputDelivery = !inputTimingAvailable
    ? "UNAVAILABLE"
    : pressed.length < requested.length ||
      (expectedInputCount !== null && (requested.length < expectedInputCount || pressed.length < expectedInputCount))
      ? "NOT_OBSERVED"
      : "DELIVERED";

  const networkRequests = networkSummary(events);
  const inputWindowStartMs = requested[0] ?? null;
  const inputWindowEndMs = events.reduce((latest, event) =>
    Number.isFinite(event.timestampMs) ? Math.max(latest, event.timestampMs) : latest, -Infinity);
  const requestsDuringInput = inputWindowStartMs === null
    ? []
    : networkRequests.filter((request) => request.requestStartMs !== null &&
      request.requestStartMs >= inputWindowStartMs && request.requestStartMs <= inputWindowEndMs);
  const tasks = events.filter((event) => MAIN_THREAD_TASKS.has(event.name) &&
    event.thread === "CrRendererMain" && Number.isFinite(event.durationMs) &&
    inputWindowStartMs !== null && event.timestampMs >= inputWindowStartMs);
  const longTasks = tasks.filter((event) => event.durationMs >= longTaskThresholdMs);
  const heartbeatTimes = inputWindowStartMs === null
    ? []
    : times.heartbeat.filter((time) => time >= inputWindowStartMs);
  const heartbeatGapsMs = heartbeatTimes.slice(1)
    .map((time, index) => Number((time - heartbeatTimes[index]).toFixed(3)));
  const maxHeartbeatGapMs = heartbeatGapsMs.length > 0 ? Math.max(...heartbeatGapsMs) : null;
  const mainThreadStatus = longTasks.length > 0
    ? "BUSY"
    : heartbeatTimes.length >= 2 && traceComplete
      ? maxHeartbeatGapMs >= heartbeatGapThresholdMs ? "BUSY" : "RESPONSIVE"
      : "UNAVAILABLE";

  const loadingTimes = times.loadingVisible;
  const readyTimes = times.contentReady;
  const workCompleteTimes = times.workComplete;
  const visibleLoadingAfterWork = loadingTimes.length > 0 && workCompleteTimes.length > 0 &&
    loadingTimes.at(-1) >= workCompleteTimes.at(-1) &&
    (readyTimes.length === 0 || readyTimes.at(-1) < loadingTimes.at(-1));
  const waitClasses = [];
  if (traceComplete && inputDelivery === "NOT_OBSERVED") waitClasses.push("input_not_delivered");
  if (traceComplete && requestsDuringInput.some((request) => request.state === "WAITING_FOR_HEADERS")) {
    waitClasses.push("request_in_flight");
  }
  if (traceComplete && requestsDuringInput.some((request) => request.state === "RESPONSE_BODY_OPEN")) {
    waitClasses.push("response_body_not_complete");
  }
  if (mainThreadStatus === "BUSY") waitClasses.push("main_thread_busy");
  if (traceComplete && visibleLoadingAfterWork) waitClasses.push("visible_loading_after_work");

  const rscRequests = networkRequests.filter((request) => request.route === "<rsc>");
  return {
    schemaVersion: "aiya-global-freeze-wait-state-v1",
    traceComplete,
    input: {
      expectedCount: expectedInputCount,
      observerReady: times.observerReady.length > 0,
      requestedCount: requested.length,
      pressedCount: pressed.length,
      releasedCount: times.released.length,
      handledCount: times.handled.length,
      delivery: inputDelivery,
      timingAvailable: inputTimingAvailable,
      requestedToPressedMs: requestToPressMs,
      pressedGapsMs: inputGapsMs,
      medianPressedGapMs: median(inputGapsMs),
      minPressedGapMs: inputGapsMs.length ? Math.min(...inputGapsMs) : null,
      maxPressedGapMs: inputGapsMs.length ? Math.max(...inputGapsMs) : null,
    },
    visibleState: {
      loadingVisibleCount: loadingTimes.length,
      contentReadyCount: readyTimes.length,
      workCompleteCount: workCompleteTimes.length,
      loadingAfterWork: visibleLoadingAfterWork,
    },
    network: {
      requestCount: networkRequests.length,
      requests: networkRequests,
      rscRequestCount: rscRequests.length,
    },
    mainThread: {
      status: mainThreadStatus,
      taskCount: tasks.length,
      longTaskCount: longTasks.length,
      longestTaskMs: tasks.length ? Math.max(...tasks.map((event) => event.durationMs)) : null,
      heartbeatCount: heartbeatTimes.length,
      heartbeatGapThresholdMs,
      maxHeartbeatGapMs,
      heartbeatGapsOverThreshold: heartbeatGapsMs.filter((gap) => gap >= heartbeatGapThresholdMs).length,
    },
    unavailableSignals: [
      ...(requested.length === 0 || pressed.length === 0 ? ["input_timing"] : []),
      ...(networkRequests.length === 0 ? ["network_lifecycle"] : []),
      ...(mainThreadStatus === "UNAVAILABLE" ? ["main_thread_heartbeat"] : []),
      ...(loadingTimes.length === 0 && readyTimes.length === 0 ? ["visible_state"] : []),
      ...(!traceComplete ? ["trace_completion"] : []),
    ],
    waitClasses,
  };
}
