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
    | "historical_message"
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
    retrievalEvidenced?: boolean | null;
    relevanceScore?: number | null;
    relevanceReason?: string | null;
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
    answerability?: ApprovedSourceAnswerabilityDecision;
    greenIntent?: GreenIntentTaxonomyDecision;
    foodRule?: FoodRuleDecision;
    foodDecisionV2?: FoodDecisionV2Result;
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
      secondLayerCarveOut?: {
        applied: boolean;
        reason: string;
        foodRuleDecision: string;
      } | null;
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
    conversationMessages?: CoreMessage[];
    memory?: CoreMemory;
    clientContextUpdates?: CoreContextUpdate[];
    voiceProfile?: Partial<CoreVoiceProfile>;
    styleEditHistorySignals?: {
      preferredGreeting?: string | null;
      preferredClosing?: string | null;
      warmthAdjustment?: string | null;
      responseTimingStyle?: string | null;
      sampleCount?: number;
    } | null;
    contextBudget?: number;
    promptVersion?: string | null;
    providerId?: string | null;
    now?: string;
    riskDecisionOverride?: RiskDecision;
    structuredFoodRules?: StructuredFoodRulesInput | null;
    foodRuleDecisionOverride?: FoodRuleDecision | null;
    foodRuleDecisionForRisk?: FoodRuleDecision | null;
    foodDecisionV2?: FoodDecisionV2Result | null;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
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

  export type GreenIntentFamily =
    | "green_plan_lookup"
    | "green_meal_reminder"
    | "green_allowed_substitution"
    | "green_allowed_food_confirmation"
    | "green_forbidden_food_reminder"
    | "green_food_decision_discourage"
    | "green_product_ingredient_check"
    | "green_optional_meal_skip"
    | "green_logistics"
    | "green_behavior_support"
    | "green_progress_logging"
    | "green_low_risk_clarification"
    | "green_general_education"
    | "green_context_recap"
    | "unknown_intent";

  export type SensitiveIntentFamily =
    | "yellow_plan_change_request"
    | "yellow_calorie_macro_portion_request"
    | "yellow_medication_supplement_request"
    | "yellow_lab_interpretation_request"
    | "yellow_symptom_interpretation_request"
    | "red_sensitive_context_or_emergency"
    | "yellow_active_plan_conflict"
    | "yellow_active_plan_structural_change"
    | "prompt_context_missing";

  export type GreenIntentTaxonomyDecision = {
    version: string;
    decision:
      | "green_intent_allowed"
      | "blocked_sensitive_intent"
      | "blocked_unknown_intent"
      | "not_applicable_non_green";
    allowed: boolean;
    intentFamily: GreenIntentFamily | null;
    blockedFamily: SensitiveIntentFamily | null;
    reasons: string[];
    sourceCategories: string[];
    canonicalIntent?: CanonicalIntentV2Decision | null;
    canonicalIntentVersion?: string | null;
    workflowState?: string | null;
  };

  export type CanonicalIntentV2Decision = {
    version: string;
    decision: string;
    allowed: boolean;
    intentFamily: string | null;
    blockedFamily: string | null;
    precedenceStage: string;
    workflowState: string | null;
    reasons: string[];
    foodDecisionV2?: string | null;
    foodRuleDecision?: string | null;
    foodQueryType?: string | null;
  };

  export type ApprovedSourceAnswerabilityDecision = {
    version: string;
    decision: "source_backed_green" | "draft_required" | "handoff_required" | "blocked";
    allowed: boolean;
    reasons: string[];
    sourceCategories: string[];
    sources: Array<{
      category: string;
      segmentType: string;
      sourceId: string | null;
      authority: string | null;
      origin: string | null;
    }>;
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
  export const PRODUCT_COMMUNICATION_COVENANT_INSTRUCTION: string;
  export const PRODUCT_COMMUNICATION_COVENANT_VERSION: string;
  export const APPROVED_SOURCE_ANSWERABILITY_VERSION: string;
  export const GREEN_INTENT_TAXONOMY_VERSION: string;

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
    foodRuleDecision?: FoodRuleDecisionResult | null;
  }): RiskDecision;

  export function evaluateClinicalSafetySecondLayer(input: {
    message: string;
    recentMessages?: CoreMessage[];
    clientProfile?: Record<string, unknown>;
    baseDecision?: RiskDecision;
    foodRuleDecision?: FoodRuleDecisionResult | null;
  }): ClinicalSafetySecondLayerDecision;

  export function shouldApplySourceBackedFoodRuleCarveOut(input: {
    message: string;
    clientProfile?: Record<string, unknown>;
    foodRuleDecision?: FoodRuleDecisionResult | null;
    reasons?: string[];
  }): boolean;

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
    structuredFoodRules?: StructuredFoodRulesInput | null;
    foodRuleDecision?: FoodRuleDecisionResult | null;
    foodDecisionV2?: FoodDecisionV2Result | null;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  }): PromptCompilation & { blockedReason?: string | null };

  export function buildFoodRulePromptSegments(input: {
    structuredFoodRules?: StructuredFoodRulesInput | null;
    foodRuleDecision?: FoodRuleDecisionResult | null;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  }): Array<{
    id: string;
    type: string;
    sourceId: string | null;
    text: string;
    authority?: string | null;
  }>;

  export function detectFoodRuleOutputViolations(
    output: string,
    input?: {
      foodRule?: FoodRuleDecisionResult | null;
      structuredFoodRules?: StructuredFoodRulesInput | null;
    },
  ): string[];

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

  export function normalizeSafetyText(message: string): string;
  export function detectProductCommunicationCovenantIssues(message: string): string[];
  export function evaluateApprovedSourceAnswerability(input: {
    promptContext: {
      segments: Array<{
        type: string;
        sourceId?: string | null;
        origin?: string | null;
        authority?: string | null;
        text: string;
      }>;
    } | null;
    riskDecision: { level: "green" | "yellow" | "red"; reasons?: string[] };
  }): ApprovedSourceAnswerabilityDecision;

  export const INTENT_SPECIFIC_ANSWERABILITY_VERSION: string;
  export function evaluateAnswerabilityPrelude(input: {
    promptContext: PromptContext | null;
    riskDecision: { level: "green" | "yellow" | "red"; reasons?: string[] };
  }): ApprovedSourceAnswerabilityDecision;
  export function evaluateIntentSpecificAnswerability(input: {
    promptContext: PromptContext | null;
    riskDecision: { level: "green" | "yellow" | "red"; reasons?: string[] };
    greenIntent: GreenIntentTaxonomyDecision | null;
    foodRule?: FoodRuleDecision | null;
    foodDecisionV2?: FoodDecisionV2Result | null;
    structuredFoodRules?: StructuredFoodRulesInput | null;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  }): ApprovedSourceAnswerabilityDecision & {
    intentFamily?: string | null;
    foodRuleDecision?: string | null;
    foodDecisionV2?: FoodDecisionV2Decision | null;
    matchedSourceCategories?: string[];
    requiredSourceCategories?: string[];
    requiredFoodDecisions?: string[];
    baseVersion?: string;
  };
  export function resolveEffectiveIntentFamily(
    greenIntent: GreenIntentTaxonomyDecision | null,
    foodRule: FoodRuleDecision | null | undefined,
    foodDecisionV2?: FoodDecisionV2Result | null,
  ): string;
  export function resolveFoodIntentFamily(foodRule: FoodRuleDecision | null | undefined): string | null;
  export function resolveFoodDecisionV2IntentFamily(
    foodDecisionV2: FoodDecisionV2Result | null | undefined,
  ): string | null;
  export function buildFoodDecisionV2SourceCategories(
    foodDecisionV2: FoodDecisionV2Result | null | undefined,
  ): Array<{
    category: string;
    segmentType: string;
    sourceId: string | null;
    authority: string | null;
    origin: string | null;
  }>;
  export function buildFoodDecisionV2PromptSegments(input?: {
    foodDecisionV2?: FoodDecisionV2Result | null;
  }): Array<{
    id: string;
    type: string;
    sourceId: string | null;
    text: string;
    authority?: string | null;
  }>;
  export function detectFoodDecisionV2OutputViolations(
    output: string,
    input?: { foodDecisionV2?: FoodDecisionV2Result | null },
  ): string[];
  export function buildStructuredSourceCategories(
    structuredFoodRules: StructuredFoodRulesInput | null | undefined,
    productIngredientEvidence?: ProductIngredientEvidenceInput | null,
  ): Array<{
    category: string;
    segmentType: string;
    sourceId: string | null;
    authority: string | null;
    origin: string | null;
  }>;

  export function evaluateGreenIntentTaxonomy(input: {
    promptContext: PromptContext | null;
    riskDecision: { level: "green" | "yellow" | "red"; reasons?: string[] };
    answerability?: ApprovedSourceAnswerabilityDecision | null;
    canonicalIntent?: CanonicalIntentV2Decision | null;
    foodDecisionV2?: FoodDecisionV2Result | null;
    foodRule?: FoodRuleDecision | null;
  }): GreenIntentTaxonomyDecision;

  export function resolveCanonicalIntentV2(input: {
    message: string;
    riskDecision: { level: "green" | "yellow" | "red"; reasons?: string[] };
    foodDecisionV2?: FoodDecisionV2Result | null;
    foodRule?: FoodRuleDecision | null;
  }): CanonicalIntentV2Decision;

  export const CANONICAL_INTENT_RESOLVER_V2_VERSION: string;

  export type ResponsePlanReplyMode =
    | "send"
    | "draft"
    | "clarify"
    | "ask_label"
    | "handoff"
    | "block";

  export type ResponsePlanV1 = {
    version: string;
    intentFamily: string | null;
    replyMode: ResponsePlanReplyMode;
    templateId: string | null;
    sourceRefs: Array<{
      id: string;
      category: string;
      segmentType: string | null;
      authority: string | null;
      origin: string | null;
    }>;
    foodDecision: {
      engine: string;
      decision: string;
      queryType: string | null;
      providerEligible: boolean | null;
      reasonCodes: string[];
    } | null;
    riskClass: RiskLevel | null;
    clientMessagePlan: {
      replyMode: ResponsePlanReplyMode;
      templateId: string | null;
      intentFamily: string | null;
      mustAsk: string[];
      mustAvoid: string[];
      summary: string;
    };
    internalReason: string;
    claimManifest: {
      version: string;
      templateId: string | null;
      intentFamily: string | null;
      claims: Array<{
        id: string;
        type: string;
        authority: string;
        sourceIds: string[];
      }>;
      sourceIds: string[];
      complete?: boolean;
    };
    styleDna: {
      version: string;
      scope: string;
      tenantId?: string | null;
      dietitianId?: string | null;
      sentenceLength?: string | null;
      greetingStyle?: string | null;
      formality: string | null;
      emojiPolicy: string | null;
      warmthTone?: string | null;
      boundaryPhrasing?: string | null;
      responseTimingStyle: string | null;
      candidatePhrases?: string[];
      hardGuards?: { maxChars?: number; emojiAllowed?: boolean };
      softMismatchThreshold?: number;
      clinicalIsolation?: boolean;
    };
    providerEligible: boolean;
  };

  export const RESPONSE_PLAN_V1_VERSION: string;

  export function buildResponsePlanV1(input: {
    riskDecision: RiskDecision;
    canonicalIntent?: CanonicalIntentV2Decision | null;
    greenIntent?: GreenIntentTaxonomyDecision | null;
    answerability?: Record<string, unknown> | null;
    foodDecisionV2?: FoodDecisionV2Result | null;
    foodRule?: FoodRuleDecision | null;
    modeDecision?: { action: string; reason?: string } | null;
    tenantId?: string | null;
    dietitianId?: string | null;
    voiceProfile?: Record<string, unknown> | null;
    styleEditHistorySignals?: Record<string, unknown> | null;
    knownClientNames?: string[];
  }): ResponsePlanV1;

  export function isResponsePlanProviderEligible(
    responsePlan: { replyMode?: ResponsePlanReplyMode | string | null } | null | undefined,
  ): boolean;

  export function appendResponsePlanPromptSegments(
    promptContext: PromptContext,
    responsePlan: ResponsePlanV1,
  ): PromptContext;

  export function assertBoundedProviderSegment(segment: {
    type?: string;
    text?: string;
  }): void;

  export const DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION: string;

  export const KNOWN_TEMPLATE_IDS: string[];

  export function isKnownTemplateId(templateId: string | null | undefined): boolean;

  export function assertClientFacingTemplateId(templateId: string | null | undefined): void;

  export function renderDeterministicTemplate(input: {
    templateId: string;
    language?: string;
    replyMode?: string | null;
    riskClass?: string | null;
  }): string;

  export function assertTemplateTextSafeForClient(text: string): void;

  export function parseTemplateIdFromResponsePlanSegment(segmentText?: string): string | null;

  export function parseReplyModeFromResponsePlanSegment(segmentText?: string): string | null;

  export function parseRiskClassFromResponsePlanSegment(segmentText?: string): string | null;

  export function parseRiskClassFromResponsePlanSegment(segmentText?: string): string | null;

  export const CLAIM_MANIFEST_V1_VERSION: string;

  export const CLAIM_MANIFEST_CLAIM_TYPES: string[];

  export function buildClaimManifestV1(input: {
    responsePlan: {
      templateId?: string | null;
      intentFamily?: string | null;
      sourceRefs?: Array<{ id?: string; category?: string }>;
      foodDecision?: { engine?: string; decision?: string } | null;
    };
  }): ResponsePlanV1["claimManifest"];

  export function isClaimManifestComplete(
    claimManifest: ResponsePlanV1["claimManifest"] | null | undefined,
    options?: { providerEligible?: boolean },
  ): boolean;

  export function detectClaimManifestOutputViolations(
    output: string,
    options?: { claimManifest?: ResponsePlanV1["claimManifest"] | null },
  ): string[];

  export function summarizeClaimManifestClaimTypes(
    claimManifest: ResponsePlanV1["claimManifest"] | null | undefined,
  ): string;

  export const FOOD_UNDERSTANDING_V3_VERSION: string;

  export function normalizeFoodPhrase(value?: string): string;

  export function validateFoodAliasEntry(entry: unknown): boolean;

  export function buildFoodAliasDictionaryManifest(input: {
    version?: string;
    checksum?: string | null;
    entries?: unknown[];
  }): {
    version: string;
    checksum: string | null;
    entryCount: number;
    entries: unknown[];
  };

  export function resolveFoodAliasMatches(
    phrase: string,
    options?: {
      globalAliases?: Array<Record<string, unknown>>;
      tenantApprovedAliases?: Array<Record<string, unknown>>;
    },
  ): Array<{
    foodId: string;
    foodName: string;
    confidence: "exact" | "keyword";
    path: string;
    aliasId: string;
    aliasScope: "global" | "tenant_approved";
    autopilotEligible: boolean;
  }>;

  export function filterAutopilotEligibleCatalogMatches(
    matches?: Array<{ confidence?: string; autopilotEligible?: boolean }>,
  ): Array<{ confidence?: string; autopilotEligible?: boolean }>;

  export function isBrandOrPackagedProductQuery(message?: string): boolean;

  export function isMixedDishQuery(message?: string): boolean;

  export function findMenuRecipeForPhrase(
    menu: { mealSlots?: Array<{ items?: unknown[]; alternatives?: unknown[] }> } | null,
    phrase: string,
  ): { title: string; ingredients: string[]; menuItemId: string } | null;

  export function evaluateMixedDishUnderstanding(input: {
    message: string;
    menu: { mealSlots?: Array<{ items?: unknown[]; alternatives?: unknown[] }> } | null;
    foodPhrase?: string | null;
  }): {
    applicable: boolean;
    decision: "needs_review" | null;
    reasonCodes: string[];
    evidenceManifest?: Record<string, unknown>;
  };

  export const STYLE_DNA_V2_VERSION: string;

  export const STYLE_DNA_SOFT_MISMATCH_THRESHOLD: number;

  export function buildStyleDnaScopeKey(tenantId: string, dietitianId: string): string;

  export function buildStyleDnaV2(input?: {
    tenantId?: string | null;
    dietitianId?: string | null;
    voiceProfile?: Record<string, unknown> | null;
    editHistorySignals?: Record<string, unknown> | null;
    knownClientNames?: string[];
  }): ResponsePlanV1["styleDna"];

  export function buildStyleEditHistoryRecord(input: {
    tenantId: string;
    dietitianId: string;
    aiDraft: string;
    dietitianFinal: string;
    knownClientNames?: string[];
  }): {
    tenantId: string;
    dietitianId: string;
    aiDraftHash: string;
    dietitianFinalHash: string;
    diffMetadata: {
      editDistance: number;
      lengthDelta: number;
      greetingChanged: boolean;
      closingChanged: boolean;
      wordOverlapRatio: number;
    };
  };

  export function extractStyleSignalsFromEditHistory(
    records?: Array<{ diffMetadata?: Record<string, unknown> }>,
  ): {
    preferredGreeting: string | null;
    preferredClosing: string | null;
    warmthAdjustment: string | null;
    responseTimingStyle: string | null;
    sampleCount: number;
  };

  export function stripClientIdentifyingText(text: string, knownNames?: string[]): string;

  export function filterCandidateStylePhrases(
    phrases?: string[],
    options?: { knownClientNames?: string[] },
  ): { accepted: string[]; rejected: Array<{ phrase: string; reason: string }> };

  export function detectHardStyleGuardViolations(text: string, styleDna?: ResponsePlanV1["styleDna"] | null): string[];

  export function measureSoftStyleMismatch(
    text: string,
    styleDna?: ResponsePlanV1["styleDna"] | null,
  ): { score: number; exceedsThreshold: boolean; hardBlock: boolean; checks?: string[] };

  export function extractClinicalDecisionSnapshot(
    responsePlan?: ResponsePlanV1 | null,
  ): {
    replyMode: string | null;
    templateId: string | null;
    riskClass: string | null;
    intentFamily: string | null;
    foodDecision: string | null;
    providerEligible: boolean;
  } | null;

  export function clinicalSnapshotsEqual(
    left: ReturnType<typeof extractClinicalDecisionSnapshot>,
    right: ReturnType<typeof extractClinicalDecisionSnapshot>,
  ): boolean;

  export function guardProviderOutput(input: {
    output: string;
    capsule: Record<string, unknown>;
    riskDecision: { level: RiskLevel };
    foodRule?: FoodRuleDecision | null;
    foodDecisionV2?: FoodDecisionV2Result | null;
    structuredFoodRules?: Record<string, unknown> | null;
    claimManifest?: ResponsePlanV1["claimManifest"] | null;
    styleDna?: ResponsePlanV1["styleDna"] | null;
  }): { allowed: boolean; issues: Array<{ code: string; severity: string; category: string; evidence: string }> };

  export type FoodRuleDecisionValue =
    | "allowed_food_confirmation"
    | "forbidden_food_rejection"
    | "equivalent_substitution_allowed"
    | "diet_type_compatible"
    | "diet_type_conflict"
    | "optional_skip_allowed"
    | "mandatory_skip_blocked"
    | "unknown_food_requires_review"
    | "product_ingredient_conflict"
    | "product_ingredient_unknown"
    | "mixed_intent_blocked"
    | "not_applicable";

  export type StructuredFoodRulesInput = {
    forbiddenFoodItems?: string[];
    forbiddenFoodGroups?: string[];
    allowedFoodItems?: string[];
    allowedFoodGroups?: string[];
    dietTypeRules?: string | null;
    equivalentExchangeGroups?: Array<{ groupId: string; items: string[] }>;
    mandatoryFoodsOrMeals?: string[];
    optionalFoodsOrMeals?: string[];
    skipToleranceRules?: string | null;
    portionBoundaries?: string | null;
    ingredientAllergenKeywords?: string[];
    productLabelReviewPolicy?: string | null;
    uncertaintyPolicy?: string | null;
    allowedSubstitutionsSummary?: string;
  };

  export type ProductIngredientEvidenceInput = {
    ingredientSourceType?: string;
    ingredientText?: string;
    ingredientConfidence?: "exact" | "high" | "low" | "unknown" | string;
  };

  export type ProductIngredientVerificationDecisionValue =
    | "product_allowed"
    | "product_blocked"
    | "requires_review";

  export type ProductIngredientVerificationResult = {
    version: string;
    decision: ProductIngredientVerificationDecisionValue;
    reasons: string[];
    ingredientSourceType: string;
    ingredientConfidence: string;
    matchedForbiddenKeywordIds: string[];
    dietTypeConflict: boolean;
    dietTypeConflictGroup?: string | null;
  };

  export const PRODUCT_INGREDIENT_VERIFICATION_VERSION: string;
  export const INGREDIENT_SOURCE_TYPES: string[];
  export const INGREDIENT_CONFIDENCE_LEVELS: string[];
  export const PRODUCT_INGREDIENT_VERIFICATION_DECISIONS: ProductIngredientVerificationDecisionValue[];
  export function evaluateProductIngredientVerification(input: {
    ingredientText?: string | null;
    ingredientSourceType?: string | null;
    ingredientConfidence?: string | null;
    ingredientAllergenKeywords?: string[];
    forbiddenFoodItems?: string[];
    forbiddenFoodGroups?: string[];
    dietTypeRules?: string | null;
  }): ProductIngredientVerificationResult;

  export type FoodDecisionV2Decision =
    | "allow"
    | "discourage"
    | "forbid"
    | "needs_label"
    | "needs_review"
    | "not_applicable";

  export type FoodDecisionV2CatalogMatch = {
    foodId: string;
    foodName: string;
    confidence: "exact" | "partial" | "keyword";
    path: string;
  };

  export type FoodDecisionV2Result = {
    version: string;
    decision: FoodDecisionV2Decision;
    reasonCodes: string[];
    queryType: string | null;
    catalogMatches: FoodDecisionV2CatalogMatch[];
    menuOnPlan: boolean | null;
    effectiveFlexibility: string | null;
    evidenceManifest: Record<string, unknown>;
    sourceReferences: string[];
    providerEligible: boolean;
    legacyFoodRuleDecision: string;
  };

  export type FoodRuleDecision = {
    version: string;
    decision: FoodRuleDecisionValue;
    allowed: boolean;
    reasons: string[];
    queryType?: string | null;
    matchedFood?: string;
    matchedSource?: string;
    exchangeGroupId?: string;
    sourceFood?: string;
    targetFood?: string;
    skipTarget?: string | null;
    dietType?: string | null;
    matchedKeywords?: string[];
    matchedForbiddenKeywordIds?: string[];
    ingredientConfidence?: string;
    ingredientSourceType?: string;
    verification?: ProductIngredientVerificationResult;
    dietTypeConflictGroup?: string | null;
  };

  export const FOOD_RULE_ENGINE_VERSION: string;
  export const FOOD_RULE_DECISIONS: FoodRuleDecisionValue[];
  export function evaluateFoodRuleDecision(input: {
    message?: string;
    structuredFoodRules?: StructuredFoodRulesInput | null;
    mixedIntentBlocked?: boolean;
    productIngredientEvidence?: ProductIngredientEvidenceInput | null;
  }): FoodRuleDecision;

  export type ScopeRuleEscalationLevel = "yellow" | "red";
  export type ScopeGuardStatus = "noop" | "unavailable" | "no_match" | "matched";

  export type ScopeGuardResult = {
    active: boolean;
    escalate: boolean;
    level: RiskLevel;
    reasons: string[];
    matchedRuleIds: string[];
    scores: Record<string, number>;
    status: ScopeGuardStatus;
    version: string;
  };

  export const SCOPE_GUARD_VERSION: string;
  export const FULL_CLASSIFIER_VERSION_WITH_SCOPE: string;
  export function applyScopeRules(
    retrievedRules?: Array<{ ruleId: string; score: number; escalationLevel: ScopeRuleEscalationLevel }>,
    options?: { matchThreshold?: number },
  ): ScopeGuardResult;
  export function buildScopeGuardNoopResult(): ScopeGuardResult;
  export function buildScopeGuardUnavailableResult(): ScopeGuardResult;
  export function mergeScopeDecision(
    baseDecision: RiskDecision,
    scopeResult: ScopeGuardResult | null | undefined,
  ): RiskDecision;
  export function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel;
  export function rankRiskLevel(level: RiskLevel): number;

  export const AI_QUALITY_EVAL_HARNESS_V1_VERSION: string;
  export const RELEASE_SUBSET_TARGET_COUNT: number;
  export const FULL_REHEARSAL_TARGET_COUNT: number;

  export function loadHarnessCasesFromJsonl(raw: string): Array<Record<string, unknown>>;
  export function expandHarnessCasesDeterministically(
    seedCases: Array<Record<string, unknown>>,
    targetCount: number,
  ): Array<Record<string, unknown>>;
  export function buildHarnessBaseInput(overrides?: Record<string, unknown>): Record<string, unknown>;
  export function extractHarnessEvalSnapshot(result: Record<string, unknown>): Record<string, unknown>;
  export function evaluateHarnessExpectations(
    expect: Record<string, unknown>,
    snapshot: Record<string, unknown>,
  ): string[];
  export function detectClientFacingMetadataLeaks(text: string): string[];
  export function assertClientFacingTextSafe(text: string): void;
  export function runHarnessCase(
    caseDef: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<{ id: string; category: string; snapshots: Record<string, unknown>[]; failures: string[]; pass: boolean }>;
  export function runHarnessBatch(
    cases: Array<Record<string, unknown>>,
    options?: Record<string, unknown>,
  ): Promise<{
    results: Array<{ id: string; category: string; snapshots: Record<string, unknown>[]; failures: string[]; pass: boolean }>;
    metrics: Record<string, unknown>;
  }>;

  export const AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION: string;
  export const EXPANDED_REHEARSAL_CLIENT_COUNT: number;
  export const EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT: number;
  export const EXPANDED_REHEARSAL_TARGET_COUNT: number;
  export const EXPANDED_REHEARSAL_SAMPLE_CLIENT_COUNT: number;
  export const EXPANDED_REHEARSAL_SAMPLE_MESSAGES_PER_CLIENT: number;
  export const EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT: number;
  export function expandHarnessCasesForClientScale(
    seedCases: Array<Record<string, unknown>>,
    clientCount?: number,
    messagesPerClient?: number,
  ): Array<Record<string, unknown>>;
  export function extractExpandedRehearsalSnapshot(result: Record<string, unknown>): Record<string, unknown>;
  export function evaluateExpandedRehearsalSafety(
    snapshot: Record<string, unknown>,
    caseDef: Record<string, unknown>,
    turnExpect?: Record<string, unknown>,
  ): string[];
  export function evaluateExpandedRehearsalTurnQuality(
    snapshot: Record<string, unknown>,
    caseDef: Record<string, unknown>,
    turnExpect?: Record<string, unknown>,
  ): Record<string, unknown>;
  export function buildExpandedRehearsalMetrics(
    results: Array<Record<string, unknown>>,
    options?: Record<string, unknown>,
  ): Record<string, unknown>;
  export function runExpandedRehearsalCase(
    caseDef: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<{
    id: string;
    category: string;
    snapshots: Record<string, unknown>[];
    failures: string[];
    pass: boolean;
  }>;
  export function runExpandedRehearsalBatch(
    cases: Array<Record<string, unknown>>,
    options?: Record<string, unknown>,
  ): Promise<{
    results: Array<{ id: string; category: string; snapshots: Record<string, unknown>[]; failures: string[]; pass: boolean }>;
    metrics: Record<string, unknown>;
  }>;

  export const CLINICAL_RED_TEAM_V1_VERSION: string;
  export const RD_REVIEW_PACKET_VERSION: string;
  export const RD_REVIEW_SECTIONS: string[];
  export const CLINICAL_RED_TEAM_CATEGORIES: string[];

  export function isClientSendAction(action?: string | null): boolean;
  export function isYellowRedClientSend(snapshot?: { action?: string | null; risk?: string | null }): boolean;
  export function evaluateClinicalRedTeamSafety(
    snapshot: Record<string, unknown>,
    caseDef: Record<string, unknown>,
  ): string[];
  export function runClinicalRedTeamCase(
    caseDef: Record<string, unknown>,
    options?: Record<string, unknown>,
  ): Promise<{
    id: string;
    category: string;
    rdSection: string | null;
    redTeamCategory: string | null;
    snapshots: Record<string, unknown>[];
    safetyViolations: string[];
    failures: string[];
    pass: boolean;
  }>;
  export function runClinicalRedTeamBatch(
    cases: Array<Record<string, unknown>>,
    options?: Record<string, unknown>,
  ): Promise<{
    results: Array<Record<string, unknown>>;
    metrics: {
      status: "pass" | "fail";
      caseCount: number;
      passCount: number;
      failureCount: number;
      unsafeClientSendCount: number;
      yellowRedClientSendCount: number;
      failures: string[];
      rdSectionCounts: Record<string, number>;
      redTeamCategoryCounts: Record<string, number>;
      elapsedMs: number;
    };
  }>;
  export function buildClinicalRedTeamMetrics(
    results: Array<Record<string, unknown>>,
    failures?: string[],
    startedAt?: number,
  ): Record<string, unknown>;
  export function buildRdReviewPacketEvidence(
    metrics: Record<string, unknown>,
    cases: Array<Record<string, unknown>>,
  ): {
    packet_version: string;
    red_team_version: string;
    status: string;
    evidence_only: boolean;
    production_gate_closed: boolean;
    clinical_taxonomy_gate_closed: boolean;
    case_count: number;
    pass_count: number;
    unsafe_client_send_count: number;
    yellow_red_client_send_count: number;
    rd_section_inventory: Array<{ section: string; caseCount: number; covered: boolean }>;
    red_team_inventory: Array<{ category: string; caseCount: number; covered: boolean }>;
    rd_section_counts: Record<string, number>;
    red_team_category_counts: Record<string, number>;
    generated_at: string;
  };
  export function serializeRdReviewPacketEvidence(
    metrics: Record<string, unknown>,
    cases: Array<Record<string, unknown>>,
  ): ReturnType<typeof buildRdReviewPacketEvidence>;
  export function summarizeClinicalRedTeamSnapshot(result: Record<string, unknown>): Record<string, unknown>;

  export const COPILOT_QUALITY_WORKFLOW_V1_VERSION: string;
  export const CLIENT_EXPORT_FORBIDDEN_FIELDS: string[];

  export function buildCopilotQualityReviewContext(input?: {
    decision?: Record<string, unknown> | null;
    contextManifest?: Record<string, unknown> | null;
    blockedReason?: string | null;
    qualityIssues?: string[];
    draftBody?: string | null;
  }): {
    version: string;
    internalOnly: boolean;
    decisionId: string | null;
    responsePlanSummary: Record<string, unknown> | null;
    sourceRefs: Array<{ id: string | null; category: string | null; segmentType: string | null }>;
    claimManifestSummary: Record<string, unknown> | null;
    blockOrHandoffReason: string | null;
    suggestedEditFocus: string[];
  };
  export function sanitizeAiDecisionForClientExport(decision: Record<string, unknown>): Record<string, unknown>;
  export function sanitizeClientScopedExportForClientFacing(exportData: Record<string, unknown>): Record<string, unknown>;
  export function detectClientExportMetadataLeaks(exportPayload: unknown): string[];
  export function assertClientExportMetadataSafe(exportPayload: unknown): void;
  export function assertStyleEditDoesNotMutateClinicalDecision(
    beforePlan: Record<string, unknown> | null | undefined,
    afterPlan: Record<string, unknown> | null | undefined,
  ): void;

  export const NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION: string;
  export const NARROW_AUTOPILOT_INELIGIBLE_REASON_CODES: string[];

  export function evaluateNarrowAutopilotEligibilityV2(input?: {
    clientAiMode?: string;
    riskDecision?: { level?: string } | null;
    modeDecision?: { action?: string; reason?: string } | null;
    canonicalIntent?: Record<string, unknown> | null;
    greenIntent?: Record<string, unknown> | null;
    answerability?: Record<string, unknown> | null;
    foodDecisionV2?: Record<string, unknown> | null;
    foodRule?: Record<string, unknown> | null;
    responsePlan?: Record<string, unknown> | null;
    providerOutputSafety?: { allowed?: boolean } | null;
    phase?: "pre_provider" | "post_provider";
  }): {
    version: string;
    eligible: boolean;
    applies: boolean;
    phase: string;
    reasonCodes: string[];
    fallbackModeAction: string | null;
    fallbackReason: string | null;
    postProvider?: Record<string, unknown>;
  };
  export function applyNarrowAutopilotModeDowngrade(
    modeDecision: { action?: string; reason?: string } | null | undefined,
    narrowAutopilotEligibility: {
      applies?: boolean;
      eligible?: boolean;
      fallbackModeAction?: string | null;
      fallbackReason?: string | null;
    } | null | undefined,
  ): { action?: string; reason?: string };

  export const VISUAL_MEANING_RESOLVER_V1_VERSION: string;
  export const VISUAL_SOURCE_AUTHORITY_STATES: string[];
  export const VISUAL_WORKFLOW_STATES: string[];

  export type VisualMeaningTextBinding = {
    primaryBinding: "caption" | "reply" | "sequential_bundle" | "none";
    captionText: string | null;
    replyText: string | null;
    sequentialTexts: string[];
    replyToProviderMessageId: string | null;
  };

  export type VisualMeaningSegmentResolution = {
    analysisId: string;
    mediaAssetId: string;
    sceneType: string;
    reasonCodes: string[];
    sourceAuthority: string;
    workflowState: string;
    menuMatch: Record<string, unknown> | null;
    labelEvidence: Record<string, unknown> | null;
    screenshotQuery: string | null;
    screenshotApprovedSourceHit: boolean;
    approvedSourceId: string | null;
    productDecision: string | null;
  };

  export type ApprovedDietitianVisualSource = {
    category: string;
    segmentType: string;
    sourceId: string | null;
    authority: string;
    origin: string;
    text: string;
  };

  export type VisualMeaningResolution = {
    schemaVersion: string;
    bundleId: string;
    textBinding: VisualMeaningTextBinding;
    visualSegments: VisualMeaningSegmentResolution[];
    sourceAuthorityState: "unresolved" | "partial" | "approved_only";
    extractedQuestions: string[];
    absenceOfEvidenceAllowedCount: number;
    ocrNeverApprovedSource: boolean;
    providerContextBound: Record<string, unknown> | null;
    approvedSourceManifest: ApprovedDietitianVisualSource[];
  };

  export function resolveVisualMeaningV1(input?: {
    envelope?: {
      bundleId?: string;
      textSegments?: Array<{
        body?: string;
        replyToProviderMessageId?: string | null;
      }>;
      visualSegments?: Array<{
        messageId?: string;
        mediaAssetId?: string;
        analysisId?: string;
        captionText?: string | null;
        observation?: Record<string, unknown>;
      }>;
    };
    activeMenu?: { mealSlots?: Array<{ items?: unknown[]; alternatives?: unknown[] }> } | null;
    foodRules?: Record<string, unknown>;
    messagesByProviderMessageId?: Record<string, { id: string; providerMessageId: string | null }>;
    providerContext?: Record<string, unknown> | null;
    approvedDietitianSources?: ApprovedDietitianVisualSource[];
  }): VisualMeaningResolution;

  export function resolveTextBinding(
    envelope: {
      textSegments?: Array<{ body?: string; replyToProviderMessageId?: string | null }>;
      visualSegments?: Array<{ messageId?: string; captionText?: string | null }>;
    },
    messagesByProviderMessageId?: Record<string, { id: string; providerMessageId: string | null }>,
  ): VisualMeaningTextBinding;

  export function findExactMenuItemMatch(
    menu: { mealSlots?: Array<{ items?: unknown[]; alternatives?: unknown[] }> } | null,
    phrase: string,
  ): { menuItemId: string; matchedLabel: string } | null;

  export function evaluateScreenshotApprovedSourceHit(
    query: string,
    activeMenu: { mealSlots?: Array<{ items?: unknown[]; alternatives?: unknown[] }> } | null,
  ): boolean;

  export function hasHighIntegrityLabel(observation: Record<string, unknown>): boolean;

  export class VisualMeaningResolverError extends Error {}

  export const VISUAL_RISK_OVERLAY_V1_VERSION: string;
  export const VISUAL_INELIGIBILITY_REASON_CODES: string[];
  export function evaluateVisualRiskOverlay(input?: {
    baseRiskDecision?: { level: "green" | "yellow" | "red"; reasons?: string[] };
    meaning?: VisualMeaningResolution;
    envelope?: Record<string, unknown>;
  }): {
    version: string;
    baseRiskLevel: "green" | "yellow" | "red";
    visualRiskLevel: "green" | "yellow" | "red";
    mergedRiskLevel: "green" | "yellow" | "red";
    riskEscalated: boolean;
    ineligibilityReasons: string[];
    allowlisted: boolean;
    reasonCodes: string[];
    providerBlocked: boolean;
    providerAttempted: boolean;
  };

  export const VISUAL_INTENT_BRIDGE_V1_VERSION: string;
  export const VISUAL_GREEN_INTENT_FAMILIES: string[];
  export function resolveVisualCanonicalIntent(input?: Record<string, unknown>): Record<string, unknown> | null;

  export const VISUAL_ANSWERABILITY_V1_VERSION: string;
  export function evaluateVisualAnswerability(input?: Record<string, unknown>): Record<string, unknown> | null;

  export const VISUAL_MULTIMODAL_SAFETY_V1_VERSION: string;
  export function evaluateMultimodalVisualSafetyChainV1(input?: Record<string, unknown>): {
    version: string;
    visualRiskOverlay: ReturnType<typeof evaluateVisualRiskOverlay>;
    mergedRiskDecision: { level: "green" | "yellow" | "red"; reasons: string[] };
    visualCanonicalIntent: Record<string, unknown> | null;
    answerability: Record<string, unknown>;
    greenIntent: Record<string, unknown>;
    modeDecision: { action: string; reason?: string };
    responsePlan: Record<string, unknown>;
    narrowAutopilotEligibility: Record<string, unknown>;
    providerAttempted: boolean;
    clientSendEligible: boolean;
    outputGuard: { allowed: boolean; issues: string[]; textSample: string };
    outputGuardSample: { allowed: boolean; issues: string[] } | null;
  };
  export function isVisualClientSendEligible(chainResult: { clientSendEligible?: boolean } | null | undefined): boolean;
  export function detectVisualMetadataLeaks(text: string): string[];

  export const VISUAL_EVIDENCE_SOURCE_V2_VERSION: string;
  export const VISUAL_EVIDENCE_SOURCE_TYPES: string[];
  export function mapVisualOcrIngredientSourceType(): "visual_label_ocr";
  export function buildSourceGatedVisualSummary(input: Record<string, unknown>): Record<string, unknown>;
  export function assertProviderContextExcludesRawOcr(value: unknown): void;

  export const VISUAL_SOURCE_GATE_V1_VERSION: string;
  export function extractAllowlistedConflictTokens(input?: Record<string, unknown>): string[];
  export function buildSegmentSourceGatedSummary(input?: Record<string, unknown>): Record<string, unknown> | null;
  export function buildSourceGatedVisualProviderContext(input?: Record<string, unknown>): {
    version: string;
    byteSize: number;
    withinLimit: boolean;
    excludesRawMedia: boolean;
    excludesRawOcr: boolean;
    segments: Array<Record<string, unknown>>;
  };
  export function buildApprovedDietitianVisualSources(input?: {
    pinnedNotes?: string[];
    contextUpdates?: Array<{ id?: string; summary?: string; body?: string }>;
  }): ApprovedDietitianVisualSource[];
  export function evaluateMultiImageSourceIdentity(
    segmentResolutions?: Array<Record<string, unknown>>,
  ): { consistent: boolean; reasonCode: string | null };

  export const DIETITIAN_CHAT_CONTEXT_POLICY_VERSION: string;
  export const DIETITIAN_CHAT_INTENTS: string[];
  export const AI_CHAT_CONTEXT_TOOLS: string[];
  export const DIETITIAN_CHAT_MAX_VISIBLE_MESSAGES: number;
  export const DIETITIAN_CHAT_MAX_CONTEXT_CHARS: number;
  export const DIETITIAN_CHAT_MAX_ROLLING_SUMMARY_CHARS: number;
  export function buildDietitianChatProviderContext(input: {
    messages: Array<{ role: "user" | "assistant"; body: string }>;
  }): {
    version: string;
    visibleMessages: Array<{ role: "user" | "assistant"; body: string }>;
    visibleCharCount: number;
    rollingSummary: { summaryText: string; isAuthoritative: boolean };
  };
  export function buildDietitianChatRollingSummary(
    olderMessages: Array<{ role: "user" | "assistant"; body: string }>,
    maxChars?: number,
  ): { summaryText: string; isAuthoritative: boolean };
  export function selectDietitianChatVisibleMessages(
    messages: Array<{ role: "user" | "assistant"; body: string }>,
    maxMessages?: number,
    maxChars?: number,
  ): { visibleMessages: Array<{ role: "user" | "assistant"; body: string }>; totalChars: number };
  export function classifyDietitianChatIntentFromSignals(input: {
    triggerBody: string;
    scopeType?: "general" | "client";
  }): string;
  export function planDietitianChatContextTools(
    intent: string,
    scopeType: "general" | "client",
  ): string[];
  export function buildDietitianChatEvidenceEnvelope(input: {
    intent: string;
    sourceRefs: Array<{ sourceId: string; excerpt: string }>;
    structuredFacts?: Array<{ section: string; facts: string[]; isAiSynthesis: boolean }>;
  }): string;

  export const DIETITIAN_CHAT_OUTPUT_GUARD_VERSION: string;
  export function isDietitianChatTerminalRunStatus(status: string | null | undefined): boolean;
  export function shouldAbortDietitianChatRun(status: string | null | undefined): boolean;
  export function validateDietitianChatAssistantOutput(input: {
    directAnswer: string | null;
    answerability?: string | null;
    riskLevel?: string | null;
    completionState?: string | null;
  }): {
    ok: boolean;
    code?: string;
    answerability: string;
    riskLevel: string;
    completionState: string;
    directAnswer: string | null;
  };
  export function validateDietitianChatRiskAssessmentResult(input: {
    riskAssessment: Record<string, unknown> | null | undefined;
    providerRiskLevel?: string | null;
  }): { ok: boolean; code?: string; riskLevel?: string; reasons?: string[] };

  export const DIETITIAN_CHAT_ORCHESTRATOR_VERSION: string;
  export const DIETITIAN_CHAT_RUN_PHASES: string[];
  export function createDietitianChatRunPlan(input: {
    messages: Array<{ role: "user" | "assistant"; body: string }>;
    triggerBody: string;
    scopeType?: "general" | "client";
  }): {
    version: string;
    phases: string[];
    context: ReturnType<typeof buildDietitianChatProviderContext>;
    triggerBody: string;
    scopeType: "general" | "client";
    intent: string;
    toolPlan: string[];
  };
  export const DIETITIAN_CHAT_ANSWERABILITY_VERSION: string;
  export function validateDietitianChatStructuredAnswerSchema(input: unknown): {
    ok: boolean;
    code?: string | null;
    errors: string[];
    answer?: Record<string, unknown> | null;
  };
  export function validateDietitianChatSourcedAnswer(input: {
    structuredAnswer: Record<string, unknown> | null;
    allowedSourceIds: string[];
    sourceTypesById?: Record<string, string>;
    sourceExcerptById?: Record<string, string>;
    runId?: string | null;
    clientId?: string | null;
  }): {
    ok: boolean;
    stage: string;
    code?: string | null;
    answerability: string;
    errors: string[];
    answer?: Record<string, unknown> | null;
  };
  export function detectDietitianChatPromptInjectionSignals(text: string): {
    flagged: boolean;
    reasons: string[];
  };
  export function wrapUntrustedSourceContent(text: string): string;
  export function buildDeidentifiedWebResearchQuery(input: {
    query: string;
    clientNames?: string[];
  }): { ok: boolean; reason: string | null; query: string };
  export function finalizeDietitianChatRun(input: {
    runStatus: string;
    providerResult: {
      directAnswer: string | null;
      answerability?: string | null;
      riskLevel?: string | null;
      completionState?: string | null;
      structuredAnswer?: Record<string, unknown> | null;
    };
    sourcedValidation?: { ok: boolean; answerability?: string | null; code?: string | null } | null;
  }): {
    terminalStatus: string;
    validation: ReturnType<typeof validateDietitianChatAssistantOutput>;
  };
}

declare module "dietitian-ai-assistant-architecture/risk" {
  export const DIETITIAN_CHAT_RISK_VERSION: string;
  export function classifyDietitianChatRisk(input: Record<string, unknown>): {
    version: string;
    riskLevel: string;
    reasons: string[];
    sourceRefIds: string[];
    confidenceClass: string;
    recommendedHumanAction: string;
    hypotheticalRed: boolean;
    safeDraft: { body: string; riskLevel: string | null; sourceRefIds: string[] } | null;
  };
  export function buildAiChatRedNotificationFingerprint(input: {
    clientId: string;
    reasons: string[];
    sourceRevisionDigest: string;
  }): string;
}
