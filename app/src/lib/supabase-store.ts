import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import { createInitialState } from "./seed-data";
import { isSafetyChecklistComplete, normalizeSafetyChecklist } from "./safety-checklist";
import { anonymizeClientInState, buildClientScopedExport } from "./data-governance";
import {
  addManualReplyInState,
  approveDraftInState,
  createClientInState,
  dismissDraftInState,
  patchClientInState,
  releaseHumanTakeoverInState,
  simulateInState,
  updateHandoffStatusInState,
} from "./app-state-store";
import type { AppTenantContext } from "./auth-context";
import { AppDomainError } from "./app-errors";
import type {
  AiDecisionRecord,
  AuditEventRecord,
  ClientRecord,
  ConversationRecord,
  HandoffCaseRecord,
  ManuAppState,
  MessageRecord,
  NotificationRecord,
  RiskAssessmentRecord,
  SimulationRequest,
} from "./types";

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
  full_name: string;
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
  created_at: string;
};
type DbChannel = {
  client_id: string;
  channel: ClientRecord["channel"];
  channel_user_id: string;
  display_handle: string | null;
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
  provider_id: string | null;
  provider_status: AiDecisionRecord["providerStatus"];
  provider_error_code: string | null;
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
    channelsResult,
    conversationsResult,
    memoriesResult,
    messagesResult,
    decisionsResult,
    riskAssessmentsResult,
    handoffsResult,
    notificationsResult,
    auditEventsResult,
    processedEventsResult,
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", context.tenantId).single(),
    supabase.from("dietitians").select("*").eq("id", context.dietitianId).eq("tenant_id", context.tenantId).single(),
    supabase.from("clients").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("client_channels").select("*").eq("tenant_id", context.tenantId),
    supabase.from("conversations").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("conversation_memories").select("*").eq("tenant_id", context.tenantId),
    supabase.from("messages").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("ai_decisions").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("risk_assessments").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("handoff_cases").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("notifications").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("audit_events").select("*").eq("tenant_id", context.tenantId).order("created_at"),
    supabase.from("processed_inbound_events").select("*").eq("tenant_id", context.tenantId),
  ]);

  throwIfError(tenantResult.error);
  throwIfError(dietitianResult.error);
  throwIfError(clientsResult.error);
  throwIfError(channelsResult.error);
  throwIfError(conversationsResult.error);
  throwIfError(memoriesResult.error);
  throwIfError(messagesResult.error);
  throwIfError(decisionsResult.error);
  throwIfError(riskAssessmentsResult.error);
  throwIfError(handoffsResult.error);
  throwIfError(notificationsResult.error);
  throwIfError(auditEventsResult.error);
  throwIfError(processedEventsResult.error);

  const channels = channelsResult.data || [];
  const memories = memoriesResult.data || [];

  return {
    tenant: {
      id: tenantResult.data.id,
      name: tenantResult.data.name,
    },
    dietitian: {
      id: dietitianResult.data.id,
      tenantId: dietitianResult.data.tenant_id,
      displayName: dietitianResult.data.display_name,
      timezone: dietitianResult.data.timezone,
    },
    clients: (clientsResult.data || []).map((client) => mapClient(client, channels)),
    conversations: (conversationsResult.data || []).map((conversation) =>
      mapConversation(conversation, memories),
    ),
    messages: (messagesResult.data || []).map(mapMessage),
    aiDecisions: (decisionsResult.data || []).map(mapDecision),
    riskAssessments: (riskAssessmentsResult.data || []).map(mapRiskAssessment),
    handoffCases: (handoffsResult.data || []).map(mapHandoff),
    notifications: (notificationsResult.data || []).map(mapNotification),
    auditEvents: (auditEventsResult.data || []).map(mapAuditEvent),
    processedSimulationKeys: (processedEventsResult.data || []).map((event) => event.provider_event_id),
    lastSimulation: null,
  } satisfies ManuAppState;
}

export async function resetSupabaseState(context = demoTenantContext()) {
  const supabase = requireSupabase();
  await deleteDemoData(supabase, context.tenantId);
  await ensureDemoData(supabase, context.userId);
  return loadSupabaseState(context);
}

export async function createSupabaseClientRecord(
  input: Pick<ClientRecord, "fullName" | "channel" | "channelUserId">,
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
  await upsertClient(supabase, client);
  await upsertChannel(supabase, client);
  if (hasAiControlChange(state.clients.find((item) => item.id === clientId), client)) {
    await insertClientAiStatusEvent(supabase, state.clients.find((item) => item.id === clientId), client, context);
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
  return buildClientScopedExport(await loadSupabaseState(context), clientId);
}

export async function anonymizeSupabaseClientData(clientId: string, context = demoTenantContext()) {
  const before = await loadSupabaseState(context);
  const after = anonymizeClientInState(before, clientId);
  const client = after.clients.find((item) => item.id === clientId);

  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }

  const supabase = requireSupabase();
  const conversationIds = after.conversations
    .filter((conversation) => conversation.clientId === client.id)
    .map((conversation) => conversation.id);
  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));

  await upsertClient(supabase, client);
  await checked(
    supabase
      .from("client_channels")
      .update({
        channel_user_id: `anonymized:${client.id}`,
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

  if (conversationIds.length > 0) {
    await checked(
      supabase
        .from("messages")
        .update({
          body: "[client data anonymized]",
          source_message_id: null,
          generated_by_ai_decision_id: null,
          approved_by_dietitian_id: null,
          author_dietitian_id: null,
        })
        .eq("tenant_id", context.tenantId)
        .in("conversation_id", conversationIds),
    );
    await checked(
      supabase
        .from("risk_assessments")
        .update({ reasons: ["client_data_anonymized"] })
        .eq("tenant_id", context.tenantId)
        .in("conversation_id", conversationIds),
    );
  }

  await checked(
    supabase
      .from("ai_decisions")
      .update({
        model: null,
        provider_status: "not_called",
        provider_error_code: null,
        blocked_reason: "client_data_anonymized",
        quality_issues: [],
        reasons: ["client_data_anonymized"],
      })
      .eq("tenant_id", context.tenantId)
      .eq("client_id", client.id),
  );
  await checked(
    supabase
      .from("handoff_cases")
      .update({
        reasons: ["client_data_anonymized"],
        safe_acknowledgement: "[client data anonymized]",
        recommended_action: "[client data anonymized]",
      })
      .eq("tenant_id", context.tenantId)
      .eq("client_id", client.id),
  );

  for (const audit of after.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }

  return loadSupabaseState(context);
}

export async function addSupabaseManualReply(clientId: string, body: string, context = demoTenantContext()) {
  const state = await loadSupabaseState(context);
  const next = addManualReplyInState(state, clientId, body);
  await persistStateDiff(requireSupabase(), state, next);
  return loadSupabaseState(context);
}

export async function approveSupabaseDraftMessage(
  messageId: string,
  body: string | undefined,
  context = demoTenantContext(),
) {
  const state = await loadSupabaseState(context);
  const next = approveDraftInState(state, messageId, body);
  await persistDraftUpdate(requireSupabase(), state, next, messageId, context);
  return loadSupabaseState(context);
}

export async function dismissSupabaseDraftMessage(messageId: string, context = demoTenantContext()) {
  const state = await loadSupabaseState(context);
  const next = dismissDraftInState(state, messageId);
  await persistDraftUpdate(requireSupabase(), state, next, messageId, context);
  return loadSupabaseState(context);
}

export async function releaseSupabaseHumanTakeover(clientId: string, context = demoTenantContext()) {
  const state = await loadSupabaseState(context);
  const next = releaseHumanTakeoverInState(state, clientId);
  const client = next.clients.find((item) => item.id === clientId);

  if (!client) {
    throw new AppDomainError(404, "client_not_found");
  }

  const supabase = requireSupabase();
  const { error } = await supabase
    .from("clients")
    .update({ human_takeover_locked: client.humanTakeoverLocked })
    .eq("id", clientId)
    .eq("tenant_id", context.tenantId);
  throwIfError(error);

  const beforeAudits = new Set(state.auditEvents.map((item) => item.id));
  for (const audit of next.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }

  return loadSupabaseState(context);
}

export async function runSupabaseSimulation(request: SimulationRequest, context = demoTenantContext()) {
  const state = await loadSupabaseState(context);
  const simulationClient = state.clients.find((client) => client.id === request.clientId);
  const next = await simulateInState(state, request);
  await persistStateDiff(requireSupabase(), state, next, simulationClient?.channel);
  return loadSupabaseStateWithLastSimulation(next, context);
}

export async function updateSupabaseHandoffStatus(
  handoffId: string,
  status: "resolved" | "dismissed",
  context = demoTenantContext(),
) {
  const state = await loadSupabaseState(context);
  const next = updateHandoffStatusInState(state, handoffId, status);
  const handoff = next.handoffCases.find((item) => item.id === handoffId);

  if (handoff) {
    const { error } = await requireSupabase()
      .from("handoff_cases")
      .update({ status: handoff.status, resolved_at: new Date().toISOString() })
      .eq("id", handoffId)
      .eq("tenant_id", context.tenantId);
    throwIfError(error);
  }

  if (!handoff) {
    throw new AppDomainError(404, "handoff_not_found");
  }

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
      auth_user_id: userId,
    }),
  );

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
    "notifications",
    "audit_events",
    "handoff_cases",
    "messages",
    "ai_decisions",
    "risk_assessments",
    "conversation_memories",
    "conversations",
    "client_channels",
    "client_ai_status_events",
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
        durable_facts: {},
      }),
    );
  }
}

async function upsertClient(supabase: SupabaseClient, client: ClientRecord) {
  const safetyChecklist = normalizeSafetyChecklist(client.safetyChecklist);
  const mandatorySafetyComplete = isSafetyChecklistComplete({ ...client, safetyChecklist });

  await checked(
    supabase.from("clients").upsert({
      id: client.id,
      tenant_id: client.tenantId,
      dietitian_id: client.dietitianId,
      full_name: client.fullName,
      selected_persona_id: client.selectedPersonaId,
      ai_status: client.aiStatus,
      ai_mode: client.aiMode,
      ai_active_from: client.aiActiveFrom,
      ai_active_until: client.aiActiveUntil,
      channel_permission: client.channelPermission,
      mandatory_safety_complete: mandatorySafetyComplete,
      human_takeover_locked: client.humanTakeoverLocked,
      safety_checklist: safetyChecklist,
      health_profile: client.healthProfile,
      diet_plan: client.dietPlan,
      allergies: client.allergies,
      restricted_foods: client.restrictedFoods,
      clinical_risk_notes: client.clinicalRiskNotes,
      pinned_notes: client.pinnedNotes,
    }),
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

async function persistStateDiff(
  supabase: SupabaseClient,
  before: ManuAppState,
  after: ManuAppState,
  processedEventChannel?: ClientRecord["channel"],
) {
  const beforeMessages = new Set(before.messages.map((item) => item.id));
  const beforeDecisions = new Set(before.aiDecisions.map((item) => item.id));
  const beforeRiskAssessments = new Set(before.riskAssessments.map((item) => item.id));
  const beforeHandoffs = new Set(before.handoffCases.map((item) => item.id));
  const beforeNotifications = new Set(before.notifications.map((item) => item.id));
  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));
  const beforeProcessed = new Set(before.processedSimulationKeys);

  for (const decision of after.aiDecisions.filter((item) => !beforeDecisions.has(item.id))) {
    await insertDecision(supabase, decision);
  }
  for (const message of after.messages.filter((item) => !beforeMessages.has(item.id))) {
    await insertMessage(supabase, message);
  }
  for (const riskAssessment of after.riskAssessments.filter((item) => !beforeRiskAssessments.has(item.id))) {
    await insertRiskAssessment(supabase, riskAssessment);
  }
  for (const handoff of after.handoffCases.filter((item) => !beforeHandoffs.has(item.id))) {
    await insertHandoff(supabase, handoff);
  }
  for (const notification of after.notifications.filter((item) => !beforeNotifications.has(item.id))) {
    await insertNotification(supabase, notification);
  }
  for (const audit of after.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }
  for (const key of after.processedSimulationKeys.filter((item) => !beforeProcessed.has(item))) {
    const channel = processedEventChannel || after.clients[0]?.channel || "whatsapp";
    await checked(
      supabase.from("processed_inbound_events").insert({
        tenant_id: after.tenant.id,
        channel,
        provider_event_id: key,
      }),
    );
  }
}

async function persistDraftUpdate(
  supabase: SupabaseClient,
  before: ManuAppState,
  after: ManuAppState,
  messageId: string,
  context: AppTenantContext,
) {
  const beforeMessage = before.messages.find((message) => message.id === messageId);
  const afterMessage = after.messages.find((message) => message.id === messageId);

  if (!beforeMessage || !afterMessage || beforeMessage.status !== "draft") {
    throw new AppDomainError(beforeMessage ? 400 : 404, beforeMessage ? "message_not_ai_draft" : "message_not_found");
  }

  const { error } = await supabase
    .from("messages")
    .update({
      body: afterMessage.body,
      status: afterMessage.status,
      approved_by_dietitian_id: afterMessage.approvedByDietitianId,
    })
    .eq("id", messageId)
    .eq("tenant_id", context.tenantId)
    .eq("status", "draft");
  throwIfError(error);

  const beforeAudits = new Set(before.auditEvents.map((item) => item.id));
  for (const audit of after.auditEvents.filter((item) => !beforeAudits.has(item.id))) {
    await insertAudit(supabase, audit);
  }
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
      provider_id: decision.providerId,
      provider_status: decision.providerStatus,
      provider_error_code: decision.providerErrorCode,
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

async function insertHandoff(supabase: SupabaseClient, handoff: HandoffCaseRecord) {
  await checked(
    supabase.from("handoff_cases").insert({
      id: handoff.id,
      tenant_id: handoff.tenantId,
      dietitian_id: handoff.dietitianId,
      client_id: handoff.clientId,
      conversation_id: handoff.conversationId,
      triggering_message_id: handoff.triggeringMessageId,
      risk: handoff.risk,
      reasons: handoff.reasons,
      status: handoff.status,
      urgency: handoff.urgency,
      safe_acknowledgement: handoff.safeAcknowledgement,
      recommended_action: handoff.recommendedAction,
      created_at: handoff.createdAt,
    }),
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

async function insertNotification(supabase: SupabaseClient, notification: NotificationRecord) {
  await checked(
    supabase.from("notifications").insert({
      id: notification.id,
      tenant_id: notification.tenantId,
      type: notification.type,
      entity_type: notification.entityType,
      entity_id: notification.entityId,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      acknowledged_at: notification.acknowledgedAt,
      created_at: notification.createdAt,
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

function mapClient(client: DbClient, channels: DbChannel[]): ClientRecord {
  const channel = channels.find((item) => item.client_id === client.id);
  return {
    id: client.id,
    tenantId: client.tenant_id,
    dietitianId: client.dietitian_id,
    fullName: client.full_name,
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
    createdAt: client.created_at,
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
    providerId: decision.provider_id || null,
    providerStatus: decision.provider_status || "not_called",
    providerErrorCode: decision.provider_error_code || null,
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
