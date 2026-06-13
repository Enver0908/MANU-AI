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
    memory?: CoreMemory;
    clientContextUpdates?: CoreContextUpdate[];
    voiceProfile?: Partial<CoreVoiceProfile>;
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
    | "green_logistics"
    | "green_behavior_support"
    | "green_progress_logging"
    | "green_low_risk_clarification"
    | "green_general_education"
    | "green_context_recap";

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
    decision: "green_intent_allowed" | "blocked_sensitive_intent" | "not_applicable_non_green";
    allowed: boolean;
    intentFamily: GreenIntentFamily | null;
    blockedFamily: SensitiveIntentFamily | null;
    reasons: string[];
    sourceCategories: string[];
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
  }): GreenIntentTaxonomyDecision;

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
}
