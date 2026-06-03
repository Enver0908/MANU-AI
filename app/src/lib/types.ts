export type AiStatus = "active" | "passive";
export type AiMode = "autopilot" | "copilot" | "manual" | "paused";
export type Channel = "whatsapp" | "telegram";
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
export type ClientContextUpdateSource = "phone" | "zoom" | "in_person" | "other";
export type ClientContextUpdateImportance = "routine" | "important" | "critical";
export type ClientContextUpdateStatus = "active" | "superseded";
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

export type ClientFormFieldDefinition = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
  llmVisibility: FormFieldLlmVisibility;
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
};

export type MessageRecord = {
  id: string;
  tenantId: string;
  conversationId: string;
  sender: SenderType;
  body: string;
  origin: MessageOrigin;
  sourceMessageId?: string | null;
  authorDietitianId?: string | null;
  generatedByAiDecisionId?: string | null;
  approvedByDietitianId?: string | null;
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
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  read: boolean;
  acknowledgedAt: string | null;
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
  clientFormSchemas: ClientFormSchemaRecord[];
  clientFormResponses: ClientFormResponseRecord[];
  clientContextUpdates: ClientContextUpdateRecord[];
  clients: ClientRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  aiDecisions: AiDecisionRecord[];
  riskAssessments: RiskAssessmentRecord[];
  handoffCases: HandoffCaseRecord[];
  auditEvents: AuditEventRecord[];
  notifications: NotificationRecord[];
  inboundQuarantines: InboundQuarantineRecord[];
  dataRequests: DataRequestRecord[];
  internalCopilotMessages: InternalCopilotMessageRecord[];
  internalCopilotToolCalls: InternalCopilotToolCallRecord[];
  scopeRules: ScopeRuleRecord[];
  scopeRuleChunks: ScopeRuleChunkRecord[];
  scopeGuardEvaluations: ScopeGuardEvaluationRecord[];
  processedSimulationKeys: string[];
  lastSimulation: SimulationResult | null;
};

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
  mockProviderOutput?: "missing_historical_context";
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
