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
  CONTEXT_POLICY_V2,
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
export {
  HISTORICAL_RETRIEVAL_VERSION,
  detectAmbiguousCompetingDietitianSources,
  detectStructuredRecordUpdateSignals,
  isGenericGreeting,
  isRetrievalEligibleMessage,
  isRetrievalEvidencedDietitianMessage,
  retrieveHistoricalMessages,
  scoreLexicalRelevance,
  tokenizeTranscriptText,
  evaluateTemporalInstruction,
} from "./historical-retrieval.js";
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
  resolveFoodDecisionV2IntentFamily,
  buildStructuredSourceCategories,
  buildFoodDecisionV2SourceCategories,
} from "./intent-specific-answerability.js";
export {
  GREEN_INTENT_TAXONOMY_VERSION,
  evaluateGreenIntentTaxonomy,
  resolveCanonicalIntentV2,
  mapCanonicalIntentToGreenTaxonomy,
} from "./green-intent-taxonomy.js";
export {
  CANONICAL_INTENT_RESOLVER_V2_VERSION,
  CANONICAL_INTENT_WORKFLOW_STATES,
} from "./canonical-intent-resolver-v2.js";
export {
  RESPONSE_PLAN_V1_VERSION,
  RESPONSE_PLAN_REPLY_MODES,
  buildResponsePlanV1,
  isResponsePlanProviderEligible,
  resolveReplyMode,
  resolveTemplateId,
} from "./response-plan-v1.js";
export {
  RESPONSE_PLAN_PROMPT_SEGMENTS_VERSION,
  BOUNDED_RESPONSE_PLAN_SEGMENT_MAX_CHARS,
  buildResponsePlanPromptSegments,
  appendResponsePlanPromptSegments,
  assertBoundedProviderSegment,
} from "./response-plan-prompt-segments.js";
export {
  DETERMINISTIC_TEMPLATE_LIBRARY_V1_VERSION,
  KNOWN_TEMPLATE_IDS,
  isKnownTemplateId,
  assertClientFacingTemplateId,
  renderDeterministicTemplate,
  assertTemplateTextSafeForClient,
  parseTemplateIdFromResponsePlanSegment,
  parseReplyModeFromResponsePlanSegment,
  parseRiskClassFromResponsePlanSegment,
} from "./deterministic-template-library-v1.js";
export {
  CLAIM_MANIFEST_V1_VERSION,
  CLAIM_MANIFEST_CLAIM_TYPES,
  buildClaimManifestV1,
  isClaimManifestComplete,
  detectClaimManifestOutputViolations,
  summarizeClaimManifestClaimTypes,
} from "./claim-manifest-v1.js";
export {
  FOOD_UNDERSTANDING_V3_VERSION,
  normalizeFoodPhrase,
  validateFoodAliasEntry,
  buildFoodAliasDictionaryManifest,
  resolveFoodAliasMatches,
  filterAutopilotEligibleCatalogMatches,
  isBrandOrPackagedProductQuery,
  isMixedDishQuery,
  findMenuRecipeForPhrase,
  evaluateMixedDishUnderstanding,
} from "./food-understanding-v3.js";
export {
  STYLE_DNA_V2_VERSION,
  STYLE_DNA_SOFT_MISMATCH_THRESHOLD,
  buildStyleDnaScopeKey,
  buildStyleDnaV2,
  buildStyleEditHistoryRecord,
  extractStyleSignalsFromEditHistory,
  stripClientIdentifyingText,
  filterCandidateStylePhrases,
  detectHardStyleGuardViolations,
  measureSoftStyleMismatch,
  extractClinicalDecisionSnapshot,
  clinicalSnapshotsEqual,
} from "./style-dna-v2.js";
export {
  AI_QUALITY_EVAL_HARNESS_V1_VERSION,
  RELEASE_SUBSET_TARGET_COUNT,
  FULL_REHEARSAL_TARGET_COUNT,
  loadHarnessCasesFromJsonl,
  expandHarnessCasesDeterministically,
  buildHarnessBaseInput,
  extractHarnessEvalSnapshot,
  evaluateHarnessExpectations,
  detectClientFacingMetadataLeaks,
  assertClientFacingTextSafe,
  runHarnessCase,
  runHarnessBatch,
} from "./ai-quality-evaluation-harness-v1.js";
export {
  AI_QUALITY_EXPANDED_REHEARSAL_V1_VERSION,
  EXPANDED_REHEARSAL_CLIENT_COUNT,
  EXPANDED_REHEARSAL_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_TARGET_COUNT,
  EXPANDED_REHEARSAL_SAMPLE_CLIENT_COUNT,
  EXPANDED_REHEARSAL_SAMPLE_MESSAGES_PER_CLIENT,
  EXPANDED_REHEARSAL_SAMPLE_TARGET_COUNT,
  expandHarnessCasesForClientScale,
  extractExpandedRehearsalSnapshot,
  evaluateExpandedRehearsalSafety,
  evaluateExpandedRehearsalTurnQuality,
  buildExpandedRehearsalMetrics,
  runExpandedRehearsalCase,
  runExpandedRehearsalBatch,
} from "./ai-quality-expanded-rehearsal-v1.js";
export {
  CLINICAL_RED_TEAM_V1_VERSION,
  RD_REVIEW_PACKET_VERSION,
  RD_REVIEW_SECTIONS,
  CLINICAL_RED_TEAM_CATEGORIES,
  isClientSendAction,
  isYellowRedClientSend,
  evaluateClinicalRedTeamSafety,
  runClinicalRedTeamCase,
  runClinicalRedTeamBatch,
  buildClinicalRedTeamMetrics,
  buildRdReviewPacketEvidence,
  serializeRdReviewPacketEvidence,
  summarizeClinicalRedTeamSnapshot,
} from "./clinical-red-team-v1.js";
export {
  COPILOT_QUALITY_WORKFLOW_V1_VERSION,
  CLIENT_EXPORT_FORBIDDEN_FIELDS,
  buildCopilotQualityReviewContext,
  sanitizeAiDecisionForClientExport,
  sanitizeClientScopedExportForClientFacing,
  detectClientExportMetadataLeaks,
  assertClientExportMetadataSafe,
  assertStyleEditDoesNotMutateClinicalDecision,
} from "./copilot-quality-workflow-v1.js";
export {
  NARROW_AUTOPILOT_ELIGIBILITY_V2_VERSION,
  NARROW_AUTOPILOT_INELIGIBLE_REASON_CODES,
  evaluateNarrowAutopilotEligibilityV2,
  applyNarrowAutopilotModeDowngrade,
} from "./narrow-autopilot-eligibility-v2.js";
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
  FOOD_DECISION_V2_PROMPT_SEGMENTS_VERSION,
  FOOD_DECISION_V2_PROMPT_SEGMENT_TYPES,
  FOOD_DECISION_V2_PROVIDER_INSTRUCTION,
  buildFoodDecisionV2PromptSegments,
} from "./food-decision-v2-prompt-segments.js";
export {
  PRODUCT_COMMUNICATION_COVENANT_VERSION,
  FOOD_RULE_OUTPUT_GUARD_VERSION,
  FOOD_DECISION_V2_OUTPUT_GUARD_VERSION,
  detectFoodRuleOutputViolations,
  detectFoodDecisionV2OutputViolations,
  detectProductCommunicationCovenantIssues,
  guardAssistantReply,
  guardProviderOutput,
  hasMissingHistoricalContextToken,
} from "./response-quality-guard.js";
export { MODEL_ROUTING, selectModelForRisk } from "./model-routing.js";
export { resolveAiActivation } from "./ai-activation.js";
export { MESSAGE_ORIGINS, buildMessageProvenance } from "./message-provenance.js";
export {
  VISUAL_OBSERVATION_V1_VERSION,
  VISUAL_SCENE_TYPES,
  NON_AUTOPILOT_VISUAL_SCENES,
  validateVisualObservationV1,
  isVisualSceneType,
  isUnitConfidence,
  isNonAutopilotVisualScene,
  mergeVisualRiskOverlay,
  assertVisualSceneExhaustive,
} from "./visual-observation-v1.js";
