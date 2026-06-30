import {
  evaluateProductionPilotLaunchGateEvidence,
  type LaunchGateEvidenceRecord,
} from "./launch-gates";
import type { Phase80R405Status } from "./phase-80c-launch-gate-evidence-evaluation";

export const PHASE_80D_VERSION = "phase80-r405-closure-evaluation-v1";
export const MIN_PATCHED_POSTCSS_VERSION = "8.5.10";
export const R405_KNOWN_AUDIT_FINDING_KEYS = [
  "next:postcss",
  "postcss:GHSA-qx2v-qp2m-jg93",
] as const;

export type Phase80dPatchPath = "safe_stable_patch_available" | "no_safe_stable_patch";

export type Phase80dFormalR405Acceptance = {
  owner?: string;
  rationale?: string;
  compensatingControls?: string[];
  acceptedFindingKeys?: string[];
  approvedAt?: string | null;
  reviewDueAt?: string | null;
  expiresAt?: string | null;
  artifactRef?: string;
  sanitizedReference?: boolean;
};

export type Phase80dR405ClosureEvaluation = {
  phase80dVersion: string;
  generatedAt: string;
  nextLatestVersion: string;
  eslintConfigNextLatestVersion: string;
  nestedPostcssVersion: string;
  patchPath: Phase80dPatchPath;
  dependencyFilesChanged: boolean;
  productionAuditFindings: string[];
  unknownProductionAuditFindings: string[];
  formalAcceptanceArtifactSupplied: boolean;
  formalAcceptanceValid: boolean;
  formalAcceptanceBlockingReasons: string[];
  dependencyGateApproved: boolean;
  r405Status: Phase80R405Status;
  narrative: string;
  blockingReasons: string[];
};

export function parseSemverTuple(version: string) {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

export function isPostcssAtLeast(version: string, minimum = MIN_PATCHED_POSTCSS_VERSION) {
  const current = parseSemverTuple(version);
  const target = parseSemverTuple(minimum);
  if (!current || !target) return false;
  for (let index = 0; index < 3; index += 1) {
    if (current[index] > target[index]) return true;
    if (current[index] < target[index]) return false;
  }
  return true;
}

export function isStableNextVersion(version: string) {
  const normalized = version.trim().toLowerCase();
  return !/(canary|beta|rc)/.test(normalized);
}

export function evaluateSafeStablePatchPath(input: {
  nextLatestVersion: string;
  nestedPostcssVersion: string;
  eslintConfigNextLatestVersion: string;
}) {
  if (!isStableNextVersion(input.nextLatestVersion)) {
    return "no_safe_stable_patch" as const;
  }
  if (!isStableNextVersion(input.eslintConfigNextLatestVersion)) {
    return "no_safe_stable_patch" as const;
  }
  if (input.nextLatestVersion !== input.eslintConfigNextLatestVersion) {
    return "no_safe_stable_patch" as const;
  }
  if (!isPostcssAtLeast(input.nestedPostcssVersion)) {
    return "no_safe_stable_patch" as const;
  }
  return "safe_stable_patch_available" as const;
}

export function extractProductionAuditFindingKeys(
  auditReport: {
    vulnerabilities?: Record<string, { via?: unknown[]; severity?: unknown }>;
  } = {},
) {
  const keys = new Set<string>();
  const vulnerabilities = auditReport.vulnerabilities ?? {};

  if (vulnerabilities.next) {
    const via = vulnerabilities.next.via ?? [];
    if (via.some((entry) => entry === "postcss" || (typeof entry === "object" && entry !== null))) {
      keys.add("next:postcss");
    }
  }

  if (vulnerabilities.postcss) {
    const via = vulnerabilities.postcss.via ?? [];
    if (
      via.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "url" in entry &&
          String((entry as { url?: string }).url).includes("GHSA-qx2v-qp2m-jg93"),
      )
    ) {
      keys.add("postcss:GHSA-qx2v-qp2m-jg93");
    }
  }

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (name === "next" || name === "postcss") continue;
    const severity =
      typeof (vulnerability as { severity?: unknown }).severity === "string"
        ? (vulnerability as { severity: string }).severity
        : "unknown";
    keys.add(`${name}:${severity}`);
  }

  return [...keys];
}

export function auditReportsOnlyKnownR405Findings(findingKeys: string[]) {
  if (findingKeys.length === 0) return true;
  return findingKeys.every((key) =>
    R405_KNOWN_AUDIT_FINDING_KEYS.includes(key as (typeof R405_KNOWN_AUDIT_FINDING_KEYS)[number]),
  );
}

export function hasFormalR405AcceptanceEvidence(evidenceRecords: LaunchGateEvidenceRecord[]) {
  return evidenceRecords.some((record) => record.gateId === "dependency_audit_clearance");
}

export function getUnknownProductionAuditFindings(findingKeys: string[]) {
  return findingKeys.filter(
    (key) => !R405_KNOWN_AUDIT_FINDING_KEYS.includes(key as (typeof R405_KNOWN_AUDIT_FINDING_KEYS)[number]),
  );
}

function parseRequiredDate(value: string | null | undefined, label: string, reasons: string[], now: Date) {
  if (!value) {
    reasons.push(`missing formal R-405 acceptance ${label}`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    reasons.push(`invalid formal R-405 acceptance ${label}`);
    return null;
  }
  if (label === "approval date" && parsed.getTime() > now.getTime()) {
    reasons.push("formal R-405 acceptance approval date is in the future");
  }
  if (label === "review due date" && parsed.getTime() < now.getTime()) {
    reasons.push("formal R-405 acceptance review due date is expired");
  }
  return parsed;
}

function parseOptionalDate(value: string | null | undefined, label: string, reasons: string[], now: Date) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    reasons.push(`invalid formal R-405 acceptance ${label}`);
    return null;
  }
  if (parsed.getTime() < now.getTime()) {
    reasons.push("formal R-405 acceptance artifact is expired");
  }
  return parsed;
}

export function validateFormalR405Acceptance(input: {
  acceptance?: Phase80dFormalR405Acceptance;
  dependencyGateApproved: boolean;
  productionAuditFindings: string[];
  unknownProductionAuditFindings: string[];
  now: string;
}) {
  const reasons: string[] = [];
  const acceptance = input.acceptance;
  const now = new Date(input.now);

  if (!acceptance) {
    reasons.push("formal R-405 acceptance details not supplied");
    return { valid: false, reasons };
  }
  if (!input.dependencyGateApproved) {
    reasons.push("dependency_audit_clearance evidence is incomplete or invalid");
  }
  if (input.unknownProductionAuditFindings.length > 0) {
    reasons.push(`unknown production audit findings are not accepted by R-405 waiver: ${input.unknownProductionAuditFindings.join(", ")}`);
  }
  if (!acceptance.owner?.trim()) reasons.push("missing formal R-405 acceptance owner");
  if (!acceptance.rationale?.trim()) reasons.push("missing formal R-405 acceptance rationale");
  if (!acceptance.compensatingControls || acceptance.compensatingControls.length === 0) {
    reasons.push("missing formal R-405 acceptance compensating controls");
  }
  if (!acceptance.artifactRef?.trim()) reasons.push("missing formal R-405 acceptance sanitized artifact reference");
  if (acceptance.sanitizedReference !== true) {
    reasons.push("formal R-405 acceptance artifact reference is not marked sanitized");
  }
  if (!acceptance.acceptedFindingKeys || acceptance.acceptedFindingKeys.length === 0) {
    reasons.push("missing formal R-405 accepted finding keys");
  } else {
    for (const finding of input.productionAuditFindings) {
      if (!acceptance.acceptedFindingKeys.includes(finding)) {
        reasons.push(`formal R-405 acceptance does not cover finding: ${finding}`);
      }
    }
  }

  parseRequiredDate(acceptance.approvedAt, "approval date", reasons, now);
  parseRequiredDate(acceptance.reviewDueAt, "review due date", reasons, now);
  parseOptionalDate(acceptance.expiresAt, "expiry date", reasons, now);

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function resolvePhase80dR405Status(input: {
  technicalClosureAllowed: boolean;
  productionAuditFindings: string[];
  dependencyGateApproved: boolean;
  formalAcceptanceArtifactSupplied: boolean;
  formalAcceptanceValid?: boolean;
}): Phase80R405Status {
  if (input.technicalClosureAllowed && input.productionAuditFindings.length === 0) {
    return "technically_resolved";
  }
  if (
    input.dependencyGateApproved &&
    input.formalAcceptanceArtifactSupplied &&
    input.formalAcceptanceValid === true
  ) {
    return "formally_accepted";
  }
  return "open";
}

export function buildPhase80dR405ClosureEvaluation(input: {
  nextLatestVersion: string;
  nestedPostcssVersion: string;
  eslintConfigNextLatestVersion: string;
  productionAuditFindings: string[];
  evidenceRecords?: LaunchGateEvidenceRecord[];
  formalAcceptance?: Phase80dFormalR405Acceptance;
  dependencyFilesChanged?: boolean;
  technicallyRemediated?: boolean;
  now?: string;
}): Phase80dR405ClosureEvaluation {
  const generatedAt = input.now ?? new Date().toISOString();
  const evidenceRecords = input.evidenceRecords ?? [];
  const patchPath = evaluateSafeStablePatchPath({
    nextLatestVersion: input.nextLatestVersion,
    nestedPostcssVersion: input.nestedPostcssVersion,
    eslintConfigNextLatestVersion: input.eslintConfigNextLatestVersion,
  });
  const dependencyEvaluation = evaluateProductionPilotLaunchGateEvidence(evidenceRecords, {
    now: generatedAt,
  });
  const dependencyGateApproved = dependencyEvaluation.approvedGateIds.includes(
    "dependency_audit_clearance",
  );
  const formalAcceptanceArtifactSupplied =
    hasFormalR405AcceptanceEvidence(evidenceRecords) || input.formalAcceptance !== undefined;
  const technicallyRemediated = input.technicallyRemediated ?? false;
  const dependencyFilesChanged = input.dependencyFilesChanged ?? false;
  const unknownProductionAuditFindings = getUnknownProductionAuditFindings(input.productionAuditFindings);
  const technicalClosureAllowed =
    patchPath === "safe_stable_patch_available" &&
    dependencyFilesChanged &&
    technicallyRemediated &&
    unknownProductionAuditFindings.length === 0;
  const formalAcceptanceValidation = validateFormalR405Acceptance({
    acceptance: input.formalAcceptance,
    dependencyGateApproved,
    productionAuditFindings: input.productionAuditFindings,
    unknownProductionAuditFindings,
    now: generatedAt,
  });
  const r405Status = resolvePhase80dR405Status({
    technicalClosureAllowed,
    productionAuditFindings: input.productionAuditFindings,
    dependencyGateApproved,
    formalAcceptanceArtifactSupplied,
    formalAcceptanceValid: formalAcceptanceValidation.valid,
  });

  const blockingReasons: string[] = [];
  if (patchPath === "no_safe_stable_patch" && r405Status !== "formally_accepted") {
    blockingReasons.push(
      `stable next@latest ${input.nextLatestVersion} still bundles nested postcss@${input.nestedPostcssVersion}`,
    );
  }
  if (!formalAcceptanceArtifactSupplied && r405Status === "open") {
    blockingReasons.push("no formal external R-405 risk acceptance artifact supplied");
  }
  if (formalAcceptanceArtifactSupplied && !dependencyGateApproved) {
    blockingReasons.push("dependency_audit_clearance evidence is incomplete or invalid");
  }
  if (formalAcceptanceArtifactSupplied && !formalAcceptanceValidation.valid) {
    blockingReasons.push(...formalAcceptanceValidation.reasons);
  }
  if (unknownProductionAuditFindings.length > 0) {
    blockingReasons.push(`unknown production audit findings block R-405 closure: ${unknownProductionAuditFindings.join(", ")}`);
  }
  if (technicallyRemediated && patchPath === "no_safe_stable_patch") {
    blockingReasons.push("technical remediation cannot be accepted without a safe stable patch path");
  }
  if (patchPath === "safe_stable_patch_available" && (!technicallyRemediated || !dependencyFilesChanged)) {
    blockingReasons.push("safe stable patch path exists but technical remediation has not been applied");
  }
  if (dependencyFilesChanged && patchPath === "no_safe_stable_patch") {
    blockingReasons.push("dependency files must not change without a safe stable patch path");
  }

  const narrative =
    r405Status === "technically_resolved"
      ? "R-405 is technically resolved after stable Next.js bundles patched PostCSS and production audit is clean."
      : r405Status === "formally_accepted"
        ? "R-405 remains technically open in dependency metadata but is formally accepted through complete dependency_audit_clearance evidence."
        : patchPath === "no_safe_stable_patch"
          ? `R-405 remains open: stable next@latest ${input.nextLatestVersion} still bundles nested postcss@${input.nestedPostcssVersion}; no dependency files were changed.`
          : "R-405 remains open until the safe stable patch path is applied and verified.";

  return {
    phase80dVersion: PHASE_80D_VERSION,
    generatedAt,
    nextLatestVersion: input.nextLatestVersion,
    eslintConfigNextLatestVersion: input.eslintConfigNextLatestVersion,
    nestedPostcssVersion: input.nestedPostcssVersion,
    patchPath,
    dependencyFilesChanged,
    productionAuditFindings: input.productionAuditFindings,
    unknownProductionAuditFindings,
    formalAcceptanceArtifactSupplied,
    formalAcceptanceValid: formalAcceptanceValidation.valid,
    formalAcceptanceBlockingReasons: formalAcceptanceValidation.reasons,
    dependencyGateApproved,
    r405Status,
    narrative,
    blockingReasons,
  };
}

export function buildPhase80dNoPatchClosureEvaluation(input: {
  nextLatestVersion: string;
  nestedPostcssVersion: string;
  eslintConfigNextLatestVersion: string;
  productionAuditFindings?: string[];
  evidenceRecords?: LaunchGateEvidenceRecord[];
  formalAcceptance?: Phase80dFormalR405Acceptance;
  now?: string;
}) {
  return buildPhase80dR405ClosureEvaluation({
    ...input,
    productionAuditFindings:
      input.productionAuditFindings ?? [...R405_KNOWN_AUDIT_FINDING_KEYS],
    dependencyFilesChanged: false,
    technicallyRemediated: false,
  });
}
