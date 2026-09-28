import test from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createPhaseRun,
  inspectPhaseRuns,
  openPhaseRun,
  readPhaseRun,
  requestPhaseRunPause,
} from "./checkpoint-store.mjs";
import {
  assertPhaseDefinition,
  stageEvidenceStatus,
  validatePhaseDefinition,
} from "./phase-runner.mjs";
import {
  closePhaseCycle,
  openPhaseCycle,
  openOrResumePhaseCycle,
  readPhaseCycles,
  resumePhaseCycle,
  transitionPhaseCycle,
} from "./phase-cycle-store.mjs";

function temporaryRoot() {
  return mkdtempSync(join(tmpdir(), "aiya-phase-execution-"));
}

test("checkpoint store durably commits events and reconstructs an interrupted run", () => {
  const root = temporaryRoot();
  try {
    const first = createPhaseRun({
      root,
      phaseId: "test-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
      metadata: { identitySummary: { source: "a" } },
      redact: (value) => ({ ...value, password: "<redacted>" }),
    });
    const runId = first.runId;
    first.append("work.committed", { unitId: "unit-1", password: "secret" });
    first.close();

    const reopened = openPhaseRun({
      root,
      phaseId: "test-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
      runId,
    });
    assert.equal(reopened.action, "RUN");
    assert.equal(reopened.resumed, true);
    assert.equal(reopened.run.eventsOf("work.committed").length, 1);
    assert.equal(reopened.run.eventsOf("execution.interrupted").length, 1);
    assert.equal(reopened.run.events.at(-1).payload.resumed, true);
    reopened.run.close();

    const status = inspectPhaseRuns({ root, phaseId: "test-phase" });
    assert.equal(status[0].eventCount >= 5, true);
    const eventFiles = reopened.run.events.map((event) => event.eventId);
    assert.equal(new Set(eventFiles).size, eventFiles.length);
    const serialized = readFileSync(
      join(root, "test-phase", runId, "events", "00000003-" + eventFiles[2] + ".json"),
      "utf8",
    );
    assert.equal(serialized.includes("secret"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint pause is an external control file and is applied only at a safe boundary", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "pause-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    requestPhaseRunPause({
      root,
      phaseId: "pause-phase",
      runId: created.runId,
      reason: "computer_shutdown",
    });
    assert.equal(created.pauseRequested().reason, "computer_shutdown");
    created.applyPause("computer_shutdown");
    assert.equal(created.status, "PAUSED");
    assert.equal(created.pauseRequested(), null);
    created.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint identity changes block silent continuation and active writers are exclusive", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "identity-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    assert.throws(
      () =>
        openPhaseRun({
          root,
          phaseId: "identity-phase",
          phaseSchemaVersion: "test-v1",
          identity: { source: "a" },
        }),
      /phase_run_locked/,
    );
    created.close();
    const stale = openPhaseRun({
      root,
      phaseId: "identity-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "changed" },
    });
    assert.equal(stale.action, "STALE");
    assert.equal(stale.run, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint corruption blocks fallback to a new silent run", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "corrupt-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    const runId = created.runId;
    created.close();
    const eventsDirectory = join(root, "corrupt-phase", runId, "events");
    const eventName = readdirSync(eventsDirectory).find((name) => name.endsWith(".json"));
    appendFileSync(join(eventsDirectory, eventName), "corrupt\n", "utf8");
    assert.throws(
      () =>
        openPhaseRun({
          root,
          phaseId: "corrupt-phase",
          phaseSchemaVersion: "test-v1",
          identity: { source: "a" },
        }),
      /checkpoint_run_corrupt/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkpoint read verifies the source hash chain before compatible migration", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "read-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    const runId = created.runId;
    created.append("work.committed", { unitId: "unit-1" });
    created.close();
    const read = readPhaseRun({ root, phaseId: "read-phase", runId });
    assert.equal(read.manifest.runId, runId);
    assert.equal(read.events.at(-1).type, "work.committed");
    assert.equal(read.events.at(-1).eventSha256.length, 64);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("phase runner enforces ordered stages and explicit verifiers", () => {
  const valid = {
    phaseId: "test",
    phaseSchemaVersion: "v1",
    stages: [
      { stageId: "1", prerequisites: [], verify: () => true },
      { stageId: "2", prerequisites: ["1"], verify: () => true },
    ],
  };
  assert.equal(validatePhaseDefinition(valid).status, "PASS");
  assert.doesNotThrow(() => assertPhaseDefinition(valid));
  assert.equal(
    stageEvidenceStatus(
      [
        { stageId: "1", status: "COMPLETE" },
        { stageId: "2", status: "COMPLETE" },
      ],
      ["1", "2"],
    ).status,
    "PASS",
  );
  assert.equal(
    validatePhaseDefinition({ ...valid, stages: [{ stageId: "2", prerequisites: [], verify: null }] })
      .status,
    "FAIL",
  );
});

test("phase cycles persist ordered diagnose-fix-validate-remeasure transitions", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "cycle-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    created.close();

    const opened = openPhaseCycle({
      root,
      phaseId: "cycle-phase",
      runId: created.runId,
      trigger: "android_diagnostic",
      evidenceRefs: ["diagnostic.json"],
    });
    transitionPhaseCycle(opened.run, {
      cycleId: opened.cycleId,
      state: "FIX",
      reason: "diagnosis_identified_controlled_component",
      evidenceRefs: ["diagnosis.json"],
    });
    transitionPhaseCycle(opened.run, {
      cycleId: opened.cycleId,
      state: "VALIDATE",
      reason: "targeted_fix_validation_passed",
      evidenceRefs: ["validation.json"],
    });
    transitionPhaseCycle(opened.run, {
      cycleId: opened.cycleId,
      state: "REMEASURE",
      reason: "validation_contract_complete",
      evidenceRefs: ["validation.json"],
    });
    transitionPhaseCycle(opened.run, {
      cycleId: opened.cycleId,
      state: "DIAGNOSE",
      reason: "remeasurement_exposed_next_blocker",
      evidenceRefs: ["remeasurement.json"],
    });
    closePhaseCycle(opened.run, {
      cycleId: opened.cycleId,
      state: "BLOCKED",
      reason: "requires_next_controlled_cycle",
      evidenceRefs: ["remeasurement.json"],
    });
    opened.run.close();

    const inspected = readPhaseCycles({
      root,
      phaseId: "cycle-phase",
      runId: created.runId,
    });
    assert.equal(inspected.cycles.length, 1);
    assert.equal(inspected.cycles[0].state, "BLOCKED");
    assert.equal(inspected.activeCycle, null);
    assert.equal(inspected.run.manifest.status, "BLOCKED");
    const holder = openPhaseCycle({
      root,
      phaseId: "cycle-phase",
      runId: created.runId,
      trigger: "lock_check",
    });
    assert.throws(
      () =>
        openPhaseCycle({
          root,
          phaseId: "cycle-phase",
          runId: created.runId,
          trigger: "second_cycle",
        }),
      /phase_cycle_already_active/,
    );
    closePhaseCycle(holder.run, {
      cycleId: holder.cycleId,
      state: "BLOCKED",
      reason: "lock_check_complete",
      evidenceRefs: ["lock-check.json"],
    });
    holder.run.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("phase cycles reject skipped transitions and keep the phase open after a blocked cycle", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "cycle-blocked-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    created.close();
    const first = openPhaseCycle({
      root,
      phaseId: "cycle-blocked-phase",
      runId: created.runId,
      trigger: "first_cycle",
    });
    assert.throws(
      () => transitionPhaseCycle(first.run, { cycleId: first.cycleId, state: "REMEASURE" }),
      /phase_cycle_transition_not_allowed:DIAGNOSE->REMEASURE/,
    );
    assert.throws(
      () =>
        transitionPhaseCycle(first.run, {
          cycleId: first.cycleId,
          state: "FIX",
          reason: "missing_evidence_reference",
        }),
      /phase_cycle_transition_evidence_missing/,
    );
    assert.throws(
      () =>
        transitionPhaseCycle(first.run, {
          cycleId: first.cycleId,
          state: "FIX",
          evidenceRefs: ["diagnosis.json"],
        }),
      /phase_cycle_transition_reason_missing/,
    );
    closePhaseCycle(first.run, {
      cycleId: first.cycleId,
      state: "BLOCKED",
      reason: "external_prerequisite",
      evidenceRefs: ["prerequisite.json"],
    });
    first.run.close();

    const second = openPhaseCycle({
      root,
      phaseId: "cycle-blocked-phase",
      runId: created.runId,
      trigger: "prerequisite_recovered",
      parentCycleId: first.cycleId,
    });
    assert.equal(second.cycleNumber, 2);
    assert.equal(second.run.status, "RUNNING");
    second.run.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("phase cycle open-or-resume rejects a non-active requested cycle", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "cycle-request-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    created.close();
    const first = openPhaseCycle({
      root,
      phaseId: "cycle-request-phase",
      runId: created.runId,
      trigger: "first_cycle",
    });
    closePhaseCycle(first.run, {
      cycleId: first.cycleId,
      state: "BLOCKED",
      reason: "first_cycle_complete",
      evidenceRefs: ["first-cycle.json"],
    });
    first.run.close();
    assert.throws(
      () =>
        openOrResumePhaseCycle({
          root,
          phaseId: "cycle-request-phase",
          runId: created.runId,
          cycleId: first.cycleId,
          trigger: "must_not_reopen_blocked_cycle",
        }),
      /phase_cycle_requested_id_not_active/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("phase cycle events redact sensitive fields and credential-shaped text by default", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "cycle-redaction-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    created.close();
    const cycle = openPhaseCycle({
      root,
      phaseId: "cycle-redaction-phase",
      runId: created.runId,
      trigger: "redaction_test",
    });
    cycle.run.append("phase.cycle.diagnosis", {
      password: "password-value",
      requestBody: "clinical text",
      deviceSerial: "physical-device-serial",
      message: "email=owner@example.invalid",
      bodyFinishedMs: 123,
    });
    const event = cycle.run.events.at(-1);
    assert.equal(event.payload.password, "<redacted>");
    assert.equal(event.payload.requestBody, "<redacted>");
    assert.equal(event.payload.deviceSerial, "<redacted>");
    assert.equal(event.payload.message, "<redacted>");
    assert.equal(event.payload.bodyFinishedMs, 123);
    assert.equal(JSON.stringify(event).includes("password-value"), false);
    cycle.run.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an interrupted active cycle resumes with the same cycle identity", () => {
  const root = temporaryRoot();
  try {
    const created = createPhaseRun({
      root,
      phaseId: "cycle-resume-phase",
      phaseSchemaVersion: "test-v1",
      identity: { source: "a" },
    });
    const runId = created.runId;
    created.close();
    const first = openPhaseCycle({
      root,
      phaseId: "cycle-resume-phase",
      runId,
      trigger: "resume_test",
    });
    first.run.close();

    const resumed = openOrResumePhaseCycle({
      root,
      phaseId: "cycle-resume-phase",
      runId,
      cycleId: first.cycleId,
    });
    assert.equal(resumed.resumed, true);
    assert.equal(resumed.cycleId, first.cycleId);
    assert.equal(resumed.state, "DIAGNOSE");
    assert.equal(
      resumed.run.events.at(-2).type,
      "execution.interrupted",
    );
    assert.equal(resumed.run.events.at(-1).type, "execution.started");
    resumed.run.close();

    const inspected = readPhaseCycles({
      root,
      phaseId: "cycle-resume-phase",
      runId,
    });
    assert.equal(inspected.activeCycle.cycleId, first.cycleId);
    assert.equal(inspected.cycles.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
