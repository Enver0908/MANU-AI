import type { LaunchGateEvidenceRecord } from "./launch-gates";
import { PHASE_72_PERMISSION_GRAPH_VERSION } from "./phase-72-permission-graph";
import { PHASE_74_POLICY_VERSION } from "./phase-74-data-lifecycle-policy";
import type { RiskLevel } from "./types";

export const PHASE_75_GEMINI_PROVIDER_PACK_VERSION = "phase-75-gemini-provider-pack-v1";

export const PHASE_75_GREEN_MODEL_ID = "gemini-1.5-flash";
export const PHASE_75_YELLOW_MODEL_ID = "gemini-3";
export const PHASE_75_TARGET_PROVIDER_SURFACE =
  "google_cloud_vertex_ai_gemini_enterprise_agent_platform_paid";

export type Phase75ApprovalStatus = "draft";

export type Phase75ProviderRoutingBand =
  | "no_provider"
  | "quarantine"
  | "green_autopilot_send_candidate"
  | "green_copilot_draft"
  | "yellow_internal_draft";

export type Phase75ForbiddenSurfaceId =
  | "consumer_gemini_app"
  | "free_google_ai_studio"
  | "unpaid_gemini_api"
  | "gemini_api_without_billing"
  | "personal_google_account"
  | "grounding_google_search"
  | "grounding_google_maps"
  | "gemini_live_session"
  | "file_image_audio_pdf_input"
  | "model_tuning_client_data"
  | "pre_ga_health_models"
  | "third_party_model_garden_health";

export type Phase75ProviderRoutingInput = {
  riskLevel: RiskLevel;
  clientAiMode: "copilot" | "autopilot";
  clientAiActive: boolean;
  sourceBacked: boolean;
  sensitiveIntentBlocked: boolean;
  passiveOrManual: boolean;
  unknownIdentity: boolean;
  groupMessage: boolean;
  optOut: boolean;
  removedClient: boolean;
  launchGateEvidence?: LaunchGateEvidenceRecord[];
};

export type Phase75ProviderRoutingEvaluation = {
  packVersion: string;
  approvalStatus: Phase75ApprovalStatus;
  routingBand: Phase75ProviderRoutingBand;
  modelId: string | null;
  providerAttemptAllowed: boolean;
  clientFacingSendAllowed: boolean;
  realGeminiEgressAllowed: boolean;
  blockingReasons: string[];
};

export type Phase75HealthEligibilityChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  approvalStatus: Phase75ApprovalStatus;
};

export type Phase75ProviderSourceRef = {
  sourceFamily: string;
  sourceUrl: string;
};

const DRAFT: Phase75ApprovalStatus = "draft";

export const PHASE_75_OFFICIAL_PROVIDER_SOURCES: Phase75ProviderSourceRef[] = [
  {
    sourceFamily: "Gemini API Additional Terms",
    sourceUrl: "https://ai.google.dev/gemini-api/terms",
  },
  {
    sourceFamily: "Google Cloud Service Specific Terms",
    sourceUrl: "https://cloud.google.com/terms/service-terms",
  },
  {
    sourceFamily: "Vertex AI zero data retention",
    sourceUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/vertex-ai-zero-data-retention",
  },
  {
    sourceFamily: "Gemini Enterprise Agent Platform data residency",
    sourceUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency",
  },
  {
    sourceFamily: "Google Cloud HIPAA compliance guide",
    sourceUrl: "https://cloud.google.com/security/compliance/hipaa",
  },
];

export const PHASE_75_FORBIDDEN_PROVIDER_SURFACES: Array<{
  id: Phase75ForbiddenSurfaceId;
  label: string;
  approvalStatus: Phase75ApprovalStatus;
}> = [
  { id: "consumer_gemini_app", label: "Consumer Gemini app", approvalStatus: DRAFT },
  { id: "free_google_ai_studio", label: "Free Google AI Studio", approvalStatus: DRAFT },
  { id: "unpaid_gemini_api", label: "Unpaid Gemini API quota", approvalStatus: DRAFT },
  { id: "gemini_api_without_billing", label: "Gemini API without active Cloud Billing", approvalStatus: DRAFT },
  { id: "personal_google_account", label: "Personal Google account / consumer workflow", approvalStatus: DRAFT },
  { id: "grounding_google_search", label: "Grounding with Google Search", approvalStatus: DRAFT },
  { id: "grounding_google_maps", label: "Grounding with Google Maps", approvalStatus: DRAFT },
  { id: "gemini_live_session", label: "Gemini Live API session resumption", approvalStatus: DRAFT },
  { id: "file_image_audio_pdf_input", label: "File/image/audio/PDF interpretation", approvalStatus: DRAFT },
  { id: "model_tuning_client_data", label: "Model tuning/fine-tuning with client data", approvalStatus: DRAFT },
  { id: "pre_ga_health_models", label: "Pre-GA models with health data", approvalStatus: DRAFT },
  { id: "third_party_model_garden_health", label: "Third-party models through model garden for health data", approvalStatus: DRAFT },
];

export const PHASE_75_TRAINING_LOGGING_RETENTION_POLICY = {
  approvalStatus: DRAFT,
  trainingUse: "Customer/client prompts and health data must not be used for provider training or fine-tuning.",
  logging: "App logs store minimized provider audit metadata only; no raw prompt/completion or raw health message retention.",
  providerMetadataRetentionMonths: 12,
  rawPromptCompletionRetention: 0,
  unpaidApiHealthData: "forbidden",
  groundingSearchMaps: "disabled",
} as const;

export const PHASE_75_HEALTH_ELIGIBILITY_STATUS = "conditional_yes_after_contractual_consent_and_gates" as const;

export const PHASE_75_HEALTH_ELIGIBILITY_CHECKLIST: Phase75HealthEligibilityChecklistItem[] = [
  { id: "legal_privacy_approval", label: "Legal/privacy approval artifact signed", required: true, approvalStatus: DRAFT },
  { id: "provider_vendor_approval", label: "Provider/vendor approval artifact signed", required: true, approvalStatus: DRAFT },
  { id: "google_cloud_dpa_reviewed", label: "Google Cloud contract/DPA terms reviewed", required: true, approvalStatus: DRAFT },
  { id: "healthcare_restrictions_memo", label: "Health data use case aligned with Google healthcare restrictions", required: true, approvalStatus: DRAFT },
  { id: "medical_device_classification", label: "Not medical advice/device or clearance memo approved", required: true, approvalStatus: DRAFT },
  { id: "prompt_allowlist_locked", label: "PromptContext allowlist locked via Phase 70/72", required: true, approvalStatus: DRAFT },
  { id: "red_no_provider", label: "Red provider call impossible", required: true, approvalStatus: DRAFT },
  { id: "yellow_no_client_send", label: "Yellow provider internal-only; no client-facing auto-send", required: true, approvalStatus: DRAFT },
  { id: "green_source_backed", label: "Green calls source-backed and send-guarded", required: true, approvalStatus: DRAFT },
  { id: "paid_surface_only", label: "Paid Google Cloud surface only", required: true, approvalStatus: DRAFT },
  { id: "no_tuning", label: "No model tuning/fine-tuning", required: true, approvalStatus: DRAFT },
  { id: "no_grounding_files", label: "No grounding/search/maps/live/files", required: true, approvalStatus: DRAFT },
  { id: "data_residency_approved", label: "Data residency/region and transfer decision approved", required: true, approvalStatus: DRAFT },
  { id: "abuse_monitoring_decision", label: "Abuse monitoring / zero retention decision approved", required: true, approvalStatus: DRAFT },
];

export const PHASE_75_ALLOWED_PROMPT_CONTEXT_FIELDS = [
  "conversation_language",
  "persona_style_contract",
  "active_diet_plan_summary",
  "meal_plan_slots",
  "allowed_substitutions",
  "restricted_foods",
  "allergies",
  "food_rule_decision",
  "allowed_food_rules",
  "forbidden_food_rules",
  "equivalent_exchange_rules",
  "diet_type_rules",
  "ingredient_verification",
  "pinned_notes",
  "dietitian_context_update_summaries",
  "dietitian_manual_message_summaries",
  "approved_official_corpus_snippets",
  "yellow_current_message_bounded",
  "minimized_health_profile_flags",
] as const;

export const PHASE_75_FORBIDDEN_PROMPT_CONTEXT_FIELDS = [
  "whatsapp_phone_e164",
  "telegram_user_id",
  "date_of_birth",
  "credential_id",
  "diagnosed_condition_details",
  "medication_details",
  "insulin_details",
  "supplement_details",
  "lab_result_details",
  "symptom_details",
  "eating_disorder_details",
  "pregnancy_complication_details",
  "dietitian_only_notes",
  "raw_client_free_text_outside_window",
  "raw_pdf_image_audio_voice",
  "secrets_tokens_webhook_payloads",
  "other_client_data",
  "opt_out_client_data",
  "removed_client_data",
] as const;

export const PHASE_75_REQUIRED_GATE_EVIDENCE = [
  "gemini_provider_terms_reviewed",
  "google_cloud_paid_surface_selected",
  "dpa_data_processor_terms_reviewed",
  "health_data_eligibility_memo",
  "medical_device_cds_classification_memo",
  "kvkk_legal_basis_transfer_memo",
  "provider_logging_retention_training_memo",
  "abuse_monitoring_zero_retention_decision",
  "region_data_residency_decision",
  "security_iam_secrets_cost_control_decision",
  "clinical_taxonomy_approval",
  "product_covenant_provider_output_guard",
  "prompt_context_allowlist",
  "red_no_provider_tests",
  "yellow_no_client_send_tests",
] as const;

const FORBIDDEN_PROMPT_FIELD_SET = new Set<string>(PHASE_75_FORBIDDEN_PROMPT_CONTEXT_FIELDS);
const ALLOWED_PROMPT_FIELD_SET = new Set<string>(PHASE_75_ALLOWED_PROMPT_CONTEXT_FIELDS);

export function evaluatePhase75ProviderPackReadiness(): { status: "pass" | "fail"; blockingReasons: string[] } {
  const blockingReasons: string[] = [];

  if (PHASE_75_FORBIDDEN_PROVIDER_SURFACES.length < 10) {
    blockingReasons.push("forbidden provider surface list incomplete");
  }
  if (PHASE_75_HEALTH_ELIGIBILITY_CHECKLIST.length < 14) {
    blockingReasons.push("health eligibility checklist incomplete");
  }
  if (PHASE_75_REQUIRED_GATE_EVIDENCE.length < 14) {
    blockingReasons.push("required gate evidence catalog incomplete");
  }

  return {
    status: blockingReasons.length === 0 ? "pass" : "fail",
    blockingReasons,
  };
}

export function evaluatePhase75PromptContextFieldEligibility(fieldId: string): {
  fieldId: string;
  providerInputAllowed: boolean;
  approvalStatus: Phase75ApprovalStatus;
} {
  if (FORBIDDEN_PROMPT_FIELD_SET.has(fieldId)) {
    return { fieldId, providerInputAllowed: false, approvalStatus: DRAFT };
  }

  if (ALLOWED_PROMPT_FIELD_SET.has(fieldId)) {
    return { fieldId, providerInputAllowed: true, approvalStatus: DRAFT };
  }

  return { fieldId, providerInputAllowed: false, approvalStatus: DRAFT };
}

export function isPhase75HealthEligibilitySatisfied(
  launchGateEvidence: LaunchGateEvidenceRecord[] = [],
): boolean {
  const legalApproved = launchGateEvidence.some(
    (record) => record.gateId === "legal_privacy_review" && record.approvalStatus === "approved",
  );
  const providerApproved = launchGateEvidence.some(
    (record) => record.gateId === "provider_vendor_review" && record.approvalStatus === "approved",
  );

  return legalApproved && providerApproved;
}

export function isPhase75RealGeminiEgressAllowed(
  launchGateEvidence: LaunchGateEvidenceRecord[] = [],
): boolean {
  if (process.env.MANU_ALLOW_REAL_GEMINI !== "true") {
    return false;
  }

  return isPhase75HealthEligibilitySatisfied(launchGateEvidence);
}

function buildPhase75RoutingEvaluation(
  input: Phase75ProviderRoutingInput,
  routingBand: Phase75ProviderRoutingBand,
  modelId: string | null,
  providerAttemptAllowed: boolean,
  clientFacingSendAllowed: boolean,
  blockingReasons: string[],
): Phase75ProviderRoutingEvaluation {
  return {
    packVersion: PHASE_75_GEMINI_PROVIDER_PACK_VERSION,
    approvalStatus: DRAFT,
    routingBand,
    modelId,
    providerAttemptAllowed,
    clientFacingSendAllowed,
    realGeminiEgressAllowed: isPhase75RealGeminiEgressAllowed(input.launchGateEvidence ?? []),
    blockingReasons: [...new Set(blockingReasons)],
  };
}

export function evaluatePhase75GeminiProviderRouting(
  input: Phase75ProviderRoutingInput,
): Phase75ProviderRoutingEvaluation {
  const blockingReasons: string[] = [];

  if (input.removedClient) blockingReasons.push("removed client");
  if (input.optOut) blockingReasons.push("opt-out active");
  if (input.unknownIdentity || input.groupMessage) blockingReasons.push("identity/channel quarantine");

  if (input.unknownIdentity || input.groupMessage || input.optOut || input.removedClient) {
    return buildPhase75RoutingEvaluation(input, "quarantine", null, false, false, blockingReasons);
  }

  if (input.passiveOrManual) {
    blockingReasons.push("passive/manual/paused client");
    return buildPhase75RoutingEvaluation(input, "no_provider", null, false, false, blockingReasons);
  }

  if (!input.clientAiActive) {
    blockingReasons.push("client AI not active");
    return buildPhase75RoutingEvaluation(input, "no_provider", null, false, false, blockingReasons);
  }

  if (input.riskLevel === "red") {
    blockingReasons.push("red risk blocks provider");
    return buildPhase75RoutingEvaluation(input, "no_provider", null, false, false, blockingReasons);
  }

  if (input.riskLevel === "yellow") {
    blockingReasons.push("yellow provider is internal draft/handoff only");
    return buildPhase75RoutingEvaluation(
      input,
      "yellow_internal_draft",
      PHASE_75_YELLOW_MODEL_ID,
      true,
      false,
      blockingReasons,
    );
  }

  if (!input.sourceBacked) {
    blockingReasons.push("green requires source-backed answerability");
    return buildPhase75RoutingEvaluation(input, "no_provider", null, false, false, blockingReasons);
  }

  if (input.sensitiveIntentBlocked) {
    blockingReasons.push("sensitive green-looking intent blocked");
    return buildPhase75RoutingEvaluation(input, "no_provider", null, false, false, blockingReasons);
  }

  if (input.clientAiMode === "autopilot") {
    return buildPhase75RoutingEvaluation(
      input,
      "green_autopilot_send_candidate",
      PHASE_75_GREEN_MODEL_ID,
      true,
      true,
      blockingReasons,
    );
  }

  return buildPhase75RoutingEvaluation(
    input,
    "green_copilot_draft",
    PHASE_75_GREEN_MODEL_ID,
    true,
    false,
    blockingReasons,
  );
}

export function buildPhase75GeminiProviderLaunchGateEvidence(): LaunchGateEvidenceRecord[] {
  return [
    {
      gateId: "provider_vendor_review",
      artifactTitle: "Phase 75 Gemini provider decision pack",
      artifactRef: PHASE_75_GEMINI_PROVIDER_PACK_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "provider requirements",
        "no-storage/no-training requirements",
        "prompt/completion logging decision checklist",
        "provider-attempt audit semantics",
        "provider input allowlist",
        "internal copilot egress review",
        "dietitian context update egress review",
      ],
      sanitizedReference: true,
    },
    {
      gateId: "legal_privacy_review",
      artifactTitle: "Phase 75 health-data eligibility and cross-border transfer memo",
      artifactRef: PHASE_75_GEMINI_PROVIDER_PACK_VERSION,
      approvalStatus: "draft",
      coveredEvidence: [
        "legal basis matrix",
        "privacy notice and client permission documents",
        "medical-device or clinical-decision-support classification memo",
      ],
      sanitizedReference: true,
    },
  ];
}

export const PHASE_75_UPSTREAM_ARTIFACT_VERSIONS = {
  permissionGraph: PHASE_72_PERMISSION_GRAPH_VERSION,
  dataLifecyclePolicy: PHASE_74_POLICY_VERSION,
} as const;
