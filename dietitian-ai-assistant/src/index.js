export { handleInboundMessage, decideModeAction } from "./orchestrator.js";
export { personas, getPersona } from "./personas.js";
export { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, languageLabel, normalizeLanguageCode } from "./languages.js";
export { buildDietitianVoiceProfile, defaultVoiceProfile } from "./voice-profile.js";
export { normalizeSafetyText } from "./normalize-safety-text.js";
export { classifyConversationRisk, classifyDieteticRisk, SAFETY_CLASSIFIER_VERSION } from "./safety-classifier.js";
export {
  CLINICAL_SAFETY_CLASSIFIER_VERSION,
  CLINICAL_SAFETY_SECOND_LAYER_VERSION,
  classifyClinicalSafetyRisk,
  evaluateClinicalSafetySecondLayer,
  shouldApplySourceBackedFoodRuleCarveOut,
} from "./clinical-safety-second-layer.js";
export {
  SCOPE_GUARD_VERSION,
  FULL_CLASSIFIER_VERSION_WITH_SCOPE,
  applyScopeRules,
  buildScopeGuardNoopResult,
  buildScopeGuardUnavailableResult,
  mergeScopeDecision,
  maxRiskLevel,
  rankRiskLevel,
} from "./scope-guard.js";
export { evaluateInboundPreflight } from "./inbound-preflight.js";
export { buildClientContextCapsule, assertTenantIsolation } from "./context-capsule.js";
export {
  CONTEXT_POLICY_V1,
  CLIENT_AUTHORED_DATA_INSTRUCTION,
  LATEST_DIETITIAN_CONTEXT_INSTRUCTION,
  MISSING_HISTORICAL_CONTEXT_INSTRUCTION,
  MISSING_HISTORICAL_CONTEXT_TOKEN,
  PRODUCT_COMMUNICATION_COVENANT_INSTRUCTION,
  compilePromptContext,
  renderPromptContext,
  selectPromptableRecentMessages,
} from "./context-compiler.js";
export { buildMemoryContext, selectRecentMessages, appendDurableFact } from "./conversation-memory.js";
export { createHandoffCase } from "./handoff-engine.js";
export {
  APPROVED_SOURCE_ANSWERABILITY_VERSION,
  evaluateApprovedSourceAnswerability,
} from "./approved-source-answerability.js";
export {
  INTENT_SPECIFIC_ANSWERABILITY_VERSION,
  evaluateAnswerabilityPrelude,
  evaluateIntentSpecificAnswerability,
  resolveEffectiveIntentFamily,
  resolveFoodIntentFamily,
  buildStructuredSourceCategories,
} from "./intent-specific-answerability.js";
export {
  GREEN_INTENT_TAXONOMY_VERSION,
  evaluateGreenIntentTaxonomy,
} from "./green-intent-taxonomy.js";
export {
  FOOD_RULE_ENGINE_VERSION,
  FOOD_RULE_DECISIONS,
  evaluateFoodRuleDecision,
} from "./food-rule-engine.js";
export {
  PRODUCT_INGREDIENT_VERIFICATION_VERSION,
  INGREDIENT_SOURCE_TYPES,
  INGREDIENT_CONFIDENCE_LEVELS,
  PRODUCT_INGREDIENT_VERIFICATION_DECISIONS,
  evaluateProductIngredientVerification,
} from "./product-ingredient-verification.js";
export {
  FOOD_RULE_PROMPT_SEGMENTS_VERSION,
  FOOD_RULE_PROMPT_SEGMENT_TYPES,
  FOOD_RULE_PROVIDER_INSTRUCTION,
  BOUNDED_FOOD_RULE_SEGMENT_MAX_CHARS,
  buildFoodRulePromptSegments,
} from "./food-rule-prompt-segments.js";
export {
  PRODUCT_COMMUNICATION_COVENANT_VERSION,
  FOOD_RULE_OUTPUT_GUARD_VERSION,
  detectFoodRuleOutputViolations,
  detectProductCommunicationCovenantIssues,
  guardAssistantReply,
  guardProviderOutput,
  hasMissingHistoricalContextToken,
} from "./response-quality-guard.js";
export { MODEL_ROUTING, selectModelForRisk } from "./model-routing.js";
export { resolveAiActivation } from "./ai-activation.js";
export { MESSAGE_ORIGINS, buildMessageProvenance } from "./message-provenance.js";
