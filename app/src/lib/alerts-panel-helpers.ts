import type { ClinicalAlertListItem, ClinicalAlertKind } from "./phase-85-stage-4b-contracts";
import type { ClinicalAlertFilterSeverity } from "./phase-85-stage-4b-alerts";
import type { DashboardMessageKey } from "./i18n";

export const ALERTS_PANEL_ROW_MIN_HEIGHT_CLASS = "min-h-11";
export const ALERTS_PANEL_SKELETON_ROW_COUNT = 6;

export type AlertSeveritySegment = ClinicalAlertFilterSeverity;

export type ClinicalAlertTypeLabelKey =
  | "alertTypeEmergencySymptom"
  | "alertTypeSevereAllergicReaction"
  | "alertTypeGlucoseOrMedicationSafety"
  | "alertTypeCrisisOrSelfHarm"
  | "alertTypePregnancyOrLactation"
  | "alertTypeSymptomOrCondition"
  | "alertTypeMedicationOrSupplement"
  | "alertTypeLabResult"
  | "alertTypeNutritionPlanChange"
  | "alertTypeMinorOrBodyImage"
  | "alertTypeAllergyRestrictionOrProduct"
  | "alertTypeContextAmbiguity"
  | "alertTypeSecurityReview"
  | "alertTypeClinicalReviewRequired";

export const CLINICAL_ALERT_KIND_TO_TYPE_LABEL_KEY: Record<ClinicalAlertKind, ClinicalAlertTypeLabelKey> = {
  emergency_symptom: "alertTypeEmergencySymptom",
  severe_allergic_reaction: "alertTypeSevereAllergicReaction",
  glucose_or_medication_safety: "alertTypeGlucoseOrMedicationSafety",
  crisis_or_self_harm: "alertTypeCrisisOrSelfHarm",
  pregnancy_or_lactation: "alertTypePregnancyOrLactation",
  symptom_or_condition: "alertTypeSymptomOrCondition",
  medication_or_supplement: "alertTypeMedicationOrSupplement",
  lab_result: "alertTypeLabResult",
  nutrition_plan_change: "alertTypeNutritionPlanChange",
  minor_or_body_image: "alertTypeMinorOrBodyImage",
  allergy_restriction_or_product: "alertTypeAllergyRestrictionOrProduct",
  context_ambiguity: "alertTypeContextAmbiguity",
  security_review: "alertTypeSecurityReview",
  clinical_review_required: "alertTypeClinicalReviewRequired",
};

export type AlertSlaPresentation = {
  elapsedLabel: string;
  deadlineLabel: string | null;
  tone: "stone" | "amber" | "red";
};

export function resolveAlertClientDisplayName(fullName: string | null | undefined, fallbackLabel: string) {
  const trimmed = fullName?.trim();
  return trimmed ? trimmed : fallbackLabel;
}

export function resolveAlertTypeLabelKey(kind: ClinicalAlertKind): ClinicalAlertTypeLabelKey {
  return CLINICAL_ALERT_KIND_TO_TYPE_LABEL_KEY[kind];
}

export function formatAlertElapsedMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return "0 dk";
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} sa ${remainder} dk` : `${hours} sa`;
}

export function formatAlertStartedAt(value: string, locale = "tr-TR", timeZone = "Europe/Istanbul") {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(parsed));
}

export function resolveAlertSlaPresentation(alert: ClinicalAlertListItem): AlertSlaPresentation | null {
  if (alert.slaState === "unconfigured") {
    return {
      elapsedLabel: formatAlertElapsedMinutes(alert.elapsedMinutes),
      deadlineLabel: null,
      tone: "stone",
    };
  }

  const deadlineLabel = alert.slaDeadline ? formatAlertStartedAt(alert.slaDeadline) : null;
  return {
    elapsedLabel: formatAlertElapsedMinutes(alert.elapsedMinutes),
    deadlineLabel,
    tone: alert.slaState === "overdue" ? "red" : alert.severity === "red" ? "red" : "amber",
  };
}

export function resolveAlertAdditionalReasonSuffix(additionalReasonCount: number) {
  if (additionalReasonCount <= 0) return "";
  return ` +${additionalReasonCount}`;
}

export function buildAlertSeveritySegmentLabel(
  segment: AlertSeveritySegment,
  counts: { all: number; red: number; yellow: number },
  labels: Record<AlertSeveritySegment, string>,
) {
  const count = segment === "all" ? counts.all : segment === "red" ? counts.red : counts.yellow;
  return `${labels[segment]} (${count})`;
}

export function resolveAlertEmptyStateKeys(
  severity: AlertSeveritySegment,
  query: string,
): { titleKey: DashboardMessageKey; messageKey: DashboardMessageKey } {
  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    return {
      titleKey: "alertsEmptySearchTitle",
      messageKey: "alertsEmptySearchMessage",
    };
  }
  if (severity === "red") {
    return { titleKey: "alertsEmptyRedTitle", messageKey: "alertsEmptyRedMessage" };
  }
  if (severity === "yellow") {
    return { titleKey: "alertsEmptyYellowTitle", messageKey: "alertsEmptyYellowMessage" };
  }
  return { titleKey: "noAlertsYet", messageKey: "noAlertsYetHint" };
}

export function canNavigateToAlertTarget(alert: ClinicalAlertListItem, knownClientIds?: ReadonlySet<string>) {
  if (!alert.clientId?.trim() || !alert.conversationId?.trim()) return false;
  if (knownClientIds && !knownClientIds.has(alert.clientId)) return false;
  return true;
}
