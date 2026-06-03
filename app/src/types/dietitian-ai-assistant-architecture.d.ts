declare module "dietitian-ai-assistant-architecture" {
  export type RiskLevel = "green" | "yellow" | "red";
  export type ClientAiStatus = "active" | "passive";
  export type ClientAiMode = "autopilot" | "copilot" | "manual" | "paused";
  export type CoreAction = "sent" | "draft_for_approval" | "handoff" | "no_ai";
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
  export type ProviderAttempted = boolean;
  export type SupportedLanguageCode = "tr" | "en" | "de" | "fr" | "es" | "pt" | "cs";

  export type CorePersona = {
    id: string;
    label: string;
    behavior: Record<string, string>;
  };

  export type CoreDietitian = {
    id: string;
    tenantId: string;
    displayName: string;
    timezone?: string;
  };

  export type CoreClient = {
    id: string;
    tenantId: string;
    dietitianId: string;
    fullName: string;
    lifecycleStatus?: "active" | "removed_anonymized";
    selectedPersonaId: string;
    aiStatus: ClientAiStatus;
    aiMode: ClientAiMode;
    channelUserId?: string;
    channelPermission?: "ready" | "pending" | "blocked" | "opted_out";
    mandatorySafetyComplete?: boolean;
    humanTakeoverLocked?: boolean;
    redRiskLock?:
      | { status: "none" }
      | { status: "locked"; handoffId: string }
      | { status: "reactivated"; handoffId: string };
    contextRevision?: number;
    healthProfile?: Record<string, unknown>;
    dietPlan?: Record<string, unknown>;
    allergies?: string[];
    restrictedFoods?: string[];
    clinicalRiskNotes?: string[];
    pinnedNotes?: string[];
    knownOtherClientNames?: string[];
    communicationLanguage?: SupportedLanguageCode;
  };

  export type CoreConversation = {
    id: string;
    tenantId: string;
    dietitianId: string;
    clientId: string;
    channel: "whatsapp" | "telegram";
    memoryVersion?: string;
    memoryRevision?: number;
    memoryStale?: boolean;
  };

  export type CoreMessage = {
    id?: string;
    body: string;
    sender?: "client" | "assistant" | "dietitian" | "system";
    origin?: "client_inbound" | "ai_generated" | "dietitian_manual" | "system_event" | "imported_unknown";
    status?: "stored" | "sent" | "draft" | "handoff" | "blocked";
    createdAt?: string;
  };

  export type CoreMemory = {
    rollingSummary?: string;
    durableFacts?: Record<string, unknown>;
    memoryVersion?: string;
    memoryRevision?: number;
    memoryStale?: boolean;
  };

  export type CoreContextUpdate = {
    id: string;
    title: string;
    summary: string;
    details?: string;
    importance: "routine" | "important" | "critical";
    occurredAt?: string;
    createdAt?: string;
    status?: "active" | "superseded";
  };

  export type CoreVoiceProfile = {
    averageMessageChars: number;
    formality: string;
    emojiPolicy: string;
    commonGreetings: string[];
    commonClosings: string[];
    styleNotes: string;
  };

  export type PromptSegmentType =
    | "system_instruction"
    | "current_message"
    | "diet_plan_summary"
    | "allergies"
    | "restricted_foods"
    | "pinned_note"
    | "dietitian_context_update"
    | "client_form_summary"
    | "rolling_summary"
    | "recent_message"
    | "persona"
    | "voice_profile"
    | "conversation_language";

  export type PromptSegmentOrigin =
    | "system"
    | "client_current_message"
    | "client_profile"
    | "dietitian_plan"
    | "dietitian_context_update"
    | "client_form_response"
    | "conversation_memory"
    | "dietitian_manual"
    | "ai_generated"
    | "client_inbound"
    | "personality_config"
    | "voice_profile";

  export type PromptSegmentAuthority =
    | "system"
    | "client_current_message"
    | "client_authored"
    | "dietitian_authored"
    | "newest_dietitian_authored"
    | "approved_ai_generated"
    | "tenant_config"
    | "memory";

  export type PromptContextSegment = {
    type: PromptSegmentType;
    text: string;
    sourceId?: string | null;
    origin?: PromptSegmentOrigin | string;
    createdAt?: string | null;
    authority?: PromptSegmentAuthority | string;
    tokens?: number;
    truncated?: boolean;
    omitted?: boolean;
    importance?: "routine" | "important" | "critical";
  };

  export type PromptContext = {
    version: string;
    risk: RiskLevel;
    segments: PromptContextSegment[];
    rendered: string;
  };

  export type ContextManifestSegment = Omit<PromptContextSegment, "text"> & {
    tokens: number;
    truncated: boolean;
    omitted?: boolean;
  };

  export type ContextManifest = {
    policyVersion: string;
    promptVersion: string;
    clientId: string;
    conversationId: string;
    contextRevision: number;
    currentMessageId: string | null;
    latestPromptableMessageId?: string | null;
    memoryIncluded: boolean;
    memoryVersion?: string;
    memoryRevision?: number;
    memoryStale?: boolean;
    communicationLanguage?: SupportedLanguageCode;
    languageSource?: string;
    totalEstimatedTokens: number;
    maxTokens: number;
    truncatedSegments: string[];
    droppedSegments: string[];
    droppedRecentMessageIds: string[];
    droppedContextUpdateIds?: string[];
    hasMissingHistoricalContext: boolean;
    segments: ContextManifestSegment[];
  };

  export type PromptCompilation = {
    promptContext: PromptContext;
    contextManifest: ContextManifest;
    tokenBudget: {
      maxTokens: number;
      totalEstimatedTokens: number;
      overBudget: boolean;
      droppedRecentMessageIds: string[];
      truncatedSegments: string[];
      droppedSegments: string[];
      droppedContextUpdateIds?: string[];
    };
  };

  export type RiskDecision = {
    level: RiskLevel;
    reasons: string[];
    classifierVersion: string;
    shouldHandoff: boolean;
    pauseAutopilot: boolean;
    layers?: {
      baseClassifierVersion: string;
      secondLayerVersion: string;
      secondLayerReasons: string[];
    };
  };

  export type ClinicalSafetySecondLayerDecision = {
    version: string;
    escalate: boolean;
    level: "green" | "yellow";
    reasons: string[];
  };

  export type PreflightBlock = {
    blockedReason: string;
    reasons: string[];
  };

  export type ActivationResult = {
    active: boolean;
    status: "active" | "passive" | "scheduled" | "expired";
    reason: string;
    activeFrom?: string | null;
    activeUntil?: string | null;
  };

  export type ModeActionResult = {
    action: "auto_send" | "draft_for_approval" | "handoff" | "ignore";
    reason: string;
    sendStatus?: SendStatus;
    blockedReason?: string;
    draftRequired?: boolean;
  };

  export type ProviderGenerationPayload = {
    prompt: string;
    promptContext: PromptContext;
    contextManifest: ContextManifest;
    model: string;
    riskDecision: RiskDecision;
  };

  export type CoreInboundInput = {
    tenantId: string;
    dietitian: CoreDietitian;
    client: CoreClient;
    conversation: CoreConversation;
    message: CoreMessage;
    recentMessages?: CoreMessage[];
    memory?: CoreMemory;
    clientContextUpdates?: CoreContextUpdate[];
    voiceProfile?: Partial<CoreVoiceProfile>;
    contextBudget?: number;
    promptVersion?: string | null;
    providerId?: string | null;
    now?: string;
    riskDecisionOverride?: RiskDecision;
  };

  export type ProviderOutputSafetyIssue = {
    code: string;
    severity: string;
    category: string;
    evidence: string;
  };

  export type ProviderOutputSafety = {
    allowed: boolean;
    issues: ProviderOutputSafetyIssue[];
  };

  export type CoreResult = {
    mode: ClientAiMode;
    aiStatus: ClientAiStatus;
    action: CoreAction;
    risk: RiskLevel;
    reasons: string[];
    model: string | null;
    providerAttempted: ProviderAttempted;
    providerId: string | null;
    providerStatus: ProviderStatus;
    providerErrorCode: string | null;
    sendStatus?: SendStatus;
    blockedReason: string | null;
    promptVersion: string | null;
    promptContext?: PromptContext | null;
    contextManifest?: ContextManifest | null;
    tokenBudget?: PromptCompilation["tokenBudget"] | null;
    draft?: string | null;
    sentMessage?: string | null;
    handoffCase?: Record<string, unknown> | null;
    qualityIssues?: string[];
    providerOutputSafety?: ProviderOutputSafety | null;
  };

  export const personas: CorePersona[];
  export const SAFETY_CLASSIFIER_VERSION: string;
  export const CLINICAL_SAFETY_CLASSIFIER_VERSION: string;
  export const CLINICAL_SAFETY_SECOND_LAYER_VERSION: string;
  export const CONTEXT_POLICY_V1: string;
  export const MISSING_HISTORICAL_CONTEXT_TOKEN: string;
  export const MISSING_HISTORICAL_CONTEXT_INSTRUCTION: string;
  export const LATEST_DIETITIAN_CONTEXT_INSTRUCTION: string;

  export function buildDietitianVoiceProfile(samples: string[]): CoreVoiceProfile;
  export function normalizeLanguageCode(value: unknown): SupportedLanguageCode;
  export function isSupportedLanguageCode(value: unknown): value is SupportedLanguageCode;
  export function languageLabel(value: unknown): string;
  export function normalizeE164Phone(value: unknown): string;

  export function classifyDieteticRisk(message: string, clientProfile?: Record<string, unknown>): RiskDecision;

  export function classifyConversationRisk(input: {
    message: string;
    recentMessages?: CoreMessage[];
    clientProfile?: Record<string, unknown>;
  }): RiskDecision;

  export function classifyClinicalSafetyRisk(input: {
    message: string;
    recentMessages?: CoreMessage[];
    clientProfile?: Record<string, unknown>;
  }): RiskDecision;

  export function evaluateClinicalSafetySecondLayer(input: {
    message: string;
    recentMessages?: CoreMessage[];
    clientProfile?: Record<string, unknown>;
    baseDecision?: RiskDecision;
  }): ClinicalSafetySecondLayerDecision;

  export function evaluateInboundPreflight(
    client: CoreClient,
    options?: { safetyChecklistComplete?: boolean; missingSafetyChecklistItems?: string[] },
  ): PreflightBlock | null;

  export function compilePromptContext(input: {
    capsule: Record<string, unknown>;
    currentMessage: CoreMessage;
    recentMessages?: CoreMessage[];
    riskLevel: RiskLevel;
    promptVersion?: string | null;
    policy?: unknown;
  }): PromptCompilation & { blockedReason?: string | null };

  export function renderPromptContext(promptContext: PromptContext): string;

  export function selectPromptableRecentMessages(messages: CoreMessage[], limit?: number): CoreMessage[];

  export function resolveAiActivation(client: CoreClient, now?: Date | string): ActivationResult;

  export function decideModeAction(
    mode: ClientAiMode | string,
    riskDecision: RiskDecision,
  ): ModeActionResult;

  export function handleInboundMessage(
    input: CoreInboundInput,
    adapters: {
      generateReply?: (payload: ProviderGenerationPayload) => Promise<string>;
      sendMessage?: (payload: { capsule: Record<string, unknown>; body: string }) => Promise<void>;
      onDraftForApproval?: (payload: {
        capsule: Record<string, unknown>;
        draft: string;
        riskDecision: RiskDecision;
      }) => Promise<void>;
      onHandoff?: (payload: Record<string, unknown>) => Promise<void>;
    },
  ): Promise<CoreResult>;
}
