import { assertPhaseDefinition } from "./phase-runner.mjs";

// Copy this descriptor into a phase adapter and replace every verifier with a
// deterministic postcondition check. The runner never guesses a missing step.
export function defineResumablePhase({ phaseId, phaseSchemaVersion, stages }) {
  return assertPhaseDefinition({
    phaseId,
    phaseSchemaVersion,
    stages: stages.map((stage) => ({
      stageId: stage.stageId,
      prerequisites: stage.prerequisites ?? [],
      verify: stage.verify,
    })),
  });
}

export function defineWorkUnit({
  unitId,
  stageId,
  inputIdentity,
  outputPaths,
  run,
  verify,
  externalSideEffect = "none",
}) {
  if (!unitId || !stageId || typeof run !== "function" || typeof verify !== "function") {
    throw new Error("resumable_work_unit_contract_invalid");
  }
  if (externalSideEffect !== "none" && externalSideEffect !== "receipt_required") {
    throw new Error("resumable_external_side_effect_policy_invalid");
  }
  return {
    unitId,
    stageId,
    inputIdentity: inputIdentity ?? null,
    outputPaths: outputPaths ?? [],
    run,
    verify,
    externalSideEffect,
  };
}
