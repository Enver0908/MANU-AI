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

export type LaunchGateEvidenceStatus = "approved" | "conditional" | "rejected" | "draft";

export type ProductionPilotLaunchGateScope = {
  channels?: {
    whatsapp?: boolean;
    telegram?: boolean;
  };
};

export type LaunchGateEvidenceRecord = {
  gateId: string;
  artifactTitle?: string;
  artifactRef?: string;
  owner?: string;
  approvalStatus?: LaunchGateEvidenceStatus;
  approvedAt?: string | null;
  reviewDueAt?: string | null;
  expiresAt?: string | null;
  coveredEvidence?: string[];
  sanitizedReference?: boolean;
};

export type LaunchGateEvaluation = {
  blocked: boolean;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  ignoredApprovalIds: string[];
};

export type LaunchGateEvidenceGateResult = {
  gateId: LaunchGateId;
  status: "approved" | "open";
  coveredEvidence: string[];
  missingEvidence: string[];
  blockingReasons: string[];
  evidenceRefs: string[];
};

export type LaunchGateEvidenceEvaluation = {
  blocked: boolean;
  approvedGateIds: LaunchGateId[];
  openGateIds: LaunchGateId[];
  ignoredEvidenceGateIds: string[];
  gateResults: LaunchGateEvidenceGateResult[];
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
      "user-supplied dietitian/client form privacy and prompt-allowlist approval",
      "official PDF corpus handling decision",
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
      "approved official regulation PDF corpus version",
      "corpus golden-case report",
      "user-supplied form clinical implication review",
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

export function resolveProductionPilotLaunchGatesForScope(
  scope: ProductionPilotLaunchGateScope = {},
): LaunchGateDefinition[] {
  const telegramEnabled = scope.channels?.telegram !== false;

  return PRODUCTION_PILOT_LAUNCH_GATES.map((gate) => {
    if (gate.id !== "channel_policy_review" || telegramEnabled) {
      return gate;
    }

    return {
      ...gate,
      label: "WhatsApp policy review",
      requiredEvidence: gate.requiredEvidence.filter(
        (item) => item !== "Telegram privacy and bot policy review",
      ),
    };
  });
}

export function evaluateProductionPilotLaunchGates(
  approvedGateIds: string[] = [],
  scope: ProductionPilotLaunchGateScope = {},
): LaunchGateEvaluation {
  const gateDefinitions = resolveProductionPilotLaunchGatesForScope(scope);
  const knownGateIds = new Set(gateDefinitions.map((gate) => gate.id));
  const approvedKnownGateIds = new Set(
    approvedGateIds.filter((gateId): gateId is LaunchGateId => knownGateIds.has(gateId as LaunchGateId)),
  );
  const openGateIds = gateDefinitions.map((gate) => gate.id).filter(
    (gateId) => !approvedKnownGateIds.has(gateId),
  );

  return {
    blocked: openGateIds.length > 0,
    approvedGateIds: [...approvedKnownGateIds],
    openGateIds,
    ignoredApprovalIds: approvedGateIds.filter((gateId) => !knownGateIds.has(gateId as LaunchGateId)),
  };
}

export function evaluateProductionPilotLaunchGateEvidence(
  evidenceRecords: LaunchGateEvidenceRecord[] = [],
  options: { now?: string; scope?: ProductionPilotLaunchGateScope } = {},
): LaunchGateEvidenceEvaluation {
  const now = options.now ? new Date(options.now) : new Date();
  const gateDefinitions = resolveProductionPilotLaunchGatesForScope(options.scope);
  const knownGateIds = new Set(gateDefinitions.map((gate) => gate.id));
  const ignoredEvidenceGateIds = unique(
    evidenceRecords
      .map((record) => record.gateId)
      .filter((gateId) => !knownGateIds.has(gateId as LaunchGateId)),
  );

  const gateResults = gateDefinitions.map((gate): LaunchGateEvidenceGateResult => {
    const requiredEvidence = new Set(gate.requiredEvidence);
    const recordsForGate = evidenceRecords.filter((record) => record.gateId === gate.id);
    const coveredEvidence = new Set<string>();
    const evidenceRefs = new Set<string>();
    const blockingReasons = new Set<string>();

    if (recordsForGate.length === 0) {
      blockingReasons.add("no evidence records supplied");
    }

    for (const record of recordsForGate) {
      const validation = validateEvidenceRecord(record, now);
      if (!validation.valid) {
        for (const reason of validation.reasons) blockingReasons.add(reason);
        continue;
      }

      for (const evidenceItem of record.coveredEvidence ?? []) {
        if (requiredEvidence.has(evidenceItem)) {
          coveredEvidence.add(evidenceItem);
        } else {
          blockingReasons.add(`unknown evidence item ignored: ${evidenceItem}`);
        }
      }

      if (record.artifactRef) evidenceRefs.add(record.artifactRef);
    }

    const missingEvidence = gate.requiredEvidence.filter((evidenceItem) => !coveredEvidence.has(evidenceItem));
    if (missingEvidence.length > 0) {
      blockingReasons.add(`missing required evidence: ${missingEvidence.join("; ")}`);
    }

    const gateApproved = missingEvidence.length === 0;

    return {
      gateId: gate.id,
      status: gateApproved ? "approved" : "open",
      coveredEvidence: gate.requiredEvidence.filter((evidenceItem) => coveredEvidence.has(evidenceItem)),
      missingEvidence,
      blockingReasons: gateApproved ? [] : [...blockingReasons],
      evidenceRefs: [...evidenceRefs],
    };
  });

  const approvedGateIds = gateResults
    .filter((result) => result.status === "approved")
    .map((result) => result.gateId);
  const openGateIds = gateResults
    .filter((result) => result.status === "open")
    .map((result) => result.gateId);

  return {
    blocked: openGateIds.length > 0,
    approvedGateIds,
    openGateIds,
    ignoredEvidenceGateIds,
    gateResults,
  };
}

function validateEvidenceRecord(record: LaunchGateEvidenceRecord, now: Date) {
  const reasons: string[] = [];

  if (record.approvalStatus !== "approved") {
    reasons.push(`evidence is not approved: ${record.approvalStatus ?? "missing"}`);
  }
  if (!record.artifactTitle?.trim()) reasons.push("missing artifact title");
  if (!record.artifactRef?.trim()) reasons.push("missing sanitized artifact reference");
  if (!record.owner?.trim()) reasons.push("missing approval owner");
  if (record.sanitizedReference !== true) reasons.push("artifact reference is not marked sanitized");
  if (!record.coveredEvidence || record.coveredEvidence.length === 0) reasons.push("missing covered evidence list");

  const approvedAt = parseRequiredDate(record.approvedAt, "approval date", reasons);
  if (approvedAt && approvedAt.getTime() > now.getTime()) {
    reasons.push("approval date is in the future");
  }

  const reviewDueAt = parseRequiredDate(record.reviewDueAt, "review due date", reasons);
  if (reviewDueAt && reviewDueAt.getTime() < now.getTime()) {
    reasons.push("review due date is expired");
  }

  if (record.expiresAt) {
    const expiresAt = parseOptionalDate(record.expiresAt, "expiry date", reasons);
    if (expiresAt && expiresAt.getTime() < now.getTime()) {
      reasons.push("approval artifact is expired");
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

function parseRequiredDate(value: string | null | undefined, label: string, reasons: string[]) {
  if (!value) {
    reasons.push(`missing ${label}`);
    return null;
  }
  return parseOptionalDate(value, label, reasons);
}

function parseOptionalDate(value: string, label: string, reasons: string[]) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    reasons.push(`invalid ${label}`);
    return null;
  }
  return parsed;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
