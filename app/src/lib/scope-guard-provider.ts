import { evaluateProductionPilotLaunchGates } from "./launch-gates";

export function isRealScopeGuardProviderAllowed(approvedLaunchGateIds: string[] = []) {
  const evaluation = evaluateProductionPilotLaunchGates(approvedLaunchGateIds);
  if (evaluation.openGateIds.includes("clinical_taxonomy_approval")) {
    return false;
  }
  if (process.env.MANU_ALLOW_REAL_SCOPE_GUARD !== "true") {
    return false;
  }
  return true;
}
