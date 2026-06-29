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
  DietitianVoiceProfileRecord,
  DietitianVoiceSampleRecord,
  HandoffCaseRecord,
  InboundQuarantineRecord,
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
  VoiceSampleStatus,
} from "./types";
import { normalizeLanguageCode } from "./languages";
import { processWhatsAppMockWebhookInState } from "./whatsapp-mock-webhook";
import { createDefaultChannelAdapterRollbackControls } from "./channel-adapter-rollback";

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
  source_message_id: string | null;
  author_dietitian_id: string | null;
  generated_by_ai_decision_id: string | null;
  approved_by_dietitian_id: string | null;
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
  entity_type: string;
  entity_id: string;
  title: string;
  body: string;
  read: boolean;
  acknowledged_at: string | null;
  created_at: string;
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
    dataRequestsResult,
    internalCopilotMessagesResult,
    internalCopilotToolCallsResult,
    voiceSamplesResult,
    voiceProfilesResult,
    formSchemasResult,
    formResponsesResult,
    clientContextUpdatesResult,
    clientUpdateProposalsResult,
    clientFoodRuleProfilesResult,
    clientMenuPlansResult,
    inboundQuarantinesResult,
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
    supabase.from("data_requests").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("internal_copilot_messages").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("internal_copilot_tool_calls").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("dietitian_voice_samples").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("dietitian_voice_profiles").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("client_form_schemas").select("*").eq("tenant_id", context.tenantId).order("version"),
    supabase.from("client_form_responses").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("client_context_updates").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_update_proposals").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_food_rule_profiles").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("client_menu_plans").select("*").eq("tenant_id", context.tenantId).order("updated_at"),
    supabase.from("inbound_quarantines").select("*").eq("tenant_id", context.tenantId).order("created_at"),
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
  throwIfError(dataRequestsResult.error);
  throwIfError(internalCopilotMessagesResult.error);
  throwIfError(internalCopilotToolCallsResult.error);
  throwIfError(voiceSamplesResult.error);
  throwIfError(voiceProfilesResult.error);
  throwIfError(formSchemasResult.error);
  throwIfError(formResponsesResult.error);
  throwIfError(clientContextUpdatesResult.error);
  throwIfError(clientUpdateProposalsResult.error);
  throwIfError(clientFoodRuleProfilesResult.error);
  throwIfError(clientMenuPlansResult.error);
  throwIfError(inboundQuarantinesResult.error);
  throwIfError(channelDeliveriesResult.error);
  throwIfError(channelAdapterRollbackResult.error);
  throwIfError(auditEventsResult.error);
  throwIfError(processedEventsResult.error);

  const channels = channelsResult.data || [];
  const memories = memoriesResult.data || [];
  const scopedState = scopeSupabaseState(
    {
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
      dietitianFormSchemas: [],
      dietitianFormResponses: [],
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
      inboundQuarantines: (inboundQuarantinesResult.data || []).map(mapInboundQuarantine),
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
    },
    context,
    assignmentsResult.data || [],
  );

  return scopedState satisfies ManuAppState;
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

  const messages = rawMessages
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
      inboundQuarantines: [],
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
  const visibleInboundQuarantines =
    context.role === "owner" || context.role === "admin" || context.role === "dietitian"
      ? state.inboundQuarantines
      : [];
  const visibleInboundQuarantineIds = new Set(visibleInboundQuarantines.map((quarantine) => quarantine.id));
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
    notifications: state.notifications.filter(
      (notification) => notification.entityType === "handoff_case" && visibleHandoffIds.has(notification.entityId),
    ),
    inboundQuarantines: visibleInboundQuarantines,
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
        visibleInboundQuarantineIds.has(event.entityId) ||
        visibleChannelDeliveryIds.has(event.entityId) ||
        (canReadRollbackAudit && event.eventType === "channel_automation_rollback_updated"),
    ),
  };
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

export async function createSupabaseClientRecord(
  input: Pick<ClientRecord, "fullName" | "channel" | "channelUserId"> &
    Partial<Pick<ClientRecord, "primaryPhoneE164" | "communicationLanguage">>,
  context = demoTenantContext(),
) {
  const state = await loadSupabaseState(context);
  const next = createClientInState(state, input);
  const rawClient = next.clients[next.clients.length - 1];
  const client = { ...rawClient, tenantId: context.tenantId, dietitianId: context.dietitianId };
  const rawConversation = next.conversations.find((item) => item.clientId === rawClient.id);
  const conversation = rawConversation
    ? { ...rawConversation, tenantId: context.tenantId, dietitianId: context.dietitianId, clientId: client.id }
    : undefined;

  const supabase = requireSupabase();
  await insertClientBundle(supabase, client, conversation);
  return loadSupabaseState(context);
}

export async function patchSupabaseClientRecord(
  clientId: string,
  patch: Partial<ClientRecord>,
  context = demoTenantContext(),
) {
  const state = await loadSupabaseState(context);
  const next = patchClientInState(state, clientId, patch);
  const client = next.clients.find((item) => item.id === clientId);

  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }

  const supabase = requireSupabase();
  const beforeClient = state.clients.find((item) => item.id === clientId);
  await upsertClient(supabase, client, beforeClient);
  await upsertChannel(supabase, client);
  if (hasAiControlChange(beforeClient, client)) {
    await insertClientAiStatusEvent(supabase, beforeClient, client, context);
    await insertAudit(supabase, {
      id: crypto.randomUUID(),
      tenantId: context.tenantId,
      eventType: "client_ai_control_updated",
      entityType: "client",
      entityId: client.id,
      metadata: { source: "supabase_store" },
      createdAt: new Date().toISOString(),
    });
  }
  return loadSupabaseState(context);
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

export async function runSupabaseSimulation(request: SimulationRequest, context = demoTenantContext()) {
  const state =
    request.sourceConversationType === "group" || !request.clientId
      ? await loadSupabaseState(context)
      : await loadSupabaseClientOperationState(request.clientId, context, {
          processedEventId: request.idempotencyKey,
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
  const { error } = await requireSupabase()
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("tenant_id", context.tenantId);
  throwIfError(error);
  await assertSupabaseNotificationExists(notificationId, context);
  return loadSupabaseState(context);
}

export async function acknowledgeSupabaseNotification(notificationId: string, context = demoTenantContext()) {
  const { error } = await requireSupabase()
    .from("notifications")
    .update({ read: true, acknowledged_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("tenant_id", context.tenantId);
  throwIfError(error);
  await assertSupabaseNotificationExists(notificationId, context);
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

export async function runSupabaseInternalCopilotMessage(body: string, context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
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
    "dietitian_voice_samples",
    "internal_copilot_messages",
    "internal_copilot_tool_calls",
    "data_requests",
    "notifications",
    "channel_deliveries",
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
  const beforeMessagesById = new Map(before.messages.map((item) => [item.id, item]));
  const beforeDecisionsById = new Map(before.aiDecisions.map((item) => [item.id, item]));
  const beforeRiskAssessments = new Set(before.riskAssessments.map((item) => item.id));
  const beforeHandoffsById = new Map(before.handoffCases.map((item) => [item.id, item]));
  const beforeNotifications = new Set(before.notifications.map((item) => item.id));
  const beforeQuarantines = new Set(before.inboundQuarantines.map((item) => item.id));
  const beforeChannelDeliveries = new Set(before.channelDeliveries.map((item) => item.id));
  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));
  const beforeProcessed = new Set(before.processedSimulationKeys);
  const beforeFormResponsesById = new Map(before.clientFormResponses.map((item) => [item.id, item]));
  const beforeContextUpdatesById = new Map(before.clientContextUpdates.map((item) => [item.id, item]));
  const beforeProposalsById = new Map(before.clientUpdateProposals.map((item) => [item.id, item]));
  const beforeNotificationsById = new Map(before.notifications.map((item) => [item.id, item]));
  const changedClients = after.clients.filter((client) => {
    const beforeClient = beforeClientsById.get(client.id);
    return beforeClient && JSON.stringify(beforeClient) !== JSON.stringify(client);
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

  return {
    expectedClientRevisions: Object.fromEntries(
      changedClients.map((client) => [client.id, beforeClientsById.get(client.id)?.contextRevision || 1]),
    ),
    clients: changedClients.map(serializeClientForRpc),
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
    channelDeliveries: after.channelDeliveries
      .filter((item) => !beforeChannelDeliveries.has(item.id))
      .map(serializeChannelDeliveryForRpc),
    channelAdapterRollbackControls:
      JSON.stringify(before.channelAdapterRollback) === JSON.stringify(after.channelAdapterRollback)
        ? null
        : serializeChannelAdapterRollbackControlsForRpc(after.channelAdapterRollback),
    clientContextUpdates: after.clientContextUpdates
      .filter((item) => !beforeContextUpdatesById.has(item.id))
      .map(serializeClientContextUpdateForRpc),
    clientContextUpdateUpdates: changedContextUpdates.map(serializeClientContextUpdateUpdateForRpc),
    clientUpdateProposals: changedProposals.map(serializeClientUpdateProposalForRpc),
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
    createdAt: message.createdAt,
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
    entityType: notification.entityType,
    entityId: notification.entityId,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    acknowledgedAt: notification.acknowledgedAt,
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
      author_dietitian_id: message.authorDietitianId,
      generated_by_ai_decision_id: message.generatedByAiDecisionId,
      approved_by_dietitian_id: message.approvedByDietitianId,
      source_message_id: message.sourceMessageId,
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
    sourceMessageId: message.source_message_id,
    authorDietitianId: message.author_dietitian_id,
    generatedByAiDecisionId: message.generated_by_ai_decision_id,
    approvedByDietitianId: message.approved_by_dietitian_id,
    risk: message.risk,
    status: message.status,
    createdAt: message.created_at,
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
    entityType: notification.entity_type,
    entityId: notification.entity_id,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    acknowledgedAt: notification.acknowledged_at,
    createdAt: notification.created_at,
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

async function assertSupabaseNotificationExists(notificationId: string, context: AppTenantContext) {
  const result = await requireSupabase()
    .from("notifications")
    .select("id")
    .eq("id", notificationId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();
  throwIfError(result.error);

  if (!result.data) {
    throw new AppDomainError(404, "notification_not_found");
  }
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
