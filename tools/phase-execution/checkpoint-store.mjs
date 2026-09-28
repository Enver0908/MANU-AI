import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";

export const CHECKPOINT_SCHEMA_VERSION = "phase-execution-checkpoint-v1";
export const RUN_STATUSES = [
  "RUNNING",
  "PAUSE_REQUESTED",
  "PAUSED",
  "INTERRUPTED",
  "BLOCKED",
  "STALE",
  "COMPLETE",
];

function json(value) {
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function now() {
  return new Date().toISOString();
}

function safeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, "_");
}

const DURABLE_RENAME_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800, 1_200, 2_000];

function sleepSync(milliseconds) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, milliseconds);
}

function renameDurable(temporaryPath, destinationPath) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      renameSync(temporaryPath, destinationPath);
      return;
    } catch (error) {
      const retryable = ["EACCES", "EBUSY", "EPERM"].includes(error?.code);
      const delay = DURABLE_RENAME_RETRY_DELAYS_MS[attempt];
      if (!retryable || delay == null) throw error;
      sleepSync(delay);
    }
  }
}

function writeDurable(path, value, { exclusive = false } = {}) {
  const directory = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  mkdirSync(directory, { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  const flags = exclusive ? "wx" : "w";
  const fileDescriptor = openSync(temporaryPath, flags, 0o600);
  try {
    const contents = Buffer.from(`${json(value)}\n`, "utf8");
    writeSync(fileDescriptor, contents, 0, contents.length, 0);
    fsyncSync(fileDescriptor);
  } finally {
    closeSync(fileDescriptor);
  }
  renameDurable(temporaryPath, path);
  try {
    const directoryDescriptor = openSync(directory, "r");
    try {
      fsyncSync(directoryDescriptor);
    } finally {
      closeSync(directoryDescriptor);
    }
  } catch {
    // Windows does not always allow directory handles. The file itself was
    // flushed and renamed; the caller still receives the completed write.
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function eventDigest(event) {
  const { eventSha256: ignored, ...withoutDigest } = event;
  return sha256(json(withoutDigest));
}

function runDirectory(root, phaseId, runId) {
  return join(root, safeName(phaseId), safeName(runId));
}

function manifestPath(directory) {
  return join(directory, "manifest.json");
}

function eventDirectory(directory) {
  return join(directory, "events");
}

function eventPath(directory, sequence, eventId) {
  return join(
    eventDirectory(directory),
    `${String(sequence).padStart(8, "0")}-${safeName(eventId)}.json`,
  );
}

function statusFromEvents(manifest, events) {
  let status = manifest.status;
  for (const event of events) {
    if (typeof event.status === "string" && RUN_STATUSES.includes(event.status)) {
      status = event.status;
    }
  }
  return status;
}

function loadEvents(directory) {
  const path = eventDirectory(directory);
  if (!existsSync(path)) return [];
  const names = readdirSync(path)
    .filter((name) => /^\d{8}-[A-Za-z0-9._-]+\.json$/.test(name))
    .sort();
  const events = [];
  let previousDigest = null;
  for (const name of names) {
    const event = readJson(join(path, name));
    if (event.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
      throw new Error("checkpoint_event_schema_mismatch");
    }
    if (event.sequence !== events.length + 1) {
      throw new Error("checkpoint_event_sequence_gap");
    }
    if ((event.previousEventSha256 ?? null) !== previousDigest) {
      throw new Error("checkpoint_event_hash_chain_broken");
    }
    if (event.eventSha256 !== eventDigest(event)) {
      throw new Error("checkpoint_event_hash_invalid");
    }
    events.push(event);
    previousDigest = event.eventSha256;
  }
  return events;
}

function readManifest(directory) {
  const manifest = readJson(manifestPath(directory));
  if (manifest.schemaVersion !== CHECKPOINT_SCHEMA_VERSION) {
    throw new Error("checkpoint_manifest_schema_mismatch");
  }
  return manifest;
}

function listRunDirectories(root, phaseId) {
  const phaseDirectory = join(root, safeName(phaseId));
  if (!existsSync(phaseDirectory)) return [];
  return readdirSync(phaseDirectory)
    .map((name) => join(phaseDirectory, name))
    .filter((path) => {
      try {
        return lstatSync(path).isDirectory() && existsSync(manifestPath(path));
      } catch {
        return false;
      }
    });
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(directory, executionId) {
  const lockDirectory = join(directory, "lock");
  try {
    mkdirSync(lockDirectory, { recursive: false });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let owner = null;
    try {
      owner = readJson(join(lockDirectory, "owner.json"));
    } catch {
      throw new Error("phase_run_lock_owner_unreadable");
    }
    if (processIsAlive(owner?.pid)) {
      throw new Error("phase_run_locked");
    }
    const stalePath = `${lockDirectory}.stale-${Date.now()}-${randomUUID()}`;
    renameSync(lockDirectory, stalePath);
    mkdirSync(lockDirectory, { recursive: false });
  }
  writeDurable(join(lockDirectory, "owner.json"), {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    executionId,
    pid: process.pid,
    startedAt: now(),
  });
  return lockDirectory;
}

function releaseLock(lockDirectory) {
  if (!lockDirectory || !existsSync(lockDirectory)) return;
  rmSync(lockDirectory, { recursive: true, force: true });
}

export class PhaseCheckpointRun {
  constructor({ root, directory, manifest, events, executionId, redact }) {
    this.root = root;
    this.directory = directory;
    this.manifest = manifest;
    this.events = events;
    this.executionId = executionId;
    this.redact = typeof redact === "function" ? redact : (value) => value;
    this.lockDirectory = acquireLock(directory, executionId);
    this.closed = false;
  }

  get runId() {
    return this.manifest.runId;
  }

  get status() {
    return statusFromEvents(this.manifest, this.events);
  }

  get eventCount() {
    return this.events.length;
  }

  append(type, payload = {}, { status = null } = {}) {
    if (this.closed) throw new Error("checkpoint_run_closed");
    const sequence = this.events.length + 1;
    const eventId = `${this.executionId}-${sequence}`;
    const event = {
      schemaVersion: CHECKPOINT_SCHEMA_VERSION,
      runId: this.runId,
      executionId: this.executionId,
      sequence,
      eventId,
      type,
      at: now(),
      previousEventSha256: this.events.at(-1)?.eventSha256 ?? null,
      status: status && RUN_STATUSES.includes(status) ? status : undefined,
      payload: this.redact(payload),
    };
    if (event.status == null) delete event.status;
    event.eventSha256 = eventDigest(event);
    writeDurable(eventPath(this.directory, sequence, eventId), event);
    this.events.push(event);
    this.manifest.status = statusFromEvents(this.manifest, this.events);
    this.manifest.lastSequence = sequence;
    this.manifest.lastEventSha256 = event.eventSha256;
    this.manifest.updatedAt = now();
    writeDurable(manifestPath(this.directory), this.manifest);
    return event;
  }

  eventsOf(type) {
    return this.events.filter((event) => event.type === type);
  }

  requestPause(reason = "user_requested") {
    writeDurable(join(this.directory, "pause.request.json"), {
      schemaVersion: CHECKPOINT_SCHEMA_VERSION,
      runId: this.runId,
      requestedAt: now(),
      reason: String(reason).slice(0, 200),
      status: "PENDING",
    });
  }

  pauseRequested() {
    const path = join(this.directory, "pause.request.json");
    if (!existsSync(path)) return null;
    try {
      const request = readJson(path);
      return request.status === "PENDING" ? request : null;
    } catch {
      throw new Error("pause_request_invalid");
    }
  }

  applyPause(reason = "user_requested") {
    this.append("run.paused", { reason }, { status: "PAUSED" });
    const path = join(this.directory, "pause.request.json");
    if (existsSync(path)) {
      const request = readJson(path);
      writeDurable(path, { ...request, status: "APPLIED", appliedAt: now() });
    }
  }

  markStatus(status, payload = {}) {
    if (!RUN_STATUSES.includes(status)) throw new Error("checkpoint_status_invalid");
    this.append("run.status", payload, { status });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    releaseLock(this.lockDirectory);
  }
}

function compatible(manifest, schemaVersion, identityFingerprint) {
  return (
    manifest.schemaVersion === CHECKPOINT_SCHEMA_VERSION &&
    manifest.phaseSchemaVersion === schemaVersion &&
    manifest.identityFingerprint === identityFingerprint
  );
}

function buildRunId(phaseId) {
  return `${safeName(phaseId)}-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomUUID()}`;
}

export function identityFingerprint(identity) {
  return sha256(json(identity ?? null));
}

export function createPhaseRun({
  root,
  phaseId,
  phaseSchemaVersion,
  identity,
  metadata = {},
  runId = null,
  redact,
} = {}) {
  if (!root || !phaseId || !phaseSchemaVersion) {
    throw new Error("checkpoint_run_identity_missing");
  }
  const resolvedRunId = runId || buildRunId(phaseId);
  const directory = runDirectory(root, phaseId, resolvedRunId);
  mkdirSync(eventDirectory(directory), { recursive: true });
  const manifest = {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    phaseId,
    phaseSchemaVersion,
    runId: resolvedRunId,
    createdAt: now(),
    updatedAt: now(),
    status: "RUNNING",
    identityFingerprint: identityFingerprint(identity),
    identitySummary: metadata.identitySummary ?? null,
    metadata: redact ? redact(metadata) : metadata,
    lastSequence: 0,
    lastEventSha256: null,
  };
  writeDurable(manifestPath(directory), manifest);
  const executionId = randomUUID();
  const run = new PhaseCheckpointRun({
    root,
    directory,
    manifest,
    events: [],
    executionId,
    redact,
  });
  run.append("run.created", { metadata }, { status: "RUNNING" });
  run.append("execution.started", { resumed: false }, { status: "RUNNING" });
  return run;
}

export function openPhaseRun({
  root,
  phaseId,
  phaseSchemaVersion,
  identity,
  metadata = {},
  runId = null,
  newRun = false,
  redact,
} = {}) {
  const fingerprint = identityFingerprint(identity);
  const invalidCandidates = [];
  const candidates = listRunDirectories(root, phaseId)
    .map((directory) => {
      try {
        const manifest = readManifest(directory);
        const events = loadEvents(directory);
        return { directory, manifest, events };
      } catch (error) {
        invalidCandidates.push({ directory, reason: String(error?.message || error) });
        return null;
      }
    })
    .filter(Boolean);
  if (invalidCandidates.length && !newRun) {
    throw new Error("checkpoint_run_corrupt");
  }
  let selected = null;
  if (runId) {
    selected = candidates.find((candidate) => candidate.manifest.runId === runId) || null;
    if (!selected) throw new Error("checkpoint_run_not_found");
  } else if (!newRun) {
    selected = candidates
      .filter((candidate) => candidate.manifest.status !== "COMPLETE")
      .sort((a, b) => String(b.manifest.updatedAt).localeCompare(String(a.manifest.updatedAt)))[0] || null;
  }
  if (!selected) {
    return {
      action: "RUN",
      resumed: false,
      run: createPhaseRun({
        root,
        phaseId,
        phaseSchemaVersion,
        identity,
        metadata,
        redact,
      }),
    };
  }
  if (selected.manifest.status === "COMPLETE") {
    return { action: "COMPLETE", resumed: true, run: null, manifest: selected.manifest };
  }
  if (!compatible(selected.manifest, phaseSchemaVersion, fingerprint)) {
    return {
      action: "STALE",
      resumed: true,
      run: null,
      manifest: selected.manifest,
      reason: "checkpoint_identity_changed",
      currentIdentityFingerprint: fingerprint,
    };
  }
  const executionId = randomUUID();
  const run = new PhaseCheckpointRun({
    root,
    directory: selected.directory,
    manifest: selected.manifest,
    events: selected.events,
    executionId,
    redact,
  });
  if (run.status === "RUNNING" || run.status === "PAUSE_REQUESTED") {
    run.append("execution.interrupted", { previousStatus: run.status }, { status: "INTERRUPTED" });
  }
  run.append("execution.started", { resumed: true }, { status: "RUNNING" });
  return { action: "RUN", resumed: true, run };
}

export function inspectPhaseRuns({ root, phaseId } = {}) {
  return listRunDirectories(root, phaseId).map((directory) => {
    try {
      const manifest = readManifest(directory);
      const events = loadEvents(directory);
      return {
        runId: manifest.runId,
        phaseId: manifest.phaseId,
        status: statusFromEvents(manifest, events),
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
        eventCount: events.length,
        identityFingerprint: manifest.identityFingerprint,
      };
    } catch (error) {
      return { status: "BLOCKED", reason: String(error?.message || error) };
    }
  });
}

export function readPhaseRun({ root, phaseId, runId } = {}) {
  if (!root || !phaseId || !runId) throw new Error("checkpoint_run_identity_missing");
  const directory = runDirectory(root, phaseId, runId);
  if (!existsSync(manifestPath(directory))) throw new Error("checkpoint_run_not_found");
  return {
    directory,
    manifest: readManifest(directory),
    events: loadEvents(directory),
  };
}

export function requestPhaseRunPause({ root, phaseId, runId, reason } = {}) {
  const directory = runDirectory(root, phaseId, runId);
  if (!existsSync(manifestPath(directory))) throw new Error("checkpoint_run_not_found");
  writeDurable(join(directory, "pause.request.json"), {
    schemaVersion: CHECKPOINT_SCHEMA_VERSION,
    runId,
    requestedAt: now(),
    reason: String(reason || "user_requested").slice(0, 200),
    status: "PENDING",
  });
}
