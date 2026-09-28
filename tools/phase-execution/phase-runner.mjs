export const PHASE_EXECUTION_SCHEMA_VERSION = "phase-execution-runner-v1";

export function validatePhaseDefinition(definition) {
  const failures = [];
  if (!definition?.phaseId) failures.push("phase_id_missing");
  if (!definition?.phaseSchemaVersion) failures.push("phase_schema_version_missing");
  const stages = definition?.stages ?? [];
  const ids = stages.map((stage) => stage.stageId);
  if (!ids.length) failures.push("stages_missing");
  if (new Set(ids).size !== ids.length) failures.push("duplicate_stage_id");
  stages.forEach((stage, index) => {
    if (!stage.stageId) failures.push(`stage_id_missing:${index}`);
    if (index > 0 && !(stage.prerequisites ?? []).includes(ids[index - 1])) {
      failures.push(`stage_prerequisite_mismatch:${stage.stageId}`);
    }
    if (typeof stage.verify !== "function") failures.push(`stage_verifier_missing:${stage.stageId}`);
  });
  return { status: failures.length ? "FAIL" : "PASS", failures };
}

export function assertPhaseDefinition(definition) {
  const result = validatePhaseDefinition(definition);
  if (result.status !== "PASS") {
    throw new Error(`phase_definition_invalid:${result.failures.join(",")}`);
  }
  return definition;
}

export function stageEvidenceStatus(stageLedger, requiredStageIds) {
  const actual = (stageLedger ?? []).map((stage) => stage.stageId);
  const failures = [];
  requiredStageIds.forEach((stageId, index) => {
    if (actual[index] !== stageId) failures.push(`stage_order_mismatch:${stageId}`);
    if (stageLedger?.[index]?.status !== "COMPLETE") {
      failures.push(`stage_not_complete:${stageId}`);
    }
  });
  return { status: failures.length ? "FAIL" : "PASS", failures };
}
