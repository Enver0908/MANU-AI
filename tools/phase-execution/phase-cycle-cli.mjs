#!/usr/bin/env node

import { inspectPhaseRuns } from "./checkpoint-store.mjs";
import {
  closePhaseCycle,
  openOrResumePhaseCycle,
  readPhaseCycles,
  resumePhaseCycle,
  transitionPhaseCycle,
} from "./phase-cycle-store.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  return value && !value.startsWith("--") ? value : null;
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`phase_cycle_argument_missing:${name}`);
  return value;
}

function selectedRunId(root, phaseId) {
  return (
    argument("--run-id") ??
    inspectPhaseRuns({ root, phaseId })
      .filter((run) => run.status !== "COMPLETE")
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .at(0)?.runId ??
    null
  );
}

function safeCycle(cycle) {
  return {
    cycleId: cycle.cycleId,
    cycleNumber: cycle.cycleNumber,
    trigger: cycle.trigger,
    parentCycleId: cycle.parentCycleId,
    startedAt: cycle.startedAt,
    updatedAt: cycle.updatedAt ?? null,
    state: cycle.state,
    reason: cycle.reason ?? null,
    evidenceRefs: cycle.evidenceRefs,
  };
}

function printStatus(root, phaseId, runId) {
  const result = readPhaseCycles({ root, phaseId, runId });
  console.log(
    JSON.stringify(
      {
        phaseId,
        runId,
        phaseStatus: result.run.manifest.status,
        eventCount: result.run.events.length,
        activeCycle: result.activeCycle,
        cycles: result.cycles.map(safeCycle),
      },
      null,
      2,
    ),
  );
}

function main() {
  const root = requiredArgument("--root");
  const phaseId = requiredArgument("--phase-id");
  const runId = selectedRunId(root, phaseId);
  if (!runId) throw new Error("phase_cycle_run_not_found");

  if (process.argv.includes("--status")) {
    printStatus(root, phaseId, runId);
    return;
  }

  if (process.argv.includes("--open")) {
    const cycle = openOrResumePhaseCycle({
      root,
      phaseId,
      runId,
      cycleId: argument("--cycle-id"),
      trigger: argument("--trigger") || "operator_requested_cycle",
      parentCycleId: argument("--parent-cycle-id"),
      evidenceRefs: (argument("--evidence-refs") || "")
        .split(",")
        .map((ref) => ref.trim())
        .filter(Boolean),
    });
    try {
      console.log(
        JSON.stringify(
          { runId, cycleId: cycle.cycleId, cycleNumber: cycle.cycleNumber, state: cycle.state || "DIAGNOSE", resumed: cycle.resumed === true },
          null,
          2,
        ),
      );
    } finally {
      cycle.run.close();
    }
    return;
  }

  const cycleId = requiredArgument("--cycle-id");
  const cycle = resumePhaseCycle({ root, phaseId, runId, cycleId });
  try {
    const nextState = argument("--state");
    if (!nextState) throw new Error("phase_cycle_state_missing");
    const options = {
      cycleId,
      state: nextState,
      reason: argument("--reason"),
      evidenceRefs: (argument("--evidence-refs") || "")
        .split(",")
        .map((ref) => ref.trim())
        .filter(Boolean),
    };
    const event = ["BLOCKED", "COMPLETE"].includes(nextState)
      ? closePhaseCycle(cycle.run, options)
      : transitionPhaseCycle(cycle.run, options);
    console.log(
      JSON.stringify(
        {
          runId,
          cycleId,
          state: nextState,
          sequence: event.sequence,
          status: event.status || null,
        },
        null,
        2,
      ),
    );
  } finally {
    cycle.run.close();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
