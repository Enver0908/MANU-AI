export const STAGE7_SEVERITIES = ["P0", "P1", "P2", "P3"] as const;
export const STAGE7_FINDING_STATUSES = [
  "open",
  "in_remediation",
  "resolved",
  "accepted_p3",
  "not_reproducible",
] as const;
export const STAGE7_ROLES = ["owner", "admin", "dietitian", "assistant", "auditor"] as const;
export const STAGE7_ASSIGNMENT_ACCESS = ["care_team", "viewer"] as const;
export const STAGE7_LOCALES = ["tr", "en", "de", "pt", "es", "fr", "ar"] as const;
export const STAGE7_PWA_MODES = ["service_worker_blocked", "service_worker_enabled"] as const;
export const STAGE7_SNAPSHOT_KINDS = ["page", "locator", "state", "none"] as const;
export const STAGE7_BROWSER_TIERS = [
  "chromium-desktop",
  "chromium-desktop-xl",
  "chromium-tablet",
  "chromium-android",
  "chromium-reflow-320",
  "chromium-mobile-landscape",
  "webkit-iphone",
  "webkit-ipad",
  "firefox-desktop",
] as const;
export const STAGE7_VIEWPORT_TIERS = [
  "desktop-1440",
  "desktop-1728",
  "tablet-768",
  "android-390",
  "iphone-390",
  "ipad-pro-11",
  "reflow-320",
  "mobile-landscape",
] as const;

export type Stage7Severity = (typeof STAGE7_SEVERITIES)[number];
export type Stage7FindingStatus = (typeof STAGE7_FINDING_STATUSES)[number];
export type Stage7Role = (typeof STAGE7_ROLES)[number];
export type Stage7AssignmentAccess = (typeof STAGE7_ASSIGNMENT_ACCESS)[number];
export type Stage7Locale = (typeof STAGE7_LOCALES)[number];
export type Stage7PwaMode = (typeof STAGE7_PWA_MODES)[number];
export type Stage7SnapshotKind = (typeof STAGE7_SNAPSHOT_KINDS)[number];
export type Stage7BrowserTier = (typeof STAGE7_BROWSER_TIERS)[number];
export type Stage7ViewportTier = (typeof STAGE7_VIEWPORT_TIERS)[number];

export type Stage7Scenario = {
  id: string;
  surface: string;
  route: string;
  state: string;
  tenantRole: Stage7Role;
  assignmentAccess: Stage7AssignmentAccess;
  locale: Stage7Locale;
  browserTier: Stage7BrowserTier;
  viewportTier: Stage7ViewportTier;
  pwaMode: Stage7PwaMode;
  fixtureId: string;
  requiredAssertions: string[];
  snapshotKind: Stage7SnapshotKind;
  accessibilityChecks: string[];
  performanceEligible: boolean;
};

export type Stage7Finding = {
  id: string;
  fingerprint: string;
  category: string;
  severity: Stage7Severity;
  status: Stage7FindingStatus;
  surface: string;
  scenarioId: string;
  role: Stage7Role;
  locale: Stage7Locale;
  browser: string;
  viewport: string;
  wcagCriteria: string[];
  expected: string;
  actual: string;
  reproductionSteps: string[];
  evidenceRefs: string[];
  rootCause: string;
  remediationPhase: "7.2" | "7.3" | "7.4" | "7.5" | "out_of_scope";
  resolutionEvidence: string[];
  acceptedBy?: string;
  acceptedAt?: string;
  acceptanceReason?: string;
};

const FINDING_TRANSITIONS: Record<Stage7FindingStatus, Stage7FindingStatus[]> = {
  open: ["in_remediation", "resolved", "accepted_p3", "not_reproducible"],
  in_remediation: ["resolved", "accepted_p3", "not_reproducible", "open"],
  resolved: ["open"],
  accepted_p3: ["open"],
  not_reproducible: ["open"],
};

function assertString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Stage7 schema: ${field} must be a non-empty string`);
  }
}

function assertArrayOfStrings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Stage7 schema: ${field} must be an array of strings`);
  }
}

function assertIncluded<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Stage7 schema: ${field} must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

export function parseStage7Scenario(input: unknown): Stage7Scenario {
  if (!input || typeof input !== "object") {
    throw new Error("Stage7 schema: scenario must be an object");
  }
  const value = input as Record<string, unknown>;
  assertString(value.id, "id");
  assertString(value.surface, "surface");
  assertString(value.route, "route");
  assertString(value.state, "state");
  assertString(value.fixtureId, "fixtureId");
  assertArrayOfStrings(value.requiredAssertions, "requiredAssertions");
  assertArrayOfStrings(value.accessibilityChecks, "accessibilityChecks");
  if (typeof value.performanceEligible !== "boolean") {
    throw new Error("Stage7 schema: performanceEligible must be boolean");
  }
  return {
    id: value.id as string,
    surface: value.surface as string,
    route: value.route as string,
    state: value.state as string,
    tenantRole: assertIncluded(value.tenantRole, STAGE7_ROLES, "tenantRole"),
    assignmentAccess: assertIncluded(value.assignmentAccess, STAGE7_ASSIGNMENT_ACCESS, "assignmentAccess"),
    locale: assertIncluded(value.locale, STAGE7_LOCALES, "locale"),
    browserTier: assertIncluded(value.browserTier, STAGE7_BROWSER_TIERS, "browserTier"),
    viewportTier: assertIncluded(value.viewportTier, STAGE7_VIEWPORT_TIERS, "viewportTier"),
    pwaMode: assertIncluded(value.pwaMode, STAGE7_PWA_MODES, "pwaMode"),
    fixtureId: value.fixtureId as string,
    requiredAssertions: value.requiredAssertions as string[],
    snapshotKind: assertIncluded(value.snapshotKind, STAGE7_SNAPSHOT_KINDS, "snapshotKind"),
    accessibilityChecks: value.accessibilityChecks as string[],
    performanceEligible: value.performanceEligible as boolean,
  };
}

export function parseStage7Finding(input: unknown): Stage7Finding {
  if (!input || typeof input !== "object") {
    throw new Error("Stage7 schema: finding must be an object");
  }
  const value = input as Record<string, unknown>;
  assertString(value.id, "id");
  assertString(value.fingerprint, "fingerprint");
  assertString(value.category, "category");
  assertString(value.surface, "surface");
  assertString(value.scenarioId, "scenarioId");
  assertString(value.browser, "browser");
  assertString(value.viewport, "viewport");
  assertString(value.expected, "expected");
  assertString(value.actual, "actual");
  assertString(value.rootCause, "rootCause");
  assertArrayOfStrings(value.wcagCriteria, "wcagCriteria");
  assertArrayOfStrings(value.reproductionSteps, "reproductionSteps");
  assertArrayOfStrings(value.evidenceRefs, "evidenceRefs");
  assertArrayOfStrings(value.resolutionEvidence, "resolutionEvidence");
  const status = assertIncluded(value.status, STAGE7_FINDING_STATUSES, "status");
  const severity = assertIncluded(value.severity, STAGE7_SEVERITIES, "severity");
  if (status === "accepted_p3") {
    if (severity !== "P3") {
      throw new Error("Stage7 schema: accepted_p3 requires severity P3");
    }
    assertString(value.acceptedBy, "acceptedBy");
    assertString(value.acceptedAt, "acceptedAt");
    assertString(value.acceptanceReason, "acceptanceReason");
  }
  const remediationPhase = value.remediationPhase;
  if (
    remediationPhase !== "7.2" &&
    remediationPhase !== "7.3" &&
    remediationPhase !== "7.4" &&
    remediationPhase !== "7.5" &&
    remediationPhase !== "out_of_scope"
  ) {
    throw new Error("Stage7 schema: remediationPhase is invalid");
  }
  return {
    id: value.id as string,
    fingerprint: value.fingerprint as string,
    category: value.category as string,
    severity,
    status,
    surface: value.surface as string,
    scenarioId: value.scenarioId as string,
    role: assertIncluded(value.role, STAGE7_ROLES, "role"),
    locale: assertIncluded(value.locale, STAGE7_LOCALES, "locale"),
    browser: value.browser as string,
    viewport: value.viewport as string,
    wcagCriteria: value.wcagCriteria as string[],
    expected: value.expected as string,
    actual: value.actual as string,
    reproductionSteps: value.reproductionSteps as string[],
    evidenceRefs: value.evidenceRefs as string[],
    rootCause: value.rootCause as string,
    remediationPhase,
    resolutionEvidence: value.resolutionEvidence as string[],
    acceptedBy: typeof value.acceptedBy === "string" ? value.acceptedBy : undefined,
    acceptedAt: typeof value.acceptedAt === "string" ? value.acceptedAt : undefined,
    acceptanceReason: typeof value.acceptanceReason === "string" ? value.acceptanceReason : undefined,
  };
}

export function assertUniqueScenarioIds(scenarios: Stage7Scenario[]) {
  const seen = new Set<string>();
  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) {
      throw new Error(`Stage7 schema: duplicate scenario id ${scenario.id}`);
    }
    seen.add(scenario.id);
  }
}

export function transitionFindingStatus(
  current: Stage7FindingStatus,
  next: Stage7FindingStatus,
): Stage7FindingStatus {
  if (!FINDING_TRANSITIONS[current].includes(next)) {
    throw new Error(`Stage7 schema: cannot transition finding from ${current} to ${next}`);
  }
  return next;
}
