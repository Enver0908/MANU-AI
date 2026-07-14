import type {
  NotificationKind,
  NotificationPriority,
  NotificationReceiptRecord,
} from "./phase-85-stage-4b-contracts";
import type { ConversationReadReceiptRecord } from "./phase-85-stage-4b2-contracts";
import type { Stage4B3MediaStateSlice } from "./phase-85-stage-4b3-media-contracts";
import type { Stage4B4VoiceStateSlice } from "./phase-85-stage-4b4-voice-contracts";

export type AiStatus = "active" | "passive";
export type AiMode = "autopilot" | "copilot" | "manual" | "paused";
export type Channel = "whatsapp" | "telegram";
export type ChannelProvider = "whatsapp_cloud" | "telegram_bot";
export type SupportedLanguageCode = "tr" | "en" | "de" | "fr" | "es" | "pt" | "cs";
export type TenantRole = "owner" | "admin" | "dietitian" | "assistant" | "auditor";
export type MessageOrigin =
  | "client_inbound"
  | "ai_generated"
  | "dietitian_manual"
  | "system_event"
  | "imported_unknown";
export type SenderType = "client" | "assistant" | "dietitian" | "system";
export type RiskLevel = "green" | "yellow" | "red";
export type DecisionAction = "sent" | "draft_for_approval" | "handoff" | "no_ai" | "duplicate_ignored";
export type ProviderStatus = "not_called" | "ok" | "failed";
export type SendStatus =
  | "not_called"
  | "send_eligible"
  | "sent"
  | "send_blocked"
  | "draft_created"
  | "draft_invalidated"
  | "legacy_sent_unverified"
  | "legacy_draft_unverified"
  | "not_applicable";
export type PermissionState = "ready" | "pending" | "blocked" | "opted_out";
export type VoiceSampleStatus = "draft" | "approved" | "rejected";
export type VoiceProfileStatus = "default" | "generated" | "needs_samples";
export type FormSchemaStatus = "draft" | "published" | "archived";
export type FormFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "multiselect" | "date";
export type FormFieldLlmVisibility = "never" | "prompt_allowed";
export type FormFieldPromptAccess =
  | "prompt_allowed"
  | "dietitian_only"
  | "sensitive_never_prompt"
  | "system_rule";
export type FormFieldAnswerabilityRole =
  | "none"
  | "answerability_source"
  | "risk_modifier"
  | "logistics_only"
  | "policy_source";
export type FormFieldPrivacySensitivity = "low" | "medium" | "high" | "critical";
export type FormFieldClinicalSensitivity = "none" | "risk_modifier" | "critical";
export type AutopilotQualificationStatus = "qualified" | "incomplete" | "not_qualified";
export type ClientContextUpdateSource = "phone" | "zoom" | "in_person" | "other";
export type ClientContextUpdateImportance = "routine" | "important" | "critical";
export type ClientContextUpdateStatus = "active" | "superseded";
export type ClientUpdateProposalStatus = "pending" | "applied" | "rejected" | "needs_clarification" | "unsupported";
export type ClientUpdateProposalPatchTarget = "client_form_answer" | "client_record";
export type ClientUpdateProposalPatchOperation =
  | "append_unique"
  | "append_note"
  | "set_value"
  | "merge_exchange_group";
export type ClientUpdateProposalPatchCategory = "nutrition" | "clinical_safety" | "sensitive_detail" | "food_rule";
export type ChannelAccountOperatingMode = "mock" | "disabled" | "future_real";
export type ChannelAccountLifecycleStatus = "draft" | "active" | "revoked";
export type ChannelAccountAttributionPolicy = "exclusive_dietitian" | "shared_authorized_team";
export type ChannelActorType = "client" | "exact_dietitian" | "business_operator" | "ai" | "system" | "unknown";
export type ChannelActorAttributionBasis =
  | "authenticated_manu_action"
  | "exclusive_verified_account"
  | "shared_authorized_team"
  | "provider_counterparty"
  | "ai_decision"
  | "system_operation"
  | "imported_unknown";
export type ChannelAuthorInterface =
  | "manu_dashboard"
  | "whatsapp_business_surface"
  | "telegram_business_surface"
  | "client_channel"
  | "ai_provider"
  | "system"
  | "unknown";
export type ChannelEventKind =
  | "client_message_text"
  | "client_message_image"
  | "client_message_audio"
  | "client_message_media_unsupported"
  | "business_human_echo_text"
  | "business_human_echo_media_unsupported"
  | "outbound_status"
  | "history_client_message"
  | "history_business_human_message"
  | "message_edit"
  | "message_revoke"
  | "message_revision_unknown_target"
  | "malformed_event"
  | "duplicate_event"
  | "duplicate_message"
  | "unknown_account"
  | "unknown_client"
  | "ambiguous_client"
  | "cross_tenant_collision"
  | "unsupported_event";
export type ChannelEventProcessingStatus =
  | "received"
  | "normalized"
  | "quarantined"
  | "committed"
  | "duplicate"
  | "replayed"
  | "rejected"
  | "expired";
export type MessageContentStatus = "available" | "edited" | "revoked" | "content_unavailable" | "redacted";
export type MessageRetrievalEligibility =
  | "eligible"
  | "excluded_imported_unknown"
  | "excluded_revoked"
  | "excluded_unavailable"
  | "excluded_blocked"
  | "excluded_draft"
  | "excluded_unverified_actor"
  | "excluded_media_pending"
  | "excluded_media_only"
  | "excluded_media_expired"
  | "excluded_voice_pending"
  | "excluded_voice_only"
  | "excluded_voice_expired";
export type ChannelMessageRevisionAction = "edit" | "revoke" | "unknown_target";
export type HumanControlSessionReason =
  | "yellow_risk_hold"
  | "red_risk_lock"
  | "manual_takeover"
  | "channel_trust_gap"
  | "external_human_active";
export type HumanControlSessionStatus = "active" | "resolved" | "reactivated";
export type RiskActivityEventType =
  | "human_response_observed"
  | "ai_paused"
  | "draft_invalidated"
  | "risk_resolved"
  | "ai_reactivated";
export type ContextIntakeProposalStatus =
  | "pending_confirmation"
  | "confirmed"
  | "applied"
  | "rejected"
  | "stale"
  | "blocked_structured_impact"
  | "expired";
export type SafetyChecklist = {
  goalReviewed: boolean;
  dietPlanReviewed: boolean;
  allergiesReviewed: boolean;
  restrictedFoodsReviewed: boolean;
  riskFlagsReviewed: boolean;
  channelPermissionVerified: boolean;
  adultStatusConfirmed: boolean;
};

export type TenantRecord = {
  id: string;
  name: string;
};

export type DietitianRecord = {
  id: string;
  tenantId: string;
  displayName: string;
  timezone: string;
  uiLanguage: SupportedLanguageCode;
};

export type DietitianVoiceSampleRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  body: string;
  bodyHash: string;
  status: VoiceSampleStatus;
  createdAt: string;
};

export type DietitianVoiceProfileRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  status: VoiceProfileStatus;
  profileVersion: number;
  averageMessageChars: number;
  formality: string;
  emojiPolicy: string;
  commonGreetings: string[];
  commonClosings: string[];
  styleNotes: string;
  sampleCount: number;
  sourceSampleIds: string[];
  generatedAt: string | null;
  updatedAt: string;
};

export type DietitianStyleEditHistoryRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  clientId: string | null;
  aiDraftHash: string;
  dietitianFinalHash: string;
  diffMetadata: {
    editDistance: number;
    lengthDelta: number;
    greetingChanged: boolean;
    closingChanged: boolean;
    wordOverlapRatio: number;
  };
  createdAt: string;
};

export type ClientFormFieldDefinition = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  llmVisibility: FormFieldLlmVisibility;
  promptAccess?: FormFieldPromptAccess;
  answerabilityRole?: FormFieldAnswerabilityRole;
  privacySensitivity?: FormFieldPrivacySensitivity;
  clinicalSensitivity?: FormFieldClinicalSensitivity;
  section?: string;
};

export type ClientFormSchemaRecord = {
  id: string;
  tenantId: string;
  title: string;
  languageCode: SupportedLanguageCode;
  version: number;
  status: FormSchemaStatus;
  fields: ClientFormFieldDefinition[];
  createdAt: string;
  publishedAt: string | null;
  registryVersion?: string | null;
};

export type DietitianFormSchemaRecord = ClientFormSchemaRecord;

export type DietitianFormResponseRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  schemaId: string;
  schemaVersion: number;
  schemaSnapshot: DietitianFormSchemaRecord;
  languageCode: SupportedLanguageCode;
  answers: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ClientFormResponseRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  schemaId: string;
  schemaVersion: number;
  schemaSnapshot: ClientFormSchemaRecord;
  languageCode: SupportedLanguageCode;
  submittedPhoneE164: string | null;
  answers: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Phase77EFlexibilityLevel = "restricted" | "moderate" | "flexible";
export type ClientFoodRuleProfileV2Status = "draft" | "published";

export type Phase77FMenuPlanTemplateType =
  | "day_by_day_detailed"
  | "weekly_meal_framework"
  | "exchange_option_based"
  | "simple_guidance";

export type Phase77FMenuPlanStatus = "draft" | "active" | "archived";

export type Phase77FMenuPlanCatalogMatchConfidence = "exact" | "partial" | "none";

export type Phase77FMenuPlanCatalogMatch = {
  query: string;
  catalogFoodId: string | null;
  catalogFoodName: string | null;
  matchConfidence: Phase77FMenuPlanCatalogMatchConfidence;
};

export type Phase77FMenuPlanRecipe = {
  title: string;
  ingredients: string[];
  instructions: string;
};

export type Phase77FMenuPlanMealItem = {
  id: string;
  label: string;
  freeText: string;
  catalogFoodIds: string[];
  catalogMatch: Phase77FMenuPlanCatalogMatch | null;
  portionNote: string;
  recipe: Phase77FMenuPlanRecipe | null;
};

export type Phase77FMenuPlanMealSlot = {
  id: string;
  dayKey: string | null;
  mealKey: string;
  title: string;
  items: Phase77FMenuPlanMealItem[];
  alternatives: Phase77FMenuPlanMealItem[];
  exchangeGuidance: string;
  weeklyTargetNote: string;
};

export type ClientMenuPlanV1Record = {
  id: string;
  tenantId: string;
  clientId: string;
  dietitianId: string;
  templateType: Phase77FMenuPlanTemplateType;
  status: Phase77FMenuPlanStatus;
  version: number;
  revision: number;
  title: string;
  effectiveDate: string | null;
  mealSlots: Phase77FMenuPlanMealSlot[];
  preferredFoods: string[];
  avoidFoods: string[];
  dietitianNotes: string;
  clientFacingNotes: string;
  exportVisible: boolean;
  migratedFromLegacyDietPlan: boolean;
  catalogVersion: string;
  catalogSourceSha256: string;
  catalogRecordSetSha256: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
};

export type ClientFoodRuleProfileV2Record = {
  id: string;
  tenantId: string;
  clientId: string;
  dietitianId: string;
  version: number;
  status: ClientFoodRuleProfileV2Status;
  revision: number;
  allowedCatalogMainCategoryIds: string[];
  allowedCatalogSubCategoryIds: string[];
  allowedCatalogFoodIds: string[];
  forbiddenCatalogMainCategoryIds: string[];
  forbiddenCatalogSubCategoryIds: string[];
  forbiddenCatalogFoodIds: string[];
  allowedFoodGroups: string[];
  forbiddenFoodGroups: string[];
  freeTextAllowedFoods: string[];
  freeTextForbiddenFoods: string[];
  forbiddenIngredientKeywords: string[];
  dietTypeRestrictions: string[];
  flexibilityGlobal: Phase77EFlexibilityLevel;
  flexibilityByMeal: Record<string, Phase77EFlexibilityLevel>;
  flexibilityByGoal: Record<string, Phase77EFlexibilityLevel>;
  flexibilityByFoodGroup: Record<string, Phase77EFlexibilityLevel>;
  notes: string;
  migratedFromLegacy76d: boolean;
  catalogVersion: string;
  catalogSourceSha256: string;
  catalogRecordSetSha256: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type ClientContextUpdateRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  dietitianId: string;
  source: ClientContextUpdateSource;
  occurredAt: string;
  title: string;
  summary: string;
  details: string;
  importance: ClientContextUpdateImportance;
  status: ClientContextUpdateStatus;
  supersedesUpdateId: string | null;
  createdAt: string;
};

export type ClientUpdateProposalPatch = {
  target: ClientUpdateProposalPatchTarget;
  fieldId: string;
  label: string;
  operation: ClientUpdateProposalPatchOperation;
  value: string;
  category?: ClientUpdateProposalPatchCategory;
  editable?: boolean;
  impactLabel?: string;
};

export type ClientUpdateProposalRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  dietitianId: string;
  sourceText: string;
  proposedPatches: ClientUpdateProposalPatch[];
  safetyFlags: string[];
  status: ClientUpdateProposalStatus;
  expectedContextRevision: number;
  createdAt: string;
  resolvedAt: string | null;
};

export type ClientRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  lifecycleStatus: "active" | "removed_anonymized";
  removedAt: string | null;
  fullName: string;
  primaryPhoneE164: string | null;
  communicationLanguage: SupportedLanguageCode;
  selectedPersonaId: string;
  aiStatus: AiStatus;
  aiMode: AiMode;
  aiActiveFrom: string | null;
  aiActiveUntil: string | null;
  healthProfile: {
    goal: string;
    preferredLanguage: string;
    adultStatus: "adult" | "minor" | "unknown";
    diagnosedConditionFlag: boolean;
    medicationOrSupplementFlag: boolean;
    pregnancyOrBreastfeedingFlag: boolean;
    eatingDisorderRiskFlag: boolean;
  };
  dietPlan: {
    summary: string;
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };
  allergies: string[];
  restrictedFoods: string[];
  clinicalRiskNotes: string[];
  pinnedNotes: string[];
  channel: Channel;
  channelUserId: string;
  channelPermission: PermissionState;
  mandatorySafetyComplete: boolean;
  safetyChecklist: SafetyChecklist;
  humanTakeoverLocked: boolean;
  redRiskLock: RedRiskLockRecord;
  yellowRiskHold: YellowRiskHoldRecord;
  contextRevision: number;
  createdAt: string;
};

export type YellowRiskHoldRecord =
  | { status: "none" }
  | {
      status: "active";
      startedAt: string;
      firstMessageId: string;
      latestMessageId: string;
      activeDraftMessageId: string | null;
      activeDecisionId: string | null;
      messageIds: string[];
      reasons: string[];
      previousAiStatus: AiStatus;
      previousAiMode: AiMode;
      blockedByRedHandoffId: string | null;
    };

export type RedRiskLockRecord =
  | { status: "none" }
  | {
      status: "locked";
      handoffId: string;
      lockedAt: string;
      reasons: string[];
      previousAiStatus: AiStatus;
      previousAiMode: AiMode;
    }
  | {
      status: "reactivated";
      handoffId: string;
      lockedAt: string;
      reasons: string[];
      previousAiStatus: AiStatus;
      previousAiMode: AiMode;
      reactivatedAt: string;
      reactivatedByDietitianId: string;
      reactivationReason: string;
      reactivatedAiMode: "copilot" | "autopilot";
    };

export type ConversationRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  clientId: string;
  channel: Channel;
  rollingSummary: string;
  memoryVersion: string;
  memoryRevision: number;
  memoryStale: boolean;
  revision: number;
};

export type ClientAssignmentAccessLevel = "care_team" | "viewer";

export type ClientAssignmentRecord = {
  tenantId: string;
  clientId: string;
  dietitianId: string;
  accessLevel: ClientAssignmentAccessLevel;
};

export type MessageRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  sender: SenderType;
  body: string;
  origin: MessageOrigin;
  providerAccountBindingId?: string | null;
  providerEventId?: string | null;
  providerMessageId?: string | null;
  actorType?: ChannelActorType | null;
  actorBindingId?: string | null;
  authorInterface?: ChannelAuthorInterface | null;
  actorResolutionBasis?: ChannelActorAttributionBasis | null;
  sourceMessageId?: string | null;
  authorDietitianId?: string | null;
  generatedByAiDecisionId?: string | null;
  approvedByDietitianId?: string | null;
  providerSentAt?: string | null;
  observedAt?: string | null;
  persistedAt?: string | null;
  conversationSequence?: number | null;
  contentStatus?: MessageContentStatus | null;
  retrievalEligibility?: MessageRetrievalEligibility | null;
  risk?: RiskLevel | null;
  status?: "sent" | "draft" | "handoff" | "stored" | "blocked";
  createdAt: string;
};

export type AiDecisionRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  clientId: string;
  mode: AiMode;
  aiStatus: AiStatus;
  personaId: string;
  risk: RiskLevel;
  model: string | null;
  promptVersion: string | null;
  providerAttempted: boolean;
  providerId: string | null;
  providerStatus: ProviderStatus;
  providerErrorCode: string | null;
  sendStatus: SendStatus;
  contextManifest?: Record<string, unknown> | null;
  providerOutputSafety?: Record<string, unknown> | null;
  tokenBudget?: Record<string, unknown> | null;
  action: DecisionAction;
  blockedReason: string | null;
  qualityIssues: string[];
  reasons: string[];
  conversationRevisionAtGeneration?: number | null;
  createdAt: string;
};

export type HandoffCaseRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  clientId: string;
  conversationId: string;
  triggeringMessageId: string | null;
  risk: RiskLevel;
  reasons: string[];
  status: "open" | "assigned" | "resolved" | "dismissed";
  urgency: string;
  safeAcknowledgement: string;
  recommendedAction: string;
  createdAt: string;
};

export type RiskAssessmentRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  messageId: string;
  level: RiskLevel;
  reasons: string[];
  classifierVersion: string;
  createdAt: string;
};

export type AuditEventRecord = {
  id: string;
  tenantId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type NotificationRecord = {
  id: string;
  tenantId: string;
  type: "handoff_urgent" | "handoff_standard" | "system";
  kind: NotificationKind;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  read: boolean;
  acknowledgedAt: string | null;
  dedupeKey?: string | null;
  sourceMessageId?: string | null;
  targetPanel?: string | null;
  baselineRevision?: number | null;
  resolvedAt?: string | null;
  resolvedByDietitianId?: string | null;
  clientId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  handoffId?: string | null;
  occurrenceCount: number;
  lastOccurredAt: string;
  createdAt: string;
};

export type InboundQuarantineRecord = {
  id: string;
  tenantId: string;
  channel: Channel;
  sourceConversationType: "group";
  sourceConversationId: string | null;
  sourceMessageId: string | null;
  senderChannelUserId: string | null;
  reason: "whatsapp_group_unsupported";
  createdAt: string;
};

export type ChannelAccountBindingRecord = {
  id: string;
  tenantId: string;
  provider: ChannelProvider;
  providerAccountId: string;
  wabaId: string | null;
  businessPhoneNumberId: string | null;
  normalizedDisplayNumber: string | null;
  operatingMode: ChannelAccountOperatingMode;
  lifecycleStatus: ChannelAccountLifecycleStatus;
  attributionPolicy: ChannelAccountAttributionPolicy;
  verifiedAt: string | null;
  revokedAt: string | null;
  createdByDietitianId: string | null;
  revokedByDietitianId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelActorBindingRecord = {
  id: string;
  tenantId: string;
  accountBindingId: string;
  dietitianId: string | null;
  actorType: ChannelActorType;
  attributionBasis: ChannelActorAttributionBasis;
  validFrom: string;
  validTo: string | null;
  verifiedAt: string | null;
  revokedAt: string | null;
  createdByDietitianId: string | null;
  revokedByDietitianId: string | null;
  auditReasonCode: string | null;
  createdAt: string;
};

export type ChannelEventRecord = {
  id: string;
  tenantId: string;
  accountBindingId: string | null;
  eventKind: ChannelEventKind;
  processingStatus: ChannelEventProcessingStatus;
  providerAccountId: string | null;
  providerEventId: string | null;
  providerMessageId: string | null;
  fromIdentity: string | null;
  toIdentity: string | null;
  counterpartyIdentity: string | null;
  payloadDigest: string;
  payloadSchemaVersion: string;
  providerTime: string | null;
  observedAt: string;
  committedAt: string | null;
  quarantineId: string | null;
  replayOfEventId: string | null;
  retryCount: number;
  internalSequence: number | null;
};

export type ChannelMessageRevisionRecord = {
  id: string;
  tenantId: string;
  messageId: string | null;
  channelEventId: string | null;
  providerEventId: string | null;
  revisionAction: ChannelMessageRevisionAction;
  priorContentStatus: MessageContentStatus | null;
  currentContentStatus: MessageContentStatus;
  priorBodyDigest: string | null;
  currentBodyDigest: string | null;
  revisionSequence: number;
  providerTime: string | null;
  observedAt: string;
};

export type HumanControlSessionRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  reason: HumanControlSessionReason;
  status: HumanControlSessionStatus;
  previousAiStatus: AiStatus;
  previousAiMode: AiMode;
  linkedHandoffId: string | null;
  linkedYellowHoldMessageId: string | null;
  openedByMessageId: string | null;
  latestHumanMessageId: string | null;
  humanResponseObservedCount: number;
  openedAt: string;
  resolvedAt: string | null;
  reactivatedByDietitianId: string | null;
  reactivationReasonCode: string | null;
  restoredAiMode: AiMode | null;
};

export type RiskActivityEventRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  humanControlSessionId: string | null;
  eventType: RiskActivityEventType;
  sourceMessageId: string | null;
  handoffId: string | null;
  aiDecisionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ContextIntakeProposalRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  dietitianId: string | null;
  sourceChannel: Channel | "internal_copilot";
  intakeSource: ClientContextUpdateSource;
  sourceTextDigest: string;
  sourceText: string | null;
  rawSourceReference: string | null;
  occurredAt: string;
  title: string;
  summary: string;
  details: string;
  importance: ClientContextUpdateImportance;
  structuredImpactFlags: string[];
  baselineContextRevision: number;
  baselineFormRevision: number | null;
  baselineFoodRuleRevision: number | null;
  baselineMenuPlanRevision: number | null;
  status: ContextIntakeProposalStatus;
  confirmationCount: number;
  appliedContextUpdateId: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type ChannelDeliveryStatus = "sent" | "delivered" | "failed";

export type ChannelDeliveryRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  conversationId: string;
  messageId: string;
  channel: Channel;
  direction: "outbound";
  mockProviderMessageId: string;
  deliveryStatus: ChannelDeliveryStatus;
  failureCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChannelAdapterRollbackControls = {
  globalChannelAutomationDisabled: boolean;
  tenantChannelAutomationDisabled: boolean;
  disabledDietitianIds: string[];
  disabledClientIds: string[];
};

export type ScopeRuleStatus = "draft" | "approved" | "archived";

export type ScopeRuleRecord = {
  id: string;
  title: string;
  body: string;
  languageCode: SupportedLanguageCode;
  escalationLevel: Extract<RiskLevel, "yellow" | "red">;
  version: number;
  status: ScopeRuleStatus;
  approvedByDietitianId: string | null;
  approvedAt: string | null;
  createdAt: string;
  sourceRefs?: {
    sourceId: string;
    sectionId: string;
    pageStart: number;
    pageEnd: number;
  }[];
};

export type ScopeRuleChunkRecord = {
  id: string;
  ruleId: string;
  chunkIndex: number;
  chunkText: string;
  lexicalTokens: string[];
  languageCode: SupportedLanguageCode;
  escalationLevel: Extract<RiskLevel, "yellow" | "red">;
};

export type ScopeGuardEvaluationRecord = {
  id: string;
  tenantId: string;
  conversationId: string | null;
  messageId: string | null;
  decisionLevel: RiskLevel;
  matchedRuleIds: string[];
  scores: Record<string, number>;
  scopeGuardVersion: string;
  status: "noop" | "matched" | "no_match" | "unavailable";
  createdAt: string;
};

export type PermissionGraphEvaluationRecord = {
  id: string;
  tenantId: string;
  conversationId: string | null;
  messageId: string | null;
  decisionLevel: RiskLevel;
  graphVersion: string;
  bridgeVersion: string;
  mode: "shadow" | "enforce";
  finalRoutingBand: string;
  mixedIntentFailClosed: boolean;
  foodRuleIntentIds: string[];
  messageIntentIds: string[];
  triggeredPrivacyGates: string[];
  blockingReasons: string[];
  status: "evaluated" | "enforced";
  createdAt: string;
};

export type DataRequestRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  requestType: "export" | "anonymization" | "deletion";
  status: "requested" | "review_required" | "completed" | "rejected";
  requestedByDietitianId: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type InternalCopilotSourceRef = {
  entityType: "client" | "message" | "ai_decision" | "handoff_case" | "client_form_response";
  entityId: string;
  clientId: string | null;
  label: string;
  createdAt: string | null;
};

export type InternalCopilotMessageRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  role: "user" | "assistant";
  body: string;
  sourceRefs: InternalCopilotSourceRef[];
  toolCallIds: string[];
  safetyStatus: "ok" | "needs_clarification" | "not_found" | "unsupported" | "no_sources";
  createdAt: string;
};

export type InternalCopilotToolCallRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  toolName:
    | "resolveVisibleClientByName"
    | "getClientSnapshot"
    | "getClientDietPlan"
    | "getClientRecentMessages"
    | "getClientFormResponses"
    | "getClientHandoffs"
    | "getClientAiDecisionHistory";
  arguments: Record<string, unknown>;
  status: "ok" | "ambiguous" | "not_found" | "unsupported";
  sourceRefs: InternalCopilotSourceRef[];
  resultSummary: string;
  createdAt: string;
};

export type ManuAppState = {
  tenant: TenantRecord;
  dietitian: DietitianRecord;
  voiceSamples: DietitianVoiceSampleRecord[];
  voiceProfiles: DietitianVoiceProfileRecord[];
  styleEditHistory: DietitianStyleEditHistoryRecord[];
  clientFormSchemas: ClientFormSchemaRecord[];
  clientFormResponses: ClientFormResponseRecord[];
  dietitianFormSchemas: DietitianFormSchemaRecord[];
  dietitianFormResponses: DietitianFormResponseRecord[];
  clientContextUpdates: ClientContextUpdateRecord[];
  clientFoodRuleProfiles: ClientFoodRuleProfileV2Record[];
  clientMenuPlans: ClientMenuPlanV1Record[];
  clientUpdateProposals: ClientUpdateProposalRecord[];
  clients: ClientRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  aiDecisions: AiDecisionRecord[];
  riskAssessments: RiskAssessmentRecord[];
  handoffCases: HandoffCaseRecord[];
  auditEvents: AuditEventRecord[];
  notifications: NotificationRecord[];
  notificationReceipts: NotificationReceiptRecord[];
  conversationReadReceipts: ConversationReadReceiptRecord[];
  inboundQuarantines: InboundQuarantineRecord[];
  channelAccountBindings: ChannelAccountBindingRecord[];
  channelActorBindings: ChannelActorBindingRecord[];
  channelEvents: ChannelEventRecord[];
  channelMessageRevisions: ChannelMessageRevisionRecord[];
  humanControlSessions: HumanControlSessionRecord[];
  riskActivityEvents: RiskActivityEventRecord[];
  contextIntakeProposals: ContextIntakeProposalRecord[];
  channelDeliveries: ChannelDeliveryRecord[];
  channelAdapterRollback: ChannelAdapterRollbackControls;
  dataRequests: DataRequestRecord[];
  internalCopilotMessages: InternalCopilotMessageRecord[];
  internalCopilotToolCalls: InternalCopilotToolCallRecord[];
  scopeRules: ScopeRuleRecord[];
  scopeRuleChunks: ScopeRuleChunkRecord[];
  scopeGuardEvaluations: ScopeGuardEvaluationRecord[];
  permissionGraphEvaluations: PermissionGraphEvaluationRecord[];
  processedSimulationKeys: string[];
  lastSimulation: SimulationResult | null;
} & Stage4B3MediaStateSlice &
  Stage4B4VoiceStateSlice;

export type SimulationRequest = {
  clientId?: string;
  body: string;
  idempotencyKey: string;
  channel?: Channel;
  sourceConversationType?: "direct" | "group";
  sourceConversationId?: string;
  sourceMessageId?: string;
  senderChannelUserId?: string;
  now?: string;
  mockProviderFailure?: "provider_timeout" | "provider_error" | "provider_policy_violation";
  mockProviderOutput?: "missing_historical_context" | "covenant_violation";
  channelPolicyMock?: {
    serviceWindowClosed?: boolean;
    mockTemplateId?: string;
    outboundTrigger?: "inbound_reply" | "proactive";
    mockDeliveryStatus?: ChannelDeliveryStatus;
    mockDeliveryFailureCode?: string;
  };
};

export type SimulationResult = {
  action: DecisionAction;
  risk: RiskLevel | null;
  model: string | null;
  blockedReason: string | null;
  reasons: string[];
  draft: string | null;
  decisionId: string | null;
};

export type {
  ClinicalAlertKind,
  ClinicalAlertListItem,
  ClinicalAlertReasonLabelKey,
  ClinicalAlertSeverity,
  ClinicalAlertSlaState,
  NotificationCategory,
  NotificationKind,
  NotificationPriority,
  NotificationReceiptRecord,
  Stage4BNavigationSection,
  Stage4BNavigationTarget,
  SystemNotificationListItem,
} from "./phase-85-stage-4b-contracts";
export type { ConversationReadReceiptRecord } from "./phase-85-stage-4b2-contracts";
export type {
  ConversationMediaDto,
  InboundMessageBundleItemRecord,
  InboundMessageBundleRecord,
  MediaAssetRecord,
  MultimodalMessageEnvelope,
  Stage4B3MediaStateSlice,
  VisualAnalysisRecord,
  VisualAutopilotEligibility,
  VisualCorrectionRecord,
  VisualCorrectionRequest,
  VisualObservationV1,
  VisualReviewDto,
  VisualSceneType,
} from "./phase-85-stage-4b3-media-contracts";
export type {
  AudioTranscriptionObservationV1,
  AudioTranscriptionRecord,
  AudioTranscriptCorrectionRecord,
  ConversationAudioDto,
  ConversationVoiceTranscriptDto,
  Stage4B4VoiceStateSlice,
  TranscriptCorrectionRequest,
  VoiceTranscriptEligibility,
} from "./phase-85-stage-4b4-voice-contracts";
