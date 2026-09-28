import { randomUUID } from "node:crypto";
import { PhaseCheckpointRun, readPhaseRun } from "./checkpoint-store.mjs";

export const PHASE_CYCLE_STATES = Object.freeze([
  "DIAGNOSE",
  "FIX",
  "VALIDATE",
  "REMEASURE",
  "BLOCKED",
  "COMPLETE",
]);

const STATE_TO_RUN_STATUS = Object.freeze({
  DIAGNOSE: "RUNNING",
  FIX: "RUNNING",
  VALIDATE: "RUNNING",
  REMEASURE: "RUNNING",
  BLOCKED: "BLOCKED",
  COMPLETE: "COMPLETE",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  DIAGNOSE: ["FIX", "BLOCKED"],
  FIX: ["VALIDATE", "BLOCKED"],
  VALIDATE: ["FIX", "REMEASURE", "BLOCKED"],
  REMEASURE: ["DIAGNOSE", "COMPLETE", "BLOCKED"],
  BLOCKED: [],
  COMPLETE: [],
});

const SENSITIVE_CYCLE_KEY = /(?:password|token|cookie|secret|authorization|email|prompt|clinical|healthdata|deviceserial|(?:raw|request|response)?body$|(?:raw|request|response)?payload$)/i;
const SENSITIVE_CYCLE_TEXT = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|[?&](?:email|password|token|secret)=[^&\s]+|\b(?:bearer|authorization|password|token|secret)\b)/i;

function redactCycleValue(value, key = "") {
  if (SENSITIVE_CYCLE_KEY.test(key)) return "<redacted>";
  if (typeof value === "string") {
    return SENSITIVE_CYCLE_TEXT.test(value)
      ? "<redacted>"
      : value.slice(0, 240);
  }
  if (Array.isArray(value)) return value.map((item) => redactCycleValue(item, key));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactCycleValue(childValue, childKey),
      ]),
    );
  }
  return value;
}

function cycleRedactor(redact) {
  return (value) =>
    redactCycleValue(
      typeof redact === "function" ? redact(value) : value,
    );
}

function cycleEvents(events) {
  return events.filter((event) =>
    ["phase.cycle.started", "phase.cycle.state"].includes(event.type),
  );
}

function cycleState(events, cycleId) {
  return cycleEvents(events)
    .filter((event) => event.payload?.cycleId === cycleId)
    .map((event) => event.payload?.state)
    .filter((state) => PHASE_CYCLE_STATES.includes(state))
    .at(-1) ?? null;
}

function cycleNumber(events) {
  return cycleEvents(events)
    .map((event) => Number(event.payload?.cycleNumber))
    .filter(Number.isInteger)
    .reduce((highest, value) => Math.max(highest, value), 0);
}

function activeCycle(events) {
  const started = cycleEvents(events)
    .filter((event) => event.type === "phase.cycle.started")
    .at(-1);
  if (!started) return null;
  const cycleId = started.payload?.cycleId;
  const state = cycleState(events, cycleId);
  if (!cycleId || !state || ["BLOCKED", "COMPLETE"].includes(state)) return null;
  return {
    cycleId,
    cycleNumber: started.payload?.cycleNumber ?? null,
    state,
  };
}

export function getActivePhaseCycle(input) {
  return activeCycle(Array.isArray(input) ? input : input?.events ?? []);
}

function validateText(value, fallback, maxLength = 240) {
  const text = String(value ?? fallback).trim();
  return text ? text.slice(0, maxLength) : fallback;
}

export function readPhaseCycles({ root, phaseId, runId } = {}) {
  const run = readPhaseRun({ root, phaseId, runId });
  const started = new Map();
  for (const event of cycleEvents(run.events)) {
    const payload = event.payload ?? {};
    if (!payload.cycleId) continue;
    if (event.type === "phase.cycle.started") {
      started.set(payload.cycleId, {
        cycleId: payload.cycleId,
        cycleNumber: payload.cycleNumber ?? null,
        trigger: payload.trigger ?? null,
        parentCycleId: payload.parentCycleId ?? null,
        startedAt: event.at,
        state: payload.state ?? "DIAGNOSE",
        evidenceRefs: payload.evidenceRefs ?? [],
      });
    } else if (started.has(payload.cycleId)) {
      const current = started.get(payload.cycleId);
      started.set(payload.cycleId, {
        ...current,
        state: payload.state,
        updatedAt: event.at,
        reason: payload.reason ?? null,
        evidenceRefs: payload.evidenceRefs ?? current.evidenceRefs,
      });
    }
  }
  return {
    run,
    cycles: [...started.values()].sort(
      (a, b) => Number(a.cycleNumber ?? 0) - Number(b.cycleNumber ?? 0),
    ),
    activeCycle: activeCycle(run.events),
  };
}

export function openPhaseCycle({
  root,
  phaseId,
  runId,
  trigger,
  parentCycleId = null,
  evidenceRefs = [],
  redact,
} = {}) {
  if (!root || !phaseId || !runId) throw new Error("phase_cycle_identity_missing");
  const persisted = readPhaseRun({ root, phaseId, runId });
  if (persisted.manifest.status === "COMPLETE") {
    throw new Error("phase_cycle_parent_run_complete");
  }
  const previousActive = activeCycle(persisted.events);
  if (previousActive) throw new Error("phase_cycle_already_active");

  const run = new PhaseCheckpointRun({
    root,
    directory: persisted.directory,
    manifest: persisted.manifest,
    events: persisted.events,
    executionId: randomUUID(),
    redact: cycleRedactor(redact),
  });
  const cycleId = `cycle-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID()}`;
  const nextCycleNumber = cycleNumber(persisted.events) + 1;
  run.append(
    "phase.cycle.started",
    {
      cycleId,
      cycleNumber: nextCycleNumber,
      state: "DIAGNOSE",
      trigger: validateText(trigger, "operator_requested_cycle"),
      parentCycleId: parentCycleId ? validateText(parentCycleId, null, 160) : null,
      evidenceRefs: Array.isArray(evidenceRefs)
        ? evidenceRefs.map((ref) => validateText(ref, "", 240)).filter(Boolean)
        : [],
    },
    { status: "RUNNING" },
  );
  return { run, cycleId, cycleNumber: nextCycleNumber };
}

export function resumePhaseCycle({
  root,
  phaseId,
  runId,
  cycleId = null,
  redact,
} = {}) {
  if (!root || !phaseId || !runId) throw new Error("phase_cycle_identity_missing");
  const persisted = readPhaseRun({ root, phaseId, runId });
  if (persisted.manifest.status === "COMPLETE") {
    throw new Error("phase_cycle_parent_run_complete");
  }
  const current = activeCycle(persisted.events);
  if (!current) throw new Error("phase_cycle_active_not_found");
  if (cycleId && current.cycleId !== cycleId) {
    throw new Error("phase_cycle_active_id_mismatch");
  }
  const started = persisted.events.find(
    (event) =>
      event.type === "phase.cycle.started" &&
      event.payload?.cycleId === current.cycleId,
  );
  const run = new PhaseCheckpointRun({
    root,
    directory: persisted.directory,
    manifest: persisted.manifest,
    events: persisted.events,
    executionId: randomUUID(),
    redact: cycleRedactor(redact),
  });
  if (["RUNNING", "PAUSE_REQUESTED"].includes(run.status)) {
    run.append(
      "execution.interrupted",
      { previousStatus: run.status, resumedCycleId: current.cycleId },
      { status: "INTERRUPTED" },
    );
  }
  run.append(
    "execution.started",
    { resumed: true, resumedCycleId: current.cycleId },
    { status: "RUNNING" },
  );
  return {
    run,
    cycleId: current.cycleId,
    cycleNumber: started?.payload?.cycleNumber ?? current.cycleNumber,
    state: current.state,
    resumed: true,
  };
}

export function openOrResumePhaseCycle(options = {}) {
  const persisted = readPhaseRun({
    root: options.root,
    phaseId: options.phaseId,
    runId: options.runId,
  });
  const current = activeCycle(persisted.events);
  if (current) {
    if (options.cycleId && options.cycleId !== current.cycleId) {
      throw new Error("phase_cycle_active_id_mismatch");
    }
    return resumePhaseCycle(options);
  }
  if (options.cycleId) throw new Error("phase_cycle_requested_id_not_active");
  return openPhaseCycle(options);
}

export function transitionPhaseCycle(
  run,
  { cycleId, state, reason = null, evidenceRefs = [], details = {} } = {},
) {
  if (!run || !cycleId || !PHASE_CYCLE_STATES.includes(state)) {
    throw new Error("phase_cycle_transition_invalid");
  }
  const current = cycleState(run.events, cycleId);
  if (!current) throw new Error("phase_cycle_not_found");
  if (!ALLOWED_TRANSITIONS[current].includes(state)) {
    throw new Error(`phase_cycle_transition_not_allowed:${current}->${state}`);
  }
  const normalizedReason = String(reason ?? "").trim();
  const normalizedEvidenceRefs = Array.isArray(evidenceRefs)
    ? evidenceRefs.map((ref) => validateText(ref, "", 240)).filter(Boolean)
    : [];
  if (!normalizedReason) throw new Error("phase_cycle_transition_reason_missing");
  if (!normalizedEvidenceRefs.length) {
    throw new Error("phase_cycle_transition_evidence_missing");
  }
  const payload = {
    cycleId,
    state,
    reason: validateText(normalizedReason, null),
    evidenceRefs: normalizedEvidenceRefs,
    details: details && typeof details === "object" ? details : {},
  };
  return run.append("phase.cycle.state", payload, {
    status: STATE_TO_RUN_STATUS[state],
  });
}

export function closePhaseCycle(run, options = {}) {
  const state = options.state ?? "BLOCKED";
  if (!["BLOCKED", "COMPLETE"].includes(state)) {
    throw new Error("phase_cycle_terminal_state_invalid");
  }
  return transitionPhaseCycle(run, { ...options, state });
}
