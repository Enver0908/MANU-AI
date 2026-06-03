export type LaunchGateId =
  | "legal_privacy_review"
  | "clinical_taxonomy_approval"
  | "provider_vendor_review"
  | "channel_policy_review"
  | "incident_response_runbook"
  | "backup_restore_test"
  | "secret_rotation_plan"
  | "dependency_audit_clearance";

export type LaunchGateDefinition = {
  id: LaunchGateId;
  label: string;
  requiredBefore: "pilot";
  sourceOfApproval: "external_review";
  requiredEvidence: string[];
};

export type LaunchGateEvaluation = {
  blocked: boolean;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  ignoredApprovalIds: string[];
};

export const PRODUCTION_PILOT_LAUNCH_GATES: LaunchGateDefinition[] = [
  {
    id: "legal_privacy_review",
    label: "Legal and privacy review",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: [
      "legal basis matrix",
      "privacy notice and client permission documents",
      "medical-device or clinical-decision-support classification memo",
    ],
  },
  {
    id: "clinical_taxonomy_approval",
    label: "Qualified dietitian clinical taxonomy approval",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: [
      "qualified dietitian sign-off",
      "current clinical golden test report",
      "taxonomy change log",
      "approved scope rule corpus version",
      "scope guard golden evaluation report",
    ],
  },
  {
    id: "provider_vendor_review",
    label: "Provider vendor and retention review",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: [
      "provider terms review",
      "health-data retention configuration",
      "prompt and completion logging decision",
    ],
  },
  {
    id: "channel_policy_review",
    label: "WhatsApp and Telegram policy review",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: [
      "WhatsApp healthcare feasibility review",
      "Telegram privacy and bot policy review",
      "opt-in, opt-out, template, and service-window procedure",
    ],
  },
  {
    id: "incident_response_runbook",
    label: "Incident response and deletion workflow runbook",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: [
      "incident response runbook",
      "breach escalation owner list",
      "client deletion and export operating procedure",
    ],
  },
  {
    id: "backup_restore_test",
    label: "Backup expiry and restore test",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: ["backup expiry policy", "restore drill result", "restore owner and cadence"],
  },
  {
    id: "secret_rotation_plan",
    label: "Production secret rotation plan",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: ["secret inventory", "rotation cadence", "emergency revocation procedure"],
  },
  {
    id: "dependency_audit_clearance",
    label: "Production dependency audit clearance",
    requiredBefore: "pilot",
    sourceOfApproval: "external_review",
    requiredEvidence: ["production dependency audit report", "R-405 resolution or formal acceptance"],
  },
];

export function evaluateProductionPilotLaunchGates(approvedGateIds: string[] = []): LaunchGateEvaluation {
  const knownGateIds = new Set(PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id));
  const approvedKnownGateIds = new Set(
    approvedGateIds.filter((gateId): gateId is LaunchGateId => knownGateIds.has(gateId as LaunchGateId)),
  );
  const openGateIds = PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => gate.id).filter(
    (gateId) => !approvedKnownGateIds.has(gateId),
  );

  return {
    blocked: openGateIds.length > 0,
    approvedGateIds: [...approvedKnownGateIds],
    openGateIds,
    ignoredApprovalIds: approvedGateIds.filter((gateId) => !knownGateIds.has(gateId as LaunchGateId)),
  };
}
