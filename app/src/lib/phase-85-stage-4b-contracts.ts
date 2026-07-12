export const PHASE_85_STAGE_4B_CONTRACT_VERSION = "p85-stage-4b-contracts-v1";

export type ClinicalAlertSeverity = "red" | "yellow";

export type ClinicalAlertKind =
  | "emergency_symptom"
  | "severe_allergic_reaction"
  | "glucose_or_medication_safety"
  | "crisis_or_self_harm"
  | "pregnancy_or_lactation"
  | "symptom_or_condition"
  | "medication_or_supplement"
  | "lab_result"
  | "nutrition_plan_change"
  | "minor_or_body_image"
  | "allergy_restriction_or_product"
  | "context_ambiguity"
  | "security_review"
  | "clinical_review_required";

export type ClinicalAlertSlaState = "unconfigured" | "within_sla" | "overdue";

export type ClinicalAlertReasonLabelKey =
  | "alertReasonEmergencySymptom"
  | "alertReasonSevereAllergicReaction"
  | "alertReasonGlucoseOrMedicationSafety"
  | "alertReasonCrisisOrSelfHarm"
  | "alertReasonPregnancyOrLactation"
  | "alertReasonSymptomOrCondition"
  | "alertReasonMedicationOrSupplement"
  | "alertReasonLabResult"
  | "alertReasonNutritionPlanChange"
  | "alertReasonMinorOrBodyImage"
  | "alertReasonAllergyRestrictionOrProduct"
  | "alertReasonContextAmbiguity"
  | "alertReasonSecurityReview"
  | "alertReasonClinicalReviewRequired";

export type NotificationPriority = "intervention_required" | "review_required" | "info";

export type NotificationKind =
  | "structured_record_update_required"
  | "competing_authoritative_instructions"
  | "unsupported_media_review"
  | "safe_reply_unavailable"
  | "delivery_failed"
  | "communication_permission_closed"
  | "ai_window_expired"
  | "ai_paused_by_verified_human"
  | "draft_invalidated"
  | "human_control_integrity"
  | "legacy_system"
  | "legacy_handoff";

export type NotificationCategory =
  | "records"
  | "conversation_review"
  | "channel_delivery"
  | "ai_control";

export type NotificationReceiptRecord = {
  tenantId: string;
  notificationId: string;
  dietitianId: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Stage4BNavigationSection = "messages" | "clients" | "ai-control";

export type Stage4BNavigationTarget = {
  section: Stage4BNavigationSection;
  clientId: string;
  conversationId?: string;
  messageId?: string;
  source?: "alert" | "notification";
  sourceId?: string;
};

export type ClinicalAlertListItem = {
  id: string;
  clientId: string;
  conversationId: string | null;
  clientFullName: string;
  severity: ClinicalAlertSeverity;
  kind: ClinicalAlertKind;
  reasonLabelKey: ClinicalAlertReasonLabelKey;
  additionalReasonCount: number;
  sourceMessageId: string | null;
  activeDraftMessageId: string | null;
  handoffId: string | null;
  startedAt: string;
  elapsedMinutes: number;
  slaDeadline: string | null;
  slaState: ClinicalAlertSlaState;
  target: Stage4BNavigationTarget;
};

export type SystemNotificationListItem = {
  id: string;
  kind: NotificationKind;
  priority: NotificationPriority;
  category: NotificationCategory;
  clientId: string | null;
  conversationId: string | null;
  messageId: string | null;
  handoffId: string | null;
  clientFullName: string | null;
  titleKey: string;
  summaryKey: string;
  occurrenceCount: number;
  lastOccurredAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  lifecycleState: "active" | "unread" | "history";
  target: Stage4BNavigationTarget;
};

export type ClinicalAlertsListResponse = {
  version: string;
  generatedAt: string;
  items: ClinicalAlertListItem[];
  nextCursor: string | null;
  filteredTotal: number;
  counts: {
    all: number;
    red: number;
    yellow: number;
  };
};

export type SystemNotificationsListResponse = {
  version: string;
  generatedAt: string;
  items: SystemNotificationListItem[];
  nextCursor: string | null;
  filteredTotal: number;
  counts: {
    active: number;
    unread: number;
    history: number;
    interventionRequired: number;
  };
};

export type Stage4BNotificationMutationResponse = {
  version: string;
  generatedAt: string;
  notificationId: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt?: string | null;
  target: Stage4BNavigationTarget;
  counts: SystemNotificationsListResponse["counts"];
};

export type Stage4BNotificationReadAllResponse = {
  version: string;
  generatedAt: string;
  markedReadCount: number;
  counts: SystemNotificationsListResponse["counts"];
};

export const CLINICAL_ALERT_KIND_TO_REASON_LABEL_KEY: Record<ClinicalAlertKind, ClinicalAlertReasonLabelKey> = {
  emergency_symptom: "alertReasonEmergencySymptom",
  severe_allergic_reaction: "alertReasonSevereAllergicReaction",
  glucose_or_medication_safety: "alertReasonGlucoseOrMedicationSafety",
  crisis_or_self_harm: "alertReasonCrisisOrSelfHarm",
  pregnancy_or_lactation: "alertReasonPregnancyOrLactation",
  symptom_or_condition: "alertReasonSymptomOrCondition",
  medication_or_supplement: "alertReasonMedicationOrSupplement",
  lab_result: "alertReasonLabResult",
  nutrition_plan_change: "alertReasonNutritionPlanChange",
  minor_or_body_image: "alertReasonMinorOrBodyImage",
  allergy_restriction_or_product: "alertReasonAllergyRestrictionOrProduct",
  context_ambiguity: "alertReasonContextAmbiguity",
  security_review: "alertReasonSecurityReview",
  clinical_review_required: "alertReasonClinicalReviewRequired",
};

export const CLINICAL_ALERT_SEVERITY_RANK: Record<ClinicalAlertSeverity, number> = {
  red: 0,
  yellow: 1,
};
