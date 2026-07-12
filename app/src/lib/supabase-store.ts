import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import { createPlaceholderScopeRules } from "./scope-corpus";
import { createInitialState } from "./seed-data";
import { isSafetyChecklistComplete, normalizeSafetyChecklist } from "./safety-checklist";
import {
  anonymizeClientInState,
  buildClientScopedExport,
  recordClientExportInState,
  removeClientInState,
} from "./data-governance";
import { sanitizeClientScopedExportForClientFacing } from "./phase-77v-copilot-quality-workflow";
import {
  buildClientCreateValidationState,
  buildClientPatchValidationState,
  type Phase79ScopedClientCreateResponse,
  type Phase79ScopedClientPatchResponse,
} from "./phase-79c-scoped-client-mutation";
import {
  buildPhase79WindowedDashboardPayload,
  WINDOWED_READ_DEFAULTS,
  type Phase79WindowedDashboardPayload,
} from "./phase-79b-windowed-read-contracts";
import { assembleBoundedInternalCopilotToolState } from "./phase-79d-bounded-internal-copilot-loaders";
import {
  classifyInternalCopilotIntent,
  extractClientQuery,
  resolveVisibleClientByName,
} from "./internal-copilot";
import {
  addManualReplyInState,
  addClientContextUpdateInState,
  applyUpdateProposalInState,
  approveDraftInState,
  addVoiceSamplesInState,
  createFormSchemaInState,
  createClientInState,
  createUpdateProposalInState,
  dismissDraftInState,
  generateVoiceProfile,
  publishFormSchemaInState,
  patchClientInState,
  rejectUpdateProposalInState,
  releaseHumanTakeoverInState,
  resolveAndReactivateRedRiskInState,
  runInternalCopilotMessageInState,
  activateMenuPlanInState,
  createMenuPlanInState,
  saveClientFoodRuleProfileV2InState,
  saveFormResponseInState,
  saveMenuPlanInState,
  simulateInState,
  updateVoiceSampleStatus,
  updateHandoffStatusInState,
  setChannelAdapterRollbackInState,
} from "./app-state-store";
import type { AppTenantContext } from "./auth-context";
import type { ControlledAiActivationInput } from "./phase-85-if-f-risk-reactivation";
import { createContextIntakeProposalInState } from "./phase-85-if-g-context-intake";
import {
  buildOperationalFoundationInspectionDto,
  type OperationalFoundationInspectionDto,
} from "./phase-85-if-h-operational-visibility";
import { revokeTenantChannelBindingsInState } from "./phase-85-if-i-lifecycle-closure";
import type { CreateClientContextUpdateInput } from "./client-context-updates";
import type { ApplyClientUpdateProposalInput, CreateClientUpdateProposalInput } from "./client-update-proposals";
import type { SaveClientFoodRuleProfileV2Input } from "./phase-77e-client-food-rule-profile";
import type { CreateClientMenuPlanV1Input, SaveClientMenuPlanV1Input } from "./phase-77f-client-menu-plan";
import { AppDomainError } from "./app-errors";
import type {
  AiDecisionRecord,
  AuditEventRecord,
  ClientFoodRuleProfileV2Record,
  ClientMenuPlanV1Record,
  ClientFormResponseRecord,
  ClientFormSchemaRecord,
  ClientFormFieldDefinition,
  ClientContextUpdateRecord,
  Phase77EFlexibilityLevel,
  ClientRecord,
  ClientUpdateProposalRecord,
  ConversationRecord,
  DataRequestRecord,
  DietitianFormResponseRecord,
  DietitianFormSchemaRecord,
  DietitianVoiceProfileRecord,
  DietitianVoiceSampleRecord,
  HandoffCaseRecord,
  InboundQuarantineRecord,
  ChannelAccountBindingRecord,
  ChannelActorBindingRecord,
  ChannelEventRecord,
  ChannelMessageRevisionRecord,
  HumanControlSessionRecord,
  RiskActivityEventRecord,
  ContextIntakeProposalRecord,
  ChannelDeliveryRecord,
  ChannelAdapterRollbackControls,
  InternalCopilotMessageRecord,
  InternalCopilotSourceRef,
  InternalCopilotToolCallRecord,
  ManuAppState,
  MessageRecord,
  NotificationRecord,
  RiskAssessmentRecord,
  SimulationRequest,
  SupportedLanguageCode,
  TenantRole,
  VoiceSampleStatus,
} from "./types";
import type { ConversationReadReceiptRecord } from "./phase-85-stage-4b2-contracts";
import { normalizeLanguageCode } from "./languages";
import { processWhatsAppMockWebhookInState } from "./whatsapp-mock-webhook";
import { createDefaultChannelAdapterRollbackControls } from "./channel-adapter-rollback";
import {
  buildSearchConversationMessagesRpcParams,
  mapSupabaseSearchRowToRetrievalCandidate,
  type SupabaseConversationMessageSearchRow,
} from "./phase-85-if-e-supabase-search";
import {
  isStage4BNotificationVisible,
  normalizeNotificationsInState,
} from "./phase-85-stage-4b-notifications";
import {
  projectClinicalAlertsFromState,
  resolveClinicalAlertKind,
  resolveDietitianClinicalSla,
  type ClinicalAlertFilterSeverity,
} from "./phase-85-stage-4b-alerts";
import type {
  ClinicalAlertListItem,
  ClinicalAlertsListResponse,
  NotificationCategory,
  NotificationPriority,
  NotificationReceiptRecord,
  Stage4BNotificationMutationResponse,
  Stage4BNotificationReadAllResponse,
  SystemNotificationListItem,
  SystemNotificationsListResponse,
} from "./phase-85-stage-4b-contracts";
import {
  buildStage4BNotificationTargetFromLinks,
  decodeAlertCursor,
  decodeNotificationCursor,
  encodeAlertCursor,
  encodeNotificationCursor,
  resolveNotificationSearchKinds,
  STAGE4B_NOTIFICATION_I18N_KEYS,
  type NotificationListStatus,
} from "./phase-85-stage-4b-api";

export const DEMO_TENANT_UUID = "00000000-0000-4000-8000-000000000001";
export const DEMO_DIETITIAN_UUID = "00000000-0000-4000-8000-000000000002";
export const DEMO_USER_UUID = "00000000-0000-4000-8000-000000000003";
const DEMO_CLIENT_IDS = [
  "00000000-0000-4000-8000-000000000011",
  "00000000-0000-4000-8000-000000000012",
  "00000000-0000-4000-8000-000000000013",
];

type DbClient = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  lifecycle_status: ClientRecord["lifecycleStatus"] | null;
  removed_at: string | null;
  full_name: string;
  primary_phone_e164: string | null;
  communication_language: SupportedLanguageCode | null;
  selected_persona_id: string;
  ai_status: ClientRecord["aiStatus"];
  ai_mode: ClientRecord["aiMode"];
  ai_active_from: string | null;
  ai_active_until: string | null;
  health_profile: ClientRecord["healthProfile"];
  diet_plan: ClientRecord["dietPlan"];
  allergies: string[];
  restricted_foods: string[];
  clinical_risk_notes: string[];
  pinned_notes: string[];
  channel_permission: ClientRecord["channelPermission"];
  mandatory_safety_complete: boolean;
  safety_checklist: Partial<ClientRecord["safetyChecklist"]> | null;
  human_takeover_locked: boolean;
  red_risk_lock: ClientRecord["redRiskLock"] | null;
  yellow_risk_hold: ClientRecord["yellowRiskHold"] | null;
  context_revision: number;
  created_at: string;
};
type DbChannel = {
  client_id: string;
  channel: ClientRecord["channel"];
  channel_user_id: string;
  display_handle: string | null;
};
export type DbClientAssignment = {
  client_id: string;
  dietitian_id: string;
};
type DbConversation = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  client_id: string;
  channel: ConversationRecord["channel"];
  revision?: number;
};
type DbMemory = {
  conversation_id: string;
  rolling_summary: string;
  memory_version: string;
  memory_revision: number;
  stale: boolean;
};
type DbMessage = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  sender: MessageRecord["sender"];
  body: string;
  origin: MessageRecord["origin"];
  provider_account_binding_id?: string | null;
  provider_event_id?: string | null;
  provider_message_id?: string | null;
  actor_type?: MessageRecord["actorType"] | null;
  actor_binding_id?: string | null;
  author_interface?: MessageRecord["authorInterface"] | null;
  actor_resolution_basis?: MessageRecord["actorResolutionBasis"] | null;
  source_message_id: string | null;
  author_dietitian_id: string | null;
  generated_by_ai_decision_id: string | null;
  approved_by_dietitian_id: string | null;
  provider_sent_at?: string | null;
  observed_at?: string | null;
  persisted_at?: string | null;
  conversation_sequence?: number | null;
  content_status?: MessageRecord["contentStatus"] | null;
  retrieval_eligibility?: MessageRecord["retrievalEligibility"] | null;
  risk: MessageRecord["risk"];
  status: MessageRecord["status"];
  created_at: string;
};
type DbDecision = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  client_id: string;
  mode: AiDecisionRecord["mode"];
  ai_status: AiDecisionRecord["aiStatus"];
  persona_id: string;
  risk: AiDecisionRecord["risk"];
  model: string | null;
  prompt_version: string | null;
  provider_attempted: boolean;
  provider_id: string | null;
  provider_status: AiDecisionRecord["providerStatus"];
  provider_error_code: string | null;
  send_status: AiDecisionRecord["sendStatus"];
  context_manifest: Record<string, unknown> | null;
  provider_output_safety: Record<string, unknown> | null;
  token_budget: Record<string, unknown> | null;
  action: AiDecisionRecord["action"];
  blocked_reason: string | null;
  quality_issues: string[];
  reasons: string[];
  created_at: string;
};
type DbHandoff = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  client_id: string;
  conversation_id: string;
  triggering_message_id: string | null;
  risk: HandoffCaseRecord["risk"];
  reasons: string[];
  status: HandoffCaseRecord["status"];
  urgency: string;
  safe_acknowledgement: string;
  recommended_action: string;
  created_at: string;
};
type DbRiskAssessment = {
  id: string;
  tenant_id: string;
  conversation_id: string;
  message_id: string;
  level: RiskAssessmentRecord["level"];
  reasons: string[];
  classifier_version: string;
  created_at: string;
};
type DbAudit = {
  id: string;
  tenant_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
type DbNotification = {
  id: string;
  tenant_id: string;
  type: NotificationRecord["type"];
  kind: NotificationRecord["kind"];
  priority: NotificationRecord["priority"];
  entity_type: string;
  entity_id: string;
  title: string;
  body: string;
  read: boolean;
  acknowledged_at: string | null;
  dedupe_key: string | null;
  source_message_id: string | null;
  target_panel: string | null;
  baseline_revision: number | null;
  resolved_at: string | null;
  resolved_by_dietitian_id: string | null;
  client_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  handoff_id: string | null;
  occurrence_count: number;
  last_occurred_at: string;
  created_at: string;
};
type DbNotificationReceipt = {
  tenant_id: string;
  notification_id: string;
  dietitian_id: string;
  read_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
};
type DbConversationReadReceipt = {
  tenant_id: string;
  conversation_id: string;
  dietitian_id: string;
  last_read_sequence: number;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};
type DbStage4BAlertCandidate = {
  alert_id: string;
  client_id: string;
  conversation_id: string | null;
  client_full_name: string;
  severity: "red" | "yellow";
  started_at: string;
  handoff_id: string | null;
  source_message_id: string | null;
  active_draft_message_id: string | null;
  first_message_id: string | null;
  reason_codes: string[] | null;
};
type DbStage4BAlertCounts = {
  filtered_total: number;
  all_count: number;
  red_count: number;
  yellow_count: number;
};
type SupabaseDietitianSlaConfig = {
  timezone: string;
  redResponseSla: string | null;
  yellowReviewSla: string | null;
};
type DbStage4BNotificationCandidate = {
  id: string;
  kind: NotificationRecord["kind"];
  priority: NotificationPriority;
  category: NotificationCategory;
  client_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  handoff_id: string | null;
  client_full_name: string | null;
  occurrence_count: number;
  last_occurred_at: string;
  resolved_at: string | null;
  read_at: string | null;
  acknowledged_at: string | null;
  lifecycle_state: "active" | "unread" | "history";
  priority_rank: number;
  history_at: string;
};
type DbStage4BNotificationCounts = {
  active_count: number;
  unread_count: number;
  history_count: number;
  intervention_required_count: number;
  filtered_total: number;
};
type DbDataRequest = {
  id: string;
  tenant_id: string;
  client_id: string;
  request_type: DataRequestRecord["requestType"];
  status: DataRequestRecord["status"];
  requested_by_dietitian_id: string | null;
  completed_at: string | null;
  created_at: string;
};
type DbInternalCopilotMessage = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  role: InternalCopilotMessageRecord["role"];
  body: string;
  source_refs: InternalCopilotSourceRef[];
  tool_call_ids: string[];
  safety_status: InternalCopilotMessageRecord["safetyStatus"];
  created_at: string;
};
type DbInternalCopilotToolCall = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  tool_name: InternalCopilotToolCallRecord["toolName"];
  arguments: Record<string, unknown>;
  status: InternalCopilotToolCallRecord["status"];
  source_refs: InternalCopilotSourceRef[];
  result_summary: string;
  created_at: string;
};
type DbVoiceSample = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  body: string;
  body_hash: string;
  status: VoiceSampleStatus;
  created_at: string;
};
type DbVoiceProfile = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  status: DietitianVoiceProfileRecord["status"];
  profile_version: number;
  average_message_chars: number;
  formality: string;
  emoji_policy: string;
  common_greetings: string[];
  common_closings: string[];
  style_notes: string;
  sample_count: number;
  source_sample_ids: string[];
  generated_at: string | null;
  updated_at: string;
};
type DbFormSchema = {
  id: string;
  tenant_id: string;
  title: string;
  language_code: SupportedLanguageCode | null;
  version: number;
  status: ClientFormSchemaRecord["status"];
  fields: ClientFormFieldDefinition[];
  created_at: string;
  published_at: string | null;
};
type DbFormResponse = {
  id: string;
  tenant_id: string;
  client_id: string;
  schema_id: string;
  schema_version: number;
  schema_snapshot: ClientFormSchemaRecord;
  language_code: SupportedLanguageCode | null;
  submitted_phone_e164: string | null;
  answers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
type DbDietitianFormSchema = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  title: string;
  language_code: SupportedLanguageCode | null;
  version: number;
  status: DietitianFormSchemaRecord["status"];
  fields: ClientFormFieldDefinition[];
  registry_version: string | null;
  created_at: string;
  published_at: string | null;
};
type DbDietitianFormResponse = {
  id: string;
  tenant_id: string;
  dietitian_id: string;
  schema_id: string;
  schema_version: number;
  schema_snapshot: DietitianFormSchemaRecord;
  language_code: SupportedLanguageCode | null;
  answers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
type DbClientContextUpdate = {
  id: string;
  tenant_id: string;
  client_id: string;
  dietitian_id: string;
  source: ClientContextUpdateRecord["source"];
  occurred_at: string;
  title: string;
  summary: string;
  details: string;
  importance: ClientContextUpdateRecord["importance"];
  status: ClientContextUpdateRecord["status"];
  supersedes_update_id: string | null;
  created_at: string;
};
type DbClientMenuPlan = {
  id: string;
  tenant_id: string;
  client_id: string;
  dietitian_id: string;
  template_type: ClientMenuPlanV1Record["templateType"];
  status: ClientMenuPlanV1Record["status"];
  version: number;
  revision: number;
  title: string;
  effective_date: string | null;
  plan_data: Record<string, unknown>;
  catalog_version: string;
  catalog_source_sha256: string;
  catalog_record_set_sha256: string;
  migrated_from_legacy_diet_plan: boolean;
  export_visible: boolean;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
};
type DbClientFoodRuleProfile = {
  id: string;
  tenant_id: string;
  client_id: string;
  dietitian_id: string;
  version: number;
  status: ClientFoodRuleProfileV2Record["status"];
  revision: number;
  profile_data: Record<string, unknown>;
  catalog_version: string;
  catalog_source_sha256: string;
  catalog_record_set_sha256: string;
  migrated_from_legacy_76d: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
type DbClientUpdateProposal = {
  id: string;
  tenant_id: string;
  client_id: string;
  dietitian_id: string;
  source_text: string;
  proposed_patches: ClientUpdateProposalRecord["proposedPatches"];
  safety_flags: string[];
  status: ClientUpdateProposalRecord["status"];
  expected_context_revision: number;
  created_at: string;
  resolved_at: string | null;
};
type DbInboundQuarantine = {
  id: string;
  tenant_id: string;
  channel: InboundQuarantineRecord["channel"];
  source_conversation_type: InboundQuarantineRecord["sourceConversationType"];
  source_conversation_id: string | null;
  source_message_id: string | null;
  sender_channel_user_id: string | null;
  reason: InboundQuarantineRecord["reason"];
  created_at: string;
};
type DbChannelAccountBinding = {
  id: string;
  tenant_id: string;
  provider: ChannelAccountBindingRecord["provider"];
  provider_account_id: string;
  waba_id: string | null;
  business_phone_number_id: string | null;
  normalized_display_number: string | null;
  operating_mode: ChannelAccountBindingRecord["operatingMode"];
  lifecycle_status: ChannelAccountBindingRecord["lifecycleStatus"];
  attribution_policy: ChannelAccountBindingRecord["attributionPolicy"];
  verified_at: string | null;
  revoked_at: string | null;
  created_by_dietitian_id: string | null;
  revoked_by_dietitian_id: string | null;
  created_at: string;
  updated_at: string;
};
type DbChannelActorBinding = {
  id: string;
  tenant_id: string;
  account_binding_id: string;
  dietitian_id: string | null;
  actor_type: ChannelActorBindingRecord["actorType"];
  attribution_basis: ChannelActorBindingRecord["attributionBasis"];
  valid_from: string;
  valid_to: string | null;
  verified_at: string | null;
  revoked_at: string | null;
  created_by_dietitian_id: string | null;
  revoked_by_dietitian_id: string | null;
  audit_reason_code: string | null;
  created_at: string;
};
type DbChannelEvent = {
  id: string;
  tenant_id: string;
  account_binding_id: string | null;
  event_kind: ChannelEventRecord["eventKind"];
  processing_status: ChannelEventRecord["processingStatus"];
  provider_account_id: string | null;
  provider_event_id: string | null;
  provider_message_id: string | null;
  from_identity: string | null;
  to_identity: string | null;
  counterparty_identity: string | null;
  payload_digest: string;
  payload_schema_version: string;
  provider_time: string | null;
  observed_at: string;
  committed_at: string | null;
  quarantine_id: string | null;
  replay_of_event_id: string | null;
  retry_count: number;
  internal_sequence: number | null;
};
type DbChannelMessageRevision = {
  id: string;
  tenant_id: string;
  message_id: string | null;
  channel_event_id: string | null;
  provider_event_id: string | null;
  revision_action: ChannelMessageRevisionRecord["revisionAction"];
  prior_content_status: ChannelMessageRevisionRecord["priorContentStatus"];
  current_content_status: ChannelMessageRevisionRecord["currentContentStatus"];
  prior_body_digest: string | null;
  current_body_digest: string | null;
  revision_sequence: number;
  provider_time: string | null;
  observed_at: string;
};
type DbHumanControlSession = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  reason: HumanControlSessionRecord["reason"];
  status: HumanControlSessionRecord["status"];
  previous_ai_status: HumanControlSessionRecord["previousAiStatus"];
  previous_ai_mode: HumanControlSessionRecord["previousAiMode"];
  linked_handoff_id: string | null;
  linked_yellow_hold_message_id: string | null;
  opened_by_message_id: string | null;
  latest_human_message_id: string | null;
  human_response_observed_count: number;
  opened_at: string;
  resolved_at: string | null;
  reactivated_by_dietitian_id: string | null;
  reactivation_reason_code: string | null;
  restored_ai_mode: HumanControlSessionRecord["restoredAiMode"];
};
type DbRiskActivityEvent = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  human_control_session_id: string | null;
  event_type: RiskActivityEventRecord["eventType"];
  source_message_id: string | null;
  handoff_id: string | null;
  ai_decision_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
type DbContextIntakeProposal = {
  id: string;
  tenant_id: string;
  client_id: string;
  dietitian_id: string | null;
  source_channel: ContextIntakeProposalRecord["sourceChannel"];
  intake_source: ContextIntakeProposalRecord["intakeSource"] | null;
  source_text_digest: string;
  source_text: string | null;
  raw_source_reference: string | null;
  occurred_at: string;
  title: string;
  summary: string;
  details: string;
  importance: ContextIntakeProposalRecord["importance"];
  structured_impact_flags: string[];
  baseline_context_revision: number;
  baseline_form_revision: number | null;
  baseline_food_rule_revision: number | null;
  baseline_menu_plan_revision: number | null;
  status: ContextIntakeProposalRecord["status"];
  confirmation_count: number;
  applied_context_update_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
};
type DbChannelDelivery = {
  id: string;
  tenant_id: string;
  client_id: string;
  conversation_id: string;
  message_id: string;
  channel: ChannelDeliveryRecord["channel"];
  direction: ChannelDeliveryRecord["direction"];
  mock_provider_message_id: string;
  delivery_status: ChannelDeliveryRecord["deliveryStatus"];
  failure_code: string | null;
  created_at: string;
  updated_at: string;
};
type DbChannelAdapterRollbackControls = {
  tenant_id: string;
  global_channel_automation_disabled: boolean;
  tenant_channel_automation_disabled: boolean;
  disabled_dietitian_ids: string[];
  disabled_client_ids: string[];
  updated_at: string;
};

export function isSupabaseStoreConfigured() {
  if (process.env.MANU_DEV_FALLBACK_STORE === "true") {
    return false;
  }

  return getSupabaseAdminClient() !== null;
}

export async function loadSupabaseState(context = demoTenantContext()) {
  const supabase = requireSupabase();
  await ensureDemoData(supabase, context.userId);

  const [
    tenantResult,
    dietitianResult,
    clientsResult,
    assignmentsResult,
    channelsResult,
    conversationsResult,
    memoriesResult,
    messagesResult,
    decisionsResult,
    riskAssessmentsResult,
    handoffsResult,
    notificationsResult,
    notificationReceiptsResult,
    conversationReadReceiptsResult,
    tenantDietitiansResult,
    tenantMembershipsResult,
    dataRequestsResult,
    internalCopilotMessagesResult,
    internalCopilotToolCallsResult,
    voiceSamplesResult,
    voiceProfilesResult,
    formSchemasResult,
    formResponsesResult,
    dietitianFormSchemasResult,
    dietitianFormResponsesResult,
    clientContextUpdatesResult,
    clientUpdateProposalsResult,
    clientFoodRuleProfilesResult,
    clientMenuPlansResult,
    inboundQuarantinesResult,
    channelAccountBindingsResult,
    channelActorBindingsResult,
    channelEventsResult,
    channelMessageRevisionsResult,
    humanControlSessionsResult,
    riskActivityEventsResult,
    contextIntakeProposalsResult,
    channelDeliveriesResult,
    channelAdapterRollbackResult,
    auditEventsResult,
    processedEventsResult,
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", context.tenantId).single(),
    supabase.from("dietitians").select("*").eq("id", context.dietitianId).eq("tenant_id", context.tenantId).single(),
    supabase.from("clients").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_assignments").select("client_id, dietitian_id").eq("tenant_id", context.tenantId),
    supabase.from("client_channels").select("*").eq("tenant_id", context.tenantId),
    supabase.from("conversations").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("conversation_memories").select("*").eq("tenant_id", context.tenantId),
    supabase.from("messages").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("ai_decisions").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("risk_assessments").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("handoff_cases").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("notifications").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("notification_receipts").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("conversation_read_receipts").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("dietitians").select("id, auth_user_id").eq("tenant_id", context.tenantId),
    supabase.from("tenant_memberships").select("user_id, role").eq("tenant_id", context.tenantId),
    supabase.from("data_requests").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("internal_copilot_messages").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("internal_copilot_tool_calls").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("dietitian_voice_samples").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("dietitian_voice_profiles").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("client_form_schemas").select("*").eq("tenant_id", context.tenantId).order("version"),
    supabase.from("client_form_responses").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase
      .from("dietitian_form_schemas")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("dietitian_id", context.dietitianId)
      .order("version"),
    supabase
      .from("dietitian_form_responses")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("dietitian_id", context.dietitianId)
      .order("updated_at"),
    supabase.from("client_context_updates").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_update_proposals").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_food_rule_profiles").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("client_menu_plans").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("inbound_quarantines").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_account_bindings").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_actor_bindings").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_events").select("*").eq("tenant_id", context.tenantId).order("observed_at"),
    supabase.from("channel_message_revisions").select("*").eq("tenant_id", context.tenantId).order("observed_at"),
    supabase.from("human_control_sessions").select("*").eq("tenant_id", context.tenantId).order("opened_at"),
    supabase.from("risk_activity_events").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("context_intake_proposals").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_deliveries").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_adapter_rollback_controls").select("*").eq("tenant_id", context.tenantId).maybeSingle(),
    supabase.from("audit_events").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("processed_inbound_events").select("*").eq("tenant_id", context.tenantId),
  ]);

  throwIfError(tenantResult.error);
  throwIfError(dietitianResult.error);
  throwIfError(clientsResult.error);
  throwIfError(assignmentsResult.error);
  throwIfError(channelsResult.error);
  throwIfError(conversationsResult.error);
  throwIfError(memoriesResult.error);
  throwIfError(messagesResult.error);
  throwIfError(decisionsResult.error);
  throwIfError(riskAssessmentsResult.error);
  throwIfError(handoffsResult.error);
  throwIfError(notificationsResult.error);
  throwIfError(notificationReceiptsResult.error);
  throwIfError(conversationReadReceiptsResult.error);
  throwIfError(tenantDietitiansResult.error);
  throwIfError(tenantMembershipsResult.error);
  throwIfError(dataRequestsResult.error);
  throwIfError(internalCopilotMessagesResult.error);
  throwIfError(internalCopilotToolCallsResult.error);
  throwIfError(voiceSamplesResult.error);
  throwIfError(voiceProfilesResult.error);
  throwIfError(formSchemasResult.error);
  throwIfError(formResponsesResult.error);
  throwIfError(dietitianFormSchemasResult.error);
  throwIfError(dietitianFormResponsesResult.error);
  throwIfError(clientContextUpdatesResult.error);
  throwIfError(clientUpdateProposalsResult.error);
  throwIfError(clientFoodRuleProfilesResult.error);
  throwIfError(clientMenuPlansResult.error);
  throwIfError(inboundQuarantinesResult.error);
  throwIfError(channelAccountBindingsResult.error);
  throwIfError(channelActorBindingsResult.error);
  throwIfError(channelEventsResult.error);
  throwIfError(channelMessageRevisionsResult.error);
  throwIfError(humanControlSessionsResult.error);
  throwIfError(riskActivityEventsResult.error);
  throwIfError(contextIntakeProposalsResult.error);
  throwIfError(channelDeliveriesResult.error);
  throwIfError(channelAdapterRollbackResult.error);
  throwIfError(auditEventsResult.error);
  throwIfError(processedEventsResult.error);

  const channels = channelsResult.data || [];
  const memories = memoriesResult.data || [];
  const dietitianRoleById = buildDietitianRoleMap(
    tenantDietitiansResult.data || [],
    tenantMembershipsResult.data || [],
  );
  const scopedState = scopeSupabaseState(
    normalizeNotificationsInState({
      tenant: {
        id: tenantResult.data.id,
        name: tenantResult.data.name,
      },
      dietitian: {
        id: dietitianResult.data.id,
        tenantId: dietitianResult.data.tenant_id,
        displayName: dietitianResult.data.display_name,
        timezone: dietitianResult.data.timezone,
        uiLanguage: normalizeLanguageCode(dietitianResult.data.ui_language),
      },
      voiceSamples: (voiceSamplesResult.data || []).map(mapVoiceSample),
      voiceProfiles: (voiceProfilesResult.data || []).map(mapVoiceProfile),
      styleEditHistory: [],
      clientFormSchemas: (formSchemasResult.data || []).map(mapFormSchema),
      clientFormResponses: (formResponsesResult.data || []).map(mapFormResponse),
      dietitianFormSchemas: (dietitianFormSchemasResult.data || []).map(mapDietitianFormSchema),
      dietitianFormResponses: (dietitianFormResponsesResult.data || []).map(mapDietitianFormResponse),
      clientContextUpdates: (clientContextUpdatesResult.data || []).map(mapClientContextUpdate),
      clientUpdateProposals: (clientUpdateProposalsResult.data || []).map(mapClientUpdateProposal),
      clientFoodRuleProfiles: (clientFoodRuleProfilesResult.data || []).map(mapClientFoodRuleProfile),
      clientMenuPlans: (clientMenuPlansResult.data || []).map(mapClientMenuPlan),
      clients: (clientsResult.data || []).map((client) => mapClient(client, channels)),
      conversations: (conversationsResult.data || []).map((conversation) =>
        mapConversation(conversation, memories),
      ),
      messages: (messagesResult.data || []).map(mapMessage),
      aiDecisions: (decisionsResult.data || []).map(mapDecision),
      riskAssessments: (riskAssessmentsResult.data || []).map(mapRiskAssessment),
      handoffCases: (handoffsResult.data || []).map(mapHandoff),
      notifications: (notificationsResult.data || []).map(mapNotification),
      notificationReceipts: (notificationReceiptsResult.data || []).map(mapNotificationReceipt),
      conversationReadReceipts: (conversationReadReceiptsResult.data || []).map((receipt) =>
        mapConversationReadReceipt(receipt, dietitianRoleById),
      ),
      inboundQuarantines: (inboundQuarantinesResult.data || []).map(mapInboundQuarantine),
      channelAccountBindings: (channelAccountBindingsResult.data || []).map(mapChannelAccountBinding),
      channelActorBindings: (channelActorBindingsResult.data || []).map(mapChannelActorBinding),
      channelEvents: (channelEventsResult.data || []).map(mapChannelEvent),
      channelMessageRevisions: (channelMessageRevisionsResult.data || []).map(mapChannelMessageRevision),
      humanControlSessions: (humanControlSessionsResult.data || []).map(mapHumanControlSession),
      riskActivityEvents: (riskActivityEventsResult.data || []).map(mapRiskActivityEvent),
      contextIntakeProposals: (contextIntakeProposalsResult.data || []).map(mapContextIntakeProposal),
      channelDeliveries: (channelDeliveriesResult.data || []).map(mapChannelDelivery),
      channelAdapterRollback: mapChannelAdapterRollbackControls(channelAdapterRollbackResult.data),
      dataRequests: (dataRequestsResult.data || []).map(mapDataRequest),
      internalCopilotMessages: (internalCopilotMessagesResult.data || []).map(mapInternalCopilotMessage),
      internalCopilotToolCalls: (internalCopilotToolCallsResult.data || []).map(mapInternalCopilotToolCall),
      scopeRules: createPlaceholderScopeRules(),
      scopeRuleChunks: [],
      scopeGuardEvaluations: [],
      permissionGraphEvaluations: [],
      auditEvents: (auditEventsResult.data || []).map(mapAuditEvent),
      processedSimulationKeys: (processedEventsResult.data || []).map((event) => event.provider_event_id),
      lastSimulation: null,
    }),
    context,
    assignmentsResult.data || [],
  );

  return scopedState satisfies ManuAppState;
}

export async function loadSupabaseOperationalFoundationInspection(
  context = demoTenantContext(),
): Promise<OperationalFoundationInspectionDto> {
  return buildOperationalFoundationInspectionDto(await loadSupabaseOperationalFoundationState(context));
}

async function loadSupabaseOperationalFoundationState(context = demoTenantContext()): Promise<ManuAppState> {
  const supabase = requireSupabase();
  const [
    inboundQuarantinesResult,
    channelAccountBindingsResult,
    channelActorBindingsResult,
    channelEventsResult,
    channelDeliveriesResult,
    channelAdapterRollbackResult,
  ] = await Promise.all([
    supabase.from("inbound_quarantines").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_account_bindings").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_actor_bindings").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_events").select("*").eq("tenant_id", context.tenantId).order("observed_at"),
    supabase.from("channel_deliveries").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("channel_adapter_rollback_controls").select("*").eq("tenant_id", context.tenantId).maybeSingle(),
  ]);

  throwIfError(inboundQuarantinesResult.error);
  throwIfError(channelAccountBindingsResult.error);
  throwIfError(channelActorBindingsResult.error);
  throwIfError(channelEventsResult.error);
  throwIfError(channelDeliveriesResult.error);
  throwIfError(channelAdapterRollbackResult.error);

  const state = {
    ...createInitialState(),
    tenant: { id: context.tenantId, name: "Operational inspection" },
    inboundQuarantines: (inboundQuarantinesResult.data || []).map(mapInboundQuarantine),
    channelAccountBindings: (channelAccountBindingsResult.data || []).map(mapChannelAccountBinding),
    channelActorBindings: (channelActorBindingsResult.data || []).map(mapChannelActorBinding),
    channelEvents: (channelEventsResult.data || []).map(mapChannelEvent),
    channelDeliveries: (channelDeliveriesResult.data || []).map(mapChannelDelivery),
    channelAdapterRollback: mapChannelAdapterRollbackControls(channelAdapterRollbackResult.data),
  };

  return state as ManuAppState;
}

export async function loadSupabaseWindowedDashboardPayload(
  context = demoTenantContext(),
  options: Parameters<typeof buildPhase79WindowedDashboardPayload>[1] = {},
): Promise<Phase79WindowedDashboardPayload> {
  const supabase = requireSupabase();
  await ensureDemoData(supabase, context.userId);

  const clientQueryLimit = WINDOWED_READ_DEFAULTS.clientListMaxPageSize;
  const handoffQueryLimit = WINDOWED_READ_DEFAULTS.handoffMaxPageSize;
  const notificationQueryLimit = WINDOWED_READ_DEFAULTS.notificationMaxPageSize;
  const timelineQueryLimit = WINDOWED_READ_DEFAULTS.timelineMaxWindowSize;

  const [tenantResult, dietitianResult, assignmentsResult, clientsResult] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", context.tenantId).single(),
    supabase.from("dietitians").select("*").eq("id", context.dietitianId).eq("tenant_id", context.tenantId).single(),
    supabase.from("client_assignments").select("client_id, dietitian_id").eq("tenant_id", context.tenantId),
    supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("created_at")
      .range(0, clientQueryLimit - 1),
  ]);

  throwIfError(tenantResult.error);
  throwIfError(dietitianResult.error);
  throwIfError(assignmentsResult.error);
  throwIfError(clientsResult.error);

  const clientIds = new Set((clientsResult.data || []).map((client) => client.id));
  if (options.detailClientId) clientIds.add(options.detailClientId);
  if (options.timelineClientId) clientIds.add(options.timelineClientId);
  const clientIdList = Array.from(clientIds);
  const selectedClientIds = Array.from(
    new Set([options.detailClientId, options.timelineClientId].filter((id): id is string => Boolean(id))),
  );

  const [
    selectedClientsResult,
    channelsResult,
    conversationsResult,
    memoriesResult,
    handoffsResult,
    notificationsResult,
    auditEventsResult,
    messagesResult,
    decisionsResult,
  ] = await Promise.all([
    selectedClientIds.length
      ? supabase.from("clients").select("*").eq("tenant_id", context.tenantId).in("id", selectedClientIds)
      : Promise.resolve({ data: [], error: null }),
    clientIdList.length
      ? supabase.from("client_channels").select("*").eq("tenant_id", context.tenantId).in("client_id", clientIdList)
      : Promise.resolve({ data: [], error: null }),
    clientIdList.length
      ? supabase.from("conversations").select("*").eq("tenant_id", context.tenantId).in("client_id", clientIdList)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("conversation_memories").select("*").eq("tenant_id", context.tenantId).range(0, timelineQueryLimit - 1),
    clientIdList.length
      ? supabase
          .from("handoff_cases")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("client_id", clientIdList)
          .order("created_at")
          .range(0, handoffQueryLimit - 1)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("notifications")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("created_at")
      .range(0, notificationQueryLimit - 1),
    supabase
      .from("audit_events")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .order("created_at")
      .range(0, WINDOWED_READ_DEFAULTS.clientListMaxPageSize - 1),
    Promise.resolve({ data: [], error: null }),
    clientIdList.length
      ? supabase
          .from("ai_decisions")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("client_id", clientIdList)
          .order("created_at")
          .range(0, timelineQueryLimit - 1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  throwIfError(selectedClientsResult.error);
  throwIfError(channelsResult.error);
  throwIfError(conversationsResult.error);
  throwIfError(memoriesResult.error);
  throwIfError(handoffsResult.error);
  throwIfError(notificationsResult.error);
  throwIfError(auditEventsResult.error);
  throwIfError(messagesResult.error);
  throwIfError(decisionsResult.error);

  const conversationIds = (conversationsResult.data || []).map((conversation) => conversation.id);
  const boundedMessagesResult = conversationIds.length
    ? await supabase
        .from("messages")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .in("conversation_id", conversationIds)
        .order("created_at")
        .range(0, timelineQueryLimit - 1)
    : { data: [], error: null };
  throwIfError(boundedMessagesResult.error);

  const clients = [...(clientsResult.data || [])];
  for (const selectedClient of selectedClientsResult.data || []) {
    if (!clients.some((client) => client.id === selectedClient.id)) {
      clients.push(selectedClient);
    }
  }
  const channels = channelsResult.data || [];
  const memories = memoriesResult.data || [];
  const shell = scopeSupabaseState(
    {
      tenant: { id: tenantResult.data.id, name: tenantResult.data.name },
      dietitian: {
        id: dietitianResult.data.id,
        tenantId: dietitianResult.data.tenant_id,
        displayName: dietitianResult.data.display_name,
        timezone: dietitianResult.data.timezone,
        uiLanguage: normalizeLanguageCode(dietitianResult.data.ui_language),
      },
      voiceSamples: [],
      voiceProfiles: [],
      styleEditHistory: [],
      clientFormSchemas: [],
      clientFormResponses: [],
      dietitianFormSchemas: [],
      dietitianFormResponses: [],
      clientContextUpdates: [],
      clientUpdateProposals: [],
      clientFoodRuleProfiles: [],
      clientMenuPlans: [],
      clients: clients.map((client) => mapClient(client, channels)),
      conversations: (conversationsResult.data || []).map((conversation) => mapConversation(conversation, memories)),
      messages: (boundedMessagesResult.data || []).map(mapMessage),
      aiDecisions: (decisionsResult.data || []).map(mapDecision),
      riskAssessments: [],
      handoffCases: (handoffsResult.data || []).map(mapHandoff),
      notifications: (notificationsResult.data || []).map(mapNotification),
      notificationReceipts: [],
      conversationReadReceipts: [],
      inboundQuarantines: [],
      channelAccountBindings: [],
      channelActorBindings: [],
      channelEvents: [],
      channelMessageRevisions: [],
      humanControlSessions: [],
      riskActivityEvents: [],
      contextIntakeProposals: [],
      channelDeliveries: [],
      channelAdapterRollback: createDefaultChannelAdapterRollbackControls(),
      dataRequests: [],
      internalCopilotMessages: [],
      internalCopilotToolCalls: [],
      scopeRules: createPlaceholderScopeRules(),
      scopeRuleChunks: [],
      scopeGuardEvaluations: [],
      permissionGraphEvaluations: [],
      auditEvents: (auditEventsResult.data || []).map(mapAuditEvent),
      processedSimulationKeys: [],
      lastSimulation: null,
    },
    context,
    assignmentsResult.data || [],
  );

  return buildPhase79WindowedDashboardPayload(shell, options);
}

async function loadSupabaseClientOperationState(
  clientId: string,
  context: AppTenantContext,
  options: {
    processedEventId?: string | null;
    requiredMessageId?: string | null;
    requiredDecisionId?: string | null;
    requiredFormSchemaId?: string | null;
    requiredHandoffId?: string | null;
    historicalQuery?: string | null;
  } = {},
) {
  const supabase = requireSupabase();
  await ensureDemoData(supabase, context.userId);

  const [
    tenantResult,
    dietitianResult,
    clientResult,
    assignmentsResult,
    channelsResult,
    voiceProfilesResult,
    channelAdapterRollbackResult,
  ] =
    await Promise.all([
      supabase.from("tenants").select("*").eq("id", context.tenantId).single(),
      supabase.from("dietitians").select("*").eq("id", context.dietitianId).eq("tenant_id", context.tenantId).single(),
      supabase.from("clients").select("*").eq("tenant_id", context.tenantId).eq("id", clientId).maybeSingle(),
      supabase.from("client_assignments").select("client_id, dietitian_id").eq("tenant_id", context.tenantId),
      supabase.from("client_channels").select("*").eq("tenant_id", context.tenantId).eq("client_id", clientId),
      supabase
        .from("dietitian_voice_profiles")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("dietitian_id", context.dietitianId)
        .order("updated_at"),
      supabase.from("channel_adapter_rollback_controls").select("*").eq("tenant_id", context.tenantId).maybeSingle(),
    ]);

  throwIfError(tenantResult.error);
  throwIfError(dietitianResult.error);
  throwIfError(clientResult.error);
  throwIfError(assignmentsResult.error);
  throwIfError(channelsResult.error);
  throwIfError(voiceProfilesResult.error);
  throwIfError(channelAdapterRollbackResult.error);

  if (!clientResult.data) {
    throw new AppDomainError(404, "client_not_found");
  }

  const conversationsResult = await supabase
    .from("conversations")
    .select("*")
    .eq("tenant_id", context.tenantId)
    .eq("client_id", clientId)
    .order("created_at");
  throwIfError(conversationsResult.error);

  const conversationIds = (conversationsResult.data || []).map((conversation) => conversation.id);
  const historicalSearchResult =
    options.historicalQuery?.trim() && conversationIds.length === 1
      ? await supabase.rpc(
          "search_conversation_messages",
          buildSearchConversationMessagesRpcParams({
            tenantId: context.tenantId,
            conversationId: conversationIds[0]!,
            query: options.historicalQuery,
          }),
        )
      : await emptySupabaseResult<SupabaseConversationMessageSearchRow>();
  throwIfError(historicalSearchResult.error);
  const [
    memoriesResult,
    recentMessagesResult,
    draftMessagesResult,
    decisionsResult,
    requiredMessageResult,
    requiredDecisionResult,
    requiredFormSchemaResult,
    requiredHandoffResult,
    riskAssessmentsResult,
    handoffsResult,
    activeFormSchemasResult,
    formResponsesResult,
    clientContextUpdatesResult,
    clientUpdateProposalsResult,
    clientFoodRuleProfilesResult,
    clientMenuPlansResult,
    processedEventsResult,
  ] = await Promise.all([
    conversationIds.length > 0
      ? supabase.from("conversation_memories").select("*").eq("tenant_id", context.tenantId).in("conversation_id", conversationIds)
      : emptySupabaseResult<DbMemory>(),
    conversationIds.length > 0
      ? supabase
          .from("messages")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : emptySupabaseResult<DbMessage>(),
    conversationIds.length > 0
      ? supabase
          .from("messages")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("conversation_id", conversationIds)
          .eq("status", "draft")
          .order("created_at", { ascending: false })
      : emptySupabaseResult<DbMessage>(),
    supabase
      .from("ai_decisions")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100),
    options.requiredMessageId
      ? supabase.from("messages").select("*").eq("tenant_id", context.tenantId).eq("id", options.requiredMessageId)
      : emptySupabaseResult<DbMessage>(),
    options.requiredDecisionId
      ? supabase.from("ai_decisions").select("*").eq("tenant_id", context.tenantId).eq("id", options.requiredDecisionId)
      : emptySupabaseResult<DbDecision>(),
    options.requiredFormSchemaId
      ? supabase.from("client_form_schemas").select("*").eq("tenant_id", context.tenantId).eq("id", options.requiredFormSchemaId)
      : emptySupabaseResult<DbFormSchema>(),
    options.requiredHandoffId
      ? supabase.from("handoff_cases").select("*").eq("tenant_id", context.tenantId).eq("id", options.requiredHandoffId)
      : emptySupabaseResult<DbHandoff>(),
    conversationIds.length > 0
      ? supabase
          .from("risk_assessments")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : emptySupabaseResult<DbRiskAssessment>(),
    supabase
      .from("handoff_cases")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("client_id", clientId)
      .in("status", ["open", "assigned"])
      .order("created_at"),
    supabase.from("client_form_schemas").select("*").eq("tenant_id", context.tenantId).eq("status", "published"),
    supabase.from("client_form_responses").select("*").eq("tenant_id", context.tenantId).eq("client_id", clientId),
    supabase
      .from("client_context_updates")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("client_id", clientId)
      .order("created_at"),
    supabase
      .from("client_update_proposals")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("client_id", clientId)
      .order("created_at"),
    supabase
      .from("client_food_rule_profiles")
      .select("*")
      .eq("tenant_id", context.tenantId)
      .eq("client_id", clientId),
    supabase.from("client_menu_plans").select("*").eq("tenant_id", context.tenantId).eq("client_id", clientId),
    options.processedEventId
      ? supabase
          .from("processed_inbound_events")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .eq("provider_event_id", options.processedEventId)
      : emptySupabaseResult<{ provider_event_id: string }>(),
  ]);

  throwIfError(memoriesResult.error);
  throwIfError(recentMessagesResult.error);
  throwIfError(draftMessagesResult.error);
  throwIfError(decisionsResult.error);
  throwIfError(requiredMessageResult.error);
  throwIfError(requiredDecisionResult.error);
  throwIfError(requiredFormSchemaResult.error);
  throwIfError(requiredHandoffResult.error);
  throwIfError(riskAssessmentsResult.error);
  throwIfError(handoffsResult.error);
  throwIfError(activeFormSchemasResult.error);
  throwIfError(formResponsesResult.error);
  throwIfError(clientContextUpdatesResult.error);
  throwIfError(clientUpdateProposalsResult.error);
  throwIfError(clientFoodRuleProfilesResult.error);
  throwIfError(clientMenuPlansResult.error);
  throwIfError(processedEventsResult.error);

  const channels = channelsResult.data || [];
  const memories = memoriesResult.data || [];
  const rawMessages = mergeById([
    ...(recentMessagesResult.data || []),
    ...(draftMessagesResult.data || []),
    ...(requiredMessageResult.data || []),
  ]);
  const knownDecisionIds = new Set([
    ...(decisionsResult.data || []).map((decision) => decision.id),
    ...(requiredDecisionResult.data || []).map((decision) => decision.id),
  ]);
  const missingDraftDecisionIds = rawMessages
    .map((message) => message.generated_by_ai_decision_id)
    .filter((id): id is string => Boolean(id) && !knownDecisionIds.has(id));
  const draftDecisionsResult =
    missingDraftDecisionIds.length > 0
      ? await supabase
          .from("ai_decisions")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("id", Array.from(new Set(missingDraftDecisionIds)))
      : await emptySupabaseResult<DbDecision>();
  throwIfError(draftDecisionsResult.error);

  const historicalMessages = ((historicalSearchResult.data || []) as SupabaseConversationMessageSearchRow[]).map((row) =>
    mapHistoricalSearchRowToMessage(row, context.tenantId, conversationIds[0]!),
  );
  const messages = mergeById([...rawMessages, ...historicalMessages])
    .map(mapMessage)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const scopedState = scopeSupabaseState(
    {
      tenant: { id: tenantResult.data.id, name: tenantResult.data.name },
      dietitian: {
        id: dietitianResult.data.id,
        tenantId: dietitianResult.data.tenant_id,
        displayName: dietitianResult.data.display_name,
        timezone: dietitianResult.data.timezone,
        uiLanguage: normalizeLanguageCode(dietitianResult.data.ui_language),
      },
      voiceSamples: [],
      voiceProfiles: (voiceProfilesResult.data || []).map(mapVoiceProfile),
      styleEditHistory: [],
      clientFormSchemas: mergeById([...(activeFormSchemasResult.data || []), ...(requiredFormSchemaResult.data || [])]).map(mapFormSchema),
      clientFormResponses: (formResponsesResult.data || []).map(mapFormResponse),
      dietitianFormSchemas: [],
      dietitianFormResponses: [],
      clientContextUpdates: (clientContextUpdatesResult.data || []).map(mapClientContextUpdate),
      clientUpdateProposals: (clientUpdateProposalsResult.data || []).map(mapClientUpdateProposal),
      clientFoodRuleProfiles: (clientFoodRuleProfilesResult.data || []).map(mapClientFoodRuleProfile),
      clientMenuPlans: (clientMenuPlansResult.data || []).map(mapClientMenuPlan),
      clients: [mapClient(clientResult.data, channels)],
      conversations: (conversationsResult.data || []).map((conversation) => mapConversation(conversation, memories)),
      messages,
      aiDecisions: mergeById([
        ...(decisionsResult.data || []),
        ...(requiredDecisionResult.data || []),
        ...(draftDecisionsResult.data || []),
      ]).map(mapDecision),
      riskAssessments: (riskAssessmentsResult.data || [])
        .map(mapRiskAssessment)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      handoffCases: mergeById([...(handoffsResult.data || []), ...(requiredHandoffResult.data || [])]).map(mapHandoff),
      notifications: [],
      notificationReceipts: [],
      conversationReadReceipts: [],
      inboundQuarantines: [],
      channelAccountBindings: [],
      channelActorBindings: [],
      channelEvents: [],
      channelMessageRevisions: [],
      humanControlSessions: [],
      riskActivityEvents: [],
      contextIntakeProposals: [],
      channelDeliveries: [],
      channelAdapterRollback: mapChannelAdapterRollbackControls(channelAdapterRollbackResult.data),
      dataRequests: [],
      internalCopilotMessages: [],
      internalCopilotToolCalls: [],
      scopeRules: createPlaceholderScopeRules(),
      scopeRuleChunks: [],
      scopeGuardEvaluations: [],
      permissionGraphEvaluations: [],
      auditEvents: [],
      processedSimulationKeys: (processedEventsResult.data || []).map((event) => event.provider_event_id),
      lastSimulation: null,
    },
    context,
    assignmentsResult.data || [],
  );

  if (!scopedState.clients.some((client) => client.id === clientId)) {
    throw new AppDomainError(404, "client_not_found");
  }

  return scopedState satisfies ManuAppState;
}

async function loadSupabaseHandoffOperationState(handoffId: string, context: AppTenantContext) {
  const supabase = requireSupabase();
  await ensureDemoData(supabase, context.userId);

  const handoffResult = await supabase
    .from("handoff_cases")
    .select("id, client_id")
    .eq("tenant_id", context.tenantId)
    .eq("id", handoffId)
    .maybeSingle();
  throwIfError(handoffResult.error);

  if (!handoffResult.data) {
    throw new AppDomainError(404, "handoff_not_found");
  }

  try {
    const state = await loadSupabaseClientOperationState(handoffResult.data.client_id, context, {
      requiredHandoffId: handoffId,
    });

    if (!state.handoffCases.some((handoff) => handoff.id === handoffId)) {
      throw new AppDomainError(404, "handoff_not_found");
    }

    return state;
  } catch (error) {
    if (error instanceof AppDomainError && error.message === "client_not_found") {
      throw new AppDomainError(404, "handoff_not_found");
    }
    throw error;
  }
}

async function loadSupabaseDraftOperationState(messageId: string, context: AppTenantContext) {
  const supabase = requireSupabase();
  await ensureDemoData(supabase, context.userId);

  const messageResult = await supabase
    .from("messages")
    .select("id, conversation_id, generated_by_ai_decision_id")
    .eq("tenant_id", context.tenantId)
    .eq("id", messageId)
    .maybeSingle();
  throwIfError(messageResult.error);

  if (!messageResult.data) {
    throw new AppDomainError(404, "message_not_found");
  }

  const conversationResult = await supabase
    .from("conversations")
    .select("id, client_id")
    .eq("tenant_id", context.tenantId)
    .eq("id", messageResult.data.conversation_id)
    .maybeSingle();
  throwIfError(conversationResult.error);

  if (!conversationResult.data) {
    throw new AppDomainError(404, "message_not_found");
  }

  try {
    const state = await loadSupabaseClientOperationState(conversationResult.data.client_id, context, {
      requiredMessageId: messageId,
      requiredDecisionId: messageResult.data.generated_by_ai_decision_id,
    });

    if (!state.messages.some((message) => message.id === messageId)) {
      throw new AppDomainError(404, "message_not_found");
    }

    return state;
  } catch (error) {
    if (error instanceof AppDomainError && error.message === "client_not_found") {
      throw new AppDomainError(404, "message_not_found");
    }
    throw error;
  }
}

export function scopeSupabaseState(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
): ManuAppState {
  const visibleClientIds = getVisibleClientIds(state.clients, context, assignments);
  const visibleConversationIds = new Set(
    state.conversations
      .filter((conversation) => visibleClientIds.has(conversation.clientId))
      .map((conversation) => conversation.id),
  );
  const visibleMessages = state.messages.filter((message) => visibleConversationIds.has(message.conversationId));
  const visibleMessageIds = new Set(visibleMessages.map((message) => message.id));
  const visibleDecisions = state.aiDecisions.filter((decision) => visibleClientIds.has(decision.clientId));
  const visibleDecisionIds = new Set(visibleDecisions.map((decision) => decision.id));
  const visibleHandoffs = state.handoffCases.filter((handoff) => visibleClientIds.has(handoff.clientId));
  const visibleHandoffIds = new Set(visibleHandoffs.map((handoff) => handoff.id));
  const visibleInternalCopilotMessages =
    context.role === "owner" || context.role === "admin" || context.role === "dietitian"
      ? state.internalCopilotMessages.filter((message) => message.dietitianId === context.dietitianId)
      : [];
  const visibleInternalCopilotToolCalls =
    context.role === "owner" || context.role === "admin" || context.role === "dietitian"
      ? state.internalCopilotToolCalls.filter((call) => call.dietitianId === context.dietitianId)
      : [];
  const visibleInternalCopilotMessageIds = new Set(visibleInternalCopilotMessages.map((message) => message.id));
  const visibleInternalCopilotToolCallIds = new Set(visibleInternalCopilotToolCalls.map((call) => call.id));
  const visibleClientContextUpdates = state.clientContextUpdates.filter((update) => visibleClientIds.has(update.clientId));
  const visibleClientContextUpdateIds = new Set(visibleClientContextUpdates.map((update) => update.id));
  const visibleClientUpdateProposals = state.clientUpdateProposals.filter((proposal) => visibleClientIds.has(proposal.clientId));
  const visibleClientUpdateProposalIds = new Set(visibleClientUpdateProposals.map((proposal) => proposal.id));
  const visibleInboundQuarantines: ManuAppState["inboundQuarantines"] = [];
  const visibleChannelAccountBindings: ManuAppState["channelAccountBindings"] = [];
  const visibleChannelActorBindings: ManuAppState["channelActorBindings"] = [];
  const visibleChannelEvents: ManuAppState["channelEvents"] = [];
  const visibleChannelMessageRevisions = state.channelMessageRevisions.filter(
    (revision) => revision.messageId !== null && visibleMessageIds.has(revision.messageId),
  );
  const visibleChannelMessageRevisionIds = new Set(visibleChannelMessageRevisions.map((revision) => revision.id));
  const visibleHumanControlSessions = state.humanControlSessions.filter((session) => visibleClientIds.has(session.clientId));
  const visibleHumanControlSessionIds = new Set(visibleHumanControlSessions.map((session) => session.id));
  const visibleRiskActivityEvents = state.riskActivityEvents.filter((event) => visibleClientIds.has(event.clientId));
  const visibleRiskActivityEventIds = new Set(visibleRiskActivityEvents.map((event) => event.id));
  const visibleContextIntakeProposals = state.contextIntakeProposals.filter((proposal) =>
    visibleClientIds.has(proposal.clientId),
  );
  const visibleContextIntakeProposalIds = new Set(visibleContextIntakeProposals.map((proposal) => proposal.id));
  const visibleChannelDeliveries = state.channelDeliveries.filter((delivery) => visibleClientIds.has(delivery.clientId));
  const visibleChannelDeliveryIds = new Set(visibleChannelDeliveries.map((delivery) => delivery.id));
  const canReadRollbackAudit = context.role === "owner" || context.role === "admin" || context.role === "dietitian";

  return {
    ...state,
    voiceSamples: state.voiceSamples.filter((sample) => sample.dietitianId === context.dietitianId),
    voiceProfiles: state.voiceProfiles.filter((profile) => profile.dietitianId === context.dietitianId),
    clientFormResponses: state.clientFormResponses.filter((response) => visibleClientIds.has(response.clientId)),
    clientContextUpdates: visibleClientContextUpdates,
    clientUpdateProposals: visibleClientUpdateProposals,
    clientFoodRuleProfiles: state.clientFoodRuleProfiles.filter((profile) => visibleClientIds.has(profile.clientId)),
    clientMenuPlans: state.clientMenuPlans.filter((plan) => visibleClientIds.has(plan.clientId)),
    clients: state.clients.filter((client) => visibleClientIds.has(client.id)),
    conversations: state.conversations.filter((conversation) => visibleConversationIds.has(conversation.id)),
    messages: visibleMessages,
    aiDecisions: visibleDecisions,
    riskAssessments: state.riskAssessments.filter(
      (assessment) =>
        visibleConversationIds.has(assessment.conversationId) || visibleMessageIds.has(assessment.messageId),
    ),
    handoffCases: visibleHandoffs,
    notifications: state.notifications.filter((notification) =>
      isStage4BNotificationVisible(notification, context, assignments, state.clients),
    ),
    notificationReceipts: state.notificationReceipts.filter(
      (receipt) =>
        receipt.dietitianId === context.dietitianId &&
        state.notifications.some(
          (notification) =>
            notification.id === receipt.notificationId &&
            isStage4BNotificationVisible(notification, context, assignments, state.clients),
        ),
    ),
    inboundQuarantines: visibleInboundQuarantines,
    channelAccountBindings: visibleChannelAccountBindings,
    channelActorBindings: visibleChannelActorBindings,
    channelEvents: visibleChannelEvents,
    channelMessageRevisions: visibleChannelMessageRevisions,
    humanControlSessions: visibleHumanControlSessions,
    riskActivityEvents: visibleRiskActivityEvents,
    contextIntakeProposals: visibleContextIntakeProposals,
    channelDeliveries: visibleChannelDeliveries,
    dataRequests: state.dataRequests.filter((request) => visibleClientIds.has(request.clientId)),
    internalCopilotMessages: visibleInternalCopilotMessages,
    internalCopilotToolCalls: visibleInternalCopilotToolCalls,
    auditEvents: state.auditEvents.filter(
      (event) =>
        visibleClientIds.has(event.entityId) ||
        visibleConversationIds.has(event.entityId) ||
        visibleMessageIds.has(event.entityId) ||
        visibleDecisionIds.has(event.entityId) ||
        visibleHandoffIds.has(event.entityId) ||
        visibleClientContextUpdateIds.has(event.entityId) ||
        visibleClientUpdateProposalIds.has(event.entityId) ||
        visibleInternalCopilotMessageIds.has(event.entityId) ||
        visibleInternalCopilotToolCallIds.has(event.entityId) ||
        visibleChannelMessageRevisionIds.has(event.entityId) ||
        visibleHumanControlSessionIds.has(event.entityId) ||
        visibleRiskActivityEventIds.has(event.entityId) ||
        visibleContextIntakeProposalIds.has(event.entityId) ||
        visibleChannelDeliveryIds.has(event.entityId) ||
        (canReadRollbackAudit && event.eventType === "channel_automation_rollback_updated"),
    ),
  };
}

export function projectClinicalAlertsFromSupabaseState(
  state: ManuAppState,
  context: AppTenantContext,
  assignments: DbClientAssignment[],
  input: { now?: string; dietitianTimezones?: ReadonlyMap<string, string> } = {},
) {
  const scoped = scopeSupabaseState(state, context, assignments);
  return projectClinicalAlertsFromState(scoped, {
    now: input.now,
    visibleClientIds: new Set(scoped.clients.map((client) => client.id)),
    dietitianTimezones: input.dietitianTimezones,
  });
}

function getVisibleClientIds(
  clients: ClientRecord[],
  context: AppTenantContext,
  assignments: DbClientAssignment[],
) {
  if (context.role === "owner" || context.role === "admin") {
    return new Set(clients.map((client) => client.id));
  }

  if (context.role === "auditor") {
    return new Set<string>();
  }

  const assignedClientIds = new Set(
    assignments
      .filter((assignment) => assignment.dietitian_id === context.dietitianId)
      .map((assignment) => assignment.client_id),
  );

  if (context.role === "assistant") {
    return assignedClientIds;
  }

  if (context.role === "dietitian") {
    return new Set(
      clients
        .filter((client) => client.dietitianId === context.dietitianId || assignedClientIds.has(client.id))
        .map((client) => client.id),
    );
  }

  return new Set<string>();
}

export async function resetSupabaseState(context = demoTenantContext()) {
  const supabase = requireSupabase();
  await deleteDemoData(supabase, context.tenantId);
  await ensureDemoData(supabase, context.userId);
  return loadSupabaseState(context);
}

async function loadSupabaseClientCreateContext(context: AppTenantContext) {
  const supabase = requireSupabase();
  await ensureDemoData(supabase, context.userId);

  const [tenantResult, dietitianResult, clientsResult, channelsResult, assignmentsResult] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", context.tenantId).single(),
    supabase.from("dietitians").select("*").eq("id", context.dietitianId).eq("tenant_id", context.tenantId).single(),
    supabase.from("clients").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_channels").select("*").eq("tenant_id", context.tenantId),
    supabase.from("client_assignments").select("client_id, dietitian_id").eq("tenant_id", context.tenantId),
  ]);

  throwIfError(tenantResult.error);
  throwIfError(dietitianResult.error);
  throwIfError(clientsResult.error);
  throwIfError(channelsResult.error);
  throwIfError(assignmentsResult.error);

  const channels = channelsResult.data || [];
  const shellState = scopeSupabaseState(
    {
      tenant: { id: tenantResult.data.id, name: tenantResult.data.name },
      dietitian: {
        id: dietitianResult.data.id,
        tenantId: dietitianResult.data.tenant_id,
        displayName: dietitianResult.data.display_name,
        timezone: dietitianResult.data.timezone,
        uiLanguage: normalizeLanguageCode(dietitianResult.data.ui_language),
      },
      voiceSamples: [],
      voiceProfiles: [],
      styleEditHistory: [],
      clientFormSchemas: [],
      clientFormResponses: [],
      dietitianFormSchemas: [],
      dietitianFormResponses: [],
      clientContextUpdates: [],
      clientFoodRuleProfiles: [],
      clientMenuPlans: [],
      clientUpdateProposals: [],
      clients: (clientsResult.data || []).map((client) => mapClient(client, channels)),
      conversations: [],
      messages: [],
      aiDecisions: [],
      riskAssessments: [],
      handoffCases: [],
      auditEvents: [],
      notifications: [],
      notificationReceipts: [],
      conversationReadReceipts: [],
      inboundQuarantines: [],
      channelAccountBindings: [],
      channelActorBindings: [],
      channelEvents: [],
      channelMessageRevisions: [],
      humanControlSessions: [],
      riskActivityEvents: [],
      contextIntakeProposals: [],
      channelDeliveries: [],
      channelAdapterRollback: createDefaultChannelAdapterRollbackControls(),
      dataRequests: [],
      internalCopilotMessages: [],
      internalCopilotToolCalls: [],
      scopeRules: createPlaceholderScopeRules(),
      scopeRuleChunks: [],
      scopeGuardEvaluations: [],
      permissionGraphEvaluations: [],
      processedSimulationKeys: [],
      lastSimulation: null,
    },
    context,
    assignmentsResult.data || [],
  );

  return buildClientCreateValidationState(shellState);
}

async function loadSupabaseClientPatchContext(clientId: string, context: AppTenantContext) {
  const supabase = requireSupabase();
  const createContext = await loadSupabaseClientCreateContext(context);
  const beforeClient = createContext.clients.find((client) => client.id === clientId);

  if (!beforeClient || beforeClient.lifecycleStatus === "removed_anonymized") {
    throw new AppDomainError(404, "client_not_found");
  }

  const menuPlansResult = await supabase
    .from("client_menu_plans")
    .select("*")
    .eq("tenant_id", context.tenantId)
    .eq("client_id", clientId);
  throwIfError(menuPlansResult.error);

  const validationState = buildClientPatchValidationState(
    {
      ...createContext,
      clientMenuPlans: (menuPlansResult.data || []).map(mapClientMenuPlan),
    },
    clientId,
  );

  return { validationState, beforeClient };
}

export async function createSupabaseClientRecord(
  input: Pick<ClientRecord, "fullName" | "channel" | "channelUserId"> &
    Partial<Pick<ClientRecord, "primaryPhoneE164" | "communicationLanguage">>,
  context = demoTenantContext(),
): Promise<Phase79ScopedClientCreateResponse> {
  const validationState = await loadSupabaseClientCreateContext(context);
  const next = createClientInState(validationState, input);
  const rawClient = next.clients[next.clients.length - 1];
  const client = { ...rawClient, tenantId: context.tenantId, dietitianId: context.dietitianId };
  const rawConversation = next.conversations.find((item) => item.clientId === rawClient.id);
  const conversation = rawConversation
    ? { ...rawConversation, tenantId: context.tenantId, dietitianId: context.dietitianId, clientId: client.id }
    : undefined;

  const supabase = requireSupabase();
  await insertClientBundle(supabase, client, conversation);
  return { kind: "client_create", client, conversation };
}

export async function patchSupabaseClientRecord(
  clientId: string,
  patch: Partial<ClientRecord>,
  context = demoTenantContext(),
): Promise<Phase79ScopedClientPatchResponse> {
  if (patch.aiStatus === "active") {
    throw new AppDomainError(409, "direct_ai_activation_requires_activate_ai_endpoint");
  }
  const { validationState, beforeClient } = await loadSupabaseClientPatchContext(clientId, context);
  const next = patchClientInState(validationState, clientId, patch);
  const client = next.clients.find((item) => item.id === clientId);

  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }

  const supabase = requireSupabase();
  await upsertClient(supabase, client, beforeClient);
  await upsertChannel(supabase, client);
  const auditEvents: AuditEventRecord[] = [];
  if (hasAiControlChange(beforeClient, client)) {
    await insertClientAiStatusEvent(supabase, beforeClient, client, context);
    const auditEvent = {
      id: crypto.randomUUID(),
      tenantId: context.tenantId,
      eventType: "client_ai_control_updated",
      entityType: "client",
      entityId: client.id,
      metadata: { source: "supabase_store" },
      createdAt: new Date().toISOString(),
    };
    await insertAudit(supabase, auditEvent);
    auditEvents.push(auditEvent);
  }
  return { kind: "client_patch", client, auditEvents };
}

export async function exportSupabaseClientData(clientId: string, context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
  const after = recordClientExportInState(before, clientId);
  const beforeRequests = new Set(before.dataRequests.map((item) => item.id));
  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));
  const supabase = requireSupabase();

  for (const request of after.dataRequests.filter((item) => !beforeRequests.has(item.id))) {
    await insertDataRequest(supabase, request);
  }
  for (const audit of after.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }

  return sanitizeClientScopedExportForClientFacing(buildClientScopedExport(after, clientId));
}

export async function anonymizeSupabaseClientData(clientId: string, context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
  const after = anonymizeClientInState(before, clientId);
  return persistSupabaseClientRemovalLifecycle(before, after, clientId, context);
}

export async function removeSupabaseClientData(clientId: string, context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
  const after = removeClientInState(before, clientId);
  return persistSupabaseClientRemovalLifecycle(before, after, clientId, context);
}

export async function setSupabaseChannelAdapterRollback(
  input: Parameters<typeof setChannelAdapterRollbackInState>[1],
  context = demoTenantContext(),
) {
  const before = await loadSupabaseState(context);
  const after = setChannelAdapterRollbackInState(before, input);
  await commitStateDeltaRpc(requireSupabase(), "commit_channel_adapter_rollback", before, after);
  return loadSupabaseState(context);
}

export async function revokeSupabaseTenantChannelBindings(context = demoTenantContext()) {
  const before = await loadSupabaseOperationalFoundationOperationState(context);
  const after = revokeTenantChannelBindingsInState(before, context.tenantId, context.dietitianId);
  await commitStateDeltaRpc(requireSupabase(), "p85_if_r6_revoke_tenant_channel_bindings", before, after);
  return loadSupabaseOperationalFoundationInspection(context);
}

async function persistSupabaseClientRemovalLifecycle(
  before: ManuAppState,
  after: ManuAppState,
  clientId: string,
  context: AppTenantContext,
) {
  const client = after.clients.find((item) => item.id === clientId);

  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }

  const supabase = requireSupabase();
  const conversationIds = after.conversations
    .filter((conversation) => conversation.clientId === client.id)
    .map((conversation) => conversation.id);
  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));
  const beforeRequests = new Set(before.dataRequests.map((item) => item.id));

  await commitStateDeltaRpc(supabase, "commit_client_removal_lifecycle", before, after);
  await checked(
    supabase
      .from("channel_deliveries")
      .delete()
      .eq("tenant_id", context.tenantId)
      .eq("client_id", client.id),
  );
  await checked(
    supabase
      .from("client_channels")
      .update({
        channel_user_id: `removed:${crypto.randomUUID()}`,
        display_handle: null,
        is_active: false,
      })
      .eq("tenant_id", context.tenantId)
      .eq("client_id", client.id),
  );
  await checked(
    supabase
      .from("conversation_memories")
      .update({
        rolling_summary: "",
        durable_facts: {},
        last_compacted_message_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", context.tenantId)
      .eq("client_id", client.id),
  );

  const handoffIds = after.handoffCases.filter((handoff) => handoff.clientId === client.id).map((handoff) => handoff.id);
  const minimizedEntityIds = [
    client.id,
    ...conversationIds,
    ...after.messages.filter((message) => conversationIds.includes(message.conversationId)).map((message) => message.id),
    ...after.aiDecisions.filter((decision) => decision.clientId === client.id).map((decision) => decision.id),
    ...handoffIds,
    ...after.clientUpdateProposals.filter((proposal) => proposal.clientId === client.id).map((proposal) => proposal.id),
  ];
  await checked(
    supabase
      .from("audit_events")
      .update({ metadata: { minimized: true, reason: "client_data_anonymized" } })
      .eq("tenant_id", context.tenantId)
      .in("entity_id", minimizedEntityIds),
  );

  for (const audit of after.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }
  for (const request of after.dataRequests.filter((item) => !beforeRequests.has(item.id))) {
    await insertDataRequest(supabase, request);
  }

  return loadSupabaseState(context);
}

async function loadSupabaseOperationalFoundationOperationState(context = demoTenantContext()) {
  const state = await loadSupabaseState({ ...context, role: "owner" });
  const operationalState = await loadSupabaseOperationalFoundationState(context);
  return {
    ...state,
    channelAccountBindings: operationalState.channelAccountBindings,
    channelActorBindings: operationalState.channelActorBindings,
    channelAdapterRollback: operationalState.channelAdapterRollback,
  };
}

export async function addSupabaseManualReply(clientId: string, body: string, context = demoTenantContext()) {
  const state = await loadSupabaseClientOperationState(clientId, context);
  const next = addManualReplyInState(state, clientId, body);
  await commitStateDeltaRpc(requireSupabase(), "commit_manual_reply", state, next);
  return loadSupabaseState(context);
}

export async function approveSupabaseDraftMessage(
  messageId: string,
  body: string | undefined,
  context = demoTenantContext(),
) {
  const state = await loadSupabaseDraftOperationState(messageId, context);
  const next = approveDraftInState(state, messageId, body);
  await commitStateDeltaRpc(requireSupabase(), "commit_draft_review", state, next);
  return loadSupabaseState(context);
}

export async function dismissSupabaseDraftMessage(messageId: string, context = demoTenantContext()) {
  const state = await loadSupabaseDraftOperationState(messageId, context);
  const next = dismissDraftInState(state, messageId);
  await commitStateDeltaRpc(requireSupabase(), "commit_draft_review", state, next);
  return loadSupabaseState(context);
}

export async function releaseSupabaseHumanTakeover(clientId: string, context = demoTenantContext()) {
  const state = await loadSupabaseClientOperationState(clientId, context);
  const next = releaseHumanTakeoverInState(state, clientId);
  const client = next.clients.find((item) => item.id === clientId);

  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }

  const supabase = requireSupabase();
  await upsertClient(supabase, client, state.clients.find((item) => item.id === clientId));

  const beforeAudits = new Set(state.auditEvents.map((item) => item.id));
  for (const audit of next.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }

  return loadSupabaseState(context);
}

export async function activateSupabaseClientAi(
  clientId: string,
  input: ControlledAiActivationInput,
  context = demoTenantContext(),
) {
  assertControlledActivationInput(input);
  const supabase = requireSupabase();
  const { error } = await supabase.rpc("p85_if_r3_activate_client_ai", {
    p_tenant_id: context.tenantId,
    p_client_id: clientId,
    p_dietitian_id: context.dietitianId,
    p_requested_ai_mode: input.requestedAiMode ?? null,
    p_expected_conversation_revision: input.expectedConversationRevision,
    p_expected_client_context_revision: input.expectedClientContextRevision,
  });
  if (error) {
    throwControlledRpcError(error);
  }

  return loadSupabaseState(context);
}

function assertControlledActivationInput(input: ControlledAiActivationInput) {
  if (!Number.isInteger(input.expectedConversationRevision)) {
    throw new AppDomainError(400, "expected_conversation_revision_required");
  }
  if (!Number.isInteger(input.expectedClientContextRevision)) {
    throw new AppDomainError(400, "expected_client_context_revision_required");
  }
}

export async function runSupabaseSimulation(request: SimulationRequest, context = demoTenantContext()) {
  const state =
    request.sourceConversationType === "group" || !request.clientId
      ? await loadSupabaseState(context)
      : await loadSupabaseClientOperationState(request.clientId, context, {
          processedEventId: request.idempotencyKey,
          historicalQuery: request.body,
        });
  const simulationClient = state.clients.find((client) => client.id === request.clientId);
  const next = await simulateInState(state, request);
  await commitStateDeltaRpc(
    requireSupabase(),
    "commit_inbound_simulation",
    state,
    next,
    request.channel || simulationClient?.channel,
  );
  return loadSupabaseStateWithLastSimulation(next, context);
}

export async function runSupabaseWhatsAppMockWebhook(payload: unknown, context = demoTenantContext()) {
  const state = await loadSupabaseState(context);
  const { state: next, result } = await processWhatsAppMockWebhookInState(state, payload);

  if (result.status !== "rejected") {
    await commitStateDeltaRpc(requireSupabase(), "commit_inbound_simulation", state, next, "whatsapp");
  }

  return { webhookResult: result };
}

export async function updateSupabaseHandoffStatus(
  handoffId: string,
  status: "resolved" | "dismissed",
  context = demoTenantContext(),
) {
  const state = await loadSupabaseHandoffOperationState(handoffId, context);
  const next = updateHandoffStatusInState(state, handoffId, status);
  const handoff = next.handoffCases.find((item) => item.id === handoffId);

  if (!handoff) {
    throw new AppDomainError(404, "handoff_not_found");
  }

  await commitStateDeltaRpc(requireSupabase(), "commit_handoff_status", state, next);
  return loadSupabaseState(context);
}

export async function resolveAndReactivateSupabaseRedRisk(
  handoffId: string,
  input: { reactivationReason?: string; aiMode?: "copilot" | "autopilot" },
  context = demoTenantContext(),
) {
  const before = await loadSupabaseHandoffOperationState(handoffId, context);
  const after = resolveAndReactivateRedRiskInState(before, handoffId, input);
  const client = after.clients.find(
    (item) => item.redRiskLock.status === "reactivated" && item.redRiskLock.handoffId === handoffId,
  );
  const handoff = after.handoffCases.find((item) => item.id === handoffId);

  if (!client || !handoff) {
    throw new AppDomainError(404, "handoff_not_found");
  }

  await commitStateDeltaRpc(requireSupabase(), "commit_red_risk_reactivation", before, after);
  return loadSupabaseState(context);
}

export async function markSupabaseNotificationRead(notificationId: string, context = demoTenantContext()) {
  const { error } = await requireSupabase().rpc("p85_stage_4b_mark_notification_read_v2", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_notification_id: notificationId,
  });
  if (error) throwControlledRpcError(error);
  return buildSupabaseNotificationMutationResponse(context, notificationId);
}

export type SupabaseConversationReadMutationResult = {
  conversationId: string;
  dietitianId: string;
  actorRole: TenantRole;
  lastReadSequence: number;
  readAt: string | null;
  unreadCount: number;
};

export async function markSupabaseConversationRead(
  conversationId: string,
  throughSequence: number,
  context = demoTenantContext(),
): Promise<SupabaseConversationReadMutationResult> {
  const { data, error } = await requireSupabase().rpc("p85_stage_4b2_mark_conversation_read_v1", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_conversation_id: conversationId,
    p_through_sequence: throughSequence,
  });
  if (error) throwControlledRpcError(error);
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        conversation_id: string;
        dietitian_id: string;
        actor_role: TenantRole;
        last_read_sequence: number;
        read_at: string | null;
        unread_count: number;
      }
    | undefined;
  if (!row) {
    throw new AppDomainError(409, "conversation_read_mutation_empty");
  }
  return {
    conversationId: row.conversation_id,
    dietitianId: row.dietitian_id,
    actorRole: row.actor_role,
    lastReadSequence: Number(row.last_read_sequence),
    readAt: row.read_at,
    unreadCount: Number(row.unread_count),
  };
}

export async function acknowledgeSupabaseNotification(notificationId: string, context = demoTenantContext()) {
  const { error } = await requireSupabase().rpc("p85_stage_4b_acknowledge_notification_v2", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_notification_id: notificationId,
  });
  if (error) throwControlledRpcError(error);
  return buildSupabaseNotificationMutationResponse(context, notificationId);
}

export async function markAllSupabaseNotificationsRead(context = demoTenantContext()) {
  const { data, error } = await requireSupabase().rpc("p85_stage_4b_mark_all_notifications_read_v2", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
  });
  if (error) throwControlledRpcError(error);
  const summary = await listSupabaseNotifications(context, { status: "active", limit: 1 });
  return {
    version: "p85-stage-4b-api-v1",
    generatedAt: new Date().toISOString(),
    markedReadCount: Number(data ?? 0),
    counts: summary.counts,
  } satisfies Stage4BNotificationReadAllResponse;
}

export async function completeSupabaseUnsupportedMediaReview(notificationId: string, context = demoTenantContext()) {
  const { error } = await requireSupabase().rpc("p85_stage_4b_complete_unsupported_media_review_v2", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_notification_id: notificationId,
  });
  if (error) throwControlledRpcError(error);
  return buildSupabaseNotificationMutationResponse(context, notificationId);
}

export async function listSupabaseClinicalAlerts(
  context: AppTenantContext,
  input: {
    severity?: ClinicalAlertFilterSeverity;
    query?: string;
    cursor?: string | null;
    limit?: number;
  },
) {
  const supabase = requireSupabase();
  const cursor = decodeAlertCursor(input.cursor);
  const limit = input.limit ?? 30;
  const generatedAt = new Date().toISOString();
  const slaConfig = context.role === "auditor"
    ? { timezone: "UTC", redResponseSla: null, yellowReviewSla: null }
    : await fetchSupabaseDietitianSlaConfig(context);
  const [pageResult, countResult] = await Promise.all([
    supabase.rpc("p85_stage_4b_list_alerts_v2", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_severity: input.severity ?? null,
      p_query: input.query ?? "",
      p_cursor_severity_rank: cursor?.severityRank ?? null,
      p_cursor_started_at: cursor?.startedAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_limit: limit,
    }),
    supabase.rpc("p85_stage_4b_count_alerts_v2", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_severity: input.severity ?? null,
      p_query: input.query ?? "",
    }),
  ]);
  throwIfError(pageResult.error);
  throwIfError(countResult.error);

  const rawRows = (pageResult.data || []) as unknown as DbStage4BAlertCandidate[];
  const count = ((countResult.data || [])[0] || {
    filtered_total: 0,
    all_count: 0,
    red_count: 0,
    yellow_count: 0,
  }) as unknown as DbStage4BAlertCounts;
  const items = rawRows.slice(0, limit).map((row) => mapSupabaseClinicalAlertCandidate(row, slaConfig, generatedAt));
  const last = items.at(-1);
  const nextCursor = rawRows.length > limit && last
    ? encodeAlertCursor({
        severityRank: last.severity === "red" ? 0 : 1,
        startedAt: last.startedAt,
        id: last.id,
      })
    : null;

  return {
    version: "p85-stage-4b-api-v1",
    generatedAt,
    items,
    nextCursor,
    filteredTotal: Number(count.filtered_total || 0),
    counts: {
      all: Number(count.all_count || 0),
      red: Number(count.red_count || 0),
      yellow: Number(count.yellow_count || 0),
    },
  } satisfies ClinicalAlertsListResponse;
}

export async function listSupabaseNotifications(
  context: AppTenantContext,
  input: {
    status?: NotificationListStatus;
    priority?: NotificationPriority | null;
    category?: NotificationCategory | null;
    query?: string;
    cursor?: string | null;
    limit?: number;
  },
) {
  const supabase = requireSupabase();
  const status = input.status ?? "active";
  const cursor = decodeNotificationCursor(status, input.cursor);
  const limit = input.limit ?? 30;
  const uiLanguage = input.query && context.role !== "auditor"
    ? await fetchSupabaseDietitianLanguage(context)
    : "tr";
  const kindFilter = input.query ? resolveNotificationSearchKinds(input.query, uiLanguage) : [];
  const rpcInput = {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_status: status,
    p_priority: input.priority ?? null,
    p_category: input.category ?? null,
    p_query: input.query ?? "",
    p_kind_filter: kindFilter.length > 0 ? kindFilter : null,
    p_cursor_mode: cursor?.mode ?? null,
    p_cursor_priority_rank: status === "history" ? null : (cursor as { priorityRank?: number } | null)?.priorityRank ?? null,
    p_cursor_last_occurred_at: status === "history" ? null : (cursor as { lastOccurredAt?: string } | null)?.lastOccurredAt ?? null,
    p_cursor_history_at: status === "history" ? (cursor as { historyAt?: string } | null)?.historyAt ?? null : null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: limit,
  };
  const [pageResult, countResult] = await Promise.all([
    supabase.rpc("p85_stage_4b_list_notifications_v2", rpcInput),
    supabase.rpc("p85_stage_4b_count_notifications_v2", {
      p_tenant_id: context.tenantId,
      p_user_id: context.userId,
      p_dietitian_id: context.dietitianId,
      p_role: context.role,
      p_status: status,
      p_priority: input.priority ?? null,
      p_category: input.category ?? null,
      p_query: input.query ?? "",
      p_kind_filter: kindFilter.length > 0 ? kindFilter : null,
    }),
  ]);
  throwIfError(pageResult.error);
  throwIfError(countResult.error);

  const rawRows = (pageResult.data || []) as unknown as DbStage4BNotificationCandidate[];
  const count = ((countResult.data || [])[0] || {
    active_count: 0,
    unread_count: 0,
    history_count: 0,
    intervention_required_count: 0,
    filtered_total: 0,
  }) as unknown as DbStage4BNotificationCounts;
  const items = rawRows.slice(0, limit).map(mapSupabaseNotificationCandidate);
  const last = items.at(-1);
  const nextCursor = rawRows.length > limit && last
    ? status === "history"
      ? encodeNotificationCursor({ mode: "history", historyAt: new Date(resolveNotificationHistoryTimestamp(last)).toISOString(), id: last.id })
      : encodeNotificationCursor({
          mode: status,
          priorityRank: resolveNotificationPriorityRank(last.priority),
          lastOccurredAt: last.lastOccurredAt,
          id: last.id,
        })
    : null;

  return {
    version: "p85-stage-4b-api-v1",
    generatedAt: new Date().toISOString(),
    items,
    nextCursor,
    filteredTotal: Number(count.filtered_total || 0),
    counts: {
      active: Number(count.active_count || 0),
      unread: Number(count.unread_count || 0),
      history: Number(count.history_count || 0),
      interventionRequired: Number(count.intervention_required_count || 0),
    },
  } satisfies SystemNotificationsListResponse;
}

async function fetchSupabaseDietitianLanguage(context: AppTenantContext): Promise<SupportedLanguageCode> {
  const { data, error } = await requireSupabase()
    .from("dietitians")
    .select("ui_language")
    .eq("tenant_id", context.tenantId)
    .eq("id", context.dietitianId)
    .maybeSingle();
  throwIfError(error);
  return normalizeLanguageCode(data?.ui_language);
}

async function fetchSupabaseDietitianSlaConfig(context: AppTenantContext): Promise<SupabaseDietitianSlaConfig> {
  const [dietitianResult, responseResult] = await Promise.all([
    requireSupabase()
      .from("dietitians")
      .select("timezone")
      .eq("tenant_id", context.tenantId)
      .eq("id", context.dietitianId)
      .maybeSingle(),
    requireSupabase()
      .from("dietitian_form_responses")
      .select("answers")
      .eq("tenant_id", context.tenantId)
      .eq("dietitian_id", context.dietitianId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  throwIfError(dietitianResult.error);
  throwIfError(responseResult.error);
  const answers = (responseResult.data?.answers || {}) as Record<string, unknown>;
  const readAnswer = (key: string) => {
    const value = answers[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  return {
    timezone: dietitianResult.data?.timezone || "UTC",
    redResponseSla: readAnswer("red_response_sla"),
    yellowReviewSla: readAnswer("yellow_review_sla"),
  };
}

function mapSupabaseClinicalAlertCandidate(
  row: DbStage4BAlertCandidate,
  config: SupabaseDietitianSlaConfig,
  now: string,
): ClinicalAlertListItem {
  const severity = row.severity;
  const taxonomy = resolveClinicalAlertKind(row.reason_codes || []);
  const sla = resolveDietitianClinicalSla({
    severity,
    startedAt: row.started_at,
    now,
    timezone: config.timezone,
    redResponseSla: config.redResponseSla,
    yellowReviewSla: config.yellowReviewSla,
  });
  const target = row.conversation_id
    ? {
        section: "messages" as const,
        clientId: row.client_id,
        conversationId: row.conversation_id,
        messageId: row.source_message_id || row.active_draft_message_id || undefined,
        source: "alert" as const,
        sourceId: row.alert_id,
      }
    : {
        section: "clients" as const,
        clientId: row.client_id,
        source: "alert" as const,
        sourceId: row.alert_id,
      };

  return {
    id: row.alert_id,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    clientFullName: row.client_full_name,
    severity,
    kind: taxonomy.kind,
    reasonLabelKey: taxonomy.reasonLabelKey,
    additionalReasonCount: taxonomy.additionalReasonCount,
    sourceMessageId: row.source_message_id,
    activeDraftMessageId: row.active_draft_message_id,
    handoffId: row.handoff_id,
    startedAt: row.started_at,
    elapsedMinutes: sla.elapsedMinutes,
    slaDeadline: sla.slaDeadline,
    slaState: sla.slaState,
    target,
  };
}

function resolveNotificationPriorityRank(priority: NotificationPriority) {
  if (priority === "intervention_required") return 0;
  if (priority === "review_required") return 1;
  return 2;
}

function resolveNotificationHistoryTimestamp(item: SystemNotificationListItem) {
  return Date.parse(item.resolvedAt || item.readAt || item.lastOccurredAt);
}

function mapSupabaseNotificationCandidate(row: DbStage4BNotificationCandidate): SystemNotificationListItem {
  const i18nKeys = STAGE4B_NOTIFICATION_I18N_KEYS[row.kind];
  return {
    id: row.id,
    kind: row.kind,
    priority: row.priority,
    category: row.category,
    clientId: row.client_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    handoffId: row.handoff_id,
    clientFullName: row.client_full_name,
    titleKey: i18nKeys.titleKey,
    summaryKey: i18nKeys.summaryKey,
    occurrenceCount: row.occurrence_count,
    lastOccurredAt: row.last_occurred_at,
    readAt: row.read_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    lifecycleState: row.lifecycle_state,
    target: buildStage4BNotificationTargetFromLinks(
      {
        id: row.id,
        kind: row.kind,
        clientId: row.client_id,
        conversationId: row.conversation_id,
        messageId: row.message_id,
      },
      {
        clientExists: Boolean(row.client_id && row.client_full_name),
        source: "notification",
      },
    ),
  };
}

async function fetchSupabaseNotificationCandidate(
  context: AppTenantContext,
  notificationId: string,
): Promise<DbStage4BNotificationCandidate> {
  const { data, error } = await requireSupabase().rpc("p85_stage_4b_get_notification_v2", {
    p_tenant_id: context.tenantId,
    p_user_id: context.userId,
    p_dietitian_id: context.dietitianId,
    p_role: context.role,
    p_notification_id: notificationId,
  });
  throwIfError(error);
  const candidate = ((data || [])[0] || null) as DbStage4BNotificationCandidate | null;
  if (!candidate) throw new AppDomainError(404, "notification_not_found");
  return candidate;
}

async function buildSupabaseNotificationMutationResponse(
  context: AppTenantContext,
  notificationId: string,
): Promise<Stage4BNotificationMutationResponse> {
  const [candidate, summary] = await Promise.all([
    fetchSupabaseNotificationCandidate(context, notificationId),
    listSupabaseNotifications(context, { status: "active", limit: 1 }),
  ]);
  const item = mapSupabaseNotificationCandidate(candidate);
  return {
    version: "p85-stage-4b-api-v1",
    generatedAt: new Date().toISOString(),
    notificationId,
    readAt: item.readAt,
    acknowledgedAt: item.acknowledgedAt,
    resolvedAt: item.resolvedAt,
    target: item.target,
    counts: summary.counts,
  };
}

export async function resolveSupabaseStructuredRecordUpdateNotification(
  notificationId: string,
  context = demoTenantContext(),
) {
  const { error } = await requireSupabase().rpc(
    "p85_if_postclosure_resolve_structured_update_notification",
    {
      p_tenant_id: context.tenantId,
      p_notification_id: notificationId,
      p_dietitian_id: context.dietitianId,
    },
  );
  if (error) throwControlledRpcError(error);
  return loadSupabaseState(context);
}

export async function updateSupabaseVoiceSamples(
  input: { rawInput?: string; sampleId?: string; status?: VoiceSampleStatus },
  context = demoTenantContext(),
) {
  const before = await loadSupabaseState(context);
  const next =
    input.rawInput !== undefined
      ? addVoiceSamplesInState(before, input.rawInput)
      : updateVoiceSampleStatus(before, input.sampleId || "", input.status || "draft");
  const supabase = requireSupabase();

  for (const sample of next.voiceSamples.filter(
    (sample) => !before.voiceSamples.some((beforeSample) => beforeSample.id === sample.id),
  )) {
    await upsertVoiceSample(supabase, { ...sample, tenantId: context.tenantId, dietitianId: context.dietitianId });
  }

  for (const sample of next.voiceSamples.filter((sample) => {
    const beforeSample = before.voiceSamples.find((item) => item.id === sample.id);
    return beforeSample && beforeSample.status !== sample.status;
  })) {
    await upsertVoiceSample(supabase, sample);
  }

  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function generateSupabaseVoiceProfile(context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
  const next = generateVoiceProfile(before);
  const profile = next.voiceProfiles.find(
    (item) => !before.voiceProfiles.some((beforeProfile) => beforeProfile.id === item.id),
  );
  const supabase = requireSupabase();
  if (profile) {
    await upsertVoiceProfile(supabase, { ...profile, tenantId: context.tenantId, dietitianId: context.dietitianId });
  }
  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function createSupabaseFormSchema(
  input: { title: string; fields: ClientFormFieldDefinition[]; languageCode?: unknown },
  context = demoTenantContext(),
) {
  const before = await loadSupabaseState(context);
  const next = createFormSchemaInState(before, input);
  const schema = next.clientFormSchemas.find(
    (item) => !before.clientFormSchemas.some((beforeSchema) => beforeSchema.id === item.id),
  );
  const supabase = requireSupabase();
  if (schema) await upsertFormSchema(supabase, { ...schema, tenantId: context.tenantId });
  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function publishSupabaseFormSchema(schemaId: string, context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
  const next = publishFormSchemaInState(before, schemaId);
  const schema = next.clientFormSchemas.find((item) => item.id === schemaId);
  const supabase = requireSupabase();
  if (schema) await upsertFormSchema(supabase, schema);
  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function saveSupabaseFormResponse(
  input: { clientId: string; schemaId: string; answers: Record<string, unknown>; submittedPhoneE164?: unknown },
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(input.clientId, context, {
    requiredFormSchemaId: input.schemaId,
  });
  const next = saveFormResponseInState(before, input);
  await commitStateDeltaRpc(requireSupabase(), "commit_form_response", before, next);
  return loadSupabaseState(context);
}

export async function loadSupabaseClientFoodRuleProfile(clientId: string, context = demoTenantContext()) {
  return loadSupabaseClientOperationState(clientId, context);
}

export async function saveSupabaseClientFoodRuleProfile(
  clientId: string,
  input: SaveClientFoodRuleProfileV2Input,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = saveClientFoodRuleProfileV2InState(before, clientId, input);
  const profile = next.clientFoodRuleProfiles.find((item) => item.clientId === clientId);
  if (!profile) throw new AppDomainError(404, "client_food_rule_profile_not_found");
  const supabase = requireSupabase();
  await upsertClientFoodRuleProfile(supabase, profile);
  await commitStateDeltaRpc(supabase, "commit_form_response", before, next);
  return loadSupabaseState(context);
}

export async function listSupabaseClientMenuPlans(clientId: string, context = demoTenantContext()) {
  return loadSupabaseClientOperationState(clientId, context);
}

async function persistClientMenuPlanDelta(supabase: SupabaseClient, before: ManuAppState, after: ManuAppState, clientId: string) {
  const beforePlans = new Map(before.clientMenuPlans.map((plan) => [plan.id, plan]));
  for (const plan of after.clientMenuPlans) {
    const beforePlan = beforePlans.get(plan.id);
    if (!beforePlan || JSON.stringify(beforePlan) !== JSON.stringify(plan)) {
      await upsertClientMenuPlan(supabase, plan);
    }
  }
  const client = after.clients.find((item) => item.id === clientId);
  const beforeClient = before.clients.find((item) => item.id === clientId);
  if (client && beforeClient && JSON.stringify(beforeClient) !== JSON.stringify(client)) {
    await upsertClient(supabase, client, beforeClient);
  }
  await persistNewAudits(supabase, before, after);
}

export async function createSupabaseClientMenuPlan(
  clientId: string,
  input: CreateClientMenuPlanV1Input,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = createMenuPlanInState(before, clientId, input);
  const supabase = requireSupabase();
  const created = next.clientMenuPlans.find(
    (plan) => plan.clientId === clientId && !before.clientMenuPlans.some((item) => item.id === plan.id),
  );
  if (created) await upsertClientMenuPlan(supabase, created);
  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function saveSupabaseClientMenuPlan(
  clientId: string,
  planId: string,
  input: SaveClientMenuPlanV1Input,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = saveMenuPlanInState(before, clientId, planId, input);
  const supabase = requireSupabase();
  await persistClientMenuPlanDelta(supabase, before, next, clientId);
  return loadSupabaseState(context);
}

export async function activateSupabaseClientMenuPlan(
  clientId: string,
  planId: string,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = activateMenuPlanInState(before, clientId, planId);
  const supabase = requireSupabase();
  await persistClientMenuPlanDelta(supabase, before, next, clientId);
  return loadSupabaseState(context);
}

export async function updateSupabaseDietitianPreferences(
  input: { uiLanguage?: unknown },
  context = demoTenantContext(),
) {
  await checked(
    requireSupabase()
      .from("dietitians")
      .update({ ui_language: normalizeLanguageCode(input.uiLanguage) })
      .eq("tenant_id", context.tenantId)
      .eq("id", context.dietitianId),
  );
  return loadSupabaseState(context);
}

export async function addSupabaseClientContextUpdate(
  clientId: string,
  input: CreateClientContextUpdateInput,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = addClientContextUpdateInState(before, clientId, input);
  await commitStateDeltaRpc(requireSupabase(), "commit_client_context_update", before, next);
  return loadSupabaseState(context);
}

export async function createSupabaseClientUpdateProposal(
  clientId: string,
  input: CreateClientUpdateProposalInput,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = createUpdateProposalInState(before, clientId, input);
  await commitStateDeltaRpc(requireSupabase(), "commit_client_update_proposal", before, next);
  return loadSupabaseState(context);
}

export async function applySupabaseClientUpdateProposal(
  clientId: string,
  proposalId: string,
  input: ApplyClientUpdateProposalInput = {},
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = applyUpdateProposalInState(before, clientId, proposalId, input);
  await commitStateDeltaRpc(requireSupabase(), "commit_client_update_proposal", before, next);
  return loadSupabaseState(context);
}

export async function rejectSupabaseClientUpdateProposal(
  clientId: string,
  proposalId: string,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseClientOperationState(clientId, context);
  const next = rejectUpdateProposalInState(before, clientId, proposalId);
  const proposal = next.clientUpdateProposals.find((item) => item.id === proposalId);
  const supabase = requireSupabase();
  if (proposal) await upsertClientUpdateProposal(supabase, proposal);
  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

async function upsertContextIntakeProposal(supabase: SupabaseClient, proposal: ContextIntakeProposalRecord) {
  await checked(
    supabase.from("context_intake_proposals").upsert({
      id: proposal.id,
      tenant_id: proposal.tenantId,
      client_id: proposal.clientId,
      dietitian_id: proposal.dietitianId,
      source_channel: proposal.sourceChannel,
      intake_source: proposal.intakeSource,
      source_text_digest: proposal.sourceTextDigest,
      source_text: proposal.sourceText,
      raw_source_reference: proposal.rawSourceReference,
      occurred_at: proposal.occurredAt,
      title: proposal.title,
      summary: proposal.summary,
      details: proposal.details,
      importance: proposal.importance,
      structured_impact_flags: proposal.structuredImpactFlags,
      baseline_context_revision: proposal.baselineContextRevision,
      baseline_form_revision: proposal.baselineFormRevision,
      baseline_food_rule_revision: proposal.baselineFoodRuleRevision,
      baseline_menu_plan_revision: proposal.baselineMenuPlanRevision,
      status: proposal.status,
      confirmation_count: proposal.confirmationCount,
      applied_context_update_id: proposal.appliedContextUpdateId,
      created_at: proposal.createdAt,
      updated_at: proposal.updatedAt,
      expires_at: proposal.expiresAt,
    }),
  );
}

export async function createSupabaseContextIntakeProposal(
  resolution: import("./phase-85-if-g-context-intake").ResolveContextIntakeClientInput,
  input: import("./phase-85-if-g-context-intake").CreateContextIntakeProposalInput,
  context = demoTenantContext(),
) {
  const before = await loadSupabaseState(context);
  const next = createContextIntakeProposalInState(before, resolution, input);
  const proposal = next.contextIntakeProposals.at(-1);
  const supabase = requireSupabase();
  if (proposal) await upsertContextIntakeProposal(supabase, proposal);
  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function confirmSupabaseContextIntakeProposal(
  clientId: string,
  proposalId: string,
  context = demoTenantContext(),
) {
  await mutateSupabaseContextIntakeProposal(clientId, proposalId, "confirm", context);
  return loadSupabaseState(context);
}

export async function recheckSupabaseContextIntakeProposal(
  clientId: string,
  proposalId: string,
  context = demoTenantContext(),
) {
  await mutateSupabaseContextIntakeProposal(clientId, proposalId, "recheck", context);
  return loadSupabaseState(context);
}

export async function applySupabaseContextIntakeProposal(
  clientId: string,
  proposalId: string,
  context = demoTenantContext(),
) {
  await mutateSupabaseContextIntakeProposal(clientId, proposalId, "apply", context);
  return loadSupabaseState(context);
}

export async function rejectSupabaseContextIntakeProposal(
  clientId: string,
  proposalId: string,
  context = demoTenantContext(),
) {
  await mutateSupabaseContextIntakeProposal(clientId, proposalId, "reject", context);
  return loadSupabaseState(context);
}

async function mutateSupabaseContextIntakeProposal(
  clientId: string,
  proposalId: string,
  action: "confirm" | "recheck" | "apply" | "reject",
  context: AppTenantContext,
) {
  const { error } = await requireSupabase().rpc("p85_if_r4_mutate_context_intake_proposal", {
    p_tenant_id: context.tenantId,
    p_client_id: clientId,
    p_dietitian_id: context.dietitianId,
    p_proposal_id: proposalId,
    p_action: action,
  });

  if (error) {
    throwControlledRpcError(error);
  }
}

async function loadSupabaseInternalCopilotClientData(clientId: string, context: AppTenantContext) {
  const supabase = requireSupabase();

  const [conversationsResult, handoffsResult, decisionsResult, formResponsesResult, formSchemasResult] =
    await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("client_id", clientId)
        .order("created_at"),
      supabase
        .from("handoff_cases")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("ai_decisions")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("client_form_responses")
        .select("*")
        .eq("tenant_id", context.tenantId)
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase.from("client_form_schemas").select("*").eq("tenant_id", context.tenantId).eq("status", "published"),
    ]);

  throwIfError(conversationsResult.error);
  throwIfError(handoffsResult.error);
  throwIfError(decisionsResult.error);
  throwIfError(formResponsesResult.error);
  throwIfError(formSchemasResult.error);

  const conversationIds = (conversationsResult.data || []).map((conversation) => conversation.id);
  const memoriesResult =
    conversationIds.length > 0
      ? await supabase
          .from("conversation_memories")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("conversation_id", conversationIds)
      : await emptySupabaseResult<DbMemory>();
  throwIfError(memoriesResult.error);

  const messagesResult =
    conversationIds.length > 0
      ? await supabase
          .from("messages")
          .select("*")
          .eq("tenant_id", context.tenantId)
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : await emptySupabaseResult<DbMessage>();
  throwIfError(messagesResult.error);

  const memories = memoriesResult.data || [];

  return {
    conversations: (conversationsResult.data || []).map((conversation) => mapConversation(conversation, memories)),
    messages: (messagesResult.data || [])
      .map(mapMessage)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    handoffCases: (handoffsResult.data || []).map(mapHandoff),
    aiDecisions: (decisionsResult.data || []).map(mapDecision),
    clientFormResponses: (formResponsesResult.data || []).map(mapFormResponse),
    clientFormSchemas: (formSchemasResult.data || []).map(mapFormSchema),
  };
}

async function loadSupabaseInternalCopilotBoundedContext(body: string, context: AppTenantContext) {
  const clientShell = await loadSupabaseClientCreateContext(context);
  const intent = classifyInternalCopilotIntent(body);

  if (intent === "unsupported") {
    return assembleBoundedInternalCopilotToolState(
      { ...clientShell, conversations: [], clientFormSchemas: [] },
      body,
    );
  }

  const query = extractClientQuery(body, clientShell.clients);
  const resolved = resolveVisibleClientByName(clientShell, query);
  if (resolved.status !== "ok") {
    return assembleBoundedInternalCopilotToolState(
      { ...clientShell, conversations: [], clientFormSchemas: [] },
      body,
    );
  }

  const clientData = await loadSupabaseInternalCopilotClientData(resolved.client.id, context);
  return assembleBoundedInternalCopilotToolState({ ...clientShell, ...clientData }, body);
}

export async function runSupabaseInternalCopilotMessage(body: string, context = demoTenantContext()) {
  const before = await loadSupabaseInternalCopilotBoundedContext(body, context);
  const next = runInternalCopilotMessageInState(before, body);
  const beforeMessages = new Set(before.internalCopilotMessages.map((message) => message.id));
  const beforeToolCalls = new Set(before.internalCopilotToolCalls.map((call) => call.id));
  const supabase = requireSupabase();

  for (const call of next.internalCopilotToolCalls.filter((item) => !beforeToolCalls.has(item.id))) {
    await insertInternalCopilotToolCall(supabase, {
      ...call,
      tenantId: context.tenantId,
      dietitianId: context.dietitianId,
    });
  }

  for (const message of next.internalCopilotMessages.filter((item) => !beforeMessages.has(item.id))) {
    await insertInternalCopilotMessage(supabase, {
      ...message,
      tenantId: context.tenantId,
      dietitianId: context.dietitianId,
    });
  }

  await persistNewAudits(supabase, before, next);
  return loadSupabaseState(context);
}

export async function ensureSupabaseDemoDataForUser(userId: string) {
  await ensureDemoData(requireSupabase(), userId);
}

async function loadSupabaseStateWithLastSimulation(next: ManuAppState, context: AppTenantContext) {
  const loaded = await loadSupabaseState(context);
  return { ...loaded, lastSimulation: next.lastSimulation };
}

async function ensureDemoData(supabase: SupabaseClient, userId = DEMO_USER_UUID) {
  const existing = await supabase.from("tenants").select("id").eq("id", DEMO_TENANT_UUID).maybeSingle();
  throwIfError(existing.error);
  if (existing.data) {
    await ensureDemoMembership(supabase, userId);
    await ensureDemoDietitianFormData(supabase);
    await ensureDemoCommercialEntitlement();
    return;
  }

  const seed = remapSeedIds(createInitialState());
  const conversations = seed.conversations;
  const firstMessage = seed.messages[0];
  const decision = seed.aiDecisions[0];
  const secondMessage = seed.messages[1];

  await checked(supabase.from("tenants").upsert({ id: seed.tenant.id, name: seed.tenant.name }));
  await checked(
    supabase.from("tenant_memberships").upsert(
      {
        tenant_id: seed.tenant.id,
        user_id: userId,
        role: "owner",
      },
      { onConflict: "tenant_id,user_id" },
    ),
  );
  await checked(
    supabase.from("dietitians").upsert({
      id: seed.dietitian.id,
      tenant_id: seed.tenant.id,
      display_name: seed.dietitian.displayName,
      timezone: seed.dietitian.timezone,
      ui_language: seed.dietitian.uiLanguage,
      auth_user_id: userId,
    }),
  );

  for (const schema of seed.clientFormSchemas) {
    await upsertFormSchema(supabase, { ...schema, tenantId: seed.tenant.id });
  }

  await ensureDemoDietitianFormData(supabase, seed);

  for (const client of seed.clients) {
    await insertClientBundle(
      supabase,
      client,
      conversations.find((conversation) => conversation.clientId === client.id),
    );
  }

  await insertMessage(supabase, firstMessage);
  await insertRiskAssessment(supabase, seed.riskAssessments[0]);
  await insertDecision(supabase, decision);
  await insertMessage(supabase, secondMessage);
  await checked(
    supabase.from("processed_inbound_events").upsert({
      tenant_id: seed.tenant.id,
      channel: "whatsapp",
      provider_event_id: "seed-green",
    }),
  );
  await ensureDemoCommercialEntitlement();
}

async function ensureDemoDietitianFormData(supabase: SupabaseClient, seed = remapSeedIds(createInitialState())) {
  for (const schema of seed.dietitianFormSchemas) {
    await upsertDietitianFormSchema(supabase, { ...schema, tenantId: seed.tenant.id }, seed.dietitian.id);
  }
  for (const response of seed.dietitianFormResponses) {
    await upsertDietitianFormResponse(supabase, {
      ...response,
      tenantId: seed.tenant.id,
      dietitianId: seed.dietitian.id,
      schemaSnapshot: { ...response.schemaSnapshot, tenantId: seed.tenant.id },
    });
  }
}

async function ensureDemoCommercialEntitlement() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }

  const now = new Date().toISOString();
  await checked(
    admin.from("tenant_entitlements").upsert(
      {
        tenant_id: DEMO_TENANT_UUID,
        status: "active",
        status_changed_at: now,
        updated_at: now,
      },
      { onConflict: "tenant_id" },
    ),
  );
}

async function ensureDemoMembership(supabase: SupabaseClient, userId: string) {
  await checked(
    supabase.from("tenant_memberships").upsert(
      {
        tenant_id: DEMO_TENANT_UUID,
        user_id: userId,
        role: "owner",
      },
      { onConflict: "tenant_id,user_id" },
    ),
  );
  await checked(
    supabase
      .from("dietitians")
      .update({ auth_user_id: userId })
      .eq("id", DEMO_DIETITIAN_UUID)
      .eq("tenant_id", DEMO_TENANT_UUID),
  );
}

async function deleteDemoData(supabase: SupabaseClient, tenantId = DEMO_TENANT_UUID) {
  const tables = [
    "processed_inbound_events",
    "channel_adapter_rollback_controls",
    "client_food_rule_profiles",
    "client_menu_plans",
    "client_context_updates",
    "client_form_responses",
    "client_form_schemas",
    "dietitian_form_responses",
    "dietitian_form_schemas",
    "dietitian_voice_samples",
    "internal_copilot_messages",
    "internal_copilot_tool_calls",
    "data_requests",
    "notification_receipts",
    "conversation_read_receipts",
    "notifications",
    "channel_deliveries",
    "context_intake_proposals",
    "risk_activity_events",
    "human_control_sessions",
    "channel_message_revisions",
    "channel_events",
    "channel_actor_bindings",
    "channel_account_bindings",
    "inbound_quarantines",
    "audit_events",
    "handoff_cases",
    "messages",
    "ai_decisions",
    "risk_assessments",
    "conversation_memories",
    "conversations",
    "client_channels",
    "client_ai_status_events",
    "client_assignments",
    "clients",
    "dietitian_voice_profiles",
    "dietitians",
    "tenant_memberships",
    "tenants",
  ];

  for (const table of tables) {
    const column = table === "tenants" ? "id" : "tenant_id";
    await checked(supabase.from(table).delete().eq(column, tenantId));
  }
}

async function insertClientBundle(
  supabase: SupabaseClient,
  client: ClientRecord,
  conversation?: ConversationRecord,
) {
  await upsertClient(supabase, client);
  await upsertChannel(supabase, client);

  if (conversation) {
    await checked(
      supabase.from("conversations").upsert({
        id: conversation.id,
        tenant_id: conversation.tenantId,
        dietitian_id: conversation.dietitianId,
        client_id: conversation.clientId,
        channel: conversation.channel,
        status: "active",
      }),
    );
    await checked(
      supabase.from("conversation_memories").upsert({
        tenant_id: conversation.tenantId,
        conversation_id: conversation.id,
        client_id: conversation.clientId,
        rolling_summary: conversation.rollingSummary,
        memory_version: conversation.memoryVersion,
        memory_revision: conversation.memoryRevision,
        stale: conversation.memoryStale,
        durable_facts: {},
      }),
    );
  }
}

async function upsertClient(supabase: SupabaseClient, client: ClientRecord, beforeClient?: ClientRecord) {
  const safetyChecklist = normalizeSafetyChecklist(client.safetyChecklist);
  const mandatorySafetyComplete = isSafetyChecklistComplete({ ...client, safetyChecklist });
  const payload = {
    id: client.id,
    tenant_id: client.tenantId,
    dietitian_id: client.dietitianId,
    lifecycle_status: client.lifecycleStatus,
    removed_at: client.removedAt,
    full_name: client.fullName,
    primary_phone_e164: client.primaryPhoneE164,
    communication_language: client.communicationLanguage,
    selected_persona_id: client.selectedPersonaId,
    ai_status: client.aiStatus,
    ai_mode: client.aiMode,
    ai_active_from: client.aiActiveFrom,
    ai_active_until: client.aiActiveUntil,
    channel_permission: client.channelPermission,
    mandatory_safety_complete: mandatorySafetyComplete,
    human_takeover_locked: client.humanTakeoverLocked,
    red_risk_lock: client.redRiskLock,
    yellow_risk_hold: client.yellowRiskHold,
    context_revision: client.contextRevision,
    safety_checklist: safetyChecklist,
    health_profile: client.healthProfile,
    diet_plan: client.dietPlan,
    allergies: client.allergies,
    restricted_foods: client.restrictedFoods,
    clinical_risk_notes: client.clinicalRiskNotes,
    pinned_notes: client.pinnedNotes,
  };

  if (beforeClient) {
    const result = await supabase
      .from("clients")
      .update(payload)
      .eq("id", client.id)
      .eq("tenant_id", client.tenantId)
      .eq("context_revision", beforeClient.contextRevision)
      .select("id")
      .maybeSingle();
    throwIfError(result.error);

    if (!result.data) {
      throw new AppDomainError(409, "concurrent_state_update");
    }
    return;
  }

  await checked(
    supabase.from("clients").upsert(payload),
  );
}

async function upsertChannel(supabase: SupabaseClient, client: ClientRecord) {
  await checked(
    supabase.from("client_channels").upsert(
      {
        tenant_id: client.tenantId,
        client_id: client.id,
        channel: client.channel,
        channel_user_id: client.channelUserId || `${client.channel}:${client.id}`,
        display_handle: client.channelUserId || null,
        is_active: true,
      },
      { onConflict: "tenant_id,client_id,channel" },
    ),
  );
}

function hasAiControlChange(before: ClientRecord | undefined, after: ClientRecord) {
  if (!before) return false;

  return (
    before.aiStatus !== after.aiStatus ||
    before.aiMode !== after.aiMode ||
    before.aiActiveFrom !== after.aiActiveFrom ||
    before.aiActiveUntil !== after.aiActiveUntil
  );
}

async function insertClientAiStatusEvent(
  supabase: SupabaseClient,
  before: ClientRecord | undefined,
  after: ClientRecord,
  context: AppTenantContext,
) {
  await checked(
    supabase.from("client_ai_status_events").insert({
      tenant_id: context.tenantId,
      client_id: after.id,
      dietitian_id: context.dietitianId,
      previous_status: before?.aiStatus || null,
      new_status: after.aiStatus,
      ai_mode: after.aiMode,
      active_from: after.aiActiveFrom,
      active_until: after.aiActiveUntil,
      reason: "client_ai_control_updated",
    }),
  );
}

async function commitStateDeltaRpc(
  supabase: SupabaseClient,
  rpcName: string,
  before: ManuAppState,
  after: ManuAppState,
  processedEventChannel?: ClientRecord["channel"],
) {
  const payload = buildStateDeltaPayload(before, after, processedEventChannel);
  const { error } = await supabase.rpc(rpcName, {
    p_tenant_id: after.tenant.id,
    p_payload: payload,
  });

  if (error) {
    throwControlledRpcError(error);
  }
}

function buildStateDeltaPayload(
  before: ManuAppState,
  after: ManuAppState,
  processedEventChannel?: ClientRecord["channel"],
) {
  const beforeClientsById = new Map(before.clients.map((client) => [client.id, client]));
  const beforeConversationsById = new Map(before.conversations.map((item) => [item.id, item]));
  const beforeMessagesById = new Map(before.messages.map((item) => [item.id, item]));
  const beforeDecisionsById = new Map(before.aiDecisions.map((item) => [item.id, item]));
  const beforeRiskAssessments = new Set(before.riskAssessments.map((item) => item.id));
  const beforeHandoffsById = new Map(before.handoffCases.map((item) => [item.id, item]));
  const beforeNotifications = new Set(before.notifications.map((item) => item.id));
  const beforeQuarantines = new Set(before.inboundQuarantines.map((item) => item.id));
  const beforeChannelDeliveries = new Set(before.channelDeliveries.map((item) => item.id));
  const beforeChannelEventsById = new Map(before.channelEvents.map((item) => [item.id, item]));
  const beforeChannelAccountBindingsById = new Map(before.channelAccountBindings.map((item) => [item.id, item]));
  const beforeChannelActorBindingsById = new Map(before.channelActorBindings.map((item) => [item.id, item]));
  const beforeChannelMessageRevisionsById = new Map(before.channelMessageRevisions.map((item) => [item.id, item]));
  const beforeHumanControlSessionsById = new Map(before.humanControlSessions.map((item) => [item.id, item]));
  const beforeRiskActivityEventsById = new Map(before.riskActivityEvents.map((item) => [item.id, item]));
  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));
  const beforeProcessed = new Set(before.processedSimulationKeys);
  const beforeFormResponsesById = new Map(before.clientFormResponses.map((item) => [item.id, item]));
  const beforeContextUpdatesById = new Map(before.clientContextUpdates.map((item) => [item.id, item]));
  const beforeProposalsById = new Map(before.clientUpdateProposals.map((item) => [item.id, item]));
  const beforeContextIntakeProposalsById = new Map(before.contextIntakeProposals.map((item) => [item.id, item]));
  const beforeQuarantinesById = new Map(before.inboundQuarantines.map((item) => [item.id, item]));
  const beforeNotificationsById = new Map(before.notifications.map((item) => [item.id, item]));
  const changedClients = after.clients.filter((client) => {
    const beforeClient = beforeClientsById.get(client.id);
    return beforeClient && JSON.stringify(beforeClient) !== JSON.stringify(client);
  });
  const changedConversations = after.conversations.filter((conversation) => {
    const beforeConversation = beforeConversationsById.get(conversation.id);
    return beforeConversation && beforeConversation.revision !== conversation.revision;
  });
  const changedMessages = after.messages.filter((message) => {
    const beforeMessage = beforeMessagesById.get(message.id);
    return beforeMessage && JSON.stringify(beforeMessage) !== JSON.stringify(message);
  });
  const changedDecisions = after.aiDecisions.filter((decision) => {
    const beforeDecision = beforeDecisionsById.get(decision.id);
    return beforeDecision && JSON.stringify(beforeDecision) !== JSON.stringify(decision);
  });
  const changedHandoffs = after.handoffCases.filter((handoff) => {
    const beforeHandoff = beforeHandoffsById.get(handoff.id);
    return beforeHandoff && JSON.stringify(beforeHandoff) !== JSON.stringify(handoff);
  });
  const changedContextUpdates = after.clientContextUpdates.filter((update) => {
    const beforeUpdate = beforeContextUpdatesById.get(update.id);
    return beforeUpdate && JSON.stringify(beforeUpdate) !== JSON.stringify(update);
  });
  const changedProposals = after.clientUpdateProposals.filter((proposal) => {
    const beforeProposal = beforeProposalsById.get(proposal.id);
    return !beforeProposal || JSON.stringify(beforeProposal) !== JSON.stringify(proposal);
  });
  const changedNotifications = after.notifications.filter((notification) => {
    const beforeNotification = beforeNotificationsById.get(notification.id);
    return beforeNotification && JSON.stringify(beforeNotification) !== JSON.stringify(notification);
  });
  const changedContextIntakeProposals = after.contextIntakeProposals.filter((proposal) => {
    const beforeProposal = beforeContextIntakeProposalsById.get(proposal.id);
    return beforeProposal && JSON.stringify(beforeProposal) !== JSON.stringify(proposal);
  });
  const changedInboundQuarantines = after.inboundQuarantines.filter((quarantine) => {
    const beforeQuarantine = beforeQuarantinesById.get(quarantine.id);
    return beforeQuarantine && JSON.stringify(beforeQuarantine) !== JSON.stringify(quarantine);
  });
  const changedChannelAccountBindings = after.channelAccountBindings.filter((binding) => {
    const beforeBinding = beforeChannelAccountBindingsById.get(binding.id);
    return beforeBinding && JSON.stringify(beforeBinding) !== JSON.stringify(binding);
  });
  const changedChannelActorBindings = after.channelActorBindings.filter((binding) => {
    const beforeBinding = beforeChannelActorBindingsById.get(binding.id);
    return beforeBinding && JSON.stringify(beforeBinding) !== JSON.stringify(binding);
  });

  return {
    expectedClientRevisions: Object.fromEntries(
      changedClients.map((client) => [client.id, beforeClientsById.get(client.id)?.contextRevision || 1]),
    ),
    expectedConversationRevisions: Object.fromEntries(
      changedConversations.map((conversation) => [
        conversation.id,
        beforeConversationsById.get(conversation.id)?.revision || 1,
      ]),
    ),
    clients: changedClients.map(serializeClientForRpc),
    conversationUpdates: changedConversations.map(serializeConversationUpdateForRpc),
    messages: after.messages.filter((item) => !beforeMessagesById.has(item.id)).map(serializeMessageForRpc),
    messageUpdates: changedMessages.map(serializeMessageUpdateForRpc),
    aiDecisions: after.aiDecisions.filter((item) => !beforeDecisionsById.has(item.id)).map(serializeDecisionForRpc),
    aiDecisionUpdates: changedDecisions.map(serializeDecisionUpdateForRpc),
    riskAssessments: after.riskAssessments
      .filter((item) => !beforeRiskAssessments.has(item.id))
      .map(serializeRiskAssessmentForRpc),
    handoffCases: after.handoffCases.filter((item) => !beforeHandoffsById.has(item.id)).map(serializeHandoffForRpc),
    handoffUpdates: changedHandoffs.map(serializeHandoffUpdateForRpc),
    clientAiStatusEvents: changedClients
      .filter((client) => hasAiControlChange(beforeClientsById.get(client.id), client))
      .map((client) => serializeClientAiStatusEventForRpc(beforeClientsById.get(client.id), client)),
    notifications: after.notifications.filter((item) => !beforeNotifications.has(item.id)).map(serializeNotificationForRpc),
    inboundQuarantines: after.inboundQuarantines
      .filter((item) => !beforeQuarantines.has(item.id))
      .map(serializeInboundQuarantineForRpc),
    inboundQuarantineUpdates: changedInboundQuarantines.map(serializeInboundQuarantineForRpc),
    channelAccountBindingUpdates: changedChannelAccountBindings.map(serializeChannelAccountBindingForRpc),
    channelActorBindingUpdates: changedChannelActorBindings.map(serializeChannelActorBindingForRpc),
    channelDeliveries: after.channelDeliveries
      .filter((item) => !beforeChannelDeliveries.has(item.id))
      .map(serializeChannelDeliveryForRpc),
    channelEvents: after.channelEvents
      .filter((item) => {
        const beforeEvent = beforeChannelEventsById.get(item.id);
        return !beforeEvent || JSON.stringify(beforeEvent) !== JSON.stringify(item);
      })
      .map(serializeChannelEventForRpc),
    channelMessageRevisions: after.channelMessageRevisions
      .filter((item) => {
        const beforeRevision = beforeChannelMessageRevisionsById.get(item.id);
        return !beforeRevision || JSON.stringify(beforeRevision) !== JSON.stringify(item);
      })
      .map(serializeChannelMessageRevisionForRpc),
    humanControlSessions: after.humanControlSessions
      .filter((item) => {
        const beforeSession = beforeHumanControlSessionsById.get(item.id);
        return !beforeSession || JSON.stringify(beforeSession) !== JSON.stringify(item);
      })
      .map(serializeHumanControlSessionForRpc),
    riskActivityEvents: after.riskActivityEvents
      .filter((item) => {
        const beforeEvent = beforeRiskActivityEventsById.get(item.id);
        return !beforeEvent || JSON.stringify(beforeEvent) !== JSON.stringify(item);
      })
      .map(serializeRiskActivityEventForRpc),
    channelAdapterRollbackControls:
      JSON.stringify(before.channelAdapterRollback) === JSON.stringify(after.channelAdapterRollback)
        ? null
        : serializeChannelAdapterRollbackControlsForRpc(after.channelAdapterRollback),
    clientContextUpdates: after.clientContextUpdates
      .filter((item) => !beforeContextUpdatesById.has(item.id))
      .map(serializeClientContextUpdateForRpc),
    clientContextUpdateUpdates: changedContextUpdates.map(serializeClientContextUpdateUpdateForRpc),
    clientUpdateProposals: changedProposals.map(serializeClientUpdateProposalForRpc),
    contextIntakeProposalUpdates: changedContextIntakeProposals.map(serializeContextIntakeProposalForRpc),
    notificationUpdates: changedNotifications.map(serializeNotificationUpdateForRpc),
    formResponses: after.clientFormResponses
      .filter((item) => {
        const beforeResponse = beforeFormResponsesById.get(item.id);
        return !beforeResponse || JSON.stringify(beforeResponse) !== JSON.stringify(item);
      })
      .map(serializeFormResponseForRpc),
    auditEvents: after.auditEvents.filter((item) => !beforeAudits.has(item.id)).map(serializeAuditForRpc),
    processedEvents: after.processedSimulationKeys
      .filter((item) => !beforeProcessed.has(item))
      .map((providerEventId) => ({
        channel: processedEventChannel || after.clients[0]?.channel || "whatsapp",
        providerEventId,
      })),
  };
}

function serializeClientForRpc(client: ClientRecord) {
  return {
    id: client.id,
    dietitianId: client.dietitianId,
    lifecycleStatus: client.lifecycleStatus,
    removedAt: client.removedAt,
    fullName: client.fullName,
    primaryPhoneE164: client.primaryPhoneE164,
    communicationLanguage: client.communicationLanguage,
    selectedPersonaId: client.selectedPersonaId,
    aiStatus: client.aiStatus,
    aiMode: client.aiMode,
    aiActiveFrom: client.aiActiveFrom,
    aiActiveUntil: client.aiActiveUntil,
    channelPermission: client.channelPermission,
    mandatorySafetyComplete: client.mandatorySafetyComplete,
    humanTakeoverLocked: client.humanTakeoverLocked,
    redRiskLock: client.redRiskLock,
    yellowRiskHold: client.yellowRiskHold,
    contextRevision: client.contextRevision,
    safetyChecklist: normalizeSafetyChecklist(client.safetyChecklist),
    healthProfile: client.healthProfile,
    dietPlan: client.dietPlan,
    allergies: client.allergies,
    restrictedFoods: client.restrictedFoods,
    clinicalRiskNotes: client.clinicalRiskNotes,
    pinnedNotes: client.pinnedNotes,
  };
}

function serializeMessageForRpc(message: MessageRecord) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    body: message.body,
    origin: message.origin,
    authorDietitianId: message.authorDietitianId,
    generatedByAiDecisionId: message.generatedByAiDecisionId,
    approvedByDietitianId: message.approvedByDietitianId,
    sourceMessageId: message.sourceMessageId,
    risk: message.risk,
    status: message.status || "stored",
    providerAccountBindingId: message.providerAccountBindingId,
    providerEventId: message.providerEventId,
    providerMessageId: message.providerMessageId,
    actorType: message.actorType,
    actorBindingId: message.actorBindingId,
    authorInterface: message.authorInterface,
    actorResolutionBasis: message.actorResolutionBasis,
    providerSentAt: message.providerSentAt,
    observedAt: message.observedAt,
    persistedAt: message.persistedAt,
    conversationSequence: message.conversationSequence,
    contentStatus: message.contentStatus,
    retrievalEligibility: message.retrievalEligibility,
    createdAt: message.createdAt,
  };
}

function serializeConversationUpdateForRpc(conversation: ConversationRecord) {
  return {
    id: conversation.id,
    revision: conversation.revision,
  };
}

function serializeMessageUpdateForRpc(message: MessageRecord) {
  return {
    id: message.id,
    body: message.body,
    status: message.status,
    approvedByDietitianId: message.approvedByDietitianId,
    generatedByAiDecisionId: message.generatedByAiDecisionId,
    sourceMessageId: message.sourceMessageId,
    providerAccountBindingId: message.providerAccountBindingId,
    providerEventId: message.providerEventId,
    providerMessageId: message.providerMessageId,
    actorType: message.actorType,
    actorBindingId: message.actorBindingId,
    authorInterface: message.authorInterface,
    actorResolutionBasis: message.actorResolutionBasis,
    providerSentAt: message.providerSentAt,
    observedAt: message.observedAt,
    persistedAt: message.persistedAt,
    conversationSequence: message.conversationSequence,
    contentStatus: message.contentStatus,
    retrievalEligibility: message.retrievalEligibility,
  };
}

function serializeDecisionForRpc(decision: AiDecisionRecord) {
  return {
    id: decision.id,
    conversationId: decision.conversationId,
    clientId: decision.clientId,
    mode: decision.mode,
    aiStatus: decision.aiStatus,
    personaId: decision.personaId,
    risk: decision.risk,
    model: decision.model,
    promptVersion: decision.promptVersion,
    providerAttempted: decision.providerAttempted,
    providerId: decision.providerId,
    providerStatus: decision.providerStatus,
    providerErrorCode: decision.providerErrorCode,
    sendStatus: decision.sendStatus,
    contextManifest: decision.contextManifest,
    providerOutputSafety: decision.providerOutputSafety,
    tokenBudget: decision.tokenBudget,
    action: decision.action,
    blockedReason: decision.blockedReason,
    qualityIssues: decision.qualityIssues,
    reasons: decision.reasons,
    createdAt: decision.createdAt,
  };
}

function serializeDecisionUpdateForRpc(decision: AiDecisionRecord) {
  return {
    id: decision.id,
    model: decision.model,
    providerAttempted: decision.providerAttempted,
    providerStatus: decision.providerStatus,
    providerErrorCode: decision.providerErrorCode,
    sendStatus: decision.sendStatus,
    action: decision.action,
    blockedReason: decision.blockedReason,
    qualityIssues: decision.qualityIssues,
    reasons: decision.reasons,
  };
}

function serializeRiskAssessmentForRpc(riskAssessment: RiskAssessmentRecord) {
  return {
    id: riskAssessment.id,
    conversationId: riskAssessment.conversationId,
    messageId: riskAssessment.messageId,
    level: riskAssessment.level,
    reasons: riskAssessment.reasons,
    classifierVersion: riskAssessment.classifierVersion,
    createdAt: riskAssessment.createdAt,
  };
}

function serializeHandoffForRpc(handoff: HandoffCaseRecord) {
  return {
    id: handoff.id,
    dietitianId: handoff.dietitianId,
    clientId: handoff.clientId,
    conversationId: handoff.conversationId,
    triggeringMessageId: handoff.triggeringMessageId,
    risk: handoff.risk,
    reasons: handoff.reasons,
    status: handoff.status,
    urgency: handoff.urgency,
    safeAcknowledgement: handoff.safeAcknowledgement,
    recommendedAction: handoff.recommendedAction,
    createdAt: handoff.createdAt,
  };
}

function serializeHandoffUpdateForRpc(handoff: HandoffCaseRecord) {
  return {
    id: handoff.id,
    status: handoff.status,
    reasons: handoff.reasons,
    safeAcknowledgement: handoff.safeAcknowledgement,
    recommendedAction: handoff.recommendedAction,
  };
}

function serializeClientAiStatusEventForRpc(before: ClientRecord | undefined, after: ClientRecord) {
  return {
    id: crypto.randomUUID(),
    clientId: after.id,
    dietitianId: after.dietitianId,
    previousStatus: before?.aiStatus || null,
    newStatus: after.aiStatus,
    aiMode: after.aiMode,
    activeFrom: after.aiActiveFrom,
    activeUntil: after.aiActiveUntil,
    reason: "client_ai_control_updated",
    createdAt: new Date().toISOString(),
  };
}

function serializeNotificationForRpc(notification: NotificationRecord) {
  return {
    id: notification.id,
    type: notification.type,
    kind: notification.kind,
    priority: notification.priority,
    entityType: notification.entityType,
    entityId: notification.entityId,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    acknowledgedAt: notification.acknowledgedAt,
    dedupeKey: notification.dedupeKey ?? null,
    sourceMessageId: notification.sourceMessageId ?? null,
    targetPanel: notification.targetPanel ?? null,
    baselineRevision: notification.baselineRevision ?? null,
    resolvedAt: notification.resolvedAt ?? null,
    resolvedByDietitianId: notification.resolvedByDietitianId ?? null,
    clientId: notification.clientId ?? null,
    conversationId: notification.conversationId ?? null,
    messageId: notification.messageId ?? null,
    handoffId: notification.handoffId ?? null,
    occurrenceCount: notification.occurrenceCount,
    lastOccurredAt: notification.lastOccurredAt,
    createdAt: notification.createdAt,
  };
}

function serializeInboundQuarantineForRpc(quarantine: InboundQuarantineRecord) {
  return {
    id: quarantine.id,
    channel: quarantine.channel,
    sourceConversationType: quarantine.sourceConversationType,
    sourceConversationId: quarantine.sourceConversationId,
    sourceMessageId: quarantine.sourceMessageId,
    senderChannelUserId: quarantine.senderChannelUserId,
    reason: quarantine.reason,
    createdAt: quarantine.createdAt,
  };
}

function serializeChannelDeliveryForRpc(delivery: ChannelDeliveryRecord) {
  return {
    id: delivery.id,
    clientId: delivery.clientId,
    conversationId: delivery.conversationId,
    messageId: delivery.messageId,
    channel: delivery.channel,
    direction: delivery.direction,
    mockProviderMessageId: delivery.mockProviderMessageId,
    deliveryStatus: delivery.deliveryStatus,
    failureCode: delivery.failureCode,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,
  };
}

function serializeChannelEventForRpc(event: ChannelEventRecord) {
  return {
    id: event.id,
    accountBindingId: event.accountBindingId,
    eventKind: event.eventKind,
    processingStatus: event.processingStatus,
    providerAccountId: event.providerAccountId,
    providerEventId: event.providerEventId,
    providerMessageId: event.providerMessageId,
    fromIdentity: event.fromIdentity,
    toIdentity: event.toIdentity,
    counterpartyIdentity: event.counterpartyIdentity,
    payloadDigest: event.payloadDigest,
    payloadSchemaVersion: event.payloadSchemaVersion,
    providerTime: event.providerTime,
    observedAt: event.observedAt,
    committedAt: event.committedAt,
    quarantineId: event.quarantineId,
    replayOfEventId: event.replayOfEventId,
    retryCount: event.retryCount,
  };
}

function serializeChannelAccountBindingForRpc(binding: ChannelAccountBindingRecord) {
  return {
    id: binding.id,
    lifecycleStatus: binding.lifecycleStatus,
    revokedAt: binding.revokedAt,
    revokedByDietitianId: binding.revokedByDietitianId,
    updatedAt: binding.updatedAt,
  };
}

function serializeChannelActorBindingForRpc(binding: ChannelActorBindingRecord) {
  return {
    id: binding.id,
    accountBindingId: binding.accountBindingId,
    revokedAt: binding.revokedAt,
    revokedByDietitianId: binding.revokedByDietitianId,
    validTo: binding.validTo,
  };
}

function serializeChannelMessageRevisionForRpc(revision: ChannelMessageRevisionRecord) {
  return {
    id: revision.id,
    messageId: revision.messageId,
    channelEventId: revision.channelEventId,
    providerEventId: revision.providerEventId,
    revisionAction: revision.revisionAction,
    priorContentStatus: revision.priorContentStatus,
    currentContentStatus: revision.currentContentStatus,
    priorBodyDigest: revision.priorBodyDigest,
    currentBodyDigest: revision.currentBodyDigest,
    revisionSequence: revision.revisionSequence,
    providerTime: revision.providerTime,
    observedAt: revision.observedAt,
  };
}

function serializeHumanControlSessionForRpc(session: HumanControlSessionRecord) {
  return {
    id: session.id,
    clientId: session.clientId,
    conversationId: session.conversationId,
    reason: session.reason,
    status: session.status,
    previousAiStatus: session.previousAiStatus,
    previousAiMode: session.previousAiMode,
    linkedHandoffId: session.linkedHandoffId,
    linkedYellowHoldMessageId: session.linkedYellowHoldMessageId,
    openedByMessageId: session.openedByMessageId,
    latestHumanMessageId: session.latestHumanMessageId,
    humanResponseObservedCount: session.humanResponseObservedCount,
    openedAt: session.openedAt,
    resolvedAt: session.resolvedAt,
    reactivatedByDietitianId: session.reactivatedByDietitianId,
    reactivationReasonCode: session.reactivationReasonCode,
    restoredAiMode: session.restoredAiMode,
  };
}

function serializeRiskActivityEventForRpc(event: RiskActivityEventRecord) {
  return {
    id: event.id,
    clientId: event.clientId,
    conversationId: event.conversationId,
    humanControlSessionId: event.humanControlSessionId,
    eventType: event.eventType,
    sourceMessageId: event.sourceMessageId,
    handoffId: event.handoffId,
    aiDecisionId: event.aiDecisionId,
    metadata: event.metadata,
    createdAt: event.createdAt,
  };
}

function serializeContextIntakeProposalForRpc(proposal: ContextIntakeProposalRecord) {
  return {
    id: proposal.id,
    sourceText: proposal.sourceText,
    rawSourceReference: proposal.rawSourceReference,
    title: proposal.title,
    summary: proposal.summary,
    details: proposal.details,
    status: proposal.status,
    updatedAt: proposal.updatedAt,
  };
}

function serializeChannelAdapterRollbackControlsForRpc(controls: ChannelAdapterRollbackControls) {
  return {
    globalChannelAutomationDisabled: controls.globalChannelAutomationDisabled,
    tenantChannelAutomationDisabled: controls.tenantChannelAutomationDisabled,
    disabledDietitianIds: controls.disabledDietitianIds,
    disabledClientIds: controls.disabledClientIds,
  };
}

function serializeClientContextUpdateForRpc(update: ClientContextUpdateRecord) {
  return {
    id: update.id,
    clientId: update.clientId,
    dietitianId: update.dietitianId,
    source: update.source,
    occurredAt: update.occurredAt,
    title: update.title,
    summary: update.summary,
    details: update.details,
    importance: update.importance,
    status: update.status,
    supersedesUpdateId: update.supersedesUpdateId,
    createdAt: update.createdAt,
  };
}

function serializeClientContextUpdateUpdateForRpc(update: ClientContextUpdateRecord) {
  return {
    id: update.id,
    title: update.title,
    summary: update.summary,
    details: update.details,
    status: update.status,
  };
}

function serializeClientUpdateProposalForRpc(proposal: ClientUpdateProposalRecord) {
  return {
    id: proposal.id,
    clientId: proposal.clientId,
    dietitianId: proposal.dietitianId,
    sourceText: proposal.sourceText,
    proposedPatches: proposal.proposedPatches,
    safetyFlags: proposal.safetyFlags,
    status: proposal.status,
    expectedContextRevision: proposal.expectedContextRevision,
    createdAt: proposal.createdAt,
    resolvedAt: proposal.resolvedAt,
  };
}

function serializeNotificationUpdateForRpc(notification: NotificationRecord) {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    acknowledgedAt: notification.acknowledgedAt,
    occurrenceCount: notification.occurrenceCount,
    lastOccurredAt: notification.lastOccurredAt,
    resolvedAt: notification.resolvedAt,
    resolvedByDietitianId: notification.resolvedByDietitianId,
  };
}

function serializeFormResponseForRpc(response: ClientFormResponseRecord) {
  return {
    id: response.id,
    clientId: response.clientId,
    schemaId: response.schemaId,
    schemaVersion: response.schemaVersion,
    schemaSnapshot: response.schemaSnapshot,
    languageCode: response.languageCode,
    submittedPhoneE164: response.submittedPhoneE164,
    answers: response.answers,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

function serializeAuditForRpc(audit: AuditEventRecord) {
  return {
    id: audit.id,
    eventType: audit.eventType,
    entityType: audit.entityType,
    entityId: audit.entityId,
    metadata: audit.metadata,
    createdAt: audit.createdAt,
  };
}

function throwControlledRpcError(error: { message?: string }) {
  const message = error.message || "";
  if (message.includes("concurrent_state_update")) {
    throw new AppDomainError(409, "concurrent_state_update");
  }
  if (message.includes("client_not_found")) {
    throw new AppDomainError(404, "client_not_found");
  }
  if (message.includes("conversation_not_found")) {
    throw new AppDomainError(404, "conversation_not_found");
  }
  if (message.includes("expected_conversation_revision_required")) {
    throw new AppDomainError(400, "expected_conversation_revision_required");
  }
  if (message.includes("expected_client_context_revision_required")) {
    throw new AppDomainError(400, "expected_client_context_revision_required");
  }
  if (message.includes("reactivation_conflict_conversation_revision")) {
    throw new AppDomainError(409, "reactivation_conflict_conversation_revision");
  }
  if (message.includes("reactivation_conflict_client_context_revision")) {
    throw new AppDomainError(409, "reactivation_conflict_client_context_revision");
  }
  if (message.includes("red_risk_lock_not_active_for_handoff")) {
    throw new AppDomainError(409, "red_risk_lock_not_active_for_handoff");
  }
  if (message.includes("conversation_read_sequence_invalid")) {
    throw new AppDomainError(400, "conversation_read_sequence_invalid");
  }
  if (message.includes("notification_receipt_mutation_forbidden")) {
    throw new AppDomainError(409, "notification_receipt_mutation_forbidden");
  }
  if (message.includes("notification_not_found")) {
    throw new AppDomainError(404, "notification_not_found");
  }
  if (message.includes("structured_update_notification_not_resolvable")) {
    throw new AppDomainError(409, "structured_update_notification_not_resolvable");
  }
  if (message.includes("structured_update_revision_pending")) {
    throw new AppDomainError(409, "structured_update_revision_pending");
  }
  if (message.includes("structured_update_target_panel_invalid")) {
    throw new AppDomainError(409, "structured_update_target_panel_invalid");
  }
  if (message.includes("context_intake_proposal_not_found")) {
    throw new AppDomainError(404, "context_intake_proposal_not_found");
  }
  if (message.includes("context_intake_client_not_found")) {
    throw new AppDomainError(404, "context_intake_client_not_found");
  }
  if (message.includes("context_intake_proposal_expired")) {
    throw new AppDomainError(409, "context_intake_proposal_expired");
  }
  if (message.includes("context_intake_proposal_stale")) {
    throw new AppDomainError(409, "context_intake_proposal_stale");
  }
  if (message.includes("context_intake_proposal_not_mutable")) {
    throw new AppDomainError(409, "context_intake_proposal_not_mutable");
  }
  if (message.includes("context_intake_proposal_not_confirmable")) {
    throw new AppDomainError(409, "context_intake_proposal_not_confirmable");
  }
  if (message.includes("context_intake_proposal_not_blocked")) {
    throw new AppDomainError(409, "context_intake_proposal_not_blocked");
  }
  if (message.includes("context_intake_structured_revision_pending")) {
    throw new AppDomainError(409, "context_intake_structured_revision_pending");
  }
  if (message.includes("context_intake_proposal_not_ready_to_apply")) {
    throw new AppDomainError(409, "context_intake_proposal_not_ready_to_apply");
  }
  if (message.includes("context_intake_second_confirmation_required")) {
    throw new AppDomainError(409, "context_intake_second_confirmation_required");
  }
  if (message.includes("context_intake_confirmation_required")) {
    throw new AppDomainError(409, "context_intake_confirmation_required");
  }
  if (message.includes("context_intake_proposal_not_rejectable")) {
    throw new AppDomainError(409, "context_intake_proposal_not_rejectable");
  }
  if (message.includes("context_intake_action_invalid")) {
    throw new AppDomainError(400, "context_intake_action_invalid");
  }
  if (message.includes("client_removed_anonymized")) {
    throw new AppDomainError(409, "client_removed_anonymized");
  }
  throw error;
}

function emptySupabaseResult<T>() {
  return Promise.resolve({ data: [] as T[], error: null });
}

function mergeById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

async function insertMessage(supabase: SupabaseClient, message: MessageRecord) {
  await checked(
    supabase.from("messages").upsert({
      id: message.id,
      tenant_id: message.tenantId,
      conversation_id: message.conversationId,
      sender: message.sender,
      body: message.body,
      origin: message.origin,
      provider_account_binding_id: message.providerAccountBindingId ?? null,
      provider_event_id: message.providerEventId ?? null,
      provider_message_id: message.providerMessageId ?? null,
      actor_type: message.actorType ?? null,
      actor_binding_id: message.actorBindingId ?? null,
      author_interface: message.authorInterface ?? null,
      actor_resolution_basis: message.actorResolutionBasis ?? null,
      author_dietitian_id: message.authorDietitianId,
      generated_by_ai_decision_id: message.generatedByAiDecisionId,
      approved_by_dietitian_id: message.approvedByDietitianId,
      source_message_id: message.sourceMessageId,
      provider_sent_at: message.providerSentAt ?? null,
      observed_at: message.observedAt ?? null,
      persisted_at: message.persistedAt ?? message.createdAt,
      conversation_sequence: message.conversationSequence ?? null,
      content_status: message.contentStatus ?? "available",
      retrieval_eligibility: message.retrievalEligibility ?? "eligible",
      risk: message.risk,
      status: message.status || "stored",
      created_at: message.createdAt,
    }),
  );
}

async function insertDecision(supabase: SupabaseClient, decision: AiDecisionRecord) {
  await checked(
    supabase.from("ai_decisions").upsert({
      id: decision.id,
      tenant_id: decision.tenantId,
      conversation_id: decision.conversationId,
      client_id: decision.clientId,
      mode: decision.mode,
      ai_status: decision.aiStatus,
      persona_id: decision.personaId,
      risk: decision.risk,
      model: decision.model,
      prompt_version: decision.promptVersion,
      provider_attempted: decision.providerAttempted,
      provider_id: decision.providerId,
      provider_status: decision.providerStatus,
      provider_error_code: decision.providerErrorCode,
      send_status: decision.sendStatus,
      context_manifest: decision.contextManifest,
      provider_output_safety: decision.providerOutputSafety,
      token_budget: decision.tokenBudget,
      action: decision.action,
      blocked_reason: decision.blockedReason,
      quality_issues: decision.qualityIssues,
      reasons: decision.reasons,
      conversation_revision_at_generation: decision.conversationRevisionAtGeneration ?? null,
      created_at: decision.createdAt,
    }),
  );
}

async function insertRiskAssessment(supabase: SupabaseClient, riskAssessment: RiskAssessmentRecord) {
  await checked(
    supabase.from("risk_assessments").upsert(
      {
        id: riskAssessment.id,
        tenant_id: riskAssessment.tenantId,
        conversation_id: riskAssessment.conversationId,
        message_id: riskAssessment.messageId,
        level: riskAssessment.level,
        reasons: riskAssessment.reasons,
        classifier_version: riskAssessment.classifierVersion,
        created_at: riskAssessment.createdAt,
      },
      { onConflict: "message_id" },
    ),
  );
}

async function insertAudit(supabase: SupabaseClient, audit: AuditEventRecord) {
  await checked(
    supabase.from("audit_events").insert({
      id: audit.id,
      tenant_id: audit.tenantId,
      actor_type: "system",
      event_type: audit.eventType,
      entity_type: audit.entityType,
      entity_id: audit.entityId,
      metadata: audit.metadata,
      created_at: audit.createdAt,
    }),
  );
}

async function persistNewAudits(supabase: SupabaseClient, before: ManuAppState, after: ManuAppState) {
  const beforeAudits = new Set(before.auditEvents.map((audit) => audit.id));
  for (const audit of after.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }
}

async function upsertVoiceSample(supabase: SupabaseClient, sample: DietitianVoiceSampleRecord) {
  await checked(
    supabase.from("dietitian_voice_samples").upsert({
      id: sample.id,
      tenant_id: sample.tenantId,
      dietitian_id: sample.dietitianId,
      body: sample.body,
      body_hash: sample.bodyHash,
      status: sample.status,
      created_at: sample.createdAt,
    }),
  );
}

async function upsertVoiceProfile(supabase: SupabaseClient, profile: DietitianVoiceProfileRecord) {
  await checked(
    supabase.from("dietitian_voice_profiles").upsert(
      {
        id: profile.id,
        tenant_id: profile.tenantId,
        dietitian_id: profile.dietitianId,
        status: profile.status,
        profile_version: profile.profileVersion,
        average_message_chars: profile.averageMessageChars,
        formality: profile.formality,
        emoji_policy: profile.emojiPolicy,
        common_greetings: profile.commonGreetings,
        common_closings: profile.commonClosings,
        style_notes: profile.styleNotes,
        sample_count: profile.sampleCount,
        source_sample_ids: profile.sourceSampleIds,
        generated_at: profile.generatedAt,
        updated_at: profile.updatedAt,
      },
      { onConflict: "tenant_id,dietitian_id" },
    ),
  );
}

async function upsertFormSchema(supabase: SupabaseClient, schema: ClientFormSchemaRecord) {
  await checked(
    supabase.from("client_form_schemas").upsert({
      id: schema.id,
      tenant_id: schema.tenantId,
      title: schema.title,
      language_code: schema.languageCode,
      version: schema.version,
      status: schema.status,
      fields: schema.fields,
      created_at: schema.createdAt,
      published_at: schema.publishedAt,
    }),
  );
}

async function upsertDietitianFormSchema(
  supabase: SupabaseClient,
  schema: DietitianFormSchemaRecord,
  dietitianId: string,
) {
  await checked(
    supabase.from("dietitian_form_schemas").upsert({
      id: schema.id,
      tenant_id: schema.tenantId,
      dietitian_id: dietitianId,
      title: schema.title,
      language_code: schema.languageCode,
      version: schema.version,
      status: schema.status,
      fields: schema.fields,
      registry_version: schema.registryVersion ?? null,
      created_at: schema.createdAt,
      published_at: schema.publishedAt,
    }),
  );
}

async function upsertDietitianFormResponse(supabase: SupabaseClient, response: DietitianFormResponseRecord) {
  await checked(
    supabase.from("dietitian_form_responses").upsert(
      {
        id: response.id,
        tenant_id: response.tenantId,
        dietitian_id: response.dietitianId,
        schema_id: response.schemaId,
        schema_version: response.schemaVersion,
        schema_snapshot: response.schemaSnapshot,
        language_code: response.languageCode,
        answers: response.answers,
        created_at: response.createdAt,
        updated_at: response.updatedAt,
      },
      { onConflict: "tenant_id,dietitian_id,schema_id" },
    ),
  );
}

async function insertDataRequest(supabase: SupabaseClient, request: DataRequestRecord) {
  await checked(
    supabase.from("data_requests").insert({
      id: request.id,
      tenant_id: request.tenantId,
      client_id: request.clientId,
      request_type: request.requestType,
      status: request.status,
      requested_by_dietitian_id: request.requestedByDietitianId,
      completed_at: request.completedAt,
      created_at: request.createdAt,
    }),
  );
}

async function insertInternalCopilotMessage(supabase: SupabaseClient, message: InternalCopilotMessageRecord) {
  await checked(
    supabase.from("internal_copilot_messages").insert({
      id: message.id,
      tenant_id: message.tenantId,
      dietitian_id: message.dietitianId,
      role: message.role,
      body: message.body,
      source_refs: message.sourceRefs,
      tool_call_ids: message.toolCallIds,
      safety_status: message.safetyStatus,
      created_at: message.createdAt,
    }),
  );
}

async function insertInternalCopilotToolCall(supabase: SupabaseClient, call: InternalCopilotToolCallRecord) {
  await checked(
    supabase.from("internal_copilot_tool_calls").insert({
      id: call.id,
      tenant_id: call.tenantId,
      dietitian_id: call.dietitianId,
      tool_name: call.toolName,
      arguments: call.arguments,
      status: call.status,
      source_refs: call.sourceRefs,
      result_summary: call.resultSummary,
      created_at: call.createdAt,
    }),
  );
}

function readProfileDataArray(profile: DbClientFoodRuleProfile, key: string) {
  const value = profile.profile_data?.[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function readProfileDataMap(profile: DbClientFoodRuleProfile, key: string) {
  const value = profile.profile_data?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [entryKey, String(entryValue)]),
  ) as Record<string, Phase77EFlexibilityLevel>;
}

function serializeClientFoodRuleProfileData(profile: ClientFoodRuleProfileV2Record) {
  return {
    allowedCatalogMainCategoryIds: profile.allowedCatalogMainCategoryIds,
    allowedCatalogSubCategoryIds: profile.allowedCatalogSubCategoryIds,
    allowedCatalogFoodIds: profile.allowedCatalogFoodIds,
    forbiddenCatalogMainCategoryIds: profile.forbiddenCatalogMainCategoryIds,
    forbiddenCatalogSubCategoryIds: profile.forbiddenCatalogSubCategoryIds,
    forbiddenCatalogFoodIds: profile.forbiddenCatalogFoodIds,
    allowedFoodGroups: profile.allowedFoodGroups,
    forbiddenFoodGroups: profile.forbiddenFoodGroups,
    freeTextAllowedFoods: profile.freeTextAllowedFoods,
    freeTextForbiddenFoods: profile.freeTextForbiddenFoods,
    forbiddenIngredientKeywords: profile.forbiddenIngredientKeywords,
    dietTypeRestrictions: profile.dietTypeRestrictions,
    flexibilityGlobal: profile.flexibilityGlobal,
    flexibilityByMeal: profile.flexibilityByMeal,
    flexibilityByGoal: profile.flexibilityByGoal,
    flexibilityByFoodGroup: profile.flexibilityByFoodGroup,
  };
}

function mapClientFoodRuleProfile(profile: DbClientFoodRuleProfile): ClientFoodRuleProfileV2Record {
  return {
    id: profile.id,
    tenantId: profile.tenant_id,
    clientId: profile.client_id,
    dietitianId: profile.dietitian_id,
    version: profile.version,
    status: profile.status,
    revision: profile.revision,
    allowedCatalogMainCategoryIds: readProfileDataArray(profile, "allowedCatalogMainCategoryIds"),
    allowedCatalogSubCategoryIds: readProfileDataArray(profile, "allowedCatalogSubCategoryIds"),
    allowedCatalogFoodIds: readProfileDataArray(profile, "allowedCatalogFoodIds"),
    forbiddenCatalogMainCategoryIds: readProfileDataArray(profile, "forbiddenCatalogMainCategoryIds"),
    forbiddenCatalogSubCategoryIds: readProfileDataArray(profile, "forbiddenCatalogSubCategoryIds"),
    forbiddenCatalogFoodIds: readProfileDataArray(profile, "forbiddenCatalogFoodIds"),
    allowedFoodGroups: readProfileDataArray(profile, "allowedFoodGroups"),
    forbiddenFoodGroups: readProfileDataArray(profile, "forbiddenFoodGroups"),
    freeTextAllowedFoods: readProfileDataArray(profile, "freeTextAllowedFoods"),
    freeTextForbiddenFoods: readProfileDataArray(profile, "freeTextForbiddenFoods"),
    forbiddenIngredientKeywords: readProfileDataArray(profile, "forbiddenIngredientKeywords"),
    dietTypeRestrictions: readProfileDataArray(profile, "dietTypeRestrictions"),
    flexibilityGlobal: (profile.profile_data?.flexibilityGlobal as Phase77EFlexibilityLevel) || "moderate",
    flexibilityByMeal: readProfileDataMap(profile, "flexibilityByMeal"),
    flexibilityByGoal: readProfileDataMap(profile, "flexibilityByGoal"),
    flexibilityByFoodGroup: readProfileDataMap(profile, "flexibilityByFoodGroup"),
    notes: profile.notes || "",
    migratedFromLegacy76d: profile.migrated_from_legacy_76d,
    catalogVersion: profile.catalog_version,
    catalogSourceSha256: profile.catalog_source_sha256,
    catalogRecordSetSha256: profile.catalog_record_set_sha256,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    publishedAt: profile.published_at,
  };
}

function readMenuPlanDataArray(plan: DbClientMenuPlan, key: string) {
  const value = plan.plan_data?.[key];
  return Array.isArray(value) ? value.map(String) : [];
}

function serializeClientMenuPlanData(plan: ClientMenuPlanV1Record) {
  return {
    mealSlots: plan.mealSlots,
    preferredFoods: plan.preferredFoods,
    avoidFoods: plan.avoidFoods,
    dietitianNotes: plan.dietitianNotes,
    clientFacingNotes: plan.clientFacingNotes,
  };
}

function mapClientMenuPlan(plan: DbClientMenuPlan): ClientMenuPlanV1Record {
  const mealSlots = Array.isArray(plan.plan_data?.mealSlots)
    ? (plan.plan_data.mealSlots as ClientMenuPlanV1Record["mealSlots"])
    : [];

  return {
    id: plan.id,
    tenantId: plan.tenant_id,
    clientId: plan.client_id,
    dietitianId: plan.dietitian_id,
    templateType: plan.template_type,
    status: plan.status,
    version: plan.version,
    revision: plan.revision,
    title: plan.title || "",
    effectiveDate: plan.effective_date,
    mealSlots,
    preferredFoods: readMenuPlanDataArray(plan, "preferredFoods"),
    avoidFoods: readMenuPlanDataArray(plan, "avoidFoods"),
    dietitianNotes: String(plan.plan_data?.dietitianNotes || ""),
    clientFacingNotes: String(plan.plan_data?.clientFacingNotes || ""),
    exportVisible: plan.export_visible,
    migratedFromLegacyDietPlan: plan.migrated_from_legacy_diet_plan,
    catalogVersion: plan.catalog_version,
    catalogSourceSha256: plan.catalog_source_sha256,
    catalogRecordSetSha256: plan.catalog_record_set_sha256,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    activatedAt: plan.activated_at,
  };
}

async function upsertClientMenuPlan(supabase: SupabaseClient, plan: ClientMenuPlanV1Record) {
  await checked(
    supabase.from("client_menu_plans").upsert({
      id: plan.id,
      tenant_id: plan.tenantId,
      client_id: plan.clientId,
      dietitian_id: plan.dietitianId,
      template_type: plan.templateType,
      status: plan.status,
      version: plan.version,
      revision: plan.revision,
      title: plan.title,
      effective_date: plan.effectiveDate,
      plan_data: serializeClientMenuPlanData(plan),
      catalog_version: plan.catalogVersion,
      catalog_source_sha256: plan.catalogSourceSha256,
      catalog_record_set_sha256: plan.catalogRecordSetSha256,
      migrated_from_legacy_diet_plan: plan.migratedFromLegacyDietPlan,
      export_visible: plan.exportVisible,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt,
      activated_at: plan.activatedAt,
    }),
  );
}

async function upsertClientFoodRuleProfile(supabase: SupabaseClient, profile: ClientFoodRuleProfileV2Record) {
  await checked(
    supabase.from("client_food_rule_profiles").upsert(
      {
        id: profile.id,
        tenant_id: profile.tenantId,
        client_id: profile.clientId,
        dietitian_id: profile.dietitianId,
        version: profile.version,
        status: profile.status,
        revision: profile.revision,
        profile_data: serializeClientFoodRuleProfileData(profile),
        catalog_version: profile.catalogVersion,
        catalog_source_sha256: profile.catalogSourceSha256,
        catalog_record_set_sha256: profile.catalogRecordSetSha256,
        migrated_from_legacy_76d: profile.migratedFromLegacy76d,
        notes: profile.notes,
        created_at: profile.createdAt,
        updated_at: profile.updatedAt,
        published_at: profile.publishedAt,
      },
      { onConflict: "tenant_id,client_id" },
    ),
  );
}

async function upsertClientUpdateProposal(supabase: SupabaseClient, proposal: ClientUpdateProposalRecord) {
  await checked(
    supabase.from("client_update_proposals").upsert({
      id: proposal.id,
      tenant_id: proposal.tenantId,
      client_id: proposal.clientId,
      dietitian_id: proposal.dietitianId,
      source_text: proposal.sourceText,
      proposed_patches: proposal.proposedPatches,
      safety_flags: proposal.safetyFlags,
      status: proposal.status,
      expected_context_revision: proposal.expectedContextRevision,
      created_at: proposal.createdAt,
      resolved_at: proposal.resolvedAt,
    }),
  );
}

function remapSeedIds(state: ManuAppState): ManuAppState {
  const clientMap = new Map(state.clients.map((client, index) => [client.id, DEMO_CLIENT_IDS[index]]));
  const conversationMap = new Map(
    state.conversations.map((conversation, index) => [
      conversation.id,
      `00000000-0000-4000-8000-00000000002${index + 1}`,
    ]),
  );
  const messageMap = new Map([
    ["message-seed-1", "00000000-0000-4000-8000-000000000031"],
    ["message-seed-2", "00000000-0000-4000-8000-000000000032"],
  ]);
  const decisionMap = new Map([["decision-seed-1", "00000000-0000-4000-8000-000000000041"]]);
  const riskAssessmentMap = new Map([["risk-assessment-seed-1", "00000000-0000-4000-8000-000000000051"]]);

  return {
    ...state,
    tenant: { ...state.tenant, id: DEMO_TENANT_UUID },
    dietitian: { ...state.dietitian, id: DEMO_DIETITIAN_UUID, tenantId: DEMO_TENANT_UUID },
    voiceSamples: state.voiceSamples.map((sample) => ({
      ...sample,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
    })),
    voiceProfiles: state.voiceProfiles.map((profile) => ({
      ...profile,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
    })),
    clientFormSchemas: state.clientFormSchemas.map((schema) => ({ ...schema, tenantId: DEMO_TENANT_UUID })),
    clientFormResponses: state.clientFormResponses.map((response) => ({
      ...response,
      tenantId: DEMO_TENANT_UUID,
      clientId: clientMap.get(response.clientId) || response.clientId,
      schemaSnapshot: { ...response.schemaSnapshot, tenantId: DEMO_TENANT_UUID },
    })),
    dietitianFormSchemas: state.dietitianFormSchemas.map((schema) => ({ ...schema, tenantId: DEMO_TENANT_UUID })),
    dietitianFormResponses: state.dietitianFormResponses.map((response) => ({
      ...response,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
      schemaSnapshot: { ...response.schemaSnapshot, tenantId: DEMO_TENANT_UUID },
    })),
    clientContextUpdates: state.clientContextUpdates.map((update) => ({
      ...update,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
      clientId: clientMap.get(update.clientId) || update.clientId,
    })),
    clientFoodRuleProfiles: state.clientFoodRuleProfiles.map((profile) => ({
      ...profile,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
      clientId: clientMap.get(profile.clientId) || profile.clientId,
    })),
    clientMenuPlans: state.clientMenuPlans.map((plan) => ({
      ...plan,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
      clientId: clientMap.get(plan.clientId) || plan.clientId,
    })),
    clients: state.clients.map((client) => ({
      ...client,
      id: clientMap.get(client.id) || client.id,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
    })),
    conversations: state.conversations.map((conversation) => ({
      ...conversation,
      id: conversationMap.get(conversation.id) || conversation.id,
      tenantId: DEMO_TENANT_UUID,
      dietitianId: DEMO_DIETITIAN_UUID,
      clientId: clientMap.get(conversation.clientId) || conversation.clientId,
    })),
    messages: state.messages.map((message) => ({
      ...message,
      id: messageMap.get(message.id) || message.id,
      tenantId: DEMO_TENANT_UUID,
      conversationId: conversationMap.get(message.conversationId) || message.conversationId,
      sourceMessageId: message.sourceMessageId ? messageMap.get(message.sourceMessageId) : message.sourceMessageId,
      generatedByAiDecisionId: message.generatedByAiDecisionId
        ? decisionMap.get(message.generatedByAiDecisionId)
        : message.generatedByAiDecisionId,
    })),
    aiDecisions: state.aiDecisions.map((decision) => ({
      ...decision,
      id: decisionMap.get(decision.id) || decision.id,
      tenantId: DEMO_TENANT_UUID,
      clientId: clientMap.get(decision.clientId) || decision.clientId,
      conversationId: conversationMap.get(decision.conversationId) || decision.conversationId,
    })),
    riskAssessments: state.riskAssessments.map((riskAssessment) => ({
      ...riskAssessment,
      id: riskAssessmentMap.get(riskAssessment.id) || riskAssessment.id,
      tenantId: DEMO_TENANT_UUID,
      conversationId: conversationMap.get(riskAssessment.conversationId) || riskAssessment.conversationId,
      messageId: messageMap.get(riskAssessment.messageId) || riskAssessment.messageId,
    })),
  };
}

function mapVoiceSample(sample: DbVoiceSample): DietitianVoiceSampleRecord {
  return {
    id: sample.id,
    tenantId: sample.tenant_id,
    dietitianId: sample.dietitian_id,
    body: sample.body,
    bodyHash: sample.body_hash,
    status: sample.status,
    createdAt: sample.created_at,
  };
}

function mapVoiceProfile(profile: DbVoiceProfile): DietitianVoiceProfileRecord {
  return {
    id: profile.id,
    tenantId: profile.tenant_id,
    dietitianId: profile.dietitian_id,
    status: profile.status || "generated",
    profileVersion: profile.profile_version || 1,
    averageMessageChars: profile.average_message_chars,
    formality: profile.formality,
    emojiPolicy: profile.emoji_policy,
    commonGreetings: profile.common_greetings || [],
    commonClosings: profile.common_closings || [],
    styleNotes: profile.style_notes || "",
    sampleCount: profile.sample_count || 0,
    sourceSampleIds: profile.source_sample_ids || [],
    generatedAt: profile.generated_at,
    updatedAt: profile.updated_at,
  };
}

function mapFormSchema(schema: DbFormSchema): ClientFormSchemaRecord {
  return {
    id: schema.id,
    tenantId: schema.tenant_id,
    title: schema.title,
    languageCode: normalizeLanguageCode(schema.language_code),
    version: schema.version,
    status: schema.status,
    fields: schema.fields || [],
    createdAt: schema.created_at,
    publishedAt: schema.published_at,
  };
}

function mapFormResponse(response: DbFormResponse): ClientFormResponseRecord {
  return {
    id: response.id,
    tenantId: response.tenant_id,
    clientId: response.client_id,
    schemaId: response.schema_id,
    schemaVersion: response.schema_version,
    schemaSnapshot: response.schema_snapshot,
    languageCode: normalizeLanguageCode(response.language_code),
    submittedPhoneE164: response.submitted_phone_e164 || null,
    answers: response.answers || {},
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapDietitianFormSchema(schema: DbDietitianFormSchema): DietitianFormSchemaRecord {
  return {
    id: schema.id,
    tenantId: schema.tenant_id,
    title: schema.title,
    languageCode: normalizeLanguageCode(schema.language_code),
    version: schema.version,
    status: schema.status,
    fields: schema.fields || [],
    createdAt: schema.created_at,
    publishedAt: schema.published_at,
    registryVersion: schema.registry_version,
  };
}

function mapDietitianFormResponse(response: DbDietitianFormResponse): DietitianFormResponseRecord {
  return {
    id: response.id,
    tenantId: response.tenant_id,
    dietitianId: response.dietitian_id,
    schemaId: response.schema_id,
    schemaVersion: response.schema_version,
    schemaSnapshot: response.schema_snapshot,
    languageCode: normalizeLanguageCode(response.language_code),
    answers: response.answers || {},
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
}

function mapClientContextUpdate(update: DbClientContextUpdate): ClientContextUpdateRecord {
  return {
    id: update.id,
    tenantId: update.tenant_id,
    clientId: update.client_id,
    dietitianId: update.dietitian_id,
    source: update.source,
    occurredAt: update.occurred_at,
    title: update.title,
    summary: update.summary,
    details: update.details || "",
    importance: update.importance,
    status: update.status,
    supersedesUpdateId: update.supersedes_update_id,
    createdAt: update.created_at,
  };
}

function mapClientUpdateProposal(proposal: DbClientUpdateProposal): ClientUpdateProposalRecord {
  return {
    id: proposal.id,
    tenantId: proposal.tenant_id,
    clientId: proposal.client_id,
    dietitianId: proposal.dietitian_id,
    sourceText: proposal.source_text,
    proposedPatches: proposal.proposed_patches || [],
    safetyFlags: proposal.safety_flags || [],
    status: proposal.status,
    expectedContextRevision: proposal.expected_context_revision,
    createdAt: proposal.created_at,
    resolvedAt: proposal.resolved_at,
  };
}

function mapClient(client: DbClient, channels: DbChannel[]): ClientRecord {
  const channel = channels.find((item) => item.client_id === client.id);
  return {
    id: client.id,
    tenantId: client.tenant_id,
    dietitianId: client.dietitian_id,
    lifecycleStatus: client.lifecycle_status === "removed_anonymized" ? "removed_anonymized" : "active",
    removedAt: client.removed_at,
    fullName: client.full_name,
    primaryPhoneE164: client.primary_phone_e164 || null,
    communicationLanguage: normalizeLanguageCode(client.communication_language || client.health_profile?.preferredLanguage),
    selectedPersonaId: client.selected_persona_id,
    aiStatus: client.ai_status,
    aiMode: client.ai_mode,
    aiActiveFrom: client.ai_active_from,
    aiActiveUntil: client.ai_active_until,
    healthProfile: client.health_profile || {},
    dietPlan: client.diet_plan || {},
    allergies: client.allergies || [],
    restrictedFoods: client.restricted_foods || [],
    clinicalRiskNotes: client.clinical_risk_notes || [],
    pinnedNotes: client.pinned_notes || [],
    channel: channel?.channel || "whatsapp",
    channelUserId: channel?.display_handle || channel?.channel_user_id || "",
    channelPermission: client.channel_permission,
    mandatorySafetyComplete: client.mandatory_safety_complete,
    safetyChecklist: normalizeSafetyChecklist(client.safety_checklist),
    humanTakeoverLocked: client.human_takeover_locked,
    redRiskLock: normalizeRedRiskLock(client.red_risk_lock),
    yellowRiskHold: normalizeYellowRiskHold(client.yellow_risk_hold),
    contextRevision: client.context_revision || 1,
    createdAt: client.created_at,
  };
}

function normalizeRedRiskLock(value: unknown): ClientRecord["redRiskLock"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "none" };
  }

  const lock = value as Record<string, unknown>;
  const status = lock.status;
  if (status !== "locked" && status !== "reactivated") {
    return { status: "none" };
  }

  const handoffId = typeof lock.handoffId === "string" ? lock.handoffId : "";
  const lockedAt = typeof lock.lockedAt === "string" ? lock.lockedAt : "";
  if (!handoffId || !lockedAt) {
    return { status: "none" };
  }

  const previousAiStatus: ClientRecord["aiStatus"] =
    lock.previousAiStatus === "active" || lock.previousAiStatus === "passive"
      ? lock.previousAiStatus
      : "passive";
  const previousAiMode: ClientRecord["aiMode"] =
    lock.previousAiMode === "autopilot" ||
    lock.previousAiMode === "copilot" ||
    lock.previousAiMode === "manual" ||
    lock.previousAiMode === "paused"
      ? lock.previousAiMode
      : "manual";
  const base = {
    handoffId,
    lockedAt,
    reasons: Array.isArray(lock.reasons) ? lock.reasons.filter((item): item is string => typeof item === "string") : [],
    previousAiStatus,
    previousAiMode,
  };

  if (status === "locked") {
    return { status, ...base };
  }

  return {
    status,
    ...base,
    reactivatedAt: typeof lock.reactivatedAt === "string" ? lock.reactivatedAt : lockedAt,
    reactivatedByDietitianId:
      typeof lock.reactivatedByDietitianId === "string" ? lock.reactivatedByDietitianId : "",
    reactivationReason: typeof lock.reactivationReason === "string" ? lock.reactivationReason : "",
    reactivatedAiMode: lock.reactivatedAiMode === "autopilot" ? "autopilot" : "copilot",
  };
}

function normalizeYellowRiskHold(value: unknown): ClientRecord["yellowRiskHold"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { status: "none" };
  }

  const hold = value as Record<string, unknown>;
  if (hold.status !== "active") {
    return { status: "none" };
  }

  const firstMessageId = typeof hold.firstMessageId === "string" ? hold.firstMessageId : "";
  const latestMessageId = typeof hold.latestMessageId === "string" ? hold.latestMessageId : "";
  const startedAt = typeof hold.startedAt === "string" ? hold.startedAt : "";
  if (!firstMessageId || !latestMessageId || !startedAt) {
    return { status: "none" };
  }

  const previousAiStatus: ClientRecord["aiStatus"] =
    hold.previousAiStatus === "active" || hold.previousAiStatus === "passive"
      ? hold.previousAiStatus
      : "active";
  const previousAiMode: ClientRecord["aiMode"] =
    hold.previousAiMode === "autopilot" ||
    hold.previousAiMode === "copilot" ||
    hold.previousAiMode === "manual" ||
    hold.previousAiMode === "paused"
      ? hold.previousAiMode
      : "autopilot";

  return {
    status: "active",
    startedAt,
    firstMessageId,
    latestMessageId,
    activeDraftMessageId:
      typeof hold.activeDraftMessageId === "string" ? hold.activeDraftMessageId : null,
    activeDecisionId: typeof hold.activeDecisionId === "string" ? hold.activeDecisionId : null,
    messageIds: Array.isArray(hold.messageIds)
      ? hold.messageIds.filter((item): item is string => typeof item === "string")
      : [firstMessageId],
    reasons: Array.isArray(hold.reasons)
      ? hold.reasons.filter((item): item is string => typeof item === "string")
      : [],
    previousAiStatus,
    previousAiMode,
    blockedByRedHandoffId:
      typeof hold.blockedByRedHandoffId === "string" ? hold.blockedByRedHandoffId : null,
  };
}

function mapConversation(conversation: DbConversation, memories: DbMemory[]): ConversationRecord {
  const memory = memories.find((item) => item.conversation_id === conversation.id);
  return {
    id: conversation.id,
    tenantId: conversation.tenant_id,
    dietitianId: conversation.dietitian_id,
    clientId: conversation.client_id,
    channel: conversation.channel,
    rollingSummary: memory?.rolling_summary || "",
    memoryVersion: memory?.memory_version || "memory-v1",
    memoryRevision: memory?.memory_revision || 1,
    memoryStale: memory?.stale || false,
    revision: Number((conversation as DbConversation & { revision?: number }).revision ?? 1),
  };
}

function mapMessage(message: DbMessage): MessageRecord {
  return {
    id: message.id,
    tenantId: message.tenant_id,
    conversationId: message.conversation_id,
    sender: message.sender,
    body: message.body,
    origin: message.origin,
    providerAccountBindingId: message.provider_account_binding_id ?? null,
    providerEventId: message.provider_event_id ?? null,
    providerMessageId: message.provider_message_id ?? null,
    actorType: message.actor_type ?? null,
    actorBindingId: message.actor_binding_id ?? null,
    authorInterface: message.author_interface ?? null,
    actorResolutionBasis: message.actor_resolution_basis ?? null,
    sourceMessageId: message.source_message_id,
    authorDietitianId: message.author_dietitian_id,
    generatedByAiDecisionId: message.generated_by_ai_decision_id,
    approvedByDietitianId: message.approved_by_dietitian_id,
    providerSentAt: message.provider_sent_at ?? null,
    observedAt: message.observed_at ?? null,
    persistedAt: message.persisted_at ?? message.created_at,
    conversationSequence: message.conversation_sequence ?? null,
    contentStatus: message.content_status ?? "available",
    retrievalEligibility: message.retrieval_eligibility ?? "eligible",
    risk: message.risk,
    status: message.status,
    createdAt: message.created_at,
  };
}

function mapHistoricalSearchRowToMessage(
  row: SupabaseConversationMessageSearchRow,
  tenantId: string,
  conversationId: string,
): MessageRecord {
  const candidate = mapSupabaseSearchRowToRetrievalCandidate(row, tenantId, conversationId);
  return {
    id: candidate.id,
    tenantId,
    conversationId,
    sender: candidate.sender || "client",
    body: candidate.body,
    origin: candidate.origin,
    actorType: candidate.actorType ?? null,
    actorResolutionBasis: candidate.actorResolutionBasis ?? null,
    providerSentAt: candidate.providerSentAt ?? null,
    conversationSequence: candidate.conversationSequence ?? null,
    contentStatus: candidate.contentStatus ?? "available",
    retrievalEligibility: candidate.retrievalEligibility ?? "eligible",
    status: candidate.status,
    createdAt: candidate.createdAt,
  };
}

function mapDecision(decision: DbDecision): AiDecisionRecord {
  return {
    id: decision.id,
    tenantId: decision.tenant_id,
    conversationId: decision.conversation_id,
    clientId: decision.client_id,
    mode: decision.mode,
    aiStatus: decision.ai_status,
    personaId: decision.persona_id,
    risk: decision.risk,
    model: decision.model,
    promptVersion: decision.prompt_version || null,
    providerAttempted: decision.provider_attempted || false,
    providerId: decision.provider_id || null,
    providerStatus: decision.provider_status || "not_called",
    providerErrorCode: decision.provider_error_code || null,
    sendStatus: decision.send_status || "not_called",
    contextManifest: decision.context_manifest || null,
    providerOutputSafety: decision.provider_output_safety || null,
    tokenBudget: decision.token_budget || null,
    action: decision.action,
    blockedReason: decision.blocked_reason,
    qualityIssues: decision.quality_issues || [],
    reasons: decision.reasons || [],
    createdAt: decision.created_at,
  };
}

function mapRiskAssessment(riskAssessment: DbRiskAssessment): RiskAssessmentRecord {
  return {
    id: riskAssessment.id,
    tenantId: riskAssessment.tenant_id,
    conversationId: riskAssessment.conversation_id,
    messageId: riskAssessment.message_id,
    level: riskAssessment.level,
    reasons: riskAssessment.reasons || [],
    classifierVersion: riskAssessment.classifier_version,
    createdAt: riskAssessment.created_at,
  };
}

function mapHandoff(handoff: DbHandoff): HandoffCaseRecord {
  return {
    id: handoff.id,
    tenantId: handoff.tenant_id,
    dietitianId: handoff.dietitian_id,
    clientId: handoff.client_id,
    conversationId: handoff.conversation_id,
    triggeringMessageId: handoff.triggering_message_id,
    risk: handoff.risk,
    reasons: handoff.reasons || [],
    status: handoff.status,
    urgency: handoff.urgency,
    safeAcknowledgement: handoff.safe_acknowledgement,
    recommendedAction: handoff.recommended_action,
    createdAt: handoff.created_at,
  };
}

function mapAuditEvent(audit: DbAudit): AuditEventRecord {
  return {
    id: audit.id,
    tenantId: audit.tenant_id,
    eventType: audit.event_type,
    entityType: audit.entity_type,
    entityId: audit.entity_id,
    metadata: audit.metadata || {},
    createdAt: audit.created_at,
  };
}

function mapNotification(notification: DbNotification): NotificationRecord {
  return {
    id: notification.id,
    tenantId: notification.tenant_id,
    type: notification.type,
    kind: notification.kind,
    priority: notification.priority,
    entityType: notification.entity_type,
    entityId: notification.entity_id,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    acknowledgedAt: notification.acknowledged_at,
    dedupeKey: notification.dedupe_key,
    sourceMessageId: notification.source_message_id,
    targetPanel: notification.target_panel,
    baselineRevision: notification.baseline_revision,
    resolvedAt: notification.resolved_at,
    resolvedByDietitianId: notification.resolved_by_dietitian_id,
    clientId: notification.client_id,
    conversationId: notification.conversation_id,
    messageId: notification.message_id,
    handoffId: notification.handoff_id,
    occurrenceCount: notification.occurrence_count,
    lastOccurredAt: notification.last_occurred_at,
    createdAt: notification.created_at,
  };
}

function mapNotificationReceipt(receipt: DbNotificationReceipt): NotificationReceiptRecord {
  return {
    tenantId: receipt.tenant_id,
    notificationId: receipt.notification_id,
    dietitianId: receipt.dietitian_id,
    readAt: receipt.read_at,
    acknowledgedAt: receipt.acknowledged_at,
    createdAt: receipt.created_at,
    updatedAt: receipt.updated_at,
  };
}

function buildDietitianRoleMap(
  dietitians: Array<{ id: string; auth_user_id: string | null }>,
  memberships: Array<{ user_id: string; role: string }>,
): Map<string, TenantRole> {
  const roleByUserId = new Map(memberships.map((membership) => [membership.user_id, membership.role as TenantRole]));
  return new Map(
    dietitians
      .filter((dietitian) => dietitian.auth_user_id)
      .map((dietitian) => [dietitian.id, roleByUserId.get(dietitian.auth_user_id!) ?? "dietitian"]),
  );
}

function mapConversationReadReceipt(
  receipt: DbConversationReadReceipt,
  dietitianRoleById: Map<string, TenantRole>,
): ConversationReadReceiptRecord {
  return {
    tenantId: receipt.tenant_id,
    conversationId: receipt.conversation_id,
    dietitianId: receipt.dietitian_id,
    actorRole: dietitianRoleById.get(receipt.dietitian_id) ?? "dietitian",
    lastReadSequence: Number(receipt.last_read_sequence),
    readAt: receipt.read_at,
    createdAt: receipt.created_at,
    updatedAt: receipt.updated_at,
  };
}

function mapInboundQuarantine(quarantine: DbInboundQuarantine): InboundQuarantineRecord {
  return {
    id: quarantine.id,
    tenantId: quarantine.tenant_id,
    channel: quarantine.channel,
    sourceConversationType: quarantine.source_conversation_type,
    sourceConversationId: quarantine.source_conversation_id,
    sourceMessageId: quarantine.source_message_id,
    senderChannelUserId: quarantine.sender_channel_user_id,
    reason: quarantine.reason,
    createdAt: quarantine.created_at,
  };
}

function mapChannelAccountBinding(binding: DbChannelAccountBinding): ChannelAccountBindingRecord {
  return {
    id: binding.id,
    tenantId: binding.tenant_id,
    provider: binding.provider,
    providerAccountId: binding.provider_account_id,
    wabaId: binding.waba_id,
    businessPhoneNumberId: binding.business_phone_number_id,
    normalizedDisplayNumber: binding.normalized_display_number,
    operatingMode: binding.operating_mode,
    lifecycleStatus: binding.lifecycle_status,
    attributionPolicy: binding.attribution_policy,
    verifiedAt: binding.verified_at,
    revokedAt: binding.revoked_at,
    createdByDietitianId: binding.created_by_dietitian_id,
    revokedByDietitianId: binding.revoked_by_dietitian_id,
    createdAt: binding.created_at,
    updatedAt: binding.updated_at,
  };
}

function mapChannelActorBinding(binding: DbChannelActorBinding): ChannelActorBindingRecord {
  return {
    id: binding.id,
    tenantId: binding.tenant_id,
    accountBindingId: binding.account_binding_id,
    dietitianId: binding.dietitian_id,
    actorType: binding.actor_type,
    attributionBasis: binding.attribution_basis,
    validFrom: binding.valid_from,
    validTo: binding.valid_to,
    verifiedAt: binding.verified_at,
    revokedAt: binding.revoked_at,
    createdByDietitianId: binding.created_by_dietitian_id,
    revokedByDietitianId: binding.revoked_by_dietitian_id,
    auditReasonCode: binding.audit_reason_code,
    createdAt: binding.created_at,
  };
}

function mapChannelEvent(event: DbChannelEvent): ChannelEventRecord {
  return {
    id: event.id,
    tenantId: event.tenant_id,
    accountBindingId: event.account_binding_id,
    eventKind: event.event_kind,
    processingStatus: event.processing_status,
    providerAccountId: event.provider_account_id,
    providerEventId: event.provider_event_id,
    providerMessageId: event.provider_message_id,
    fromIdentity: event.from_identity,
    toIdentity: event.to_identity,
    counterpartyIdentity: event.counterparty_identity,
    payloadDigest: event.payload_digest,
    payloadSchemaVersion: event.payload_schema_version,
    providerTime: event.provider_time,
    observedAt: event.observed_at,
    committedAt: event.committed_at,
    quarantineId: event.quarantine_id,
    replayOfEventId: event.replay_of_event_id,
    retryCount: event.retry_count,
    internalSequence: event.internal_sequence,
  };
}

function mapChannelMessageRevision(revision: DbChannelMessageRevision): ChannelMessageRevisionRecord {
  return {
    id: revision.id,
    tenantId: revision.tenant_id,
    messageId: revision.message_id,
    channelEventId: revision.channel_event_id,
    providerEventId: revision.provider_event_id,
    revisionAction: revision.revision_action,
    priorContentStatus: revision.prior_content_status,
    currentContentStatus: revision.current_content_status,
    priorBodyDigest: revision.prior_body_digest,
    currentBodyDigest: revision.current_body_digest,
    revisionSequence: revision.revision_sequence,
    providerTime: revision.provider_time,
    observedAt: revision.observed_at,
  };
}

function mapHumanControlSession(session: DbHumanControlSession): HumanControlSessionRecord {
  return {
    id: session.id,
    tenantId: session.tenant_id,
    clientId: session.client_id,
    conversationId: session.conversation_id,
    reason: session.reason,
    status: session.status,
    previousAiStatus: session.previous_ai_status,
    previousAiMode: session.previous_ai_mode,
    linkedHandoffId: session.linked_handoff_id,
    linkedYellowHoldMessageId: session.linked_yellow_hold_message_id,
    openedByMessageId: session.opened_by_message_id,
    latestHumanMessageId: session.latest_human_message_id,
    humanResponseObservedCount: session.human_response_observed_count,
    openedAt: session.opened_at,
    resolvedAt: session.resolved_at,
    reactivatedByDietitianId: session.reactivated_by_dietitian_id,
    reactivationReasonCode: session.reactivation_reason_code,
    restoredAiMode: session.restored_ai_mode,
  };
}

function mapRiskActivityEvent(event: DbRiskActivityEvent): RiskActivityEventRecord {
  return {
    id: event.id,
    tenantId: event.tenant_id,
    clientId: event.client_id,
    conversationId: event.conversation_id,
    humanControlSessionId: event.human_control_session_id,
    eventType: event.event_type,
    sourceMessageId: event.source_message_id,
    handoffId: event.handoff_id,
    aiDecisionId: event.ai_decision_id,
    metadata: event.metadata || {},
    createdAt: event.created_at,
  };
}

function mapContextIntakeProposal(proposal: DbContextIntakeProposal): ContextIntakeProposalRecord {
  return {
    id: proposal.id,
    tenantId: proposal.tenant_id,
    clientId: proposal.client_id,
    dietitianId: proposal.dietitian_id,
    sourceChannel: proposal.source_channel,
    intakeSource: proposal.intake_source || "other",
    sourceTextDigest: proposal.source_text_digest,
    sourceText: proposal.source_text,
    rawSourceReference: proposal.raw_source_reference,
    occurredAt: proposal.occurred_at,
    title: proposal.title,
    summary: proposal.summary,
    details: proposal.details,
    importance: proposal.importance,
    structuredImpactFlags: proposal.structured_impact_flags || [],
    baselineContextRevision: proposal.baseline_context_revision,
    baselineFormRevision: proposal.baseline_form_revision,
    baselineFoodRuleRevision: proposal.baseline_food_rule_revision,
    baselineMenuPlanRevision: proposal.baseline_menu_plan_revision,
    status: proposal.status,
    confirmationCount: proposal.confirmation_count,
    appliedContextUpdateId: proposal.applied_context_update_id,
    createdAt: proposal.created_at,
    updatedAt: proposal.updated_at,
    expiresAt: proposal.expires_at,
  };
}

function mapChannelDelivery(delivery: DbChannelDelivery): ChannelDeliveryRecord {
  return {
    id: delivery.id,
    tenantId: delivery.tenant_id,
    clientId: delivery.client_id,
    conversationId: delivery.conversation_id,
    messageId: delivery.message_id,
    channel: delivery.channel,
    direction: delivery.direction,
    mockProviderMessageId: delivery.mock_provider_message_id,
    deliveryStatus: delivery.delivery_status,
    failureCode: delivery.failure_code,
    createdAt: delivery.created_at,
    updatedAt: delivery.updated_at,
  };
}

function mapChannelAdapterRollbackControls(
  controls: DbChannelAdapterRollbackControls | null,
): ChannelAdapterRollbackControls {
  if (!controls) {
    return createDefaultChannelAdapterRollbackControls();
  }

  return {
    globalChannelAutomationDisabled: controls.global_channel_automation_disabled,
    tenantChannelAutomationDisabled: controls.tenant_channel_automation_disabled,
    disabledDietitianIds: controls.disabled_dietitian_ids || [],
    disabledClientIds: controls.disabled_client_ids || [],
  };
}

function mapDataRequest(request: DbDataRequest): DataRequestRecord {
  return {
    id: request.id,
    tenantId: request.tenant_id,
    clientId: request.client_id,
    requestType: request.request_type,
    status: request.status,
    requestedByDietitianId: request.requested_by_dietitian_id,
    completedAt: request.completed_at,
    createdAt: request.created_at,
  };
}

function mapInternalCopilotMessage(message: DbInternalCopilotMessage): InternalCopilotMessageRecord {
  return {
    id: message.id,
    tenantId: message.tenant_id,
    dietitianId: message.dietitian_id,
    role: message.role,
    body: message.body,
    sourceRefs: message.source_refs || [],
    toolCallIds: message.tool_call_ids || [],
    safetyStatus: message.safety_status,
    createdAt: message.created_at,
  };
}

function mapInternalCopilotToolCall(call: DbInternalCopilotToolCall): InternalCopilotToolCallRecord {
  return {
    id: call.id,
    tenantId: call.tenant_id,
    dietitianId: call.dietitian_id,
    toolName: call.tool_name,
    arguments: call.arguments || {},
    status: call.status,
    sourceRefs: call.source_refs || [],
    resultSummary: call.result_summary || "",
    createdAt: call.created_at,
  };
}

async function checked(result: PromiseLike<{ error: unknown }> | { error: unknown }) {
  const response = await result;
  throwIfError(response.error);
}

function throwIfError(error: unknown) {
  if (error) {
    throw error instanceof Error ? error : new Error(JSON.stringify(error));
  }
}

function demoTenantContext(): AppTenantContext {
  return {
    tenantId: DEMO_TENANT_UUID,
    dietitianId: DEMO_DIETITIAN_UUID,
    userId: DEMO_USER_UUID,
    role: "owner",
  };
}

function requireSupabase() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin client is not configured");
  }
  return supabase;
}
