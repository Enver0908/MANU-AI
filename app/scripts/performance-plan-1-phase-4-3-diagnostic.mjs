#!/usr/bin/env node

/**
 * AIya Performance Plan 1 - Phase 4.3 general interaction diagnosis.
 *
 * This is a diagnostic harness, not the locked nine-scenario baseline. It
 * keeps normal and trace modes separate, sends the second action on a fixed
 * schedule, and records missing clicks as failures without retrying them.
 */

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import {
  inspectPhaseRuns,
  openPhaseRun,
} from "../../tools/phase-execution/checkpoint-store.mjs";
import {
  assertPhaseDefinition,
} from "../../tools/phase-execution/phase-runner.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");

export const PHASE_4_3_CHECKPOINT_PHASE_ID =
  "aiya-performance-plan1-phase4-diagnostic";
export const PHASE_4_3_CHECKPOINT_SCHEMA_VERSION =
  "aiya-performance-plan1-phase4-diagnostic-v3";
export const PHASE_4_3_CHECKPOINT_ROOT = join(
  repoRoot,
  ".manu-runtime",
  "phase-execution",
);
export const PHASE_4_3_SECOND_ACTION_DELAY_MS = 2_000;
export const PHASE_4_3_CLICK_TIMEOUT_MS = 20_000;
export const PHASE_4_3_READY_TIMEOUT_MS = 30_000;
export const PHASE_4_3_REQUEST_BODY_FINISH_TIMEOUT_MS = 15_000;
export const PHASE_4_3_PLAN_REVISION = "plan1-final-v3";
export const PHASE_4_3_REQUIRED_TIMING_FIELDS = Object.freeze([
  "plannedActionAtMs",
  "dispatchAtMs",
  "trustedEventAtMs",
  "routeCommittedAtMs",
  "requiredRequestStartAtMs",
  "responseHeaderAtMs",
  "responseBodyFinishedAtMs",
  "parseRenderCompletedAtMs",
  "readyStateAtMs",
  "secondActionAccepted",
]);

export const PHASE_4_3_MODES = Object.freeze({
  normal: Object.freeze({
    id: "normal",
    profiler: "off",
    browserObservers: "off",
    serverTiming: "off",
    serverEnvironmentPatch: Object.freeze({ AIYA_PERF_DIAGNOSTIC: "0" }),
  }),
  diagnostic: Object.freeze({
    id: "diagnostic",
    profiler: "on",
    browserObservers: "on",
    serverTiming: "on",
    serverEnvironmentPatch: Object.freeze({ AIYA_PERF_DIAGNOSTIC: "1" }),
  }),
});

export const PHASE_4_3_CONTROL_VARIANTS = Object.freeze({
  awaitActiveClientPreference: "await_active_client_preference",
  awaitInitialSummaryNavigation: "await_initial_summary_navigation",
});

export const PHASE_4_3_TRACE_VARIANTS = Object.freeze({
  preferenceIntentTimingAndCompletion: "preference_intent_timing_and_completion",
});

export const shellNavSelector = (href) =>
  [
    `[data-testid="shell-wide-nav"] a[href="${href}"]:visible`,
    `[data-testid="shell-medium-rail"] a[href="${href}"]:visible`,
    `[data-testid="shell-compact-bottom-nav"] a[href="${href}"]:visible`,
  ].join(", ");

const clientFormsSelector = '[data-testid="tab-tab_personal_form"]';
const clientNutritionSelector = '[data-testid="tab-tab_food_rules"]';

export const PHASE_4_3_JOURNEYS = Object.freeze([
  Object.freeze({
    journeyId: "J1",
    title: "client_workspace_forms_then_nutrition",
    autoRetryMissingClick: false,
    startRoute: "/dashboard",
    secondActionAnchor: Object.freeze({
      actionId: "first",
      stepLabel: "select_forms",
    }),
    firstAction: Object.freeze({
      actionId: "open_client_workspace_and_forms",
      steps: Object.freeze([
        Object.freeze({
          kind: "click",
          label: "select_clients",
          selector: shellNavSelector("/dashboard?section=clients"),
        }),
        Object.freeze({
          kind: "wait",
          label: "client_roster_ready",
          selector: '[data-testid="client-roster"]',
        }),
        Object.freeze({
          kind: "click",
          label: "open_first_client",
          selector: '[data-testid="client-roster-item"]',
        }),
        Object.freeze({
          kind: "wait",
          label: "client_workspace_ready",
          selector: '[data-testid="client-detail"], [data-testid="client-task-hub"]',
        }),
        Object.freeze({
          kind: "click",
          label: "select_forms",
          selector: clientFormsSelector,
        }),
      ]),
      readySelector: '[data-testid="client-form-panel"]',
    }),
    secondAction: Object.freeze({
      actionId: "select_nutrition",
      click: Object.freeze({
        kind: "click",
        label: "select_nutrition",
        selector: clientNutritionSelector,
      }),
      readySelector: '[data-testid="active-nutrition-plan-panel"]',
    }),
    expectedRoute: Object.freeze({
      pathname: "/dashboard",
      query: Object.freeze({
        section: "clients",
        clientId: "present",
        clientTask: "nutrition",
      }),
    }),
    requiredReads: Object.freeze([
      Object.freeze({ actionId: "first", pattern: "/api/clients/:clientId/forms" }),
      Object.freeze({
        actionId: "second",
        pattern: "/api/clients/:clientId/food-rule-profile",
      }),
    ]),
  }),
  Object.freeze({
    journeyId: "J2",
    title: "dashboard_clients_then_messages",
    autoRetryMissingClick: false,
    startRoute: "/dashboard",
    secondActionAnchor: Object.freeze({
      actionId: "first",
      stepLabel: "select_clients",
    }),
    firstAction: Object.freeze({
      actionId: "select_clients",
      steps: Object.freeze([
        Object.freeze({
          kind: "click",
          label: "select_clients",
          selector: shellNavSelector("/dashboard?section=clients"),
        }),
      ]),
      readySelector: '[data-testid="client-roster"]',
    }),
    secondAction: Object.freeze({
      actionId: "select_messages",
      click: Object.freeze({
        kind: "click",
        label: "select_messages",
        selector: shellNavSelector("/dashboard?section=messages"),
      }),
      readySelector: '[data-testid="messaging-panel"]',
    }),
    expectedRoute: Object.freeze({
      pathname: "/dashboard",
      query: Object.freeze({ section: "messages" }),
    }),
    // The inbox list is preloaded by the authenticated dashboard shell before
    // the Messages navigation action; the journey has no conversation-detail
    // click, so a detail read cannot be a required post-action boundary.
    requiredReads: Object.freeze([]),
  }),
  Object.freeze({
    journeyId: "J3",
    title: "dashboard_more_then_dashboard",
    autoRetryMissingClick: false,
    startRoute: "/dashboard",
    secondActionAnchor: Object.freeze({
      actionId: "first",
      stepLabel: "select_more",
    }),
    firstAction: Object.freeze({
      actionId: "select_more",
      steps: Object.freeze([
        Object.freeze({
          kind: "click",
          label: "select_more",
          selector: shellNavSelector("/dashboard/more"),
        }),
      ]),
      readySelector: '[data-testid="more-page"]',
    }),
    secondAction: Object.freeze({
      actionId: "return_to_dashboard",
      click: Object.freeze({
        kind: "click",
        label: "return_to_dashboard",
        selector: shellNavSelector("/dashboard"),
      }),
      readySelector: '[data-testid="overview-work-areas"]',
    }),
    expectedRoute: Object.freeze({
      pathname: "/dashboard",
      query: Object.freeze({}),
    }),
    requiredReads: Object.freeze([]),
  }),
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function phase43StageVerification(stageId) {
  if (stageId === "4.3.1") {
    const failures = [
      PHASE_4_3_JOURNEYS.length === 3 ? null : "journey_count_not_three",
      PHASE_4_3_REQUIRED_TIMING_FIELDS.length === 10
        ? null
        : "required_timing_field_count_invalid",
      PHASE_4_3_SECOND_ACTION_DELAY_MS === 2_000
        ? null
        : "second_action_delay_invalid",
    ].filter(Boolean);
    return { status: failures.length ? "FAIL" : "PASS", failures };
  }
  if (stageId === "4.3.2") {
    const normal = PHASE_4_3_MODES.normal;
    const diagnostic = PHASE_4_3_MODES.diagnostic;
    const failures = [
      normal.profiler === "off" ? null : "normal_profiler_not_off",
      diagnostic.profiler === "on" ? null : "diagnostic_profiler_not_on",
      normal.serverTiming === "off" ? null : "normal_server_timing_not_off",
      diagnostic.serverTiming === "on" ? null : "diagnostic_server_timing_not_on",
      normal.browserObservers === "off"
        ? null
        : "normal_browser_observers_not_off",
      diagnostic.browserObservers === "on"
        ? null
        : "diagnostic_browser_observers_not_on",
    ].filter(Boolean);
    return { status: failures.length ? "FAIL" : "PASS", failures };
  }
  if (stageId === "4.3.3") {
    const failures = [];
    for (const journey of PHASE_4_3_JOURNEYS) {
      if (journey.secondAction == null) failures.push(`${journey.journeyId}:second_action_missing`);
      if (journey.firstAction?.steps?.some((step) => step.kind === "click" && !step.selector)) {
        failures.push(`${journey.journeyId}:first_click_selector_missing`);
      }
      if (!journey.secondAction?.click?.selector) {
        failures.push(`${journey.journeyId}:second_click_selector_missing`);
      }
      if ((journey.autoRetryMissingClick ?? false) !== false) {
        failures.push(`${journey.journeyId}:retry_policy_missing`);
      }
    }
    return { status: failures.length ? "FAIL" : "PASS", failures };
  }
  return { status: "FAIL", failures: ["unknown_stage"] };
}

export const PHASE_4_3_PHASE_DEFINITION = deepFreeze({
  phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
  phaseSchemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
  stages: [
    {
      stageId: "4.3.1",
      prerequisites: [],
      verify: () => phase43StageVerification("4.3.1"),
    },
    {
      stageId: "4.3.2",
      prerequisites: ["4.3.1"],
      verify: () => phase43StageVerification("4.3.2"),
    },
    {
      stageId: "4.3.3",
      prerequisites: ["4.3.2"],
      verify: () => phase43StageVerification("4.3.3"),
    },
  ],
});

assertPhaseDefinition(PHASE_4_3_PHASE_DEFINITION);

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function roundMs(value) {
  const numeric = finiteNumber(value);
  return numeric == null ? null : Math.max(0, Math.round(numeric * 100) / 100);
}

function actionTiming(actionId) {
  return {
    actionId,
    plannedActionAtMs: null,
    dispatchAtMs: null,
    trustedEventAtMs: null,
    routeCommittedAtMs: null,
    requiredRequestStartAtMs: null,
    responseHeaderAtMs: null,
    responseBodyFinishedAtMs: null,
    parseRenderCompletedAtMs: null,
    readyStateAtMs: null,
    secondActionAccepted: null,
    clickAttemptCount: 0,
    failureClass: null,
    requiredRequestTimings: [],
    functionalOutcome: "INCOMPLETE",
    targetReadyStatus: "NOT_OBSERVED",
    targetUnmounted: null,
  };
}

export function createDiagnosticTrace({
  journeyId,
  mode = "diagnostic",
  secondActionDelayMs = PHASE_4_3_SECOND_ACTION_DELAY_MS,
  startedAtWallMs = Date.now(),
  controlVariant = null,
  traceVariant = null,
} = {}) {
  if (!PHASE_4_3_MODES[mode]) throw new Error("phase43_mode_invalid");
  if (
    traceVariant != null &&
    !Object.values(PHASE_4_3_TRACE_VARIANTS).includes(traceVariant)
  ) {
    throw new Error("phase43_trace_variant_invalid");
  }
  return {
    schemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
    journeyId: String(journeyId ?? ""),
    mode,
    secondActionDelayMs,
    autoRetryMissingClick: false,
    controlVariant: controlVariant == null ? null : String(controlVariant),
    traceVariant: traceVariant == null ? null : String(traceVariant),
    startedAtWallMs,
    actions: {
      first: actionTiming("first"),
      second: actionTiming("second"),
    },
    secondActionAnchor: {
      status: "PENDING",
      actionId: "first",
      stepLabel: null,
      trustedEventAtMs: null,
    },
    functionalOutcome: "INCOMPLETE",
    observationValidity: "UNKNOWN",
    performanceOutcome: "NOT_EVALUABLE",
    timing: null,
    events: [],
    requiredRequests: [],
    failures: [],
    browserObservers: PHASE_4_3_MODES[mode].browserObservers,
    status: "RUNNING",
  };
}

function traceAt(trace) {
  return roundMs(Date.now() - trace.startedAtWallMs);
}

function eventTypeForField(field) {
  return {
    plannedActionAtMs: "action.planned",
    dispatchAtMs: "action.dispatch",
    trustedEventAtMs: "trusted.event",
    routeCommittedAtMs: "route.committed",
    requiredRequestStartAtMs: "required.request.start",
    responseHeaderAtMs: "required.response.header",
    responseBodyFinishedAtMs: "required.response.body.finished",
    parseRenderCompletedAtMs: "parse.render.completed",
    readyStateAtMs: "ready.state",
    secondActionAccepted: "second.action.accepted",
  }[field] ?? "timing.field";
}

export function recordDiagnosticTiming(
  trace,
  actionId,
  field,
  value,
  details = {},
) {
  const action = trace?.actions?.[actionId];
  if (!action || !PHASE_4_3_REQUIRED_TIMING_FIELDS.includes(field)) {
    throw new Error("phase43_timing_field_invalid");
  }
  const normalized = field === "secondActionAccepted" ? Boolean(value) : roundMs(value);
  if (field !== "secondActionAccepted" && normalized == null) {
    throw new Error("phase43_timing_value_invalid");
  }
  if (action[field] != null) return action[field];
  action[field] = normalized;
  if (actionId === "second") trace.timing = action;
  trace.events.push({
    type: eventTypeForField(field),
    actionId,
    atMs: field === "secondActionAccepted" ? traceAt(trace) : normalized,
    ...sanitizeDiagnosticEvidence(details),
  });
  return normalized;
}

export function addDiagnosticFailure(trace, actionId, failureClass, details = {}) {
  const failure = {
    actionId,
    failureClass: String(failureClass || "unknown").slice(0, 120),
    ...sanitizeDiagnosticEvidence(details),
  };
  trace.failures.push(failure);
  if (trace.actions?.[actionId]) trace.actions[actionId].failureClass = failure.failureClass;
  return failure;
}

export function validateDiagnosticTrace(trace) {
  const failures = [];
  const completeness = [];
  if (!trace || trace.schemaVersion !== PHASE_4_3_CHECKPOINT_SCHEMA_VERSION) {
    failures.push("trace_schema_mismatch");
  }
  if (!PHASE_4_3_MODES[trace?.mode]) failures.push("trace_mode_invalid");
  if (trace?.autoRetryMissingClick !== false) failures.push("missing_click_retry_enabled");
  if (trace?.secondActionDelayMs !== PHASE_4_3_SECOND_ACTION_DELAY_MS) {
    failures.push("fixed_second_action_delay_invalid");
  }
  const first = trace?.actions?.first;
  const second = trace?.actions?.second;
  const anchor = trace?.secondActionAnchor;
  const anchorResolved = anchor?.status === "RESOLVED";
  const anchorUnavailable = anchor?.status === "UNAVAILABLE";
  if (!anchorResolved && !anchorUnavailable) failures.push("second_action_anchor_missing");
  if (anchorResolved && anchor.trustedEventAtMs == null) {
    failures.push("second_action_anchor_time_missing");
  }
  if (anchorUnavailable && !(first?.functionalOutcome === "FAILURE" && first?.failureClass)) {
    failures.push("second_action_anchor_unavailable_without_first_failure");
  }
  if (!second) {
    failures.push("second_action_timing_missing");
  } else {
    if (anchorResolved) {
      const expectedPlannedAtMs = roundMs(
        anchor.trustedEventAtMs + PHASE_4_3_SECOND_ACTION_DELAY_MS,
      );
      if (second.plannedActionAtMs !== expectedPlannedAtMs) {
        failures.push("second_action_planned_time_invalid");
      }
    } else if (second.plannedActionAtMs != null) {
      failures.push("second_action_planned_time_present_without_anchor");
    }
    if (typeof second.secondActionAccepted !== "boolean") {
      failures.push("second_action_acceptance_missing");
    }
    const orderedPairs = [
      ["plannedActionAtMs", "dispatchAtMs"],
      ["dispatchAtMs", "trustedEventAtMs"],
      ["requiredRequestStartAtMs", "responseHeaderAtMs"],
      ["responseHeaderAtMs", "responseBodyFinishedAtMs"],
    ];
    for (const [earlier, later] of orderedPairs) {
      if (second[earlier] != null && second[later] != null && second[later] < second[earlier]) {
        failures.push(`timing_order_invalid:${earlier}:${later}`);
      }
    }
    for (const field of ["routeCommittedAtMs", "parseRenderCompletedAtMs", "readyStateAtMs"]) {
      if (second[field] != null && second.dispatchAtMs != null && second[field] < second.dispatchAtMs) {
        failures.push(`timing_before_dispatch:${field}`);
      }
    }
    if (second.clickAttemptCount > 1) failures.push("second_action_click_retried");
    if (anchorResolved) {
      for (const field of PHASE_4_3_REQUIRED_TIMING_FIELDS) {
        if (second[field] == null) completeness.push(field);
      }
    } else if (!(anchorUnavailable && first?.functionalOutcome === "FAILURE" && first?.failureClass)) {
      completeness.push(
        "plannedActionAtMs",
        "dispatchAtMs",
        "trustedEventAtMs",
        "routeCommittedAtMs",
        "requiredRequestStartAtMs",
        "responseHeaderAtMs",
        "responseBodyFinishedAtMs",
        "parseRenderCompletedAtMs",
        "readyStateAtMs",
      );
    }
  }
  if (!Array.isArray(trace?.events)) failures.push("trace_events_missing");
  if (!Array.isArray(trace?.requiredRequests)) failures.push("required_request_records_missing");
  return {
    status: failures.length ? "FAIL" : "PASS",
    failures,
    completenessStatus: completeness.length ? "INCOMPLETE" : "COMPLETE",
    missingTimingFields: completeness,
  };
}

function redactKey(key) {
  return /(?:password|token|secret|authorization|cookie|email|phone|prompt|body|payload|clinical|credential|private.?key|api.?key)/i.test(
    String(key),
  );
}

export function sanitizeRoute(value) {
  try {
    const parsed = new URL(String(value), "http://phase43.local");
    const params = new URLSearchParams();
    for (const key of ["section", "clientTask"]) {
      const current = parsed.searchParams.get(key);
      if (current) params.set(key, current);
    }
    for (const key of ["clientId", "conversationId", "messageId", "sourceId"]) {
      if (parsed.searchParams.has(key)) params.set(key, "<present>");
    }
    const query = params.toString();
    return query ? `${parsed.pathname}?${query}` : parsed.pathname;
  } catch {
    return "<invalid-route>";
  }
}

function sanitizeString(value, key) {
  if (redactKey(key)) return "<redacted>";
  const stringValue = String(value);
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(stringValue)) {
    return "<redacted-email>";
  }
  if (/^https?:\/\//i.test(stringValue) || /^\//.test(stringValue)) {
    return sanitizeRoute(stringValue);
  }
  return stringValue.length > 300 ? `${stringValue.slice(0, 300)}<truncated>` : stringValue;
}

export function sanitizeDiagnosticEvidence(value, key = "") {
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return sanitizeString(value, key);
  if (Array.isArray(value)) return value.map((item) => sanitizeDiagnosticEvidence(item, key));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactKey(childKey)
          ? "<redacted>"
          : sanitizeDiagnosticEvidence(childValue, childKey),
      ]),
    );
  }
  return "<unsupported>";
}

export function routeMatchesExpectedRoute(value, expectedRoute) {
  try {
    const parsed = new URL(String(value), "http://phase43.local");
    if (parsed.pathname !== expectedRoute?.pathname) return false;
    for (const [key, expected] of Object.entries(expectedRoute?.query ?? {})) {
      const present = parsed.searchParams.has(key);
      if (expected === "present" && !present) return false;
      if (expected === "absent" && present) return false;
      if (expected !== "present" && expected !== "absent" && parsed.searchParams.get(key) !== expected) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function phase43CheckpointIdentity({
  sourceHead = "unbound",
  sourceVariant = "current",
  referenceSnapshotId = "phase4-2-reference-unbound",
} = {}) {
  return {
    planRevision: PHASE_4_3_PLAN_REVISION,
    phase: "4.3",
    checkpointPhaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
    checkpointSchemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
    sourceHead: String(sourceHead),
    sourceVariant: String(sourceVariant),
    referenceSnapshotId: String(referenceSnapshotId),
  };
}

function browserInstrumentationSource(enableObservers) {
  return ({ enableObservers });
}

async function installBrowserInstrumentation(page, mode) {
  await page.addInitScript(({ enableObservers }) => {
    const route = () => `${window.location.pathname}${window.location.search}`;
    const state = (window.__aiyaPhase43 = window.__aiyaPhase43 || {
      trustedEvents: [],
      routeEvents: [],
      perf: { longTaskCount: 0, lcpAtMs: null, cls: 0 },
    });
    const recordRoute = (source) => {
      state.routeEvents.push({ atWallMs: Date.now(), route: route(), source });
    };
    for (const method of ["pushState", "replaceState"]) {
      const original = window.history[method];
      window.history[method] = function phase43HistoryProxy(...args) {
        const result = original.apply(this, args);
        recordRoute(method);
        return result;
      };
    }
    window.addEventListener("popstate", () => recordRoute("popstate"));
    document.addEventListener(
      "click",
      (event) => {
        if (!event.isTrusted) return;
        const target = event.target instanceof Element
          ? event.target.closest("[data-testid],a[href]")
          : null;
        state.trustedEvents.push({
          atWallMs: Date.now(),
          testId: target?.getAttribute("data-testid") ?? null,
          href: target?.getAttribute("href") ?? null,
        });
      },
      true,
    );
    if (enableObservers && typeof PerformanceObserver !== "undefined") {
      try {
        new PerformanceObserver((list) => {
          state.perf.longTaskCount += list.getEntries().length;
        }).observe({ type: "longtask", buffered: true });
      } catch {
        state.perf.longTaskObserverUnavailable = true;
      }
      try {
        new PerformanceObserver((list) => {
          const last = list.getEntries().at(-1);
          state.perf.lcpAtMs = last?.startTime ?? null;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        state.perf.lcpObserverUnavailable = true;
      }
      try {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) state.perf.cls += entry.value || 0;
        }).observe({ type: "layout-shift", buffered: true });
      } catch {
        state.perf.clsObserverUnavailable = true;
      }
    }
  }, browserInstrumentationSource(mode.browserObservers === "on"));
}

async function resetBrowserSignals(page) {
  await page.evaluate(() => {
    const state = window.__aiyaPhase43;
    if (!state) return;
    state.trustedEvents = [];
    state.routeEvents = [];
    state.perf = { ...state.perf, longTaskCount: 0, lcpAtMs: null, cls: 0 };
  });
}

function browserElapsed(trace, wallAtMs) {
  return roundMs(Number(wallAtMs) - Number(trace.startedAtWallMs));
}

async function collectBrowserSignals(page, trace, actionId, { trustedAfterAtMs = null } = {}) {
  const signalState = await page.evaluate(() => window.__aiyaPhase43 ?? null);
  if (!signalState) return { trustedEventAtMs: null, routeCommittedAtMs: null };
  const action = trace.actions[actionId];
  const trustedEvents = signalState.trustedEvents ?? [];
  const routeEvents = signalState.routeEvents ?? [];
  const trustedFloor = trustedAfterAtMs ?? action.dispatchAtMs ?? action.plannedActionAtMs ?? 0;
  const relevantTrusted = trustedEvents
    .filter((event) => browserElapsed(trace, event.atWallMs) >= trustedFloor)
    .at(-1);
  const trustedEventAtMs = relevantTrusted
    ? browserElapsed(trace, relevantTrusted.atWallMs)
    : null;
  if (relevantTrusted && action.trustedEventAtMs == null) {
    recordDiagnosticTiming(trace, actionId, "trustedEventAtMs", trustedEventAtMs, {
      targetTestId: relevantTrusted.testId,
      route: relevantTrusted.href,
    });
  }
  const relevantRoutes = routeEvents
    .filter((event) =>
      browserElapsed(trace, event.atWallMs) >=
      (trustedEventAtMs ?? action.trustedEventAtMs ?? action.dispatchAtMs ?? action.plannedActionAtMs ?? 0),
    )
    .at(0);
  const routeCommittedAtMs = relevantRoutes
    ? browserElapsed(trace, relevantRoutes.atWallMs)
    : null;
  if (relevantRoutes && action.routeCommittedAtMs == null) {
    recordDiagnosticTiming(trace, actionId, "routeCommittedAtMs", routeCommittedAtMs, {
      route: relevantRoutes.route,
      source: relevantRoutes.source,
    });
  }
  return { trustedEventAtMs, routeCommittedAtMs };
}

function classifyClickError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("timeout") || message.includes("not found") || message.includes("locator")) {
    return "missing_click_or_not_ready";
  }
  return "click_dispatch_failed";
}

async function waitForReady(page, selector) {
  await page.locator(selector).first().waitFor({
    state: "visible",
    timeout: PHASE_4_3_READY_TIMEOUT_MS,
  });
}

async function waitForReadyOrAbandoned(page, readySelector, abandonedSelector) {
  const startedAt = Date.now();
  const ready = page.locator(readySelector).first();
  const abandoned = page.locator(abandonedSelector).first();
  while (Date.now() - startedAt < PHASE_4_3_READY_TIMEOUT_MS) {
    if (await ready.isVisible().catch(() => false)) {
      return { status: "READY", targetMounted: true };
    }
    if (await abandoned.isVisible().catch(() => false)) {
      return {
        status: "ABANDONED",
        targetMounted: (await ready.count().catch(() => 0)) > 0,
      };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error("phase43_ready_or_abandoned_timeout");
}

async function markParseRenderComplete(page, trace, actionId) {
  await page.evaluate(
    () =>
      new Promise((resolvePromise) => {
        requestAnimationFrame(() => requestAnimationFrame(resolvePromise));
      }),
  );
  recordDiagnosticTiming(trace, actionId, "parseRenderCompletedAtMs", traceAt(trace));
}

async function executeClickStep(page, trace, actionId, step) {
  const action = trace.actions[actionId];
  action.clickAttemptCount += 1;
  if (actionId === "second" && action.clickAttemptCount > 1) {
    throw new Error("phase43_second_click_retry_forbidden");
  }
  const clickDispatchAtMs = traceAt(trace);
  if (action.dispatchAtMs == null) {
    recordDiagnosticTiming(trace, actionId, "dispatchAtMs", traceAt(trace), {
      label: step.label,
    });
  }
  try {
    await page.locator(step.selector).first().click({ timeout: PHASE_4_3_CLICK_TIMEOUT_MS });
    return { dispatchAtMs: clickDispatchAtMs };
  } catch (error) {
    addDiagnosticFailure(trace, actionId, classifyClickError(error), { label: step.label });
    throw error;
  }
}

function isInitialSummaryNavigationRequest(request) {
  try {
    const url = new URL(request.url());
    return (
      url.pathname === "/dashboard" &&
      url.searchParams.get("section") === "clients" &&
      url.searchParams.has("clientId") &&
      !url.searchParams.has("clientTask") &&
      ["document", "fetch"].includes(request.resourceType())
    );
  } catch {
    return false;
  }
}

function createInitialSummaryNavigationControl(page, trace, controlVariant) {
  const state = {
    variant: controlVariant,
    status: "NOT_STARTED",
    armedAtMs: null,
    requestStartedAtMs: null,
    responseStatus: null,
    responseBodyFinishedAtMs: null,
    settledAtMs: null,
    settlementKind: null,
  };
  let armed = false;
  let targetRequest = null;
  let settled = false;
  let resolveSettlement;
  const settlementPromise = new Promise((resolvePromise) => {
    resolveSettlement = resolvePromise;
  });
  const settle = (settlementKind, responseStatus = null) => {
    if (settled) return;
    settled = true;
    state.settlementKind = settlementKind;
    state.responseStatus = responseStatus;
    state.settledAtMs = traceAt(trace);
    resolveSettlement({ settlementKind, responseStatus });
  };
  const onRequest = (request) => {
    if (!armed || targetRequest || !isInitialSummaryNavigationRequest(request)) return;
    targetRequest = request;
    state.status = "REQUEST_OBSERVED";
    state.requestStartedAtMs = traceAt(trace);
  };
  const onResponse = (response) => {
    if (!targetRequest || response.request() !== targetRequest) return;
    const responseStatus = response.status();
    state.responseStatus = responseStatus;
    Promise.resolve(response.finished())
      .then((finishedError) => {
        if (finishedError) {
          settle("response_body_failed", responseStatus);
          return;
        }
        state.responseBodyFinishedAtMs = traceAt(trace);
        settle("response_body_finished", responseStatus);
      })
      .catch(() => settle("response_body_failed", responseStatus));
  };
  const onRequestFailed = (request) => {
    if (!targetRequest || request !== targetRequest) return;
    settle("request_failed");
  };
  const arm = () => {
    if (armed) return;
    armed = true;
    state.status = "ARMED";
    state.armedAtMs = traceAt(trace);
    page.on("request", onRequest);
    page.on("response", onResponse);
    page.on("requestfailed", onRequestFailed);
  };
  return {
    arm,
    async beforeStep(step) {
      if (step.label === "open_first_client") {
        arm();
        return;
      }
      if (step.label !== "select_forms") return;
      if (!armed) {
        addDiagnosticFailure(trace, "first", "control_precondition_failed", {
          controlVariant,
          reason: "summary_navigation_control_not_armed",
        });
        throw new Error("phase43_initial_summary_control_not_armed");
      }
      state.status = "WAITING_FOR_SETTLEMENT";
      let timeoutHandle;
      const timeout = new Promise((resolvePromise) => {
        timeoutHandle = setTimeout(() => resolvePromise(null), PHASE_4_3_READY_TIMEOUT_MS);
      });
      const result = await Promise.race([settlementPromise, timeout]);
      clearTimeout(timeoutHandle);
      if (!result) {
        state.status = "FAILED";
        addDiagnosticFailure(trace, "first", "control_precondition_failed", {
          controlVariant,
          reason: "initial_summary_navigation_not_settled",
        });
        throw new Error("phase43_initial_summary_navigation_not_settled");
      }
      state.status = "PASSED";
      trace.events.push({
        type: "control.initial_summary_navigation_settled",
        atMs: state.settledAtMs,
        controlVariant,
        settlementKind: state.settlementKind,
        responseStatus: state.responseStatus,
      });
    },
    snapshot() {
      return { ...state };
    },
    dispose() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

function createFirstActionControl(page, trace, controlVariant) {
  if (controlVariant == null) return null;
  if (controlVariant === PHASE_4_3_CONTROL_VARIANTS.awaitInitialSummaryNavigation) {
    return createInitialSummaryNavigationControl(page, trace, controlVariant);
  }
  if (controlVariant !== PHASE_4_3_CONTROL_VARIANTS.awaitActiveClientPreference) {
    throw new Error("phase43_control_variant_invalid");
  }
  const state = {
    variant: controlVariant,
    status: "NOT_STARTED",
    armedAtMs: null,
    completedAtMs: null,
    responseStatus: null,
    responseBodyFinishedAtMs: null,
    settledAtMs: null,
  };
  let preferenceResponsePromise = null;
  let armed = false;
  const arm = () => {
      if (armed) return;
      armed = true;
      state.status = "ARMED";
      state.armedAtMs = traceAt(trace);
      preferenceResponsePromise = page
        .waitForResponse(
          (response) => {
            try {
              const url = new URL(response.url());
              if (
                url.pathname !== "/api/shell/preferences" ||
                response.request().method() !== "PATCH"
              ) {
                return false;
              }
              const body = response.request().postDataJSON();
              return Boolean(body && typeof body === "object" && "activeClientId" in body);
            } catch {
              return false;
            }
          },
          { timeout: PHASE_4_3_READY_TIMEOUT_MS },
        )
        .catch(() => null);
    };
  return {
    arm,
    async beforeStep(step) {
      if (step.label === "open_first_client") {
        arm();
        return;
      }
      if (step.label !== "select_forms") return;
      state.status = "WAITING_FOR_RESPONSE";
      const response = await preferenceResponsePromise;
      state.responseStatus = response?.status() ?? null;
      if (!response || !response.ok()) {
        state.status = "FAILED";
        addDiagnosticFailure(trace, "first", "control_precondition_failed", {
          controlVariant,
          responseObserved: Boolean(response),
        });
        throw new Error("phase43_active_client_preference_not_observed");
      }
      const responseFinishedError = await response.finished().catch(() => "response_finished_failed");
      if (responseFinishedError) {
        state.status = "FAILED";
        addDiagnosticFailure(trace, "first", "control_response_body_failed", {
          controlVariant,
        });
        throw new Error("phase43_active_client_preference_body_failed");
      }
      state.responseBodyFinishedAtMs = traceAt(trace);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
      state.status = "PASSED";
      state.completedAtMs = traceAt(trace);
      state.settledAtMs = state.completedAtMs;
      trace.events.push({
        type: "control.precondition.completed",
        atMs: state.completedAtMs,
        controlVariant,
        responseStatus: state.responseStatus,
      });
    },
    snapshot() {
      return { ...state };
    },
  };
}

async function executeFirstAction(page, trace, journey, { onSecondActionAnchor, beforeStep } = {}) {
  recordDiagnosticTiming(trace, "first", "plannedActionAtMs", 0, {
    action: journey.firstAction.actionId,
  });
  try {
    for (const step of journey.firstAction.steps) {
      if (step.kind === "click") {
        await beforeStep?.(step);
        const clickEvidence = await executeClickStep(page, trace, "first", step);
        const signals = await collectBrowserSignals(page, trace, "first", {
          trustedAfterAtMs: clickEvidence.dispatchAtMs,
        });
        if (step.label === journey.secondActionAnchor?.stepLabel) {
          const trustedEventAtMs = signals.trustedEventAtMs;
          if (trustedEventAtMs == null) {
            trace.secondActionAnchor = {
              status: "UNAVAILABLE",
              actionId: "first",
              stepLabel: step.label,
              trustedEventAtMs: null,
            };
            onSecondActionAnchor?.(null);
            addDiagnosticFailure(trace, "first", "trusted_click_not_observed", {
              label: step.label,
            });
            throw new Error("phase43_trusted_click_not_observed");
          }
          trace.secondActionAnchor = {
            status: "RESOLVED",
            actionId: "first",
            stepLabel: step.label,
            trustedEventAtMs,
          };
          onSecondActionAnchor?.({
            actionId: "first",
            stepLabel: step.label,
            trustedEventAtMs,
          });
        }
      } else if (step.kind === "wait") {
        await waitForReady(page, step.selector);
      } else {
        throw new Error("phase43_first_action_step_invalid");
      }
    }
    const readiness = await waitForReadyOrAbandoned(
      page,
      journey.firstAction.readySelector,
      journey.secondAction.readySelector,
    );
    if (readiness.status === "READY") {
      recordDiagnosticTiming(trace, "first", "readyStateAtMs", traceAt(trace));
      await collectBrowserSignals(page, trace, "first");
      await markParseRenderComplete(page, trace, "first");
      trace.actions.first.functionalOutcome = "SUCCESS";
      trace.actions.first.targetReadyStatus = "READY";
      return { status: "PASS" };
    }
    trace.actions.first.functionalOutcome = "ABANDONED";
    trace.actions.first.targetReadyStatus = "ABANDONED";
    trace.actions.first.targetUnmounted = readiness.targetMounted === false;
    return { status: "ABANDONED" };
  } catch (error) {
    if (trace.secondActionAnchor.status === "PENDING") {
      trace.secondActionAnchor = {
        status: "UNAVAILABLE",
        actionId: "first",
        stepLabel: journey.secondActionAnchor?.stepLabel ?? null,
        trustedEventAtMs: null,
      };
      onSecondActionAnchor?.(null);
    }
    trace.actions.first.functionalOutcome = "FAILURE";
    trace.actions.first.targetReadyStatus = "FAILED";
    trace.status = "FAILED";
    if (!trace.actions.first.failureClass) {
      addDiagnosticFailure(trace, "first", "first_action_failed", {
        kind: error?.name || "Error",
      });
    }
    return { status: "FAIL" };
  }
}

async function executeSecondAction(page, trace, journey, secondActionAnchorPromise) {
  const anchor = await secondActionAnchorPromise;
  if (!anchor) {
    recordDiagnosticTiming(trace, "second", "secondActionAccepted", false);
    trace.actions.second.functionalOutcome = "INCOMPLETE";
    addDiagnosticFailure(trace, "second", "second_action_anchor_missing");
    return { status: "FAIL" };
  }
  const plannedActionAtMs = roundMs(
    anchor.trustedEventAtMs + PHASE_4_3_SECOND_ACTION_DELAY_MS,
  );
  recordDiagnosticTiming(trace, "second", "plannedActionAtMs", plannedActionAtMs, {
    action: journey.secondAction.actionId,
    anchorAtMs: anchor.trustedEventAtMs,
  });
  while (true) {
    const remainingMs = plannedActionAtMs - traceAt(trace);
    if (remainingMs <= 0) break;
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(Math.max(1, remainingMs), 50)),
    );
  }
  try {
    const clickEvidence = await executeClickStep(page, trace, "second", journey.secondAction.click);
    recordDiagnosticTiming(trace, "second", "secondActionAccepted", true, {
      label: journey.secondAction.click.label,
    });
    await collectBrowserSignals(page, trace, "second", {
      trustedAfterAtMs: clickEvidence.dispatchAtMs,
    });
    await waitForReady(page, journey.secondAction.readySelector);
    recordDiagnosticTiming(trace, "second", "readyStateAtMs", traceAt(trace));
    await collectBrowserSignals(page, trace, "second");
    await markParseRenderComplete(page, trace, "second");
    trace.actions.second.functionalOutcome = "SUCCESS";
    trace.actions.second.targetReadyStatus = "READY";
    return { status: "PASS" };
  } catch (error) {
    recordDiagnosticTiming(trace, "second", "secondActionAccepted", false, {
      label: journey.secondAction.click.label,
    });
    trace.actions.second.functionalOutcome =
      trace.actions.second.secondActionAccepted === true ? "INCOMPLETE" : "FAILURE";
    trace.actions.second.targetReadyStatus = "FAILED";
    if (!trace.actions.second.failureClass) {
      addDiagnosticFailure(trace, "second", classifyClickError(error), {
        label: journey.secondAction.click.label,
      });
    }
    trace.status = "FAILED";
    return { status: "FAIL" };
  }
}

function pathFromUrl(value) {
  try {
    return new URL(String(value), "http://phase43.local").pathname;
  } catch {
    return "";
  }
}

export function matchesRequiredPattern(pathname, pattern) {
  const pathSegments = pathname.split("/").filter(Boolean);
  const patternSegments = String(pattern).split("/").filter(Boolean);
  if (pathSegments.length !== patternSegments.length) return false;
  return patternSegments.every((segment, index) =>
    segment.startsWith(":") || segment === pathSegments[index],
  );
}

export function sanitizeRequestFailureReason(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (/^[A-Za-z0-9:_-]{1,120}$/.test(normalized)) return normalized;
  return normalized ? "request_failed" : "request_failed_unknown";
}

function requestFailureReason(request) {
  try {
    return sanitizeRequestFailureReason(request.failure()?.errorText);
  } catch {
    return "request_failed_unknown";
  }
}

const PHASE_4_3_PREFERENCE_INTENT_KEYS = Object.freeze([
  "activeClientId",
  "lastDestinationId",
]);

export function classifyPreferenceIntentBody(body) {
  const bodyShape = body == null
    ? "unavailable"
    : typeof body === "object" && !Array.isArray(body)
      ? "object"
      : "non_object";
  const intentKeys = bodyShape === "object"
    ? PHASE_4_3_PREFERENCE_INTENT_KEYS.filter((key) =>
        Object.prototype.hasOwnProperty.call(body, key),
      )
    : [];
  const intentClass =
    intentKeys.length === 2
      ? "active_client_and_last_destination"
      : intentKeys[0] === "activeClientId"
        ? "active_client"
        : intentKeys[0] === "lastDestinationId"
          ? "last_destination"
          : "unclassified";
  return { bodyShape, intentKeys, intentClass };
}

function currentSanitizedPageRoute(page) {
  try {
    return sanitizeRoute(page.url());
  } catch {
    return "<unavailable-route>";
  }
}

function createPreferenceIntentTimingCapture(page, trace, traceVariant) {
  if (traceVariant == null) return null;
  if (traceVariant !== PHASE_4_3_TRACE_VARIANTS.preferenceIntentTimingAndCompletion) {
    throw new Error("phase43_trace_variant_invalid");
  }
  const records = new Map();
  const pendingBodies = new Set();
  const pendingBodyRecords = new Map();
  const onRequest = (request) => {
    try {
      const url = new URL(request.url());
      if (url.pathname !== "/api/shell/preferences" || request.method() !== "PATCH") return;
      let body = null;
      try {
        body = request.postDataJSON();
      } catch {
        body = null;
      }
      const intent = classifyPreferenceIntentBody(body);
      const record = {
        sequence: records.size + 1,
        ...intent,
        requestStartedAtMs: traceAt(trace),
        responseHeaderAtMs: null,
        bodyFinishedAtMs: null,
        settledAtMs: null,
        status: null,
        failed: false,
        failureReason: null,
        routeAtRequestStart: currentSanitizedPageRoute(page),
        routeAtResponseHeader: null,
        routeAtBodyFinished: null,
        routeAtSettled: null,
      };
      records.set(request, record);
    } catch {
      // A malformed request event must not interrupt the measured journey.
    }
  };
  const onResponse = (response) => {
    const record = records.get(response.request());
    if (!record) return;
    record.status = response.status();
    record.responseHeaderAtMs = traceAt(trace);
    record.routeAtResponseHeader = currentSanitizedPageRoute(page);
    const bodyPromise = Promise.resolve()
      .then(async () => {
        const finishedError = await response.finished();
        if (finishedError) throw new Error("preference_response_body_failed");
        record.bodyFinishedAtMs = traceAt(trace);
        record.routeAtBodyFinished = currentSanitizedPageRoute(page);
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
        record.settledAtMs = traceAt(trace);
        record.routeAtSettled = currentSanitizedPageRoute(page);
      })
      .catch(() => {
        record.failed = true;
        record.failureReason = "preference_response_body_failed";
        record.settledAtMs = traceAt(trace);
        record.routeAtSettled = currentSanitizedPageRoute(page);
      });
    pendingBodies.add(bodyPromise);
    pendingBodyRecords.set(bodyPromise, record);
    void bodyPromise.finally(() => {
      pendingBodies.delete(bodyPromise);
      pendingBodyRecords.delete(bodyPromise);
    });
  };
  const onRequestFailed = (request) => {
    const record = records.get(request);
    if (!record) return;
    record.failed = true;
    record.failureReason = requestFailureReason(request);
    record.settledAtMs = traceAt(trace);
    record.routeAtSettled = currentSanitizedPageRoute(page);
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  return {
    async finish() {
      const pending = [...pendingBodies];
      let bodyFinishTimedOut = false;
      if (pending.length) {
        let timeoutHandle;
        const timeout = new Promise((resolvePromise) => {
          timeoutHandle = setTimeout(
            () => resolvePromise(true),
            PHASE_4_3_REQUEST_BODY_FINISH_TIMEOUT_MS,
          );
        });
        bodyFinishTimedOut = await Promise.race([
          Promise.allSettled(pending).then(() => false),
          timeout,
        ]);
        clearTimeout(timeoutHandle);
        if (bodyFinishTimedOut) {
          for (const promise of pending) {
            const record = pendingBodyRecords.get(promise);
            if (!record) continue;
            record.failed = true;
            record.failureReason = "preference_body_finish_timeout";
          }
        }
      }
      return {
        traceVariant,
        requestCount: records.size,
        bodyFinishTimedOut,
        events: [...records.values()],
      };
    },
    dispose() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

function createRequestTracker(page, trace, journey) {
  const pendingBodies = new Set();
  const pendingBodyRecords = new Map();
  const requestRecords = new Map();
  const requiredReads = journey.requiredReads ?? [];
  const isRelevant = (request) => {
    const resourceType = request.resourceType();
    const path = pathFromUrl(request.url());
    return resourceType === "document" || path.startsWith("/api/");
  };
  const onRequest = (request) => {
    if (!isRelevant(request)) return;
    const path = pathFromUrl(request.url());
    const required = requiredReads.filter((item) => matchesRequiredPattern(path, item.pattern));
    const record = {
      route: sanitizeRoute(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      startedAtMs: traceAt(trace),
      requiredFor: required.map((item) => item.actionId),
      status: null,
      responseHeaderAtMs: null,
      bodyFinishedAtMs: null,
      failed: false,
      failureReason: null,
    };
    requestRecords.set(request, record);
    if (required.length) trace.requiredRequests.push(record);
  };
  const onResponse = (response) => {
    const record = requestRecords.get(response.request());
    if (!record) return;
    record.status = response.status();
    record.responseHeaderAtMs = traceAt(trace);
    const bodyPromise = Promise.resolve(response.finished())
      .then(() => {
        record.bodyFinishedAtMs = traceAt(trace);
      })
      .catch(() => {
        record.failed = true;
      });
    pendingBodies.add(bodyPromise);
    pendingBodyRecords.set(bodyPromise, record);
    void bodyPromise.finally(() => {
      pendingBodies.delete(bodyPromise);
      pendingBodyRecords.delete(bodyPromise);
    });
  };
  const onRequestFailed = (request) => {
    const record = requestRecords.get(request);
    if (record) {
      record.failed = true;
      record.failureReason = requestFailureReason(request);
    }
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  page.on("requestfailed", onRequestFailed);
  return {
    async finish() {
      const pending = [...pendingBodies];
      let bodyFinishTimedOut = false;
      if (pending.length) {
        let timeoutHandle;
        const timeout = new Promise((resolvePromise) => {
          timeoutHandle = setTimeout(
            () => resolvePromise(true),
            PHASE_4_3_REQUEST_BODY_FINISH_TIMEOUT_MS,
          );
        });
        bodyFinishTimedOut = await Promise.race([
          Promise.allSettled(pending).then(() => false),
          timeout,
        ]);
        clearTimeout(timeoutHandle);
        if (bodyFinishTimedOut) {
          for (const promise of pending) {
            const record = pendingBodyRecords.get(promise);
            if (record) record.failed = true;
          }
        }
      }
      for (const actionId of ["first", "second"]) {
        const actionRecords = trace.requiredRequests.filter((record) =>
          record.requiredFor.includes(actionId) &&
          record.startedAtMs >= (trace.actions[actionId].plannedActionAtMs ?? 0),
        );
        trace.actions[actionId].requiredRequestTimings = actionRecords.map((record) => ({
          route: record.route,
          method: record.method,
          startedAtMs: record.startedAtMs,
          responseHeaderAtMs: record.responseHeaderAtMs,
          bodyFinishedAtMs: record.bodyFinishedAtMs,
          status: record.status,
          failed: record.failed,
          failureReason: record.failureReason,
        }));
        if (actionRecords.length) {
          recordDiagnosticTiming(
            trace,
            actionId,
            "requiredRequestStartAtMs",
            Math.min(...actionRecords.map((record) => record.startedAtMs)),
          );
          const headers = actionRecords
            .map((record) => record.responseHeaderAtMs)
            .filter((value) => value != null);
          if (headers.length) recordDiagnosticTiming(trace, actionId, "responseHeaderAtMs", Math.min(...headers));
          const bodies = actionRecords
            .map((record) => record.bodyFinishedAtMs)
            .filter((value) => value != null);
          if (bodies.length) recordDiagnosticTiming(trace, actionId, "responseBodyFinishedAtMs", Math.max(...bodies));
        }
      }
      return { bodyFinishTimedOut };
    },
    dispose() {
      page.off("request", onRequest);
      page.off("response", onResponse);
      page.off("requestfailed", onRequestFailed);
    },
  };
}

export async function runDiagnosticJourney(
  page,
  journey,
  {
    mode = "diagnostic",
    checkpoint = null,
    controlVariant = null,
    traceVariant = null,
  } = {},
) {
  if (!PHASE_4_3_MODES[mode]) throw new Error("phase43_mode_invalid");
  if (
    controlVariant != null &&
    !Object.values(PHASE_4_3_CONTROL_VARIANTS).includes(controlVariant)
  ) {
    throw new Error("phase43_control_variant_invalid");
  }
  if (controlVariant != null && journey.journeyId !== "J1") {
    throw new Error("phase43_control_variant_journey_invalid");
  }
  if (
    traceVariant != null &&
    !Object.values(PHASE_4_3_TRACE_VARIANTS).includes(traceVariant)
  ) {
    throw new Error("phase43_trace_variant_invalid");
  }
  if (traceVariant != null && journey.journeyId !== "J1") {
    throw new Error("phase43_trace_variant_journey_invalid");
  }
  const trace = createDiagnosticTrace({
    journeyId: journey.journeyId,
    mode,
    controlVariant,
    traceVariant,
  });
  trace.expectedRoute = journey.expectedRoute;
  await resetBrowserSignals(page);
  const tracker = createRequestTracker(page, trace, journey);
  const preferenceIntentCapture = createPreferenceIntentTimingCapture(page, trace, traceVariant);
  const firstActionControl = createFirstActionControl(page, trace, controlVariant);
  checkpoint?.append("diagnostic.journey.started", {
    journeyId: journey.journeyId,
    mode,
    secondActionDelayMs: PHASE_4_3_SECOND_ACTION_DELAY_MS,
    countedAsOfficialSample: false,
  });
  let resolveSecondActionAnchor;
  let anchorResolved = false;
  const secondActionAnchorPromise = new Promise((resolvePromise) => {
    resolveSecondActionAnchor = (value) => {
      if (anchorResolved) return;
      anchorResolved = true;
      resolvePromise(value);
    };
  });
  const firstPromise = executeFirstAction(page, trace, journey, {
    onSecondActionAnchor: resolveSecondActionAnchor,
    beforeStep: firstActionControl?.beforeStep,
  }).finally(() => {
    if (!anchorResolved) resolveSecondActionAnchor(null);
  });
  const secondPromise = executeSecondAction(
    page,
    trace,
    journey,
    secondActionAnchorPromise,
  );
  await Promise.allSettled([firstPromise, secondPromise]);
  firstActionControl?.dispose?.();
  const requestTracking = await tracker.finish();
  tracker.dispose();
  const preferenceIntentTiming = await preferenceIntentCapture?.finish();
  preferenceIntentCapture?.dispose();
  trace.control = firstActionControl?.snapshot() ?? null;
  trace.preferenceIntentTiming = preferenceIntentTiming ?? null;
  if (trace.actions.second.secondActionAccepted === null) {
    recordDiagnosticTiming(trace, "second", "secondActionAccepted", false);
  }
  const validation = validateDiagnosticTrace(trace);
  trace.validation = validation;
  trace.requestTracking = requestTracking;
  trace.functionalOutcome =
    trace.actions.first.functionalOutcome === "FAILURE"
      ? "FAILURE"
      : trace.actions.first.functionalOutcome === "ABANDONED"
        ? "ABANDONED"
        : trace.actions.second.functionalOutcome === "SUCCESS"
          ? "SUCCESS"
          : "INCOMPLETE";
  trace.status =
    validation.status === "PASS" &&
    validation.completenessStatus === "COMPLETE" &&
    trace.failures.length === 0 &&
    trace.actions.first.functionalOutcome === "SUCCESS" &&
    trace.actions.second.functionalOutcome === "SUCCESS" &&
    trace.actions.second.secondActionAccepted === true
      ? "COMPLETE"
      : "INCOMPLETE";
  trace.observationValidity =
    validation.status === "PASS" &&
    (trace.status === "COMPLETE" ||
      trace.actions.first.functionalOutcome === "FAILURE" ||
      trace.actions.first.functionalOutcome === "ABANDONED" ||
      trace.actions.second.functionalOutcome === "FAILURE" ||
      trace.actions.second.functionalOutcome === "INCOMPLETE")
      ? "VALID"
      : "INVALID";
  const evidence = sanitizeDiagnosticEvidence(trace);
  checkpoint?.append("diagnostic.journey.trace", evidence);
  checkpoint?.append("diagnostic.journey.completed", {
    journeyId: journey.journeyId,
    mode,
    status: trace.status,
    countedAsOfficialSample: false,
  });
  return trace;
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value));
  if (!/^https?:$/.test(parsed.protocol)) throw new Error("phase43_base_url_protocol_invalid");
  return parsed.toString().replace(/\/$/, "");
}

async function authenticate(page, baseUrl, { email, password }) {
  await page.goto(`${baseUrl}/login?next=/dashboard`, { waitUntil: "domcontentloaded" });
  await page.locator("#customer-login-email").fill(email);
  await page.locator("#customer-login-password").fill(password);
  const loginResponse = page
    .waitForResponse((response) => response.url().includes("/api/auth/password-login"), {
      timeout: PHASE_4_3_READY_TIMEOUT_MS,
    })
    .catch(() => null);
  await page.locator('[data-testid="customer-login-submit"]').click({
    timeout: PHASE_4_3_CLICK_TIMEOUT_MS,
  });
  const response = await loginResponse;
  if (!response || !response.ok()) throw new Error("phase43_password_login_failed");
  await waitForReady(page, '[data-testid="authenticated-shell"]');
}

export async function runDiagnosticSession({
  baseUrl,
  mode = "diagnostic",
  journeyIds = PHASE_4_3_JOURNEYS.map((journey) => journey.journeyId),
  email = process.env.MANU_PHASE3_SYNTHETIC_EMAIL || "aiya-phase3-local-normal-owner@manu.local",
  password = process.env.MANU_PHASE3_SYNTHETIC_PASSWORD || "AiyaPhase3LocalOnly!",
  sourceHead = "unbound",
  sourceVariant = "current",
  referenceSnapshotId = "phase4-2-reference-unbound",
  newRun = false,
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (!PHASE_4_3_MODES[mode]) throw new Error("phase43_mode_invalid");
  const selectedJourneys = PHASE_4_3_JOURNEYS.filter((journey) => journeyIds.includes(journey.journeyId));
  if (selectedJourneys.length !== journeyIds.length) throw new Error("phase43_journey_id_invalid");
  const identity = phase43CheckpointIdentity({ sourceHead, sourceVariant, referenceSnapshotId });
  const opened = openPhaseRun({
    root: PHASE_4_3_CHECKPOINT_ROOT,
    phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
    phaseSchemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
    identity,
    metadata: {
      identitySummary: {
        planRevision: PHASE_4_3_PLAN_REVISION,
        sourceVariant,
        mode,
      },
      journeyIds: selectedJourneys.map((journey) => journey.journeyId),
      countedAsOfficialSample: false,
    },
    newRun,
    redact: sanitizeDiagnosticEvidence,
  });
  if (opened.action !== "RUN" || !opened.run) {
    throw new Error(`phase43_checkpoint_${opened.action.toLowerCase()}`);
  }
  const checkpoint = opened.run;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const results = [];
  try {
    await installBrowserInstrumentation(page, PHASE_4_3_MODES[mode]);
    checkpoint.append("diagnostic.contract.bound", {
      phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
      phaseSchemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
      mode,
      profiler: PHASE_4_3_MODES[mode].profiler,
      serverTiming: PHASE_4_3_MODES[mode].serverTiming,
      countedAsOfficialSample: false,
    });
    for (const stage of PHASE_4_3_PHASE_DEFINITION.stages) {
      const verification = stage.verify();
      if (verification.status !== "PASS") throw new Error(`phase43_stage_${stage.stageId}_invalid`);
      checkpoint.append("diagnostic.stage.completed", {
        stageId: stage.stageId,
        status: "COMPLETE",
        failures: verification.failures,
      });
    }
    await authenticate(page, normalizedBaseUrl, { email, password });
    for (const journey of selectedJourneys) {
      await page.goto(`${normalizedBaseUrl}${journey.startRoute}`, { waitUntil: "domcontentloaded" });
      await waitForReady(page, '[data-testid="authenticated-shell"]');
      results.push(await runDiagnosticJourney(page, journey, { mode, checkpoint }));
    }
    checkpoint.markStatus("COMPLETE", {
      journeyCount: results.length,
      countedAsOfficialSample: false,
    });
  } catch (error) {
    checkpoint.markStatus("BLOCKED", {
      reason: "diagnostic_run_incomplete",
      errorClass: error?.name || "Error",
      countedAsOfficialSample: false,
    });
    throw error;
  } finally {
    await browser.close();
    checkpoint.close();
  }
  return {
    runId: checkpoint.runId,
    mode,
    results,
    countedAsOfficialSample: false,
  };
}

function descriptorOutput() {
  const definition = {
    ...PHASE_4_3_PHASE_DEFINITION,
    stages: PHASE_4_3_PHASE_DEFINITION.stages.map((stage) => ({
      stageId: stage.stageId,
      prerequisites: stage.prerequisites,
      verification: stage.verify(),
    })),
  };
  return sanitizeDiagnosticEvidence({
    phase: "4.3",
    planRevision: PHASE_4_3_PLAN_REVISION,
    checkpoint: {
      phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
      schemaVersion: PHASE_4_3_CHECKPOINT_SCHEMA_VERSION,
    },
    modes: PHASE_4_3_MODES,
    requiredTimingFields: PHASE_4_3_REQUIRED_TIMING_FIELDS,
    journeys: PHASE_4_3_JOURNEYS,
    phaseDefinition: definition,
    officialMeasurementStarted: false,
    causalExperimentStarted: false,
  });
}

function parseArguments(argv) {
  const options = {
    descriptor: false,
    status: false,
    run: false,
    newRun: false,
    mode: "diagnostic",
    journeyIds: null,
    baseUrl: process.env.AIYA_PHASE43_BASE_URL || null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--descriptor") options.descriptor = true;
    else if (arg === "--status") options.status = true;
    else if (arg === "--run") options.run = true;
    else if (arg === "--new-run") options.newRun = true;
    else if (arg === "--mode") options.mode = argv[++index];
    else if (arg === "--journeys") options.journeyIds = argv[++index]?.split(",").filter(Boolean);
    else if (arg === "--base-url") options.baseUrl = argv[++index];
    else throw new Error(`phase43_argument_invalid:${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.descriptor) {
    process.stdout.write(`${JSON.stringify(descriptorOutput(), null, 2)}\n`);
    return;
  }
  if (options.status) {
    process.stdout.write(
      `${JSON.stringify(
        inspectPhaseRuns({
          root: PHASE_4_3_CHECKPOINT_ROOT,
          phaseId: PHASE_4_3_CHECKPOINT_PHASE_ID,
        }),
        null,
        2,
      )}\n`,
    );
    return;
  }
  if (!options.run) {
    process.stdout.write(
      "Phase 4.3 diagnostic harness ready. Use --descriptor for the contract; --run is explicit and never starts by default.\n",
    );
    return;
  }
  if (!options.baseUrl) throw new Error("phase43_base_url_required_for_run");
  const result = await runDiagnosticSession({
    baseUrl: options.baseUrl,
    mode: options.mode,
    journeyIds: options.journeyIds ?? undefined,
    newRun: options.newRun,
  });
  process.stdout.write(`${JSON.stringify(sanitizeDiagnosticEvidence(result), null, 2)}\n`);
}

const isMainModule = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(`${error?.message || error}\n`);
    process.exitCode = 1;
  });
}
