import {
  evaluateProductionPilotLaunchGateEvidence,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";

export type ScopeGuardProviderGateInput =
  | string[]
  | {
      launchGateEvidence?: LaunchGateEvidenceRecord[];
      now?: string;
    };

export function isRealScopeGuardProviderAllowed(input: ScopeGuardProviderGateInput = []) {
  if (process.env.MANU_ALLOW_REAL_SCOPE_GUARD !== "true") {
    return false;
  }

  if (Array.isArray(input)) {
    return false;
  }

  const evaluation = evaluateProductionPilotLaunchGateEvidence(input.launchGateEvidence ?? [], {
    now: input.now,
  });

  return (
    !evaluation.openGateIds.includes("clinical_taxonomy_approval") &&
    !evaluation.openGateIds.includes("provider_vendor_review")
  );
}
