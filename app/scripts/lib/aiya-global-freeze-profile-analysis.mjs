const LONG_TASK_NAMES = new Set([
  "RunTask",
  "Task",
  "ThreadControllerImpl::RunTask",
  "ThreadPool_RunTask",
]);

const MAX_SAMPLED_INTERVAL_MS = 50;
const MAX_REPORTED_FRAMES = 10;

function frameKey(node) {
  return JSON.stringify([node.id, node.functionName, node.script, node.line, node.column]);
}

function nodeFromChunk(raw) {
  if (!raw || !Number.isInteger(raw.id)) return null;
  return {
    id: raw.id,
    parent: Number.isInteger(raw.parent) ? raw.parent : null,
    functionName: typeof raw.functionName === "string" ? raw.functionName : "<anonymous>",
    script: typeof raw.script === "string" ? raw.script : "<script>",
    line: Number.isInteger(raw.line) ? raw.line : null,
    column: Number.isInteger(raw.column) ? raw.column : null,
    children: Array.isArray(raw.children) ? raw.children.filter(Number.isInteger) : [],
  };
}

function buildProfile(profileId, chunks) {
  const ordered = [...chunks].sort((a, b) => a.timestampMs - b.timestampMs);
  const first = ordered[0];
  const nodes = new Map();
  const conflicts = new Set();
  const samples = [];
  let sequence = 0;
  let inputSampleCount = 0;
  let inputDeltaCount = 0;
  let invalidSampleCount = 0;
  let negativeDeltaCount = 0;
  let pairCountMismatch = false;
  let nodeConflictCount = 0;
  let timeUs = first.startedAtMs === null ? null : first.startedAtMs * 1_000;
  let clockValid = Number.isFinite(timeUs);

  for (const chunk of ordered) {
    const profile = chunk.profile;
    const chunkNodes = Array.isArray(profile.nodes) ? profile.nodes : [];
    for (const raw of chunkNodes) {
      const node = nodeFromChunk(raw);
      if (!node) continue;
      const previous = nodes.get(node.id);
      if (previous && (frameKey(previous) !== frameKey(node) ||
        (previous.parent !== null && node.parent !== null && previous.parent !== node.parent))) {
        if (!conflicts.has(node.id)) nodeConflictCount += 1;
        conflicts.add(node.id);
        nodes.delete(node.id);
        continue;
      }
      if (!conflicts.has(node.id)) {
        nodes.set(node.id, {
          ...node,
          parent: previous?.parent ?? node.parent,
          children: previous?.children.length ? previous.children : node.children,
        });
      }
    }

    for (const parent of nodes.values()) {
      for (const childId of parent.children) {
        const child = nodes.get(childId);
        if (child && child.parent === null) child.parent = parent.id;
      }
    }

    const chunkSamples = Array.isArray(profile.samples) ? profile.samples : [];
    const deltas = Array.isArray(profile.timeDeltasUs) ? profile.timeDeltasUs : [];
    inputSampleCount += chunkSamples.length;
    inputDeltaCount += deltas.length;
    if (chunkSamples.length !== deltas.length) pairCountMismatch = true;

    const pairedCount = Math.min(chunkSamples.length, deltas.length);
    for (let index = 0; index < pairedCount; index += 1) {
      const deltaUs = deltas[index];
      const nodeId = chunkSamples[index];
      if (!Number.isFinite(deltaUs) || !Number.isInteger(nodeId)) {
        invalidSampleCount += 1;
        if (!Number.isFinite(deltaUs)) clockValid = false;
      } else {
        if (deltaUs < 0) negativeDeltaCount += 1;
        if (clockValid) timeUs += deltaUs;
      }
      samples.push({
        timestampMs: clockValid && Number.isInteger(nodeId) ? timeUs / 1_000 : null,
        nodeId: Number.isInteger(nodeId) ? nodeId : null,
        sequence: sequence++,
      });
    }
    invalidSampleCount += Math.abs(chunkSamples.length - pairedCount);
  }

  samples.sort((a, b) => {
    if (a.timestampMs === null) return b.timestampMs === null ? a.sequence - b.sequence : 1;
    if (b.timestampMs === null) return -1;
    return a.timestampMs - b.timestampMs || a.sequence - b.sequence;
  });

  return {
    profileId,
    processId: first.processId,
    ownerThread: first.ownerThread,
    source: first.source,
    startedAtMs: first.startedAtMs,
    chunkCount: ordered.length,
    inputSampleCount,
    inputDeltaCount,
    invalidSampleCount,
    negativeDeltaCount,
    pairCountMismatch,
    nodeConflictCount,
    conflicts,
    nodes,
    samples,
  };
}

function lowerBound(samples, timestampMs) {
  let low = 0;
  let high = samples.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (samples[middle].timestampMs < timestampMs) low = middle + 1;
    else high = middle;
  }
  return low;
}

function resolveStack(nodeId, nodes, conflicts) {
  const stack = [];
  const visited = new Set();
  let currentId = nodeId;
  let incomplete = false;
  while (Number.isInteger(currentId)) {
    if (visited.has(currentId) || conflicts.has(currentId)) {
      incomplete = true;
      break;
    }
    visited.add(currentId);
    const node = nodes.get(currentId);
    if (!node) {
      incomplete = true;
      break;
    }
    stack.push(node);
    currentId = node.parent;
  }
  return { stack: stack.reverse(), incomplete };
}

function makeFrameTotals() {
  return new Map();
}

function addFrameTime(totals, node, durationMs) {
  const key = frameKey(node);
  const current = totals.get(key) ?? {
    functionName: node.functionName,
    script: node.script,
    line: node.line,
    column: node.column,
    inclusiveSampleMs: 0,
    selfSampleMs: 0,
    sampleCount: 0,
  };
  current.inclusiveSampleMs += durationMs;
  current.sampleCount += 1;
  totals.set(key, current);
}

function summarizeFrameTotals(totals, selfTotals) {
  const selfByKey = selfTotals;
  return [...totals.entries()]
    .map(([key, frame]) => ({
      ...frame,
      inclusiveSampleMs: Number(frame.inclusiveSampleMs.toFixed(3)),
      selfSampleMs: Number((selfByKey.get(key) ?? 0).toFixed(3)),
    }))
    .sort((a, b) => b.inclusiveSampleMs - a.inclusiveSampleMs || b.selfSampleMs - a.selfSampleMs)
    .slice(0, MAX_REPORTED_FRAMES);
}

function attributeTask(task, profile) {
  const startMs = task.timestampMs;
  const endMs = startMs + task.durationMs;
  const samples = profile.samples;
  const startIndex = Math.max(0, lowerBound(samples, startMs) - 1);
  const inclusive = makeFrameTotals();
  const self = new Map();
  let coveredMs = 0;
  let largeGapMs = 0;
  let unresolvedStackMs = 0;
  let unresolvedParentSampleCount = 0;
  let missingNodeSampleCount = 0;
  let attributedSampleCount = 0;

  for (let index = startIndex; index < samples.length - 1; index += 1) {
    const sample = samples[index];
    const next = samples[index + 1];
    if (sample.timestampMs === null || sample.timestampMs >= endMs) break;
    if (next.timestampMs === null || next.timestampMs <= sample.timestampMs) continue;
    const intervalMs = next.timestampMs - sample.timestampMs;
    const overlapMs = Math.max(0, Math.min(endMs, next.timestampMs) - Math.max(startMs, sample.timestampMs));
    if (overlapMs <= 0) continue;
    if (intervalMs > MAX_SAMPLED_INTERVAL_MS) {
      largeGapMs += overlapMs;
      continue;
    }
    if (!Number.isInteger(sample.nodeId)) {
      missingNodeSampleCount += 1;
      continue;
    }
    const resolved = resolveStack(sample.nodeId, profile.nodes, profile.conflicts);
    if (!resolved.stack.length) {
      missingNodeSampleCount += 1;
      continue;
    }
    if (resolved.incomplete) {
      unresolvedStackMs += overlapMs;
      unresolvedParentSampleCount += 1;
    }
    coveredMs += overlapMs;
    attributedSampleCount += 1;
    for (const node of resolved.stack) addFrameTime(inclusive, node, overlapMs);
    const leafKey = frameKey(resolved.stack.at(-1));
    self.set(leafKey, (self.get(leafKey) ?? 0) + overlapMs);
  }

  const unknownMs = Math.max(0, task.durationMs - coveredMs);
  const sourceCoverage = task.durationMs > 0 ? coveredMs / task.durationMs : 0;
  return {
    timestampMs: task.timestampMs,
    durationMs: task.durationMs,
    threadDurationMs: task.threadDurationMs,
    attributionStatus: sourceCoverage > 0 ? "SAMPLED_SOURCE_PARTIAL" : "SOURCE_UNAVAILABLE",
    sourceCoveragePercent: Number((sourceCoverage * 100).toFixed(2)),
    attributedSampleCount,
    unknownMs: Number(unknownMs.toFixed(3)),
    largeSampleGapMs: Number(largeGapMs.toFixed(3)),
    unresolvedStackMs: Number(unresolvedStackMs.toFixed(3)),
    unresolvedParentSampleCount,
    missingNodeSampleCount,
    profileId: profile.profileId,
    profileSource: profile.source,
    topInclusiveFrames: summarizeFrameTotals(inclusive, self),
    topSelfFrames: summarizeFrameTotals(selfToInclusive(self, inclusive), self),
  };
}

function selfToInclusive(self, inclusive) {
  const result = new Map();
  for (const [key, durationMs] of self) {
    const frame = inclusive.get(key);
    if (frame) result.set(key, { ...frame, inclusiveSampleMs: durationMs });
  }
  return result;
}

function profilePriority(source) {
  if (source === "Internal") return 0;
  if (source === "Inspector") return 1;
  if (source === "SelfProfiling") return 2;
  return 3;
}

export function summarizeNativeProfileAttribution(trace) {
  if (!trace || !Array.isArray(trace.events) || !Array.isArray(trace.profiles)) {
    throw new Error("native_profile_trace_shape_invalid");
  }
  const groups = new Map();
  for (const chunk of trace.profiles) {
    if (typeof chunk.profileId !== "string" || !Number.isInteger(chunk.processId) ||
      chunk.ownerThread !== "CrRendererMain" || !Number.isFinite(chunk.startedAtMs)) continue;
    const key = `${chunk.processId}:${chunk.profileId}`;
    const chunks = groups.get(key) ?? [];
    chunks.push(chunk);
    groups.set(key, chunks);
  }

  const profiles = [...groups.entries()].map(([profileId, chunks]) => buildProfile(profileId, chunks));
  for (const profile of profiles) {
    for (const node of profile.nodes.values()) {
      for (const childId of node.children) {
        const child = profile.nodes.get(childId);
        if (child && child.parent === null) child.parent = node.id;
      }
    }
  }

  const tasks = trace.events
    .filter((event) => LONG_TASK_NAMES.has(event.name) && event.thread === "CrRendererMain" &&
      Number.isInteger(event.pid) && Number.isFinite(event.timestampMs) && Number.isFinite(event.durationMs) &&
      event.durationMs >= 50)
    .map((event) => ({
      processId: event.pid,
      timestampMs: event.timestampMs,
      durationMs: event.durationMs,
      threadDurationMs: Number.isFinite(event.threadDurationMs) ? event.threadDurationMs : null,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);

  const mappedTasks = tasks.map((task) => {
    const candidates = profiles
      .filter((profile) => profile.processId === task.processId && profile.samples.length > 1 &&
        profile.samples[0].timestampMs !== null &&
        profile.samples[0].timestampMs <= task.timestampMs + task.durationMs &&
        profile.samples.at(-1).timestampMs >= task.timestampMs)
      .sort((a, b) => profilePriority(a.source) - profilePriority(b.source) ||
        b.inputSampleCount - a.inputSampleCount);
    if (!candidates.length) {
      return {
        timestampMs: task.timestampMs,
        durationMs: task.durationMs,
        threadDurationMs: task.threadDurationMs,
        attributionStatus: "NO_OVERLAPPING_RENDERER_PROFILE",
        topInclusiveFrames: [],
        topSelfFrames: [],
      };
    }
    return attributeTask(task, candidates[0]);
  });

  return {
    status: profiles.length > 0 ? "RENDERER_PROFILE_MAPPED" : "RENDERER_PROFILE_UNAVAILABLE",
    profileCount: profiles.length,
    profileChunkCount: profiles.reduce((sum, profile) => sum + profile.chunkCount, 0),
    sampleCount: profiles.reduce((sum, profile) => sum + profile.inputSampleCount, 0),
    deltaCount: profiles.reduce((sum, profile) => sum + profile.inputDeltaCount, 0),
    negativeDeltaCount: profiles.reduce((sum, profile) => sum + profile.negativeDeltaCount, 0),
    invalidSampleCount: profiles.reduce((sum, profile) => sum + profile.invalidSampleCount, 0),
    sampleDeltaCountMismatch: profiles.some((profile) => profile.pairCountMismatch),
    nodeConflictCount: profiles.reduce((sum, profile) => sum + profile.nodeConflictCount, 0),
    ownerThreadMapping: profiles.length > 0 ? "PROFILE_HEADER_TO_RENDERER_MAIN" : "UNAVAILABLE",
    sampledIntervalCapMs: MAX_SAMPLED_INTERVAL_MS,
    longTaskCount: tasks.length,
    attributedLongTaskCount: mappedTasks.filter((task) => task.attributionStatus === "SAMPLED_SOURCE_PARTIAL").length,
    longTasks: mappedTasks,
  };
}
