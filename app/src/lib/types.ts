export type AiStatus = "active" | "passive";
export type AiMode = "autopilot" | "copilot" | "manual" | "paused";
export type Channel = "whatsapp" | "telegram";
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
export type PermissionState = "ready" | "pending" | "blocked" | "opted_out";
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
};

export type ClientRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  fullName: string;
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
  createdAt: string;
};

export type ConversationRecord = {
  id: string;
  tenantId: string;
  dietitianId: string;
  clientId: string;
  channel: Channel;
  rollingSummary: string;
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
  providerId: string | null;
  providerStatus: ProviderStatus;
  providerErrorCode: string | null;
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

export type ManuAppState = {
  tenant: TenantRecord;
  dietitian: DietitianRecord;
  clients: ClientRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  aiDecisions: AiDecisionRecord[];
  riskAssessments: RiskAssessmentRecord[];
  handoffCases: HandoffCaseRecord[];
  auditEvents: AuditEventRecord[];
  notifications: NotificationRecord[];
  processedSimulationKeys: string[];
  lastSimulation: SimulationResult | null;
};

export type SimulationRequest = {
  clientId: string;
  body: string;
  idempotencyKey: string;
  now?: string;
  mockProviderFailure?: "provider_timeout" | "provider_error";
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
