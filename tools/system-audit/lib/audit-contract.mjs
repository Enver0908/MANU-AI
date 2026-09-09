import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUDIT_PLAN_ID, AUDIT_PLAN_VERSION, PHASE_1_ID, PHASE_1_STAGES, getStageDefinition } from "./audit-plan.mjs";

export const STAGE_STATUSES = ["LOCKED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED", "STALE"];
export const PHASE_STATUSES = ["OPEN", "VERIFYING", "CLOSED", "STALE"];

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function stableDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function createInitialState({ repoRoot, observedAt, sourceCommit }) {
  return {
    schemaVersion: "aiya-system-audit-stage-state-v1",
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_1_ID,
    sourceCommit,
    openedAt: observedAt,
    phaseStatus: "OPEN",
    stages: Object.fromEntries(PHASE_1_STAGES.map((stage) => [stage.id, {
      stageId: stage.id,
      status: "LOCKED",
      evidencePath: null,
      evidenceDigest: null,
      outputDigests: {},
    }])),
    repoRoot,
  };
}

export function loadState(statePath, context) {
  if (!existsSync(statePath)) return createInitialState(context);
  const state = readJson(statePath);
  if (state.planId !== AUDIT_PLAN_ID || state.planVersion !== AUDIT_PLAN_VERSION || state.phaseId !== PHASE_1_ID) {
    throw new Error("audit_state_plan_mismatch");
  }
  return state;
}

export function saveState(statePath, state) {
  writeJson(statePath, state);
}

export function assertCanBeginStage(state, stageId) {
  const stage = getStageDefinition(stageId);
  const current = state.stages[stageId];
  if (!current) throw new Error(`stage_state_missing:${stageId}`);
  if (current.status === "VERIFIED") throw new Error(`stage_already_verified:${stageId}`);
  if (current.status === "IN_PROGRESS" || current.status === "IMPLEMENTED") {
    throw new Error(`stage_already_started:${stageId}`);
  }
  for (const prerequisiteId of stage.prerequisiteStageIds) {
    if (state.stages[prerequisiteId]?.status !== "VERIFIED") {
      throw new Error(`stage_prerequisite_not_verified:${stageId}:${prerequisiteId}`);
    }
  }
}

export function markStageInProgress(state, stageId, now) {
  assertCanBeginStage(state, stageId);
  state.stages[stageId].status = "IN_PROGRESS";
  state.stages[stageId].startedAt = now;
  return state;
}

export function markStageImplemented(state, stageId, now, outputDigests) {
  const current = state.stages[stageId];
  if (!current || current.status !== "IN_PROGRESS") throw new Error(`stage_not_in_progress:${stageId}`);
  current.status = "IMPLEMENTED";
  current.implementedAt = now;
  current.outputDigests = outputDigests;
  return state;
}

export function markStageVerified(state, stageId, now, evidencePath, evidenceDigest, outputDigests) {
  const current = state.stages[stageId];
  if (!current || current.status !== "IMPLEMENTED") throw new Error(`stage_not_implemented:${stageId}`);
  current.status = "VERIFIED";
  current.verifiedAt = now;
  current.evidencePath = evidencePath;
  current.evidenceDigest = evidenceDigest;
  current.outputDigests = outputDigests;
  return state;
}

export function assertPhaseCanVerify(state, { repoRoot = null } = {}) {
  const unverified = PHASE_1_STAGES.filter((stage) => state.stages[stage.id]?.status !== "VERIFIED").map((stage) => stage.id);
  if (unverified.length > 0) throw new Error(`phase_stages_not_verified:${unverified.join(",")}`);
  if (repoRoot) {
    for (const stage of PHASE_1_STAGES) {
      const stageState = state.stages[stage.id];
      for (const fileName of stage.requiredOutputFiles) {
        const filePath = path.join(repoRoot, "docs", "system-audit", "phase-1", fileName);
        if (!existsSync(filePath) || stageState.outputDigests?.[fileName] !== sha256File(filePath)) {
          throw new Error(`stage_output_stale:${stage.id}:${fileName}`);
        }
      }
      const evidenceFile = path.join(repoRoot, stageState.evidencePath);
      if (!stageState.evidencePath || !existsSync(evidenceFile) || sha256File(evidenceFile) !== stageState.evidenceDigest) {
        throw new Error(`stage_evidence_stale:${stage.id}`);
      }
    }
  }
  return true;
}

export function buildEvidence({ stage, now, sourceCommit, outputFiles, operations, verification }) {
  return {
    schemaVersion: "aiya-system-audit-stage-evidence-v1",
    runId: `${PHASE_1_ID}-${stage.id}-${now.replace(/[^0-9]/g, "").slice(0, 17)}`,
    planId: AUDIT_PLAN_ID,
    planVersion: AUDIT_PLAN_VERSION,
    phaseId: PHASE_1_ID,
    stageId: stage.id,
    title: stage.title,
    sourceCommit,
    verifiedAt: now,
    operations,
    outputFiles,
    verification,
    status: "VERIFIED",
    evidenceDigest: null,
  };
}

export function finalizeEvidence(evidence) {
  const withoutDigest = { ...evidence, evidenceDigest: null };
  return { ...evidence, evidenceDigest: stableDigest(withoutDigest) };
}
