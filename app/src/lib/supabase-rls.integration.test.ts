import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertRateLimit, resetRateLimits } from "./rate-limit";
import { hashCommercialInviteToken } from "./phase-83b-commercial-entitlement-model";
import {
  addSupabaseClientContextUpdate,
  activateSupabaseClientAi,
  applySupabaseContextIntakeProposal,
  approveSupabaseDraftMessage,
  confirmSupabaseContextIntakeProposal,
  createSupabaseContextIntakeProposal,
  dismissSupabaseDraftMessage,
  loadSupabaseState,
  patchSupabaseClientRecord,
  rejectSupabaseContextIntakeProposal,
  resolveSupabaseStructuredRecordUpdateNotification,
  resetSupabaseState,
  runSupabaseSimulation,
  saveSupabaseFormResponse,
} from "./supabase-store";

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowRemoteRlsTests = process.env.MANU_ALLOW_REMOTE_RLS_TESTS === "true";
const isLocalSupabase =
  supabaseUrl?.startsWith("http://127.0.0.1:") || supabaseUrl?.startsWith("http://localhost:");
const shouldRun = Boolean(supabaseUrl && anonKey && serviceRoleKey && (isLocalSupabase || allowRemoteRlsTests));

const TEST_TENANT_ID = "00000000-0000-4000-8000-000000000901";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000902";
const TEST_DIETITIAN_ID = "00000000-0000-4000-8000-000000000903";
const OTHER_DIETITIAN_ID = "00000000-0000-4000-8000-000000000953";
const TEST_CLIENT_ID = "00000000-0000-4000-8000-000000000904";
const OTHER_CLIENT_ID = "00000000-0000-4000-8000-000000000905";
const TEST_CONVERSATION_ID = "00000000-0000-4000-8000-000000000906";
const OTHER_CONVERSATION_ID = "00000000-0000-4000-8000-000000000907";
const TEST_MESSAGE_ID = "00000000-0000-4000-8000-000000000908";
const OTHER_MESSAGE_ID = "00000000-0000-4000-8000-000000000909";
const TEST_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000910";
const OTHER_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000911";
const TEST_INBOUND_QUARANTINE_ID = "00000000-0000-4000-8000-000000000933";
const OTHER_INBOUND_QUARANTINE_ID = "00000000-0000-4000-8000-000000000934";
const TEST_CHANNEL_DELIVERY_ID = "00000000-0000-4000-8000-000000000935";
const OTHER_CHANNEL_DELIVERY_ID = "00000000-0000-4000-8000-000000000936";
const TEST_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000912";
const OTHER_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000913";
const TEST_DATA_REQUEST_ID = "00000000-0000-4000-8000-000000000914";
const OTHER_DATA_REQUEST_ID = "00000000-0000-4000-8000-000000000915";
const TEST_INTERNAL_COPILOT_MESSAGE_ID = "00000000-0000-4000-8000-000000000916";
const OTHER_INTERNAL_COPILOT_MESSAGE_ID = "00000000-0000-4000-8000-000000000917";
const TEST_INTERNAL_COPILOT_TOOL_CALL_ID = "00000000-0000-4000-8000-000000000918";
const OTHER_INTERNAL_COPILOT_TOOL_CALL_ID = "00000000-0000-4000-8000-000000000919";
const ASSISTANT_DIETITIAN_ID = "00000000-0000-4000-8000-000000000920";
const VIEWER_DIETITIAN_ID = "00000000-0000-4000-8000-000000000921";
const CARE_TEAM_DIETITIAN_ID = "00000000-0000-4000-8000-000000000922";
const AUDITOR_DIETITIAN_ID = "00000000-0000-4000-8000-000000000961";
const UNASSIGNED_CLIENT_ID = "00000000-0000-4000-8000-000000000923";
const UNASSIGNED_CONVERSATION_ID = "00000000-0000-4000-8000-000000000924";
const OWNED_DIETITIAN_CLIENT_ID = "00000000-0000-4000-8000-000000000925";
const OWNED_DIETITIAN_CONVERSATION_ID = "00000000-0000-4000-8000-000000000926";
const TEST_AI_DECISION_ID = "00000000-0000-4000-8000-000000000927";
const OTHER_AI_DECISION_ID = "00000000-0000-4000-8000-000000000928";
const ASSISTANT_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000929";
const VIEWER_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000930";
const CARE_TEAM_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000931";
const TEST_HANDOFF_CASE_ID = "00000000-0000-4000-8000-000000000932";
const TEST_COMMERCIAL_INVITE_ID = "00000000-0000-4000-8000-000000000937";
const OTHER_COMMERCIAL_INVITE_ID = "00000000-0000-4000-8000-000000000944";
const TEST_TENANT_ENTITLEMENT_ID = "00000000-0000-4000-8000-000000000938";
const OTHER_TENANT_ENTITLEMENT_ID = "00000000-0000-4000-8000-000000000945";
const TEST_BILLING_CUSTOMER_ID = "00000000-0000-4000-8000-000000000939";
const OTHER_BILLING_CUSTOMER_ID = "00000000-0000-4000-8000-000000000942";
const TEST_BILLING_EVENT_ID = "00000000-0000-4000-8000-000000000940";
const TEST_MOBILE_INSTALL_AUDIT_ID = "00000000-0000-4000-8000-000000000941";
const OTHER_MOBILE_INSTALL_AUDIT_ID = "00000000-0000-4000-8000-000000000943";
const TEST_P85_HUMAN_CONTROL_SESSION_ID = "00000000-0000-4000-8000-000000000946";
const OTHER_P85_HUMAN_CONTROL_SESSION_ID = "00000000-0000-4000-8000-000000000947";
const TEST_P85_CONTEXT_INTAKE_ID = "00000000-0000-4000-8000-000000000948";
const OTHER_P85_CONTEXT_INTAKE_ID = "00000000-0000-4000-8000-000000000949";
const TEST_P85_CHANNEL_ACCOUNT_BINDING_ID = "00000000-0000-4000-8000-000000000950";
const OTHER_P85_CHANNEL_ACCOUNT_BINDING_ID = "00000000-0000-4000-8000-000000000951";
const TEST_P85_CHANNEL_ACTOR_BINDING_ID = "00000000-0000-4000-8000-000000000954";
const OTHER_P85_CHANNEL_ACTOR_BINDING_ID = "00000000-0000-4000-8000-000000000955";
const TEST_P85_CHANNEL_EVENT_ID = "00000000-0000-4000-8000-000000000956";
const OTHER_P85_CHANNEL_EVENT_ID = "00000000-0000-4000-8000-000000000957";
const TEST_P85_CHANNEL_MESSAGE_REVISION_ID = "00000000-0000-4000-8000-000000000958";
const TEST_P85_RISK_ACTIVITY_ID = "00000000-0000-4000-8000-000000000952";
const TEST_STAGE4B_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000959";
const TEST_STAGE4B_MEDIA_NOTIFICATION_ID = "00000000-0000-4000-8000-000000000960";
const TEST_STAGE4B3_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000962";
const OTHER_STAGE4B3_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000963";
const TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID = "00000000-0000-4000-8000-000000000964";
const TEST_STAGE4B3_VISUAL_ANALYSIS_ID = "00000000-0000-4000-8000-000000000965";
const OTHER_STAGE4B3_VISUAL_ANALYSIS_ID = "00000000-0000-4000-8000-000000000966";
const TEST_STAGE4B3_BUNDLE_ID = "00000000-0000-4000-8000-000000000967";
const OTHER_STAGE4B3_BUNDLE_ID = "00000000-0000-4000-8000-000000000968";
const TEST_STAGE4B3_CLAIM_BUNDLE_ID = "00000000-0000-4000-8000-000000000969";
const TEST_STAGE4B3_BUNDLE_ITEM_ID = "00000000-0000-4000-8000-000000000970";
const OTHER_STAGE4B3_BUNDLE_ITEM_ID = "00000000-0000-4000-8000-000000000971";
const TEST_STAGE4B3_VISUAL_CORRECTION_ID = "00000000-0000-4000-8000-000000000972";
const OTHER_STAGE4B3_VISUAL_CORRECTION_ID = "00000000-0000-4000-8000-000000000973";
const TEST_STAGE4B3_CLAIM_MESSAGE_ID = "00000000-0000-4000-8000-000000000974";
const TEST_STAGE4B4_AUDIO_ASSET_ID = "00000000-0000-4000-8000-000000000987";
const TEST_STAGE4B4_CLAIM_AUDIO_ASSET_ID = "00000000-0000-4000-8000-000000000988";
const TEST_STAGE4B4_TRANSCRIPTION_ID = "00000000-0000-4000-8000-000000000989";
const TEST_STAGE4B4_CLAIM_TRANSCRIPTION_ID = "00000000-0000-4000-8000-000000000990";
const TEST_STAGE4B4_AUDIO_MESSAGE_ID = "00000000-0000-4000-8000-000000000991";
const TEST_STAGE4B4_VISIBLE_AUDIO_MESSAGE_ID = "00000000-0000-4000-8000-000000000994";
const TEST_STAGE4B4_TRANSCRIPT_CORRECTION_ID = "00000000-0000-4000-8000-000000000992";
const TEST_AI_CHAT_GENERAL_CONVERSATION_ID = "00000000-0000-4000-8000-000000000995";
const OTHER_AI_CHAT_GENERAL_CONVERSATION_ID = "00000000-0000-4000-8000-000000000996";
const TEST_AI_CHAT_CLIENT_CONVERSATION_ID = "00000000-0000-4000-8000-000000000997";
const TEST_AI_CHAT_GENERAL_BRANCH_ID = "00000000-0000-4000-8000-000000000998";
const TEST_AI_CHAT_CLIENT_BRANCH_ID = "00000000-0000-4000-8000-000000000999";
const TEST_AI_CHAT_MESSAGE_ID = "00000000-0000-4000-8000-000000001000";
const TEST_AI_CHAT_MESSAGE_VERSION_ID = "00000000-0000-4000-8000-000000001001";
const TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID = "00000000-0000-4000-8000-000000001002";
const TEST_AI_CHAT_CARE_TEAM_BRANCH_ID = "00000000-0000-4000-8000-000000001003";
const PASSWORD = "manu-rls-test-password";

const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe("Supabase RLS tenant isolation", () => {
  let admin: SupabaseClient;
  let memberUserId = "";
  let outsiderUserId = "";
  let assistantUserId = "";
  let viewerUserId = "";
  let careTeamUserId = "";
  let auditorUserId = "";

  beforeAll(async () => {
    admin = createClient(supabaseUrl!, serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    await cleanup(admin);
    memberUserId = await ensureUser(admin, "rls-member@manu.local");
    outsiderUserId = await ensureUser(admin, "rls-outsider@manu.local");
    assistantUserId = await ensureUser(admin, "rls-assistant@manu.local");
    viewerUserId = await ensureUser(admin, "rls-viewer@manu.local");
    careTeamUserId = await ensureUser(admin, "rls-care-team@manu.local");
    auditorUserId = await ensureUser(admin, "rls-auditor@manu.local");
    await seedTenants(admin, {
      memberUserId,
      outsiderUserId,
      assistantUserId,
      viewerUserId,
      careTeamUserId,
      auditorUserId,
    });
  });

  afterAll(async () => {
    if (admin) {
      await cleanup(admin);
      if (memberUserId) await admin.auth.admin.deleteUser(memberUserId);
      if (outsiderUserId) await admin.auth.admin.deleteUser(outsiderUserId);
      if (assistantUserId) await admin.auth.admin.deleteUser(assistantUserId);
      if (viewerUserId) await admin.auth.admin.deleteUser(viewerUserId);
      if (careTeamUserId) await admin.auth.admin.deleteUser(careTeamUserId);
      if (auditorUserId) await admin.auth.admin.deleteUser(auditorUserId);
    }
  });

  it("allows a tenant member to read only their tenant rows", async () => {
    const member = await signIn("rls-member@manu.local");

    const ownClients = await member.from("clients").select("id, tenant_id").eq("id", TEST_CLIENT_ID);
    expect(ownClients.error).toBeNull();
    expect(ownClients.data).toHaveLength(1);
    expect(ownClients.data?.[0].id).toBe(TEST_CLIENT_ID);

    const otherClients = await member.from("clients").select("id").eq("tenant_id", OTHER_TENANT_ID);
    expect(otherClients.error).toBeNull();
    expect(otherClients.data).toHaveLength(0);

    const memories = await member.from("conversation_memories").select("conversation_id");
    expect(memories.error).toBeNull();
    expect(memories.data).toEqual([{ conversation_id: TEST_CONVERSATION_ID }]);

    const riskAssessments = await member.from("risk_assessments").select("message_id");
    expect(riskAssessments.error).toBeNull();
    expect(riskAssessments.data).toEqual([{ message_id: TEST_MESSAGE_ID }]);

    const activationEvents = await member.from("client_ai_status_events").select("client_id");
    expect(activationEvents.error).toBeNull();
    expect(activationEvents.data).toEqual([{ client_id: TEST_CLIENT_ID }]);

    const notifications = await member.from("notifications").select("id");
    expect(notifications.error).toBeNull();
    expect(notifications.data).toEqual([{ id: TEST_NOTIFICATION_ID }]);

    const inboundQuarantines = await member.from("inbound_quarantines").select("id");
    expect(inboundQuarantines.error).toBeNull();
    expect(inboundQuarantines.data).toEqual([{ id: TEST_INBOUND_QUARANTINE_ID }]);

    const channelDeliveries = await member.from("channel_deliveries").select("id");
    expect(channelDeliveries.error).toBeNull();
    expect(channelDeliveries.data).toEqual([{ id: TEST_CHANNEL_DELIVERY_ID }]);

    const rollbackControls = await member
      .from("channel_adapter_rollback_controls")
      .select("tenant_id, global_channel_automation_disabled");

    const entitlements = await member.from("tenant_entitlements").select("tenant_id, status");
    expect(entitlements.error).toBeNull();
    expect(entitlements.data).toEqual([{ tenant_id: TEST_TENANT_ID, status: "active" }]);

    const billingCustomers = await member.from("billing_customers").select("tenant_id");
    expect(billingCustomers.error).toBeNull();
    expect(billingCustomers.data).toEqual([{ tenant_id: TEST_TENANT_ID }]);

    const mobileInstallAudit = await member.from("mobile_install_audit_events").select("id");
    expect(mobileInstallAudit.error).toBeNull();
    expect(mobileInstallAudit.data).toEqual([{ id: TEST_MOBILE_INSTALL_AUDIT_ID }]);
    expect(rollbackControls.error).toBeNull();
    expect(rollbackControls.data).toEqual([
      { tenant_id: TEST_TENANT_ID, global_channel_automation_disabled: true },
    ]);

    const assignments = await member.from("client_assignments").select("id").eq("id", TEST_ASSIGNMENT_ID);
    expect(assignments.error).toBeNull();
    expect(assignments.data).toEqual([{ id: TEST_ASSIGNMENT_ID }]);

    const dataRequests = await member.from("data_requests").select("id");
    expect(dataRequests.error).toBeNull();
    expect(dataRequests.data).toEqual([{ id: TEST_DATA_REQUEST_ID }]);

    const copilotMessages = await member.from("internal_copilot_messages").select("id");
    expect(copilotMessages.error).toBeNull();
    expect(copilotMessages.data).toEqual([{ id: TEST_INTERNAL_COPILOT_MESSAGE_ID }]);

    const copilotToolCalls = await member.from("internal_copilot_tool_calls").select("id");
    expect(copilotToolCalls.error).toBeNull();
    expect(copilotToolCalls.data).toEqual([{ id: TEST_INTERNAL_COPILOT_TOOL_CALL_ID }]);
  });

  it("blocks a user without membership from tenant data", async () => {
    const outsider = await signIn("rls-outsider@manu.local");

    const clients = await outsider.from("clients").select("id").eq("tenant_id", TEST_TENANT_ID);
    expect(clients.error).toBeNull();
    expect(clients.data).toHaveLength(0);

    const memories = await outsider.from("conversation_memories").select("conversation_id");
    expect(memories.error).toBeNull();
    expect(memories.data).toHaveLength(0);

    const riskAssessments = await outsider.from("risk_assessments").select("message_id");
    expect(riskAssessments.error).toBeNull();
    expect(riskAssessments.data).toHaveLength(0);

    const activationEvents = await outsider.from("client_ai_status_events").select("client_id");
    expect(activationEvents.error).toBeNull();
    expect(activationEvents.data).toHaveLength(0);

    const notifications = await outsider.from("notifications").select("id");
    expect(notifications.error).toBeNull();
    expect(notifications.data).toHaveLength(0);

    const inboundQuarantines = await outsider.from("inbound_quarantines").select("id");
    expect(inboundQuarantines.error).toBeNull();
    expect(inboundQuarantines.data).toHaveLength(0);

    const channelDeliveries = await outsider.from("channel_deliveries").select("id");
    expect(channelDeliveries.error).toBeNull();
    expect(channelDeliveries.data).toHaveLength(0);

    const rollbackControls = await outsider.from("channel_adapter_rollback_controls").select("tenant_id");
    expect(rollbackControls.error).toBeNull();
    expect(rollbackControls.data).toHaveLength(0);

    const assignments = await outsider.from("client_assignments").select("id");
    expect(assignments.error).toBeNull();
    expect(assignments.data).toHaveLength(0);

    const dataRequests = await outsider.from("data_requests").select("id");
    expect(dataRequests.error).toBeNull();
    expect(dataRequests.data).toHaveLength(0);

    const copilotMessages = await outsider.from("internal_copilot_messages").select("id");
    expect(copilotMessages.error).toBeNull();
    expect(copilotMessages.data).toHaveLength(0);

    const copilotToolCalls = await outsider.from("internal_copilot_tool_calls").select("id");
    expect(copilotToolCalls.error).toBeNull();
    expect(copilotToolCalls.data).toHaveLength(0);

    const entitlements = await outsider.from("tenant_entitlements").select("tenant_id");
    expect(entitlements.error).toBeNull();
    expect(entitlements.data).toHaveLength(0);

    const billingCustomers = await outsider.from("billing_customers").select("tenant_id");
    expect(billingCustomers.error).toBeNull();
    expect(billingCustomers.data).toHaveLength(0);

    const commercialInvites = await outsider.from("commercial_invites").select("id");
    expect(commercialInvites.error).toBeNull();
    expect(commercialInvites.data).toHaveLength(0);

    const billingEvents = await outsider.from("billing_event_ledger").select("id");
    expect(billingEvents.error).toBeNull();
    expect(billingEvents.data).toHaveLength(0);

    const mobileInstallAudit = await outsider.from("mobile_install_audit_events").select("id");
    expect(mobileInstallAudit.error).toBeNull();
    expect(mobileInstallAudit.data).toHaveLength(0);
  });

  it("rejects cross-tenant writes through the anon client", async () => {
    const member = await signIn("rls-member@manu.local");

    const update = await member
      .from("clients")
      .update({ full_name: "Blocked Cross Tenant Update" })
      .eq("id", OTHER_CLIENT_ID);

    expect(update.error).toBeNull();
    expect(update.count ?? 0).toBe(0);

    const insert = await member.from("clients").insert({
      tenant_id: OTHER_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      full_name: "Blocked Insert",
      selected_persona_id: "balanced_coach",
    });

    expect(insert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const activationInsert = await member.from("client_ai_status_events").insert({
      tenant_id: OTHER_TENANT_ID,
      client_id: OTHER_CLIENT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      new_status: "active",
    });

    expect(activationInsert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const notificationUpdate = await member
      .from("notifications")
      .update({ read: true })
      .eq("id", OTHER_NOTIFICATION_ID);

    expect(notificationUpdate.error).toBeNull();
    expect(notificationUpdate.count ?? 0).toBe(0);

    const sameTenantNotificationUpdate = await member
      .from("notifications")
      .update({ read: true })
      .eq("id", TEST_NOTIFICATION_ID);

    expect(sameTenantNotificationUpdate.error?.message).toMatch(/row-level security/i);

    const quarantineInsert = await member.from("inbound_quarantines").insert({
      tenant_id: OTHER_TENANT_ID,
      channel: "whatsapp",
      source_conversation_type: "group",
      reason: "whatsapp_group_unsupported",
    });

    expect(quarantineInsert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const assignmentInsert = await member.from("client_assignments").insert({
      tenant_id: OTHER_TENANT_ID,
      client_id: OTHER_CLIENT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
    });

    expect(assignmentInsert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const dataRequestInsert = await member.from("data_requests").insert({
      tenant_id: OTHER_TENANT_ID,
      client_id: OTHER_CLIENT_ID,
      request_type: "export",
      status: "completed",
      requested_by_dietitian_id: TEST_DIETITIAN_ID,
    });

    expect(dataRequestInsert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const copilotMessageInsert = await member.from("internal_copilot_messages").insert({
      tenant_id: OTHER_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      role: "assistant",
      body: "Blocked cross tenant copilot answer",
      safety_status: "ok",
    });

    expect(copilotMessageInsert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const copilotToolInsert = await member.from("internal_copilot_tool_calls").insert({
      tenant_id: OTHER_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      tool_name: "getClientDietPlan",
      status: "ok",
      result_summary: "Blocked cross tenant result",
    });

    expect(copilotToolInsert.error?.message).toMatch(/row-level security|violates foreign key/i);
  });

  it("keeps Stage 4B-2 advisory tables off direct anon/authenticated access", async () => {
    const member = await signIn("rls-member@manu.local");

    const personaRead = await member.from("personas").select("id").limit(1);
    expect(personaRead.error?.message).toMatch(/permission denied|row-level security/i);

    const personaInsert = await member.from("personas").insert({
      id: "blocked_rls_test_persona",
      label: "Blocked RLS Test Persona",
      behavior_contract: { tone: "blocked" },
    });
    expect(personaInsert.error?.message).toMatch(/permission denied|row-level security/i);

    const idempotencyRead = await member.from("conversation_mutation_idempotency").select("request_id").limit(1);
    expect(idempotencyRead.error?.message).toMatch(/permission denied|row-level security/i);

    const idempotencyInsert = await member.from("conversation_mutation_idempotency").insert({
      tenant_id: TEST_TENANT_ID,
      request_id: "00000000-0000-4000-8000-000000000980",
      operation: "manual_reply",
      conversation_id: TEST_CONVERSATION_ID,
      response_json: { blocked: true },
    });
    expect(idempotencyInsert.error?.message).toMatch(/permission denied|row-level security/i);
  });

  it("enforces assigned assistant read-only access", async () => {
    const assistant = await signIn("rls-assistant@manu.local");

    const assignedClients = await assistant.from("clients").select("id").eq("id", TEST_CLIENT_ID);
    expect(assignedClients.error).toBeNull();
    expect(assignedClients.data).toEqual([{ id: TEST_CLIENT_ID }]);

    const unassignedClients = await assistant.from("clients").select("id").eq("id", UNASSIGNED_CLIENT_ID);
    expect(unassignedClients.error).toBeNull();
    expect(unassignedClients.data).toHaveLength(0);

    const messages = await assistant.from("messages").select("id").eq("id", TEST_MESSAGE_ID);
    expect(messages.error).toBeNull();
    expect(messages.data).toEqual([{ id: TEST_MESSAGE_ID }]);

    const inboundQuarantines = await assistant.from("inbound_quarantines").select("id");
    expect(inboundQuarantines.error).toBeNull();
    expect(inboundQuarantines.data).toHaveLength(0);

    const update = await assistant
      .from("clients")
      .update({ full_name: "Assistant Blocked" })
      .eq("id", TEST_CLIENT_ID)
      .select("id");
    expect(update.error).toBeNull();
    expect(update.data).toHaveLength(0);

    const insert = await assistant.from("messages").insert({
      tenant_id: TEST_TENANT_ID,
      conversation_id: TEST_CONVERSATION_ID,
      sender: "dietitian",
      origin: "dietitian_manual",
      body: "Assistant must not write raw messages",
    });
    expect(insert.error?.message).toMatch(/row-level security/i);
  });

  it("enforces viewer read-only and care-team write assignment levels", async () => {
    const viewer = await signIn("rls-viewer@manu.local");
    const careTeam = await signIn("rls-care-team@manu.local");

    const viewerRead = await viewer.from("clients").select("id").eq("id", TEST_CLIENT_ID);
    expect(viewerRead.error).toBeNull();
    expect(viewerRead.data).toEqual([{ id: TEST_CLIENT_ID }]);

    const viewerUpdate = await viewer
      .from("clients")
      .update({ full_name: "Viewer Blocked" })
      .eq("id", TEST_CLIENT_ID)
      .select("id");
    expect(viewerUpdate.error).toBeNull();
    expect(viewerUpdate.data).toHaveLength(0);

    const careTeamUpdate = await careTeam
      .from("clients")
      .update({ full_name: "Visible RLS Client Updated" })
      .eq("id", TEST_CLIENT_ID)
      .select("id");
    expect(careTeamUpdate.error).toBeNull();
    expect(careTeamUpdate.data).toEqual([{ id: TEST_CLIENT_ID }]);

    const ownedUpdate = await careTeam
      .from("clients")
      .update({ full_name: "Owned Dietitian Client Updated" })
      .eq("id", OWNED_DIETITIAN_CLIENT_ID)
      .select("id");
    expect(ownedUpdate.error).toBeNull();
    expect(ownedUpdate.data).toEqual([{ id: OWNED_DIETITIAN_CLIENT_ID }]);

    const unassignedUpdate = await careTeam
      .from("clients")
      .update({ full_name: "Unassigned Blocked" })
      .eq("id", UNASSIGNED_CLIENT_ID)
      .select("id");
    expect(unassignedUpdate.error).toBeNull();
    expect(unassignedUpdate.data).toHaveLength(0);
  });

  it("isolates P85-IF interstage foundation tables by tenant", async () => {
    const member = await signIn("rls-member@manu.local");
    const outsider = await signIn("rls-outsider@manu.local");

    for (const table of [
      "human_control_sessions",
      "risk_activity_events",
      "context_intake_proposals",
    ] as const) {
      const own = await member.from(table).select("id").eq("tenant_id", TEST_TENANT_ID);
      expect(own.error).toBeNull();
      expect((own.data ?? []).length).toBeGreaterThan(0);

      const hidden = await outsider.from(table).select("id").eq("tenant_id", TEST_TENANT_ID);
      expect(hidden.error).toBeNull();
      expect(hidden.data).toHaveLength(0);
    }
  });

  it("restricts operational trust and quarantine inspection tables to owner/admin", async () => {
    const owner = await signIn("rls-member@manu.local");
    const dietitian = await signIn("rls-viewer@manu.local");

    for (const table of [
      "channel_account_bindings",
      "channel_actor_bindings",
      "channel_events",
      "inbound_quarantines",
    ] as const) {
      const ownerRows = await owner.from(table).select("id").eq("tenant_id", TEST_TENANT_ID);
      expect(ownerRows.error).toBeNull();
      expect((ownerRows.data ?? []).length).toBeGreaterThan(0);

      const dietitianRows = await dietitian.from(table).select("id").eq("tenant_id", TEST_TENANT_ID);
      expect(dietitianRows.error).toBeNull();
      expect(dietitianRows.data).toHaveLength(0);
    }

    for (const table of ["human_control_sessions", "risk_activity_events", "context_intake_proposals"] as const) {
      const workflowRows = await dietitian.from(table).select("id").eq("tenant_id", TEST_TENANT_ID);
      expect(workflowRows.error).toBeNull();
      expect((workflowRows.data ?? []).length).toBeGreaterThan(0);
    }
  });

  it("rejects cross-tenant P85-IF foreign references even for service-role writes", async () => {
    const response = await admin.from("context_intake_proposals").insert({
      id: "00000000-0000-4000-8000-000000001953",
      tenant_id: TEST_TENANT_ID,
      client_id: OTHER_CLIENT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      source_channel: "internal_copilot",
      intake_source: "phone",
      source_text_digest: "cross-tenant-reference",
      occurred_at: "2026-07-10T10:00:00.000Z",
      title: "Cross tenant reference",
      summary: "Must be rejected by the composite tenant foreign key.",
      details: "",
      importance: "routine",
      baseline_context_revision: 1,
      status: "pending_confirmation",
    });

    expect(response.error?.message).toMatch(/foreign key/i);

    const messageProvenance = await admin
      .from("messages")
      .update({ provider_account_binding_id: OTHER_P85_CHANNEL_ACCOUNT_BINDING_ID })
      .eq("id", TEST_MESSAGE_ID)
      .eq("tenant_id", TEST_TENANT_ID);
    expect(messageProvenance.error?.message).toMatch(/foreign key/i);
  });

  it("blocks auditor access to raw client, message, AI, handoff, risk, and copilot tables", async () => {
    const auditor = await signIn("rls-auditor@manu.local");

    for (const [table, column] of [
      ["clients", "id"],
      ["messages", "id"],
      ["ai_decisions", "id"],
      ["handoff_cases", "id"],
      ["risk_assessments", "id"],
      ["inbound_quarantines", "id"],
      ["channel_deliveries", "id"],
      ["human_control_sessions", "id"],
      ["risk_activity_events", "id"],
      ["context_intake_proposals", "id"],
      ["channel_account_bindings", "id"],
      ["internal_copilot_messages", "id"],
      ["internal_copilot_tool_calls", "id"],
    ] as const) {
      const response = await auditor.from(table).select(column);
      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(0);
    }
  });

  it("enforces commercial entitlement isolation and blocks user writes to billing tables", async () => {
    const member = await signIn("rls-member@manu.local");

    const otherEntitlements = await member
      .from("tenant_entitlements")
      .select("tenant_id")
      .eq("tenant_id", OTHER_TENANT_ID);
    expect(otherEntitlements.error).toBeNull();
    expect(otherEntitlements.data).toHaveLength(0);

    const inviteRead = await member.from("commercial_invites").select("id");
    expect(inviteRead.error).toBeNull();
    expect(inviteRead.data).toHaveLength(0);

    const billingEventRead = await member.from("billing_event_ledger").select("id");
    expect(billingEventRead.error).toBeNull();
    expect(billingEventRead.data).toHaveLength(0);

    const entitlementInsert = await member.from("tenant_entitlements").insert({
      tenant_id: TEST_TENANT_ID,
      status: "active",
    });
    expect(entitlementInsert.error?.message).toMatch(/row-level security|permission denied/i);

    const billingCustomerInsert = await member.from("billing_customers").insert({
      tenant_id: TEST_TENANT_ID,
      normalized_email: "blocked@manu.local",
      stripe_customer_id: "cus_blocked",
    });
    expect(billingCustomerInsert.error?.message).toMatch(/row-level security|permission denied/i);

    const ownAuditInsert = await member.from("mobile_install_audit_events").insert({
      id: "00000000-0000-4000-8000-000000000999",
      tenant_id: TEST_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      auth_user_id: memberUserId,
      event_type: "install_prompt_shown",
      user_agent_summary: "vitest",
    });
    expect(ownAuditInsert.error).toBeNull();

    const crossTenantAuditInsert = await member.from("mobile_install_audit_events").insert({
      tenant_id: OTHER_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      auth_user_id: memberUserId,
      event_type: "install_prompt_shown",
      user_agent_summary: "vitest",
    });
    expect(crossTenantAuditInsert.error?.message).toMatch(/row-level security|violates foreign key/i);

    const adminAuditRead = await member.from("commercial_admin_audit_events").select("id");
    expect(adminAuditRead.error).toBeNull();
    expect(adminAuditRead.data).toHaveLength(0);

    const adminAuditInsert = await member.from("commercial_admin_audit_events").insert({
      event_type: "ledger_inspected",
      actor_summary: "blocked-member",
    });
    expect(adminAuditInsert.error?.message).toMatch(/row-level security|permission denied/i);

    const commercialLeadRead = await member.from("commercial_leads").select("id");
    expect(commercialLeadRead.error).toBeNull();
    expect(commercialLeadRead.data).toHaveLength(0);

    const commercialLeadInsert = await member.from("commercial_leads").insert({
      contact_name: "Blocked",
      normalized_email: "blocked@manu.local",
      message: "should fail",
    });
    expect(commercialLeadInsert.error?.message).toMatch(/row-level security|permission denied/i);

    const onboardingEventRead = await member.from("commercial_onboarding_events").select("id");
    expect(onboardingEventRead.error).toBeNull();
    expect(onboardingEventRead.data).toHaveLength(0);

    const onboardingEventInsert = await member.from("commercial_onboarding_events").insert({
      event_type: "claim_blocked",
      normalized_email: "blocked@manu.local",
    });
    expect(onboardingEventInsert.error?.message).toMatch(/row-level security|permission denied/i);
  });

  it("scopes internal copilot records to owner/admin or the current dietitian", async () => {
    const owner = await signIn("rls-member@manu.local");
    const careTeam = await signIn("rls-care-team@manu.local");

    const ownerCopilot = await owner.from("internal_copilot_messages").select("id");
    expect(ownerCopilot.error).toBeNull();
    expect(ownerCopilot.data).toEqual([{ id: TEST_INTERNAL_COPILOT_MESSAGE_ID }]);

    const careTeamCopilot = await careTeam.from("internal_copilot_messages").select("id");
    expect(careTeamCopilot.error).toBeNull();
    expect(careTeamCopilot.data).toHaveLength(0);
  });

  it("allows tenant-scoped channel and idempotency duplicates while blocking same-tenant duplicates", async () => {
    const sharedChannelUserId = `shared-channel-${Date.now()}`;
    const sharedProviderEventId = `shared-event-${Date.now()}`;

    const crossTenantChannels = await admin.from("client_channels").insert([
      {
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        channel: "whatsapp",
        channel_user_id: sharedChannelUserId,
      },
      {
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        channel: "whatsapp",
        channel_user_id: sharedChannelUserId,
      },
    ]);
    expect(crossTenantChannels.error).toBeNull();

    const sameTenantChannel = await admin.from("client_channels").insert({
      tenant_id: TEST_TENANT_ID,
      client_id: UNASSIGNED_CLIENT_ID,
      channel: "whatsapp",
      channel_user_id: sharedChannelUserId,
    });
    expect(sameTenantChannel.error?.message).toMatch(/duplicate key|unique/i);

    const crossTenantEvents = await admin.from("processed_inbound_events").insert([
      {
        tenant_id: TEST_TENANT_ID,
        channel: "whatsapp",
        provider_event_id: sharedProviderEventId,
      },
      {
        tenant_id: OTHER_TENANT_ID,
        channel: "whatsapp",
        provider_event_id: sharedProviderEventId,
      },
    ]);
    expect(crossTenantEvents.error).toBeNull();

    const sameTenantEvent = await admin.from("processed_inbound_events").insert({
      tenant_id: TEST_TENANT_ID,
      channel: "whatsapp",
      provider_event_id: sharedProviderEventId,
    });
    expect(sameTenantEvent.error?.message).toMatch(/duplicate key|unique/i);
  });

  it("isolates Supabase rate-limit buckets by tenant, scope, and key", async () => {
    const keyHash = `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-${Date.now()}`;
    const otherKeyHash = `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-${Date.now()}`;
    const now = new Date().toISOString();

    const first = await admin.rpc("consume_rate_limit", {
      p_tenant_id: TEST_TENANT_ID,
      p_scope: "manual_reply",
      p_key_hash: keyHash,
      p_limit: 2,
      p_window_seconds: 60,
      p_now: now,
    });
    const second = await admin.rpc("consume_rate_limit", {
      p_tenant_id: TEST_TENANT_ID,
      p_scope: "manual_reply",
      p_key_hash: keyHash,
      p_limit: 2,
      p_window_seconds: 60,
      p_now: now,
    });
    const denied = await admin.rpc("consume_rate_limit", {
      p_tenant_id: TEST_TENANT_ID,
      p_scope: "manual_reply",
      p_key_hash: keyHash,
      p_limit: 2,
      p_window_seconds: 60,
      p_now: now,
    });
    const differentScope = await admin.rpc("consume_rate_limit", {
      p_tenant_id: TEST_TENANT_ID,
      p_scope: "draft_review",
      p_key_hash: keyHash,
      p_limit: 2,
      p_window_seconds: 60,
      p_now: now,
    });
    const differentTenant = await admin.rpc("consume_rate_limit", {
      p_tenant_id: OTHER_TENANT_ID,
      p_scope: "manual_reply",
      p_key_hash: keyHash,
      p_limit: 2,
      p_window_seconds: 60,
      p_now: now,
    });
    const differentKey = await admin.rpc("consume_rate_limit", {
      p_tenant_id: TEST_TENANT_ID,
      p_scope: "manual_reply",
      p_key_hash: otherKeyHash,
      p_limit: 2,
      p_window_seconds: 60,
      p_now: now,
    });

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect(denied.error).toBeNull();
    expect(differentScope.error).toBeNull();
    expect(differentTenant.error).toBeNull();
    expect(differentKey.error).toBeNull();
    expect(first.data).toMatchObject({ allowed: true, count: 1, scope: "manual_reply" });
    expect(second.data).toMatchObject({ allowed: true, count: 2, scope: "manual_reply" });
    expect(denied.data).toMatchObject({ allowed: false, count: 3, scope: "manual_reply" });
    expect(differentScope.data).toMatchObject({ allowed: true, count: 1, scope: "draft_review" });
    expect(differentTenant.data).toMatchObject({ allowed: true, count: 1, scope: "manual_reply" });
    expect(differentKey.data).toMatchObject({ allowed: true, count: 1, scope: "manual_reply" });
  });

  it("maps Supabase rate-limit denials to controlled 429 errors", async () => {
    resetRateLimits();
    const key = `rls-rate-limit-${Date.now()}`;

    await assertRateLimit({
      tenantId: TEST_TENANT_ID,
      key,
      scope: "manual_reply",
      limit: 1,
      windowMs: 60_000,
    });

    await expect(
      assertRateLimit({
        tenantId: TEST_TENANT_ID,
        key,
        scope: "manual_reply",
        limit: 1,
        windowMs: 60_000,
      }),
    ).rejects.toMatchObject({ status: 429, message: "rate_limit_exceeded" });
  });

  it("rejects stale client revisions before transactional RPC writes", async () => {
    const before = await admin.from("clients").select("full_name, context_revision").eq("id", TEST_CLIENT_ID).single();
    expect(before.error).toBeNull();

    const staleCommit = await admin.rpc("commit_client_context_update", {
      p_tenant_id: TEST_TENANT_ID,
      p_payload: {
        expectedClientRevisions: { [TEST_CLIENT_ID]: (before.data?.context_revision || 1) + 99 },
        clients: [
          {
            id: TEST_CLIENT_ID,
            fullName: "Stale Revision Should Not Persist",
            contextRevision: (before.data?.context_revision || 1) + 1,
          },
        ],
      },
    });

    expect(staleCommit.error?.message).toContain("concurrent_state_update");

    const after = await admin.from("clients").select("full_name, context_revision").eq("id", TEST_CLIENT_ID).single();
    expect(after.error).toBeNull();
    expect(after.data).toEqual(before.data);
  });

  it("rolls back manual reply RPC inserts when a later update fails", async () => {
    const messageId = "00000000-0000-4000-8000-000000001101";

    const failed = await admin.rpc("commit_manual_reply", {
      p_tenant_id: TEST_TENANT_ID,
      p_payload: {
        expectedClientRevisions: {},
        messages: [
          {
            id: messageId,
            conversationId: TEST_CONVERSATION_ID,
            sender: "dietitian",
            body: "This manual reply must roll back.",
            origin: "dietitian_manual",
            authorDietitianId: TEST_DIETITIAN_ID,
            status: "sent",
            createdAt: new Date().toISOString(),
          },
        ],
        messageUpdates: [{ id: "00000000-0000-4000-8000-000000001199", status: "blocked" }],
      },
    });

    expect(failed.error?.message).toContain("message_not_found");

    const inserted = await admin.from("messages").select("id").eq("id", messageId).maybeSingle();
    expect(inserted.error).toBeNull();
    expect(inserted.data).toBeNull();
  });

  it("rolls back inbound simulation RPC inserts when a later update fails", async () => {
    const messageId = "00000000-0000-4000-8000-000000001102";
    const providerEventId = `atomic-inbound-${Date.now()}`;

    const failed = await admin.rpc("commit_inbound_simulation", {
      p_tenant_id: TEST_TENANT_ID,
      p_payload: {
        expectedClientRevisions: {},
        messages: [
          {
            id: messageId,
            conversationId: TEST_CONVERSATION_ID,
            sender: "client",
            body: "This inbound message must roll back.",
            origin: "client_inbound",
            status: "stored",
            createdAt: new Date().toISOString(),
          },
        ],
        processedEvents: [{ channel: "whatsapp", providerEventId }],
        aiDecisionUpdates: [{ id: "00000000-0000-4000-8000-000000001198", sendStatus: "send_blocked" }],
      },
    });

    expect(failed.error?.message).toContain("ai_decision_not_found");

    const insertedMessage = await admin.from("messages").select("id").eq("id", messageId).maybeSingle();
    const processedEvent = await admin
      .from("processed_inbound_events")
      .select("provider_event_id")
      .eq("tenant_id", TEST_TENANT_ID)
      .eq("provider_event_id", providerEventId)
      .maybeSingle();

    expect(insertedMessage.error).toBeNull();
    expect(insertedMessage.data).toBeNull();
    expect(processedEvent.error).toBeNull();
    expect(processedEvent.data).toBeNull();
  });

  it("stores simulator idempotency events with the simulated client channel", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const telegramClient = state.clients.find((client) => client.channel === "telegram");
    const idempotencyKey = `telegram-${Date.now()}`;

    expect(telegramClient).toBeDefined();

    await runSupabaseSimulation({
      clientId: telegramClient!.id,
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey,
    });

    const event = await admin
      .from("processed_inbound_events")
      .select("channel")
      .eq("provider_event_id", idempotencyKey)
      .single();

    expect(event.error).toBeNull();
    expect(event.data?.channel).toBe("telegram");

    const riskAssessment = await admin
      .from("risk_assessments")
      .select("level, classifier_version")
      .eq("tenant_id", state.tenant.id)
      .neq("message_id", "00000000-0000-4000-8000-000000000031")
      .single();

    expect(riskAssessment.error).toBeNull();
    expect(riskAssessment.data?.level).toBe("yellow");
    expect(riskAssessment.data?.classifier_version).toContain("clinical-safety-second-layer-v0.2.0");
    await resetSupabaseState();
  }, 30000);

  it("persists P85-IF-I lifecycle redaction fields through Supabase remove and reload", async () => {
    const lifecycle = await admin.rpc("commit_client_removal_lifecycle", {
      p_tenant_id: TEST_TENANT_ID,
      p_payload: {
        messageUpdates: [
          {
            id: TEST_MESSAGE_ID,
            body: "REDACTED_BY_PHASE74_POLICY",
            providerEventId: null,
            providerMessageId: null,
            providerAccountBindingId: null,
            actorBindingId: null,
          },
        ],
        channelMessageRevisions: [
          {
            id: TEST_P85_CHANNEL_MESSAGE_REVISION_ID,
            channelEventId: null,
            providerEventId: null,
            priorBodyDigest: "REDACTED_BY_PHASE74_POLICY",
            currentBodyDigest: "REDACTED_BY_PHASE74_POLICY",
          },
        ],
        humanControlSessions: [
          {
            id: TEST_P85_HUMAN_CONTROL_SESSION_ID,
            openedByMessageId: null,
            latestHumanMessageId: null,
            linkedYellowHoldMessageId: null,
            linkedHandoffId: null,
          },
        ],
        riskActivityEvents: [
          {
            id: TEST_P85_RISK_ACTIVITY_ID,
            sourceMessageId: null,
            handoffId: null,
            aiDecisionId: null,
            humanControlSessionId: null,
            metadata: { minimized: true, reason: "client_data_anonymized" },
          },
        ],
        contextIntakeProposalUpdates: [
          {
            id: TEST_P85_CONTEXT_INTAKE_ID,
            sourceText: null,
            rawSourceReference: null,
            title: "REDACTED_BY_PHASE74_POLICY",
            summary: "REDACTED_BY_PHASE74_POLICY",
            details: "",
          },
        ],
      },
    });
    expect(lifecycle.error).toBeNull();

    const message = await admin
      .from("messages")
      .select("body, provider_event_id, provider_message_id, provider_account_binding_id, actor_binding_id")
      .eq("id", TEST_MESSAGE_ID)
      .single();
    expect(message.error).toBeNull();
    expect(message.data).toMatchObject({
      body: "REDACTED_BY_PHASE74_POLICY",
      provider_event_id: null,
      provider_message_id: null,
      provider_account_binding_id: null,
      actor_binding_id: null,
    });

    const session = await admin
      .from("human_control_sessions")
      .select("opened_by_message_id, latest_human_message_id, linked_yellow_hold_message_id, linked_handoff_id")
      .eq("id", TEST_P85_HUMAN_CONTROL_SESSION_ID)
      .single();
    expect(session.error).toBeNull();
    expect(session.data).toMatchObject({
      opened_by_message_id: null,
      latest_human_message_id: null,
      linked_yellow_hold_message_id: null,
      linked_handoff_id: null,
    });

    const proposal = await admin
      .from("context_intake_proposals")
      .select("source_text, raw_source_reference, title")
      .eq("id", TEST_P85_CONTEXT_INTAKE_ID)
      .single();
    expect(proposal.error).toBeNull();
    expect(proposal.data).toMatchObject({
      source_text: null,
      raw_source_reference: null,
      title: "REDACTED_BY_PHASE74_POLICY",
    });

    const revision = await admin
      .from("channel_message_revisions")
      .select("channel_event_id, provider_event_id, prior_body_digest, current_body_digest")
      .eq("id", TEST_P85_CHANNEL_MESSAGE_REVISION_ID)
      .single();
    expect(revision.error).toBeNull();
    expect(revision.data).toMatchObject({
      channel_event_id: null,
      provider_event_id: null,
      prior_body_digest: "REDACTED_BY_PHASE74_POLICY",
      current_body_digest: "REDACTED_BY_PHASE74_POLICY",
    });
  });

  it("persists tenant channel-binding revoke with rollback automation disabled", async () => {
    const revokedAt = "2026-07-11T00:00:00.000Z";
    const revoke = await admin.rpc("p85_if_r6_revoke_tenant_channel_bindings", {
      p_tenant_id: TEST_TENANT_ID,
      p_payload: {
        channelAccountBindingUpdates: [
          {
            id: TEST_P85_CHANNEL_ACCOUNT_BINDING_ID,
            lifecycleStatus: "revoked",
            revokedAt,
            revokedByDietitianId: TEST_DIETITIAN_ID,
            updatedAt: revokedAt,
          },
        ],
        channelActorBindingUpdates: [
          {
            id: TEST_P85_CHANNEL_ACTOR_BINDING_ID,
            revokedAt,
            revokedByDietitianId: TEST_DIETITIAN_ID,
          },
        ],
        channelAdapterRollbackControls: {
          globalChannelAutomationDisabled: true,
          tenantChannelAutomationDisabled: true,
          disabledDietitianIds: [],
          disabledClientIds: [],
        },
        auditEvents: [
          {
            id: "00000000-0000-4000-8000-000000000959",
            eventType: "tenant_channel_bindings_revoked",
            entityType: "tenant",
            entityId: TEST_TENANT_ID,
            metadata: { minimized: true },
            createdAt: revokedAt,
          },
        ],
      },
    });
    expect(revoke.error).toBeNull();

    const account = await admin
      .from("channel_account_bindings")
      .select("lifecycle_status, revoked_at, revoked_by_dietitian_id")
      .eq("id", TEST_P85_CHANNEL_ACCOUNT_BINDING_ID)
      .single();
    expect(account.error).toBeNull();
    expect(account.data?.lifecycle_status).toBe("revoked");
    expect(account.data?.revoked_at).not.toBeNull();
    expect(account.data?.revoked_by_dietitian_id).toBe(TEST_DIETITIAN_ID);

    const actor = await admin
      .from("channel_actor_bindings")
      .select("revoked_at, revoked_by_dietitian_id")
      .eq("id", TEST_P85_CHANNEL_ACTOR_BINDING_ID)
      .single();
    expect(actor.error).toBeNull();
    expect(actor.data?.revoked_at).not.toBeNull();
    expect(actor.data?.revoked_by_dietitian_id).toBe(TEST_DIETITIAN_ID);

    const rollback = await admin
      .from("channel_adapter_rollback_controls")
      .select("tenant_channel_automation_disabled")
      .eq("tenant_id", TEST_TENANT_ID)
      .single();
    expect(rollback.error).toBeNull();
    expect(rollback.data?.tenant_channel_automation_disabled).toBe(true);
  });

  it("stores yellow risk hold state and refreshes the active draft through transactional RPC", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const client = state.clients.find((item) => item.id.endsWith("12"));

    expect(client).toBeDefined();

    const withYellow = await runSupabaseSimulation({
      clientId: client!.id,
      body: "D vitamini takviyesi kullanayim mi?",
      idempotencyKey: `yellow-hold-${Date.now()}`,
    });
    const draft = withYellow.messages.find(
      (message) => message.origin === "ai_generated" && message.status === "draft",
    );

    expect(draft).toBeDefined();
    expect(withYellow.clients.find((item) => item.id === client!.id)?.yellowRiskHold).toMatchObject({
      status: "active",
      activeDraftMessageId: draft?.id,
    });

    const withRefresh = await runSupabaseSimulation({
      clientId: client!.id,
      body: "Bugun kahvaltida yulaf olur mu?",
      idempotencyKey: `yellow-hold-refresh-${Date.now()}`,
    });
    const refreshedDraft = withRefresh.messages.find((message) => message.id === draft?.id);
    const supersededDecision = withRefresh.aiDecisions.find(
      (decision) => decision.id === draft?.generatedByAiDecisionId,
    );

    expect(refreshedDraft?.status).toBe("draft");
    expect(supersededDecision?.sendStatus).toBe("draft_invalidated");
    expect(supersededDecision?.blockedReason).toBe("yellow_hold_draft_superseded");

    const storedClient = await admin
      .from("clients")
      .select("ai_status, ai_mode, yellow_risk_hold")
      .eq("tenant_id", state.tenant.id)
      .eq("id", client!.id)
      .single();

    expect(storedClient.error).toBeNull();
    expect(storedClient.data).toMatchObject({
      ai_status: "passive",
      ai_mode: "paused",
      yellow_risk_hold: { status: "active", activeDraftMessageId: draft?.id },
    });
    await resetSupabaseState();
  }, 30000);

  it("stores Supabase-backed group quarantines without client records or AI artifacts", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const idempotencyKey = `group-${Date.now()}`;
    const beforeMessages = state.messages.length;
    const beforeRiskAssessments = state.riskAssessments.length;
    const beforeDecisions = state.aiDecisions.length;
    const beforeHandoffs = state.handoffCases.length;

    const next = await runSupabaseSimulation({
      body: "Group message must not be stored",
      idempotencyKey,
      channel: "whatsapp",
      sourceConversationType: "group",
      sourceConversationId: "rls-group",
      sourceMessageId: "rls-group-message",
      senderChannelUserId: "+905551119999",
    });

    expect(next.lastSimulation?.blockedReason).toBe("whatsapp_group_unsupported");
    expect(next.inboundQuarantines).toHaveLength(0);
    expect(next.messages).toHaveLength(beforeMessages);
    expect(next.riskAssessments).toHaveLength(beforeRiskAssessments);
    expect(next.aiDecisions).toHaveLength(beforeDecisions);
    expect(next.handoffCases).toHaveLength(beforeHandoffs);

    const quarantine = await admin
      .from("inbound_quarantines")
      .select("channel, source_conversation_type, reason, source_message_id")
      .eq("tenant_id", state.tenant.id)
      .eq("source_conversation_id", "rls-group")
      .single();

    expect(quarantine.error).toBeNull();
    expect(quarantine.data).toEqual({
      channel: "whatsapp",
      source_conversation_type: "group",
      reason: "whatsapp_group_unsupported",
      source_message_id: "rls-group-message",
    });
    expect(JSON.stringify(quarantine.data)).not.toContain("Group message must not be stored");

    const event = await admin
      .from("processed_inbound_events")
      .select("channel")
      .eq("provider_event_id", idempotencyKey)
      .single();

    expect(event.error).toBeNull();
    expect(event.data?.channel).toBe("whatsapp");
    await resetSupabaseState();
  }, 30000);

  it("audits Supabase-backed AI control updates", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const client = state.clients[0];

    await patchSupabaseClientRecord(client.id, {
      aiStatus: "passive",
      aiMode: "manual",
      aiActiveFrom: "2026-05-23T10:00:00.000Z",
    });

    const statusEvent = await admin
      .from("client_ai_status_events")
      .select("previous_status, new_status, ai_mode, active_from, reason")
      .eq("client_id", client.id)
      .eq("reason", "client_ai_control_updated")
      .single();

    expect(statusEvent.error).toBeNull();
    expect(statusEvent.data?.previous_status).toBe(client.aiStatus);
    expect(statusEvent.data?.new_status).toBe("passive");
    expect(statusEvent.data?.ai_mode).toBe("manual");

    const auditEvent = await admin
      .from("audit_events")
      .select("event_type, entity_id")
      .eq("entity_id", client.id)
      .eq("event_type", "client_ai_control_updated")
      .single();

    expect(auditEvent.error).toBeNull();
    expect(auditEvent.data?.entity_id).toBe(client.id);
    await resetSupabaseState();
  }, 30000);

  it("uses atomic activation RPC with conversation and client revision guards", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const client = state.clients[0]!;
    const conversation = state.conversations.find((item) => item.clientId === client.id)!;

    await patchSupabaseClientRecord(client.id, {
      aiStatus: "passive",
      aiMode: "manual",
    });
    const beforeActivation = await loadSupabaseState();
    const inactiveClient = beforeActivation.clients.find((item) => item.id === client.id)!;
    const inactiveConversation = beforeActivation.conversations.find((item) => item.clientId === client.id)!;

    const activated = await activateSupabaseClientAi(client.id, {
      requestedAiMode: "copilot",
      expectedConversationRevision: inactiveConversation.revision,
      expectedClientContextRevision: inactiveClient.contextRevision,
    });
    const activatedClient = activated.clients.find((item) => item.id === client.id)!;
    const activatedConversation = activated.conversations.find((item) => item.clientId === client.id)!;

    expect(activatedClient.aiStatus).toBe("active");
    expect(activatedClient.aiMode).toBe("copilot");
    expect(activatedConversation.revision).toBe(conversation.revision + 1);

    await expect(
      activateSupabaseClientAi(client.id, {
        requestedAiMode: "copilot",
        expectedConversationRevision: inactiveConversation.revision,
        expectedClientContextRevision: inactiveClient.contextRevision,
      }),
    ).rejects.toMatchObject({ status: 409, message: "reactivation_conflict_client_context_revision" });

    await resetSupabaseState();
  }, 30000);

  it("serializes activation against inbound, red-risk, and human-echo conversation commits", async () => {
    for (const scenario of ["inbound", "red-risk", "human-echo"]) {
      await resetSupabaseState();
      const initial = await loadSupabaseState();
      const client = initial.clients[0]!;
      await patchSupabaseClientRecord(client.id, { aiStatus: "passive", aiMode: "manual" });
      const before = await loadSupabaseState();
      const inactiveClient = before.clients.find((item) => item.id === client.id)!;
      const conversation = before.conversations.find((item) => item.clientId === client.id)!;

      const activation = activateSupabaseClientAi(client.id, {
        requestedAiMode: "copilot",
        expectedConversationRevision: conversation.revision,
        expectedClientContextRevision: inactiveClient.contextRevision,
      });
      const competingCommit = admin.rpc("commit_inbound_simulation", {
        p_tenant_id: inactiveClient.tenantId,
        p_payload: {
          expectedConversationRevisions: { [conversation.id]: conversation.revision },
          conversationUpdates: [{ id: conversation.id, revision: conversation.revision + 1 }],
          auditEvents: [{
            id: crypto.randomUUID(),
            eventType: `p85_if_r3_race_${scenario}`,
            entityType: "conversation",
            entityId: conversation.id,
            metadata: { scenario },
            createdAt: new Date().toISOString(),
          }],
        },
      }).then((result) => {
        if (result.error) throw new Error(result.error.message);
        return result;
      });

      const results = await Promise.allSettled([activation, competingCommit]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
      expect(String(rejected.reason)).toMatch(/reactivation_conflict_(client_context|conversation)_revision/);
      expect(String(rejected.reason)).not.toMatch(/deadlock/i);
    }

    await resetSupabaseState();
  }, 60000);

  it("resolves structured updates atomically against the target panel revision", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const client = state.clients[0]!;
    const notificationId = crypto.randomUUID();
    const sourceMessage = state.messages.find((message) =>
      state.conversations.some(
        (conversation) => conversation.clientId === client.id && conversation.id === message.conversationId,
      ),
    )!;

    const insert = await admin.from("notifications").insert({
      id: notificationId,
      tenant_id: client.tenantId,
      type: "system",
      kind: "structured_record_update_required",
      priority: "review_required",
      entity_type: "client",
      entity_id: client.id,
      client_id: client.id,
      title: "Structured update",
      body: "Diet plan update required",
      read: false,
      dedupe_key: `p85-if-e:structured:${client.id}:diet_plan:${sourceMessage.id}`,
      source_message_id: sourceMessage.id,
      target_panel: "diet_plan",
      baseline_revision: client.contextRevision,
      occurrence_count: 1,
      last_occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    expect(insert.error).toBeNull();

    await expect(resolveSupabaseStructuredRecordUpdateNotification(notificationId)).rejects.toMatchObject({
      status: 409,
      message: "structured_update_revision_pending",
    });

    await patchSupabaseClientRecord(client.id, {
      dietPlan: { ...client.dietPlan, summary: `${client.dietPlan.summary} revised` },
    });
    await resolveSupabaseStructuredRecordUpdateNotification(notificationId);
    const resolved = await admin
      .from("notifications")
      .select("resolved_at, resolved_by_dietitian_id")
      .eq("tenant_id", client.tenantId)
      .eq("id", notificationId)
      .single();
    expect(resolved.error).toBeNull();
    expect(resolved.data?.resolved_at).toBeTruthy();
    expect(resolved.data?.resolved_by_dietitian_id).toBe(state.dietitian.id);

    await resetSupabaseState();
  }, 30000);

  it("mutates notification receipts per actor and blocks assistant direct receipt writes", async () => {
    await resetSupabaseState();
    const member = await signIn("rls-member@manu.local");
    const assistant = await signIn("rls-assistant@manu.local");

    const beforeReceipts = await member
      .from("notification_receipts")
      .select("notification_id, read_at, acknowledged_at")
      .eq("notification_id", TEST_NOTIFICATION_ID);
    expect(beforeReceipts.error).toBeNull();
    expect(beforeReceipts.data).toEqual([]);

    const read = await member.rpc("p85_stage_4b_mark_notification_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_notification_id: TEST_NOTIFICATION_ID,
    });
    expect(read.error).toBeNull();

    const afterRead = await member
      .from("notification_receipts")
      .select("notification_id, read_at, acknowledged_at")
      .eq("notification_id", TEST_NOTIFICATION_ID);
    expect(afterRead.error).toBeNull();
    expect(afterRead.data?.[0]?.read_at).toBeTruthy();
    expect(afterRead.data?.[0]?.acknowledged_at).toBeNull();

    const ack = await member.rpc("p85_stage_4b_acknowledge_notification_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_notification_id: TEST_NOTIFICATION_ID,
    });
    expect(ack.error).toBeNull();

    const afterAck = await member
      .from("notification_receipts")
      .select("notification_id, read_at, acknowledged_at")
      .eq("notification_id", TEST_NOTIFICATION_ID);
    expect(afterAck.data?.[0]?.acknowledged_at).toBeTruthy();

    const assistantMutation = await assistant.rpc("p85_stage_4b_mark_notification_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_notification_id: TEST_NOTIFICATION_ID,
    });
    expect(assistantMutation.error?.message).toMatch(/notification_receipt_mutation_forbidden/i);

    const receiptInsert = await assistant.from("notification_receipts").insert({
      tenant_id: TEST_TENANT_ID,
      notification_id: TEST_NOTIFICATION_ID,
      dietitian_id: ASSISTANT_DIETITIAN_ID,
      read_at: new Date().toISOString(),
    });
    expect(receiptInsert.error?.message).toMatch(/row-level security/i);

    await resetSupabaseState();
  }, 30000);

  it("persists actor-owned monotonic conversation read receipts with role boundaries", async () => {
    await resetSupabaseState();
    const now = new Date().toISOString();
    const inboundTwoId = "00000000-0000-4000-8000-000000000962";
    const inboundThreeId = "00000000-0000-4000-8000-000000000963";
    const revokedInboundId = "00000000-0000-4000-8000-000000000964";

    await checked(
      admin.from("messages").insert([
        {
          id: inboundTwoId,
          tenant_id: TEST_TENANT_ID,
          conversation_id: TEST_CONVERSATION_ID,
          sender: "client",
          origin: "client_inbound",
          body: "Second inbound",
          conversation_sequence: 2,
          content_status: "available",
          created_at: now,
        },
        {
          id: inboundThreeId,
          tenant_id: TEST_TENANT_ID,
          conversation_id: TEST_CONVERSATION_ID,
          sender: "client",
          origin: "client_inbound",
          body: "Third inbound",
          conversation_sequence: 3,
          content_status: "available",
          created_at: now,
        },
        {
          id: revokedInboundId,
          tenant_id: TEST_TENANT_ID,
          conversation_id: TEST_CONVERSATION_ID,
          sender: "client",
          origin: "client_inbound",
          body: "Revoked inbound",
          conversation_sequence: 4,
          content_status: "revoked",
          created_at: now,
        },
      ]),
    );

    await checked(
      admin
        .from("messages")
        .update({ conversation_sequence: 1 })
        .eq("tenant_id", TEST_TENANT_ID)
        .eq("id", TEST_MESSAGE_ID),
    );

    const owner = await signIn("rls-member@manu.local");
    const assistant = await signIn("rls-assistant@manu.local");
    const auditor = await signIn("rls-auditor@manu.local");

    const firstRead = await owner.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_through_sequence: 1,
    });
    expect(firstRead.error).toBeNull();
    expect(firstRead.data?.[0]?.last_read_sequence).toBe(1);
    expect(Number(firstRead.data?.[0]?.unread_count)).toBe(2);

    const backwardRead = await owner.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_through_sequence: 1,
    });
    expect(backwardRead.error).toBeNull();
    expect(backwardRead.data?.[0]?.last_read_sequence).toBe(1);

    const fullRead = await owner.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_through_sequence: 3,
    });
    expect(fullRead.error).toBeNull();
    expect(fullRead.data?.[0]?.last_read_sequence).toBe(3);
    expect(Number(fullRead.data?.[0]?.unread_count)).toBe(0);

    const assistantRead = await assistant.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: assistantUserId,
      p_dietitian_id: ASSISTANT_DIETITIAN_ID,
      p_role: "assistant",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_through_sequence: 2,
    });
    expect(assistantRead.error).toBeNull();
    expect(assistantRead.data?.[0]?.last_read_sequence).toBe(2);
    expect(Number(assistantRead.data?.[0]?.unread_count)).toBe(1);

    const ownerReceipts = await owner
      .from("conversation_read_receipts")
      .select("dietitian_id, last_read_sequence")
      .eq("tenant_id", TEST_TENANT_ID)
      .eq("conversation_id", TEST_CONVERSATION_ID);
    expect(ownerReceipts.error).toBeNull();
    expect(ownerReceipts.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dietitian_id: TEST_DIETITIAN_ID, last_read_sequence: 3 }),
        expect.objectContaining({ dietitian_id: ASSISTANT_DIETITIAN_ID, last_read_sequence: 2 }),
      ]),
    );

    const auditorRead = await auditor.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: auditorUserId,
      p_dietitian_id: AUDITOR_DIETITIAN_ID,
      p_role: "auditor",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_through_sequence: 1,
    });
    expect(auditorRead.error?.message).toMatch(/conversation_not_found/i);

    const auditorReceipts = await auditor
      .from("conversation_read_receipts")
      .select("conversation_id")
      .eq("tenant_id", TEST_TENANT_ID);
    expect(auditorReceipts.error).toBeNull();
    expect(auditorReceipts.data).toEqual([]);

    const crossTenantRead = await owner.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: OTHER_CONVERSATION_ID,
      p_through_sequence: 1,
    });
    expect(crossTenantRead.error?.message).toMatch(/conversation_not_found/i);

    const invalidSequence = await owner.rpc("p85_stage_4b2_mark_conversation_read_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_through_sequence: 99,
    });
    expect(invalidSequence.error?.message).toMatch(/conversation_read_sequence_invalid/i);

    const directInsert = await assistant.from("conversation_read_receipts").insert({
      tenant_id: TEST_TENANT_ID,
      conversation_id: TEST_CONVERSATION_ID,
      dietitian_id: ASSISTANT_DIETITIAN_ID,
      last_read_sequence: 1,
      read_at: now,
    });
    expect(directInsert.error?.message).toMatch(/row-level security/i);

    await resetSupabaseState();
  }, 30000);

  it("returns actor-scoped Stage 4B-2 projection bundles for list and detail reads", async () => {
    await resetSupabaseState();
    const owner = await signIn("rls-member@manu.local");
    const auditor = await signIn("rls-auditor@manu.local");

    const listBundle = await owner.rpc("p85_stage_4b2_load_list_projection_source_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
    });
    expect(listBundle.error).toBeNull();
    expect(Array.isArray(listBundle.data?.conversations)).toBe(true);
    expect(listBundle.data?.conversations?.length).toBeGreaterThan(0);

    const detailBundle = await owner.rpc("p85_stage_4b2_load_detail_projection_source_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
    });
    expect(detailBundle.error).toBeNull();
    expect(detailBundle.data?.conversations?.[0]?.id).toBe(TEST_CONVERSATION_ID);

    const auditorList = await auditor.rpc("p85_stage_4b2_load_list_projection_source_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: auditorUserId,
      p_dietitian_id: AUDITOR_DIETITIAN_ID,
      p_role: "auditor",
    });
    expect(auditorList.error?.message).toMatch(/conversation_read_forbidden/i);

    const hiddenDetail = await owner.rpc("p85_stage_4b2_load_detail_projection_source_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: OTHER_CONVERSATION_ID,
    });
    expect(hiddenDetail.error?.message).toMatch(/conversation_not_found/i);

    await resetSupabaseState();
  }, 30000);

  it("uses atomic context intake RPCs with client-safe proposal guards", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const client = state.clients.find((item) => item.fullName === "Mert Kaya")!;
    const otherClient = state.clients.find((item) => item.id !== client.id)!;

    const withProposal = await createSupabaseContextIntakeProposal(
      { clientId: client.id, confirmFullName: client.fullName, confirmPhoneE164: client.primaryPhoneE164 || "" },
      {
        sourceText: "Telefonda kahvalti saatini 09:00 yaptik.",
        intakeSource: "phone",
        title: "Kahvalti saati",
        summary: "Kahvalti 09:00",
      },
    );
    const proposal = withProposal.contextIntakeProposals.at(-1)!;

    await expect(rejectSupabaseContextIntakeProposal(otherClient.id, proposal.id)).rejects.toMatchObject({
      status: 404,
      message: "context_intake_proposal_not_found",
    });

    const confirmed = await confirmSupabaseContextIntakeProposal(client.id, proposal.id);
    expect(confirmed.contextIntakeProposals.find((item) => item.id === proposal.id)?.confirmationCount).toBe(1);

    const applied = await applySupabaseContextIntakeProposal(client.id, proposal.id);
    const appliedProposal = applied.contextIntakeProposals.find((item) => item.id === proposal.id)!;
    expect(appliedProposal.status).toBe("applied");
    expect(applied.clientContextUpdates.some((update) => update.id === appliedProposal.appliedContextUpdateId)).toBe(
      true,
    );

    const staleSeed = await createSupabaseContextIntakeProposal(
      { clientId: client.id, confirmFullName: client.fullName, confirmPhoneE164: client.primaryPhoneE164 || "" },
      {
        sourceText: "Telefonda su tuketimini takip edecegiz.",
        intakeSource: "phone",
        title: "Su takibi",
        summary: "Su tuketimi takip edilecek",
      },
    );
    const staleProposal = staleSeed.contextIntakeProposals.at(-1)!;
    await confirmSupabaseContextIntakeProposal(client.id, staleProposal.id);
    await addSupabaseClientContextUpdate(client.id, {
      source: "phone",
      title: "Ara revizyon",
      summary: "Proposal baselinedan sonra manuel context eklendi.",
      importance: "routine",
    });

    await expect(applySupabaseContextIntakeProposal(client.id, staleProposal.id)).rejects.toMatchObject({
      status: 409,
      message: "context_intake_proposal_stale",
    });

    await resetSupabaseState();
  }, 30000);

  it("persists draft approve and dismiss updates through transactional RPC", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const planBackedClient = state.clients.find((client) => client.fullName === "Mert Kaya");

    expect(planBackedClient).toBeDefined();
    await patchSupabaseClientRecord(planBackedClient!.id, {
      aiMode: "copilot",
    });

    const withDraft = await runSupabaseSimulation({
      clientId: planBackedClient!.id,
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: `draft-approve-${Date.now()}`,
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(draft).toBeDefined();

    const approvedBody = "Planina uygun olarak ara ogunde yogurt veya lor peyniri tercih edebilirsin.";
    await approveSupabaseDraftMessage(draft!.id, approvedBody);

    const approved = await admin
      .from("messages")
      .select("body, status, approved_by_dietitian_id")
      .eq("id", draft!.id)
      .single();

    expect(approved.error).toBeNull();
    expect(approved.data).toMatchObject({
      body: approvedBody,
      status: "sent",
      approved_by_dietitian_id: state.dietitian.id,
    });

    const withSecondDraft = await runSupabaseSimulation({
      clientId: planBackedClient!.id,
      body: "Aksam yemeginde ne yesem?",
      idempotencyKey: `draft-dismiss-${Date.now()}`,
    });
    const secondDraft = withSecondDraft.messages.find(
      (message) => message.status === "draft" && message.id !== draft!.id,
    );
    expect(secondDraft).toBeDefined();

    await dismissSupabaseDraftMessage(secondDraft!.id);

    const dismissed = await admin.from("messages").select("status").eq("id", secondDraft!.id).single();
    expect(dismissed.error).toBeNull();
    expect(dismissed.data?.status).toBe("blocked");
    await resetSupabaseState();
  }, 30000);

  it("persists form-response draft invalidations through transactional RPC", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const copilotClient = state.clients.find((client) => client.aiMode === "copilot");
    const schema = state.clientFormSchemas.find((item) => item.status === "published");

    expect(copilotClient).toBeDefined();
    expect(schema).toBeDefined();

    const withDraft = await runSupabaseSimulation({
      clientId: copilotClient!.id,
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: `form-invalidates-${Date.now()}`,
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(draft).toBeDefined();

    await saveSupabaseFormResponse({
      clientId: copilotClient!.id,
      schemaId: schema!.id,
      submittedPhoneE164: copilotClient!.primaryPhoneE164,
      answers: {
        ...(await import("./phase-70-seed-answers")).buildPhase70QualifiedClientAnswers(),
        work_school_schedule: "Updated routine for transactional RPC test.",
      },
    });

    const blockedDraft = await admin.from("messages").select("status").eq("id", draft!.id).single();
    const decision = await admin
      .from("ai_decisions")
      .select("send_status, blocked_reason")
      .eq("id", draft!.generatedByAiDecisionId)
      .single();
    const formResponse = await admin
      .from("client_form_responses")
      .select("submitted_phone_e164, answers")
      .eq("client_id", copilotClient!.id)
      .eq("schema_id", schema!.id)
      .single();

    expect(blockedDraft.error).toBeNull();
    expect(blockedDraft.data?.status).toBe("blocked");
    expect(decision.error).toBeNull();
    expect(decision.data).toMatchObject({
      send_status: "draft_invalidated",
      blocked_reason: "client_form_response_changed",
    });
    expect(formResponse.error).toBeNull();
    expect(formResponse.data?.submitted_phone_e164).toBe(copilotClient!.primaryPhoneE164);
    await resetSupabaseState();
  }, 30000);

  it("persists client context draft invalidations through transactional RPC", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const copilotClient = state.clients.find((client) => client.aiMode === "copilot");

    expect(copilotClient).toBeDefined();

    const withDraft = await runSupabaseSimulation({
      clientId: copilotClient!.id,
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: `context-invalidates-${Date.now()}`,
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(draft).toBeDefined();

    await addSupabaseClientContextUpdate(copilotClient!.id, {
      source: "phone",
      occurredAt: "2026-06-02T10:00:00.000Z",
      title: "Phone check-in",
      summary: "Client reported schedule change.",
      details: "No raw external health data.",
      importance: "important",
    });

    const blockedDraft = await admin.from("messages").select("status").eq("id", draft!.id).single();
    const decision = await admin
      .from("ai_decisions")
      .select("send_status, blocked_reason")
      .eq("id", draft!.generatedByAiDecisionId)
      .single();
    const contextUpdate = await admin
      .from("client_context_updates")
      .select("title, source")
      .eq("client_id", copilotClient!.id)
      .single();

    expect(blockedDraft.error).toBeNull();
    expect(blockedDraft.data?.status).toBe("blocked");
    expect(decision.error).toBeNull();
    expect(decision.data).toMatchObject({
      send_status: "draft_invalidated",
      blocked_reason: "client_context_update_added",
    });
    expect(contextUpdate.error).toBeNull();
    expect(contextUpdate.data).toMatchObject({ title: "Phone check-in", source: "phone" });
    await resetSupabaseState();
  }, 30000);

  it("uses actor-aware bounded Stage 4B RPCs and isolates receipts", async () => {
    await resetSupabaseState();
    const now = new Date().toISOString();
    await checked(
      admin.from("notifications").insert({
        id: TEST_STAGE4B_NOTIFICATION_ID,
        tenant_id: TEST_TENANT_ID,
        type: "system",
        kind: "safe_reply_unavailable",
        priority: "intervention_required",
        entity_type: "message",
        entity_id: TEST_MESSAGE_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_MESSAGE_ID,
        occurrence_count: 1,
        last_occurred_at: now,
        title: "Hidden structured title",
        body: "Raw body must not leave the RPC.",
        read: false,
        created_at: now,
      }),
    );

    const owner = await signIn("rls-member@manu.local");
    const assistant = await signIn("rls-assistant@manu.local");
    const assignedDietitian = await signIn("rls-viewer@manu.local");
    const auditor = await signIn("rls-auditor@manu.local");
    const listArgs = {
      p_status: "active",
      p_limit: 30,
    };

    const ownerList = await owner.rpc("p85_stage_4b_list_notifications_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      ...listArgs,
    });
    expect(ownerList.error).toBeNull();
    expect(ownerList.data?.some((row: { id: string }) => row.id === TEST_STAGE4B_NOTIFICATION_ID)).toBe(true);

    const assistantList = await assistant.rpc("p85_stage_4b_list_notifications_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: assistantUserId,
      p_dietitian_id: ASSISTANT_DIETITIAN_ID,
      p_role: "assistant",
      ...listArgs,
    });
    expect(assistantList.error).toBeNull();
    expect(assistantList.data?.some((row: { id: string }) => row.id === TEST_STAGE4B_NOTIFICATION_ID)).toBe(true);

    const assignedList = await assignedDietitian.rpc("p85_stage_4b_list_notifications_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: viewerUserId,
      p_dietitian_id: VIEWER_DIETITIAN_ID,
      p_role: "dietitian",
      ...listArgs,
    });
    expect(assignedList.error).toBeNull();
    expect(assignedList.data?.some((row: { id: string }) => row.id === TEST_STAGE4B_NOTIFICATION_ID)).toBe(true);

    const auditorList = await auditor.rpc("p85_stage_4b_list_notifications_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: auditorUserId,
      p_dietitian_id: AUDITOR_DIETITIAN_ID,
      p_role: "auditor",
      ...listArgs,
    });
    expect(auditorList.error).toBeNull();
    expect(auditorList.data).toEqual([]);

    const ownerRead = await owner.rpc("p85_stage_4b_mark_notification_read_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_notification_id: TEST_STAGE4B_NOTIFICATION_ID,
    });
    expect(ownerRead.error).toBeNull();
    const assistantMutation = await assistant.rpc("p85_stage_4b_mark_notification_read_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: assistantUserId,
      p_dietitian_id: ASSISTANT_DIETITIAN_ID,
      p_role: "assistant",
      p_notification_id: TEST_STAGE4B_NOTIFICATION_ID,
    });
    expect(assistantMutation.error?.message).toMatch(/notification_not_found/i);

    const receipts = await admin
      .from("notification_receipts")
      .select("dietitian_id, read_at")
      .eq("tenant_id", TEST_TENANT_ID)
      .eq("notification_id", TEST_STAGE4B_NOTIFICATION_ID);
    expect(receipts.error).toBeNull();
    expect(receipts.data).toEqual([expect.objectContaining({ dietitian_id: TEST_DIETITIAN_ID })]);
    expect(receipts.data?.some((receipt) => receipt.dietitian_id === ASSISTANT_DIETITIAN_ID)).toBe(false);

    await resetSupabaseState();
  }, 30000);

  it("requires an acknowledged actor receipt for atomic unsupported-media completion", async () => {
    await resetSupabaseState();
    const now = new Date().toISOString();
    await checked(
      admin.from("notifications").insert({
        id: TEST_STAGE4B_MEDIA_NOTIFICATION_ID,
        tenant_id: TEST_TENANT_ID,
        type: "system",
        kind: "unsupported_media_review",
        priority: "review_required",
        entity_type: "conversation",
        entity_id: TEST_CONVERSATION_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_MESSAGE_ID,
        occurrence_count: 1,
        last_occurred_at: now,
        title: "Unsupported media",
        body: "Raw body must not leave the RPC.",
        read: false,
        created_at: now,
      }),
    );

    const owner = await signIn("rls-member@manu.local");
    const completeBeforeAck = await owner.rpc("p85_stage_4b_complete_unsupported_media_review_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_notification_id: TEST_STAGE4B_MEDIA_NOTIFICATION_ID,
    });
    expect(completeBeforeAck.error?.message).toMatch(/requires_acknowledged_receipt/i);

    const acknowledgement = await owner.rpc("p85_stage_4b_acknowledge_notification_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_notification_id: TEST_STAGE4B_MEDIA_NOTIFICATION_ID,
    });
    expect(acknowledgement.error).toBeNull();

    const complete = await owner.rpc("p85_stage_4b_complete_unsupported_media_review_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_notification_id: TEST_STAGE4B_MEDIA_NOTIFICATION_ID,
    });
    expect(complete.error).toBeNull();
    expect(complete.data?.[0]?.resolved_at).toBeTruthy();

    await resetSupabaseState();
  }, 30000);

  it("denies authenticated direct reads on Stage 4B-3 media tables", async () => {
    const member = await signIn("rls-member@manu.local");
    const assistant = await signIn("rls-assistant@manu.local");
    const auditor = await signIn("rls-auditor@manu.local");

    for (const client of [member, assistant, auditor]) {
      const assets = await client.from("media_assets").select("id").eq("id", TEST_STAGE4B3_MEDIA_ASSET_ID);
      expect(assets.error?.message).toMatch(/permission denied|row-level security/i);

      const analysis = await client
        .from("visual_analysis_records")
        .select("id")
        .eq("id", TEST_STAGE4B3_VISUAL_ANALYSIS_ID);
      expect(analysis.error?.message).toMatch(/permission denied|row-level security/i);

      const bundles = await client.from("inbound_message_bundles").select("id").eq("id", TEST_STAGE4B3_BUNDLE_ID);
      expect(bundles.error?.message).toMatch(/permission denied|row-level security/i);

      const bundleItems = await client
        .from("inbound_message_bundle_items")
        .select("id")
        .eq("id", TEST_STAGE4B3_BUNDLE_ITEM_ID);
      expect(bundleItems.error?.message).toMatch(/permission denied|row-level security/i);

      const corrections = await client
        .from("visual_corrections")
        .select("id")
        .eq("id", TEST_STAGE4B3_VISUAL_CORRECTION_ID);
      expect(corrections.error?.message).toMatch(/permission denied|row-level security/i);
    }

    const directInsert = await member.from("media_assets").insert({
      id: "00000000-0000-4000-8000-000000000975",
      tenant_id: TEST_TENANT_ID,
      client_id: TEST_CLIENT_ID,
      conversation_id: TEST_CONVERSATION_ID,
      message_id: TEST_MESSAGE_ID,
      declared_mime_type: "image/jpeg",
      status: "admitted",
    });
    expect(directInsert.error?.message).toMatch(/permission denied|row-level security/i);

    const bucket = await admin.storage.getBucket("p85-stage-4b3-media");
    expect(bucket.error).toBeNull();
    expect(bucket.data?.public).toBe(false);
  });

  it("claims Stage 4B-3 worker leases through service-role RPCs only", async () => {
    const member = await signIn("rls-member@manu.local");

    const deniedClaim = await member.rpc("p85_stage_4b3_claim_media_asset_worker", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "blocked-worker",
    });
    expect(deniedClaim.error?.message).toMatch(/permission denied|service_role_required/i);

    const claimedAsset = await admin.rpc("p85_stage_4b3_claim_media_asset_worker", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "rls-test-worker",
    });
    expect(claimedAsset.error).toBeNull();
    expect(claimedAsset.data?.[0]?.id).toBe(TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID);
    expect(claimedAsset.data?.[0]?.lease_owner).toBe("rls-test-worker");
    expect(claimedAsset.data?.[0]?.lease_expires_at).toBeTruthy();

    const releasedAsset = await admin.rpc("p85_stage_4b3_release_media_asset_lease", {
      p_tenant_id: TEST_TENANT_ID,
      p_asset_id: TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID,
      p_worker_id: "rls-test-worker",
      p_success: true,
    });
    expect(releasedAsset.error).toBeNull();
    expect(releasedAsset.data?.lease_owner).toBeNull();

    const deniedBundleClaim = await member.rpc("p85_stage_4b3_claim_inbound_message_bundle_worker", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "blocked-worker",
    });
    expect(deniedBundleClaim.error?.message).toMatch(/permission denied|service_role_required/i);

    const claimedBundle = await admin.rpc("p85_stage_4b3_claim_inbound_message_bundle_worker", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "rls-test-worker",
    });
    expect(claimedBundle.error).toBeNull();
    expect(claimedBundle.data?.[0]?.id).toBe(TEST_STAGE4B3_CLAIM_BUNDLE_ID);
    expect(claimedBundle.data?.[0]?.status).toBe("processing");
    expect(claimedBundle.data?.[0]?.lease_owner).toBe("rls-test-worker");

    const releasedBundle = await admin.rpc("p85_stage_4b3_release_inbound_bundle_lease", {
      p_tenant_id: TEST_TENANT_ID,
      p_bundle_id: TEST_STAGE4B3_CLAIM_BUNDLE_ID,
      p_worker_id: "rls-test-worker",
      p_success: true,
      p_reopen: false,
    });
    expect(releasedBundle.error).toBeNull();
    expect(releasedBundle.data?.lease_owner).toBeNull();
  });

  it("claims Stage 4B-3 V2 worker leases with lease tokens and blocks authenticated bounded media RPCs", async () => {
    const member = await signIn("rls-member@manu.local");

    const deniedV2Claim = await member.rpc("p85_stage_4b3_claim_media_work_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "blocked-worker",
    });
    expect(deniedV2Claim.error?.message).toMatch(/permission denied|service_role_required/i);

    const claimedAsset = await admin.rpc("p85_stage_4b3_claim_media_work_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "rls-v2-worker",
    });
    expect(claimedAsset.error).toBeNull();
    expect(claimedAsset.data?.[0]?.id).toBe(TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID);
    expect(claimedAsset.data?.[0]?.lease_token).toBeTruthy();

    const deniedRelease = await admin.rpc("p85_stage_4b3_release_media_work_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_asset_id: TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID,
      p_worker_id: "rls-v2-worker",
      p_lease_token: "00000000-0000-4000-8000-000000000999",
      p_success: true,
    });
    expect(deniedRelease.error?.message).toMatch(/media_asset_lease_not_found/i);

    const releasedAsset = await admin.rpc("p85_stage_4b3_release_media_work_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_asset_id: TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID,
      p_worker_id: "rls-v2-worker",
      p_lease_token: claimedAsset.data?.[0]?.lease_token,
      p_success: true,
    });
    expect(releasedAsset.error).toBeNull();
    expect(releasedAsset.data?.lease_token).toBeNull();

    const deniedMetadata = await member.rpc("p85_stage_4b3_load_bounded_media_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_message_ids: [TEST_MESSAGE_ID],
    });
    expect(deniedMetadata.error?.message).toMatch(/permission denied|service_role_required/i);

    const metadata = await admin.rpc("p85_stage_4b3_load_bounded_media_v2", {
      p_tenant_id: TEST_TENANT_ID,
      p_user_id: memberUserId,
      p_dietitian_id: TEST_DIETITIAN_ID,
      p_role: "owner",
      p_conversation_id: TEST_CONVERSATION_ID,
      p_message_ids: [TEST_MESSAGE_ID],
    });
    expect(metadata.error).toBeNull();
    const analysisRows = metadata.data?.visual_analysis_records ?? [];
    expect(Array.isArray(analysisRows)).toBe(true);
    if (analysisRows.length > 0) {
      expect(analysisRows[0]).not.toHaveProperty("observation");
      expect(analysisRows[0]).toHaveProperty("scene_type");
      expect(analysisRows[0]).toHaveProperty("retrieval_eligible");
    }
  });

  it("denies authenticated direct reads on Stage 4B-4 audio tables", async () => {
    const member = await signIn("rls-member@manu.local");
    const assistant = await signIn("rls-assistant@manu.local");
    const auditor = await signIn("rls-auditor@manu.local");

    for (const client of [member, assistant, auditor]) {
      const transcriptions = await client
        .from("audio_transcription_records")
        .select("id")
        .eq("id", TEST_STAGE4B4_TRANSCRIPTION_ID);
      expect(transcriptions.error?.message).toMatch(/permission denied|row-level security/i);

      const corrections = await client
        .from("audio_transcript_corrections")
        .select("id")
        .eq("id", TEST_STAGE4B4_TRANSCRIPT_CORRECTION_ID);
      expect(corrections.error?.message).toMatch(/permission denied|row-level security/i);

      const idempotency = await client
        .from("audio_transcript_correction_idempotency")
        .select("dedupe_key")
        .eq("tenant_id", TEST_TENANT_ID);
      expect(idempotency.error?.message).toMatch(/permission denied|row-level security/i);
    }

    const directInsert = await member.from("audio_transcription_records").insert({
      id: "00000000-0000-4000-8000-000000000993",
      tenant_id: TEST_TENANT_ID,
      client_id: TEST_CLIENT_ID,
      conversation_id: TEST_CONVERSATION_ID,
      message_id: TEST_MESSAGE_ID,
      media_asset_id: TEST_STAGE4B4_AUDIO_ASSET_ID,
      locale: "tr-TR",
      status: "pending",
    });
    expect(directInsert.error?.message).toMatch(/permission denied|row-level security/i);

    const bucket = await admin.storage.getBucket("p85-stage-4b4-audio");
    expect(bucket.error).toBeNull();
    expect(bucket.data?.public).toBe(false);
  });

  it("claims Stage 4B-4 audio worker leases through service-role RPCs only", async () => {
    const member = await signIn("rls-member@manu.local");

    const deniedAudioClaim = await member.rpc("p85_stage_4b4_claim_audio_admission_work_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "blocked-worker",
    });
    expect(deniedAudioClaim.error?.message).toMatch(/permission denied|service_role_required/i);

    const claimedAudio = await admin.rpc("p85_stage_4b4_claim_audio_admission_work_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "rls-test-audio-worker",
    });
    expect(claimedAudio.error).toBeNull();
    expect(claimedAudio.data?.[0]?.id).toBe(TEST_STAGE4B4_CLAIM_AUDIO_ASSET_ID);
    expect(claimedAudio.data?.[0]?.lease_owner).toBe("rls-test-audio-worker");
    expect(claimedAudio.data?.[0]?.lease_token).toBeTruthy();

    const releasedAudio = await admin.rpc("p85_stage_4b4_release_audio_admission_work_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_asset_id: TEST_STAGE4B4_CLAIM_AUDIO_ASSET_ID,
      p_worker_id: "rls-test-audio-worker",
      p_lease_token: claimedAudio.data?.[0]?.lease_token,
      p_success: true,
    });
    expect(releasedAudio.error).toBeNull();
    expect(releasedAudio.data?.lease_owner).toBeNull();
    expect(releasedAudio.data?.lease_token).toBeNull();

    const deniedTranscriptionClaim = await member.rpc("p85_stage_4b4_claim_transcription_work_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "blocked-worker",
    });
    expect(deniedTranscriptionClaim.error?.message).toMatch(/permission denied|service_role_required/i);

    const claimedTranscription = await admin.rpc("p85_stage_4b4_claim_transcription_work_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_worker_id: "rls-test-transcription-worker",
    });
    expect(claimedTranscription.error).toBeNull();
    expect(claimedTranscription.data?.[0]?.id).toBe(TEST_STAGE4B4_CLAIM_TRANSCRIPTION_ID);
    expect(claimedTranscription.data?.[0]?.status).toBe("processing");
    expect(claimedTranscription.data?.[0]?.lease_token).toBeTruthy();

    const releasedTranscription = await admin.rpc("p85_stage_4b4_release_transcription_work_v1", {
      p_tenant_id: TEST_TENANT_ID,
      p_transcription_id: TEST_STAGE4B4_CLAIM_TRANSCRIPTION_ID,
      p_worker_id: "rls-test-transcription-worker",
      p_lease_token: claimedTranscription.data?.[0]?.lease_token,
      p_success: true,
      p_terminal_status: "accepted",
    });
    expect(releasedTranscription.error).toBeNull();
    expect(releasedTranscription.data?.status).toBe("accepted");
    expect(releasedTranscription.data?.lease_owner).toBeNull();
  });

  it("isolates Stage 4C AI chat content by creator and tenant", async () => {
    const member = await signIn("rls-member@manu.local");
    const careTeam = await signIn("rls-care-team@manu.local");
    const outsider = await signIn("rls-outsider@manu.local");

    const ownGeneral = await member
      .from("ai_chat_conversations")
      .select("id, title")
      .eq("id", TEST_AI_CHAT_GENERAL_CONVERSATION_ID);
    expect(ownGeneral.error).toBeNull();
    expect(ownGeneral.data).toEqual([{ id: TEST_AI_CHAT_GENERAL_CONVERSATION_ID, title: "Visible general chat" }]);

    const hiddenTenant = await member
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", OTHER_AI_CHAT_GENERAL_CONVERSATION_ID);
    expect(hiddenTenant.error).toBeNull();
    expect(hiddenTenant.data).toHaveLength(0);

    const crossCreator = await careTeam
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", TEST_AI_CHAT_GENERAL_CONVERSATION_ID);
    expect(crossCreator.error).toBeNull();
    expect(crossCreator.data).toHaveLength(0);

    const outsiderRead = await outsider
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", TEST_AI_CHAT_GENERAL_CONVERSATION_ID);
    expect(outsiderRead.error).toBeNull();
    expect(outsiderRead.data).toHaveLength(0);

    const ownMessages = await member
      .from("ai_chat_message_versions")
      .select("id, body")
      .eq("id", TEST_AI_CHAT_MESSAGE_VERSION_ID);
    expect(ownMessages.error).toBeNull();
    expect(ownMessages.data).toEqual([
      { id: TEST_AI_CHAT_MESSAGE_VERSION_ID, body: "Visible AI chat message body" },
    ]);
  });

  it("blocks assistant and auditor access to Stage 4C AI chat tables", async () => {
    const assistant = await signIn("rls-assistant@manu.local");
    const auditor = await signIn("rls-auditor@manu.local");

    const assistantRead = await assistant.from("ai_chat_conversations").select("id");
    expect(assistantRead.error).toBeNull();
    expect(assistantRead.data).toHaveLength(0);

    const auditorRead = await auditor.from("ai_chat_message_versions").select("id");
    expect(auditorRead.error).toBeNull();
    expect(auditorRead.data).toHaveLength(0);
  });

  it("rejects authenticated direct Stage 4C mutations and worker table reads", async () => {
    const member = await signIn("rls-member@manu.local");

    const insertConversation = await member.from("ai_chat_conversations").insert({
      tenant_id: TEST_TENANT_ID,
      created_by_user_id: memberUserId,
      created_by_dietitian_id: TEST_DIETITIAN_ID,
      scope_type: "general",
      title: "Blocked direct insert",
    });
    expect(insertConversation.error).toBeTruthy();

    const mutationLedger = await member.from("ai_chat_mutation_ledger").select("request_id");
    expect(mutationLedger.error).toBeNull();
    expect(mutationLedger.data).toHaveLength(0);

    const providerEgress = await member.from("ai_chat_provider_egress_manifests").select("id");
    expect(providerEgress.error).toBeNull();
    expect(providerEgress.data).toHaveLength(0);
  });

  it("blocks general-scope client source rows and immutable conversation scope updates", async () => {
    const generalSourceInsert = await admin.from("ai_chat_source_refs").insert({
      tenant_id: TEST_TENANT_ID,
      run_id: "00000000-0000-4000-8000-000000001010",
      conversation_id: TEST_AI_CHAT_GENERAL_CONVERSATION_ID,
      created_by_user_id: memberUserId,
      source_type: "client_record",
      canonical_entity_id: TEST_CLIENT_ID,
      client_id: TEST_CLIENT_ID,
    });
    expect(generalSourceInsert.error?.message).toMatch(/ai_chat_general_scope_client_source_forbidden/i);

    const scopeMutation = await admin
      .from("ai_chat_conversations")
      .update({ scope_type: "client", client_id: TEST_CLIENT_ID })
      .eq("id", TEST_AI_CHAT_GENERAL_CONVERSATION_ID);
    expect(scopeMutation.error?.message).toMatch(/ai_chat_immutable_scope/i);
  });

  it("closes client-bound AI chat reads after assignment revocation", async () => {
    const careTeam = await signIn("rls-care-team@manu.local");

    const beforeRevocation = await careTeam
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID);
    expect(beforeRevocation.error).toBeNull();
    expect(beforeRevocation.data).toEqual([{ id: TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID }]);

    await checked(
      admin
        .from("client_assignments")
        .delete()
        .eq("id", CARE_TEAM_ASSIGNMENT_ID),
    );

    const afterRevocation = await careTeam
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID);
    expect(afterRevocation.error).toBeNull();
    expect(afterRevocation.data).toHaveLength(0);
  });
});

function loadEnvLocal() {
  const envPath = join(process.cwd(), ".env.local");
  try {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  } catch {
    // Missing local env intentionally skips this integration test.
  }
}

async function ensureUser(admin: SupabaseClient, email: string) {
  const listed = await admin.auth.admin.listUsers();
  if (listed.error) throw listed.error;

  const existing = listed.data.users.find((user) => user.email === email);
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD });
    if (updated.error) throw updated.error;
    return updated.data.user.id;
  }

  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  return created.data.user.id;
}

async function signIn(email: string) {
  const client = createClient(supabaseUrl!, anonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  const result = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (result.error) throw result.error;
  return client;
}

async function seedTenants(
  admin: SupabaseClient,
  users: {
    memberUserId: string;
    outsiderUserId: string;
    assistantUserId: string;
    viewerUserId: string;
    careTeamUserId: string;
    auditorUserId: string;
  },
) {
  await checked(admin.from("tenants").insert({ id: TEST_TENANT_ID, name: "RLS Test Tenant" }));
  await checked(admin.from("tenants").insert({ id: OTHER_TENANT_ID, name: "Other RLS Tenant" }));
  await checked(
    admin.from("tenant_memberships").insert([
      {
        tenant_id: TEST_TENANT_ID,
        user_id: users.memberUserId,
        role: "owner",
      },
      {
        tenant_id: TEST_TENANT_ID,
        user_id: users.assistantUserId,
        role: "assistant",
      },
      {
        tenant_id: TEST_TENANT_ID,
        user_id: users.viewerUserId,
        role: "dietitian",
      },
      {
        tenant_id: TEST_TENANT_ID,
        user_id: users.careTeamUserId,
        role: "dietitian",
      },
      {
        tenant_id: TEST_TENANT_ID,
        user_id: users.auditorUserId,
        role: "auditor",
      },
    ]),
  );
  await checked(
    admin.from("dietitians").insert([
      {
        id: TEST_DIETITIAN_ID,
        tenant_id: TEST_TENANT_ID,
        display_name: "RLS Test Dietitian",
        auth_user_id: users.memberUserId,
      },
      {
        id: ASSISTANT_DIETITIAN_ID,
        tenant_id: TEST_TENANT_ID,
        display_name: "RLS Assistant Staff",
        auth_user_id: users.assistantUserId,
      },
      {
        id: VIEWER_DIETITIAN_ID,
        tenant_id: TEST_TENANT_ID,
        display_name: "RLS Viewer Dietitian",
        auth_user_id: users.viewerUserId,
      },
      {
        id: CARE_TEAM_DIETITIAN_ID,
        tenant_id: TEST_TENANT_ID,
        display_name: "RLS Care Team Dietitian",
        auth_user_id: users.careTeamUserId,
      },
      {
        id: AUDITOR_DIETITIAN_ID,
        tenant_id: TEST_TENANT_ID,
        display_name: "RLS Auditor Profile",
        auth_user_id: users.auditorUserId,
      },
      {
        id: OTHER_DIETITIAN_ID,
        tenant_id: OTHER_TENANT_ID,
        display_name: "RLS Other Tenant Dietitian",
        auth_user_id: users.outsiderUserId,
      },
    ]),
  );
  await checked(
    admin.from("clients").insert([
      {
        id: TEST_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        full_name: "Visible RLS Client",
        selected_persona_id: "balanced_coach",
      },
      {
        id: UNASSIGNED_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        full_name: "Unassigned RLS Client",
        selected_persona_id: "balanced_coach",
      },
      {
        id: OWNED_DIETITIAN_CLIENT_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: CARE_TEAM_DIETITIAN_ID,
        full_name: "Owned Dietitian Client",
        selected_persona_id: "balanced_coach",
      },
      {
        id: OTHER_CLIENT_ID,
        tenant_id: OTHER_TENANT_ID,
        dietitian_id: OTHER_DIETITIAN_ID,
        full_name: "Hidden RLS Client",
        selected_persona_id: "balanced_coach",
      },
    ]),
  );
  await checked(
    admin.from("conversations").insert([
      {
        id: TEST_CONVERSATION_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        client_id: TEST_CLIENT_ID,
        channel: "whatsapp",
      },
      {
        id: OTHER_CONVERSATION_ID,
        tenant_id: OTHER_TENANT_ID,
        dietitian_id: OTHER_DIETITIAN_ID,
        client_id: OTHER_CLIENT_ID,
        channel: "whatsapp",
      },
      {
        id: UNASSIGNED_CONVERSATION_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        client_id: UNASSIGNED_CLIENT_ID,
        channel: "whatsapp",
      },
      {
        id: OWNED_DIETITIAN_CONVERSATION_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: CARE_TEAM_DIETITIAN_ID,
        client_id: OWNED_DIETITIAN_CLIENT_ID,
        channel: "whatsapp",
      },
    ]),
  );
  await checked(
    admin.from("messages").insert([
      {
        id: TEST_MESSAGE_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        sender: "client",
        origin: "client_inbound",
        body: "Visible risk message",
        provider_event_id: "rls-visible-provider-event",
        provider_message_id: "rls-visible-provider-message",
      },
      {
        id: TEST_STAGE4B4_VISIBLE_AUDIO_MESSAGE_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        sender: "client",
        origin: "client_inbound",
        body: "Stage 4B-4 visible audio message",
      },
      {
        id: OTHER_MESSAGE_ID,
        tenant_id: OTHER_TENANT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        sender: "client",
        origin: "client_inbound",
        body: "Hidden risk message",
      },
      {
        id: TEST_STAGE4B3_CLAIM_MESSAGE_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: UNASSIGNED_CONVERSATION_ID,
        sender: "client",
        origin: "client_inbound",
        body: "Stage 4B-3 claim message",
      },
      {
        id: TEST_STAGE4B4_AUDIO_MESSAGE_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: UNASSIGNED_CONVERSATION_ID,
        sender: "client",
        origin: "client_inbound",
        body: "Stage 4B-4 audio claim message",
      },
    ]),
  );
  await checked(
    admin.from("ai_decisions").insert([
      {
        id: TEST_AI_DECISION_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        client_id: TEST_CLIENT_ID,
        mode: "copilot",
        ai_status: "active",
        persona_id: "balanced_coach",
        risk: "green",
        action: "sent",
        model: "gemini-1.5-flash",
        prompt_version: "prompt-v1",
        provider_attempted: true,
        provider_id: "mock-provider-v1",
        provider_status: "ok",
        send_status: "sent",
      },
      {
        id: OTHER_AI_DECISION_ID,
        tenant_id: OTHER_TENANT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        client_id: OTHER_CLIENT_ID,
        mode: "copilot",
        ai_status: "active",
        persona_id: "balanced_coach",
        risk: "green",
        action: "sent",
        model: "gemini-1.5-flash",
        prompt_version: "prompt-v1",
        provider_attempted: true,
        provider_id: "mock-provider-v1",
        provider_status: "ok",
        send_status: "sent",
      },
    ]),
  );
  await checked(
    admin.from("handoff_cases").insert({
      id: TEST_HANDOFF_CASE_ID,
      tenant_id: TEST_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      client_id: TEST_CLIENT_ID,
      conversation_id: TEST_CONVERSATION_ID,
      triggering_message_id: TEST_MESSAGE_ID,
      risk: "red",
      safe_acknowledgement: "Visible handoff acknowledgement",
      recommended_action: "Dietitian review required.",
    }),
  );
  await checked(
    admin.from("conversation_memories").insert([
      {
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        client_id: TEST_CLIENT_ID,
        rolling_summary: "Visible memory",
      },
      {
        tenant_id: OTHER_TENANT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        client_id: OTHER_CLIENT_ID,
        rolling_summary: "Hidden memory",
      },
    ]),
  );
  await checked(
    admin.from("risk_assessments").insert([
      {
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_MESSAGE_ID,
        level: "green",
        classifier_version: "test",
      },
      {
        tenant_id: OTHER_TENANT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        message_id: OTHER_MESSAGE_ID,
        level: "green",
        classifier_version: "test",
      },
    ]),
  );
  await checked(
    admin.from("client_ai_status_events").insert([
      {
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        new_status: "active",
      },
      {
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        new_status: "active",
      },
    ]),
  );
  await checked(
    admin.from("client_assignments").insert([
      {
        id: TEST_ASSIGNMENT_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        access_level: "care_team",
      },
      {
        id: ASSISTANT_ASSIGNMENT_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        dietitian_id: ASSISTANT_DIETITIAN_ID,
        access_level: "care_team",
      },
      {
        id: VIEWER_ASSIGNMENT_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        dietitian_id: VIEWER_DIETITIAN_ID,
        access_level: "viewer",
      },
      {
        id: CARE_TEAM_ASSIGNMENT_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        dietitian_id: CARE_TEAM_DIETITIAN_ID,
        access_level: "care_team",
      },
      {
        id: OTHER_ASSIGNMENT_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        access_level: "care_team",
      },
    ]),
  );
  await checked(
    admin.from("data_requests").insert([
      {
        id: TEST_DATA_REQUEST_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        request_type: "export",
        status: "completed",
        requested_by_dietitian_id: TEST_DIETITIAN_ID,
        completed_at: "2026-05-25T00:00:00.000Z",
      },
      {
        id: OTHER_DATA_REQUEST_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        request_type: "export",
        status: "completed",
        requested_by_dietitian_id: TEST_DIETITIAN_ID,
        completed_at: "2026-05-25T00:00:00.000Z",
      },
    ]),
  );
  await checked(
    admin.from("notifications").insert([
      {
        id: TEST_NOTIFICATION_ID,
        tenant_id: TEST_TENANT_ID,
        type: "handoff_urgent",
        kind: "legacy_handoff",
        priority: "review_required",
        entity_type: "handoff_case",
        entity_id: TEST_HANDOFF_CASE_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_MESSAGE_ID,
        handoff_id: TEST_HANDOFF_CASE_ID,
        occurrence_count: 1,
        last_occurred_at: "2026-05-25T00:00:00.000Z",
        title: "Visible notification",
        body: "Review required.",
      },
      {
        id: OTHER_NOTIFICATION_ID,
        tenant_id: OTHER_TENANT_ID,
        type: "system",
        kind: "legacy_system",
        priority: "review_required",
        entity_type: "client",
        entity_id: OTHER_CLIENT_ID,
        client_id: OTHER_CLIENT_ID,
        occurrence_count: 1,
        last_occurred_at: "2026-05-25T00:00:00.000Z",
        title: "Hidden notification",
        body: "Review required.",
      },
    ]),
  );
  await checked(
    admin.from("inbound_quarantines").insert([
      {
        id: TEST_INBOUND_QUARANTINE_ID,
        tenant_id: TEST_TENANT_ID,
        channel: "whatsapp",
        source_conversation_type: "group",
        source_conversation_id: "visible-rls-group",
        source_message_id: "visible-rls-message",
        sender_channel_user_id: "visible-rls-sender",
        reason: "whatsapp_group_unsupported",
      },
      {
        id: OTHER_INBOUND_QUARANTINE_ID,
        tenant_id: OTHER_TENANT_ID,
        channel: "whatsapp",
        source_conversation_type: "group",
        source_conversation_id: "hidden-rls-group",
        source_message_id: "hidden-rls-message",
        sender_channel_user_id: "hidden-rls-sender",
        reason: "whatsapp_group_unsupported",
      },
    ]),
  );
  await checked(
    admin.from("internal_copilot_tool_calls").insert([
      {
        id: TEST_INTERNAL_COPILOT_TOOL_CALL_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        tool_name: "getClientDietPlan",
        status: "ok",
        result_summary: "Visible copilot tool result",
      },
      {
        id: OTHER_INTERNAL_COPILOT_TOOL_CALL_ID,
        tenant_id: OTHER_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        tool_name: "getClientDietPlan",
        status: "ok",
        result_summary: "Hidden copilot tool result",
      },
    ]),
  );
  await checked(
    admin.from("internal_copilot_messages").insert([
      {
        id: TEST_INTERNAL_COPILOT_MESSAGE_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        role: "assistant",
        body: "Visible copilot answer",
        tool_call_ids: [TEST_INTERNAL_COPILOT_TOOL_CALL_ID],
        safety_status: "ok",
      },
      {
        id: OTHER_INTERNAL_COPILOT_MESSAGE_ID,
        tenant_id: OTHER_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        role: "assistant",
        body: "Hidden copilot answer",
        tool_call_ids: [OTHER_INTERNAL_COPILOT_TOOL_CALL_ID],
        safety_status: "ok",
      },
    ]),
  );
  await checked(
    admin.from("channel_deliveries").insert([
      {
        id: TEST_CHANNEL_DELIVERY_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_MESSAGE_ID,
        channel: "whatsapp",
        direction: "outbound",
        mock_provider_message_id: "wamid.MOCK_VISIBLE_RLS",
        delivery_status: "delivered",
      },
      {
        id: OTHER_CHANNEL_DELIVERY_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        message_id: OTHER_MESSAGE_ID,
        channel: "whatsapp",
        direction: "outbound",
        mock_provider_message_id: "wamid.MOCK_HIDDEN_RLS",
        delivery_status: "delivered",
      },
    ]),
  );
  await checked(
    admin.from("channel_adapter_rollback_controls").insert([
      {
        tenant_id: TEST_TENANT_ID,
        global_channel_automation_disabled: true,
        disabled_client_ids: [TEST_CLIENT_ID],
      },
      {
        tenant_id: OTHER_TENANT_ID,
        global_channel_automation_disabled: true,
        disabled_client_ids: [OTHER_CLIENT_ID],
      },
    ]),
  );
  await checked(
    admin.from("channel_account_bindings").insert([
      {
        id: TEST_P85_CHANNEL_ACCOUNT_BINDING_ID,
        tenant_id: TEST_TENANT_ID,
        provider: "whatsapp_cloud",
        provider_account_id: "rls-visible-account",
        operating_mode: "mock",
        lifecycle_status: "active",
        attribution_policy: "shared_authorized_team",
      },
      {
        id: OTHER_P85_CHANNEL_ACCOUNT_BINDING_ID,
        tenant_id: OTHER_TENANT_ID,
        provider: "whatsapp_cloud",
        provider_account_id: "rls-hidden-account",
        operating_mode: "mock",
        lifecycle_status: "active",
        attribution_policy: "shared_authorized_team",
      },
    ]),
  );
  await checked(
    admin.from("channel_actor_bindings").insert([
      {
        id: TEST_P85_CHANNEL_ACTOR_BINDING_ID,
        tenant_id: TEST_TENANT_ID,
        account_binding_id: TEST_P85_CHANNEL_ACCOUNT_BINDING_ID,
        actor_type: "business_operator",
        attribution_basis: "shared_authorized_team",
      },
      {
        id: OTHER_P85_CHANNEL_ACTOR_BINDING_ID,
        tenant_id: OTHER_TENANT_ID,
        account_binding_id: OTHER_P85_CHANNEL_ACCOUNT_BINDING_ID,
        actor_type: "business_operator",
        attribution_basis: "shared_authorized_team",
      },
    ]),
  );
  await checked(
    admin.from("channel_events").insert([
      {
        id: TEST_P85_CHANNEL_EVENT_ID,
        tenant_id: TEST_TENANT_ID,
        account_binding_id: TEST_P85_CHANNEL_ACCOUNT_BINDING_ID,
        event_kind: "malformed_event",
        processing_status: "quarantined",
        provider_account_id: "rls-visible-account",
        provider_event_id: "rls-visible-event",
        payload_digest: "rls-visible-digest",
        payload_schema_version: "rls-test",
        quarantine_id: TEST_INBOUND_QUARANTINE_ID,
      },
      {
        id: OTHER_P85_CHANNEL_EVENT_ID,
        tenant_id: OTHER_TENANT_ID,
        account_binding_id: OTHER_P85_CHANNEL_ACCOUNT_BINDING_ID,
        event_kind: "malformed_event",
        processing_status: "quarantined",
        provider_account_id: "rls-hidden-account",
        provider_event_id: "rls-hidden-event",
        payload_digest: "rls-hidden-digest",
        payload_schema_version: "rls-test",
        quarantine_id: OTHER_INBOUND_QUARANTINE_ID,
      },
    ]),
  );
  await checked(
    admin.from("channel_message_revisions").insert({
      id: TEST_P85_CHANNEL_MESSAGE_REVISION_ID,
      tenant_id: TEST_TENANT_ID,
      message_id: TEST_MESSAGE_ID,
      channel_event_id: TEST_P85_CHANNEL_EVENT_ID,
      provider_event_id: "rls-visible-provider-event",
      revision_action: "edit",
      prior_content_status: "available",
      current_content_status: "edited",
      prior_body_digest: "rls-prior-digest",
      current_body_digest: "rls-current-digest",
      revision_sequence: 1,
    }),
  );
  await checked(
    admin.from("human_control_sessions").insert([
      {
        id: TEST_P85_HUMAN_CONTROL_SESSION_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        reason: "manual_takeover",
        status: "active",
        previous_ai_status: "active",
        previous_ai_mode: "copilot",
        linked_handoff_id: TEST_HANDOFF_CASE_ID,
        linked_yellow_hold_message_id: TEST_MESSAGE_ID,
        opened_by_message_id: TEST_MESSAGE_ID,
        latest_human_message_id: TEST_MESSAGE_ID,
      },
      {
        id: OTHER_P85_HUMAN_CONTROL_SESSION_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        reason: "manual_takeover",
        status: "active",
        previous_ai_status: "active",
        previous_ai_mode: "copilot",
      },
    ]),
  );
  await checked(
    admin.from("risk_activity_events").insert([
      {
        id: TEST_P85_RISK_ACTIVITY_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        human_control_session_id: TEST_P85_HUMAN_CONTROL_SESSION_ID,
        event_type: "ai_paused",
        source_message_id: TEST_MESSAGE_ID,
        handoff_id: TEST_HANDOFF_CASE_ID,
        ai_decision_id: TEST_AI_DECISION_ID,
        metadata: { minimized: true },
      },
    ]),
  );
  await checked(
    admin.from("context_intake_proposals").insert([
      {
        id: TEST_P85_CONTEXT_INTAKE_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        source_channel: "internal_copilot",
        intake_source: "phone",
        source_text_digest: "digest-visible",
        source_text: "Visible source text",
        raw_source_reference: TEST_MESSAGE_ID,
        occurred_at: "2026-07-10T10:00:00.000Z",
        title: "Visible intake",
        summary: "Visible summary",
        details: "",
        importance: "routine",
        baseline_context_revision: 1,
        status: "pending_confirmation",
      },
      {
        id: OTHER_P85_CONTEXT_INTAKE_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        dietitian_id: OTHER_DIETITIAN_ID,
        source_channel: "internal_copilot",
        intake_source: "phone",
        source_text_digest: "digest-hidden",
        occurred_at: "2026-07-10T10:00:00.000Z",
        title: "Hidden intake",
        summary: "Hidden summary",
        details: "",
        importance: "routine",
        baseline_context_revision: 1,
        status: "pending_confirmation",
      },
    ]),
  );
  await checked(
    admin.from("media_assets").insert([
      {
        id: TEST_STAGE4B3_MEDIA_ASSET_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_MESSAGE_ID,
        declared_mime_type: "image/jpeg",
        detected_mime_type: "image/jpeg",
        width: 640,
        height: 480,
        status: "analysis_ready",
        sanitized_full_object_key: "tenant/visible/full.jpg",
        thumbnail_object_key: "tenant/visible/thumb.jpg",
      },
      {
        id: OTHER_STAGE4B3_MEDIA_ASSET_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        message_id: OTHER_MESSAGE_ID,
        declared_mime_type: "image/png",
        status: "sanitized",
      },
      {
        id: TEST_STAGE4B3_CLAIM_MEDIA_ASSET_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: UNASSIGNED_CLIENT_ID,
        conversation_id: UNASSIGNED_CONVERSATION_ID,
        message_id: TEST_STAGE4B3_CLAIM_MESSAGE_ID,
        declared_mime_type: "image/jpeg",
        status: "download_pending",
      },
      {
        id: TEST_STAGE4B4_AUDIO_ASSET_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_STAGE4B4_VISIBLE_AUDIO_MESSAGE_ID,
        media_kind: "audio",
        voice_message: true,
        declared_mime_type: "audio/wav",
        detected_mime_type: "audio/wav",
        duration_ms: 3200,
        audio_codec: "pcm_s16le",
        audio_channels: 1,
        sample_rate_hz: 16000,
        sanitized_audio_object_key: "tenant/visible/voice.wav",
        status: "analysis_ready",
      },
      {
        id: TEST_STAGE4B4_CLAIM_AUDIO_ASSET_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: UNASSIGNED_CLIENT_ID,
        conversation_id: UNASSIGNED_CONVERSATION_ID,
        message_id: TEST_STAGE4B4_AUDIO_MESSAGE_ID,
        media_kind: "audio",
        voice_message: true,
        declared_mime_type: "audio/wav",
        status: "admitted",
      },
    ]),
  );
  await checked(
    admin.from("inbound_message_bundles").insert([
      {
        id: TEST_STAGE4B3_BUNDLE_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        anchor_message_id: TEST_MESSAGE_ID,
        status: "open",
        ready_at: "2026-07-10T10:00:00.000Z",
        item_count: 1,
        image_count: 1,
        unicode_codepoint_count: 12,
      },
      {
        id: OTHER_STAGE4B3_BUNDLE_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        anchor_message_id: OTHER_MESSAGE_ID,
        status: "open",
        ready_at: "2026-07-10T10:00:00.000Z",
        item_count: 1,
        image_count: 1,
        unicode_codepoint_count: 10,
      },
      {
        id: TEST_STAGE4B3_CLAIM_BUNDLE_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: UNASSIGNED_CLIENT_ID,
        conversation_id: UNASSIGNED_CONVERSATION_ID,
        anchor_message_id: TEST_STAGE4B3_CLAIM_MESSAGE_ID,
        status: "ready",
        ready_at: "2026-07-10T09:00:00.000Z",
        item_count: 1,
        image_count: 1,
        unicode_codepoint_count: 8,
      },
    ]),
  );
  await checked(
    admin.from("visual_analysis_records").insert([
      {
        id: TEST_STAGE4B3_VISUAL_ANALYSIS_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        media_asset_id: TEST_STAGE4B3_MEDIA_ASSET_ID,
        message_id: TEST_MESSAGE_ID,
        bundle_id: TEST_STAGE4B3_BUNDLE_ID,
        status: "ready",
      },
      {
        id: OTHER_STAGE4B3_VISUAL_ANALYSIS_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        media_asset_id: OTHER_STAGE4B3_MEDIA_ASSET_ID,
        message_id: OTHER_MESSAGE_ID,
        bundle_id: OTHER_STAGE4B3_BUNDLE_ID,
        status: "pending",
      },
    ]),
  );
  await checked(
    admin.from("inbound_message_bundle_items").insert([
      {
        id: TEST_STAGE4B3_BUNDLE_ITEM_ID,
        tenant_id: TEST_TENANT_ID,
        bundle_id: TEST_STAGE4B3_BUNDLE_ID,
        message_id: TEST_MESSAGE_ID,
        media_asset_id: TEST_STAGE4B3_MEDIA_ASSET_ID,
        ordinal: 1,
        item_type: "image",
        actor_type: "client",
        sender_id: TEST_CLIENT_ID,
      },
      {
        id: OTHER_STAGE4B3_BUNDLE_ITEM_ID,
        tenant_id: OTHER_TENANT_ID,
        bundle_id: OTHER_STAGE4B3_BUNDLE_ID,
        message_id: OTHER_MESSAGE_ID,
        media_asset_id: OTHER_STAGE4B3_MEDIA_ASSET_ID,
        ordinal: 1,
        item_type: "image",
        actor_type: "client",
        sender_id: OTHER_CLIENT_ID,
      },
    ]),
  );
  await checked(
    admin.from("visual_corrections").insert([
      {
        id: TEST_STAGE4B3_VISUAL_CORRECTION_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        analysis_id: TEST_STAGE4B3_VISUAL_ANALYSIS_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        reason_code: "wrong_scene",
        explanation: "Visible correction",
        conversation_revision_at_submit: 1,
        analysis_revision_at_submit: 1,
        result_action: "supersede_rerun",
      },
      {
        id: OTHER_STAGE4B3_VISUAL_CORRECTION_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        analysis_id: OTHER_STAGE4B3_VISUAL_ANALYSIS_ID,
        dietitian_id: OTHER_DIETITIAN_ID,
        reason_code: "wrong_scene",
        explanation: "Hidden correction",
        conversation_revision_at_submit: 1,
        analysis_revision_at_submit: 1,
        result_action: "manual_follow_up",
      },
    ]),
  );
  await checked(
    admin.from("audio_transcription_records").insert([
      {
        id: TEST_STAGE4B4_TRANSCRIPTION_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        message_id: TEST_STAGE4B4_VISIBLE_AUDIO_MESSAGE_ID,
        media_asset_id: TEST_STAGE4B4_AUDIO_ASSET_ID,
        locale: "tr-TR",
        status: "accepted",
        retrieval_eligible: true,
      },
      {
        id: TEST_STAGE4B4_CLAIM_TRANSCRIPTION_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: UNASSIGNED_CLIENT_ID,
        conversation_id: UNASSIGNED_CONVERSATION_ID,
        message_id: TEST_STAGE4B4_AUDIO_MESSAGE_ID,
        media_asset_id: TEST_STAGE4B4_CLAIM_AUDIO_ASSET_ID,
        locale: "tr-TR",
        status: "pending",
        retrieval_eligible: false,
      },
    ]),
  );
  await checked(
    admin.from("audio_transcript_corrections").insert([
      {
        id: TEST_STAGE4B4_TRANSCRIPT_CORRECTION_ID,
        tenant_id: TEST_TENANT_ID,
        client_id: TEST_CLIENT_ID,
        conversation_id: TEST_CONVERSATION_ID,
        transcription_id: TEST_STAGE4B4_TRANSCRIPTION_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        reason_code: "wrong_word",
        explanation: "Visible transcript correction",
        corrected_transcript: "Merhaba dunya",
        conversation_revision_at_submit: 1,
        transcription_revision_at_submit: 1,
        result_action: "supersede_rerun",
      },
    ]),
  );
  await checked(
    admin.from("commercial_invites").insert([
      {
        id: TEST_COMMERCIAL_INVITE_ID,
        normalized_email: "rls-member@manu.local",
        invite_token_hash: hashCommercialInviteToken("rls-invite-token"),
        status: "active",
        tenant_id: TEST_TENANT_ID,
        tenant_seed_metadata: { tenantName: "Visible RLS Tenant" },
      },
      {
        id: OTHER_COMMERCIAL_INVITE_ID,
        normalized_email: "hidden@manu.local",
        invite_token_hash: hashCommercialInviteToken("other-invite-token"),
        status: "active",
        tenant_id: OTHER_TENANT_ID,
        tenant_seed_metadata: { tenantName: "Hidden RLS Tenant" },
      },
    ]),
  );
  await checked(
    admin.from("tenant_entitlements").insert([
      {
        id: TEST_TENANT_ENTITLEMENT_ID,
        tenant_id: TEST_TENANT_ID,
        commercial_invite_id: TEST_COMMERCIAL_INVITE_ID,
        status: "active",
      },
      {
        id: OTHER_TENANT_ENTITLEMENT_ID,
        tenant_id: OTHER_TENANT_ID,
        commercial_invite_id: OTHER_COMMERCIAL_INVITE_ID,
        status: "active",
      },
    ]),
  );
  await checked(
    admin.from("billing_customers").insert([
      {
        id: TEST_BILLING_CUSTOMER_ID,
        tenant_id: TEST_TENANT_ID,
        commercial_invite_id: TEST_COMMERCIAL_INVITE_ID,
        normalized_email: "rls-member@manu.local",
        stripe_customer_id: "cus_visible_rls",
      },
      {
        id: OTHER_BILLING_CUSTOMER_ID,
        tenant_id: OTHER_TENANT_ID,
        commercial_invite_id: OTHER_COMMERCIAL_INVITE_ID,
        normalized_email: "hidden@manu.local",
        stripe_customer_id: "cus_hidden_rls",
      },
    ]),
  );
  await checked(
    admin.from("billing_event_ledger").insert([
      {
        id: TEST_BILLING_EVENT_ID,
        stripe_event_id: "evt_visible_rls",
        event_type: "checkout.session.completed",
        tenant_id: TEST_TENANT_ID,
        idempotency_key: "idem_visible_rls",
        payload_summary: { status: "complete" },
      },
    ]),
  );
  await checked(
    admin.from("mobile_install_audit_events").insert([
      {
        id: TEST_MOBILE_INSTALL_AUDIT_ID,
        tenant_id: TEST_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        auth_user_id: users.memberUserId,
        event_type: "install_prompt_shown",
        user_agent_summary: "vitest-visible",
      },
      {
        id: OTHER_MOBILE_INSTALL_AUDIT_ID,
        tenant_id: OTHER_TENANT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
        auth_user_id: users.memberUserId,
        event_type: "install_prompt_shown",
        user_agent_summary: "vitest-hidden",
      },
    ]),
  );
  await checked(
    admin.from("ai_chat_conversations").insert([
      {
        id: TEST_AI_CHAT_GENERAL_CONVERSATION_ID,
        tenant_id: TEST_TENANT_ID,
        created_by_user_id: users.memberUserId,
        created_by_dietitian_id: TEST_DIETITIAN_ID,
        scope_type: "general",
        title: "Visible general chat",
        status: "active",
        revision: 1,
      },
      {
        id: OTHER_AI_CHAT_GENERAL_CONVERSATION_ID,
        tenant_id: OTHER_TENANT_ID,
        created_by_user_id: users.outsiderUserId,
        created_by_dietitian_id: OTHER_DIETITIAN_ID,
        scope_type: "general",
        title: "Hidden general chat",
        status: "active",
        revision: 1,
      },
      {
        id: TEST_AI_CHAT_CLIENT_CONVERSATION_ID,
        tenant_id: TEST_TENANT_ID,
        created_by_user_id: users.memberUserId,
        created_by_dietitian_id: TEST_DIETITIAN_ID,
        scope_type: "client",
        client_id: TEST_CLIENT_ID,
        title: "Visible client chat",
        status: "active",
        revision: 1,
      },
      {
        id: TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID,
        tenant_id: TEST_TENANT_ID,
        created_by_user_id: users.careTeamUserId,
        created_by_dietitian_id: CARE_TEAM_DIETITIAN_ID,
        scope_type: "client",
        client_id: TEST_CLIENT_ID,
        title: "Care team client chat",
        status: "active",
        revision: 1,
      },
    ]),
  );
  await checked(
    admin.from("ai_chat_branches").insert([
      {
        id: TEST_AI_CHAT_GENERAL_BRANCH_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_AI_CHAT_GENERAL_CONVERSATION_ID,
        created_by_user_id: users.memberUserId,
        fork_reason: "initial",
        revision: 1,
      },
      {
        id: TEST_AI_CHAT_CLIENT_BRANCH_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_AI_CHAT_CLIENT_CONVERSATION_ID,
        created_by_user_id: users.memberUserId,
        fork_reason: "initial",
        revision: 1,
      },
      {
        id: TEST_AI_CHAT_CARE_TEAM_BRANCH_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID,
        created_by_user_id: users.careTeamUserId,
        fork_reason: "initial",
        revision: 1,
      },
    ]),
  );
  await checked(
    admin
      .from("ai_chat_conversations")
      .update({
        active_branch_id: TEST_AI_CHAT_GENERAL_BRANCH_ID,
      })
      .eq("id", TEST_AI_CHAT_GENERAL_CONVERSATION_ID),
  );
  await checked(
    admin
      .from("ai_chat_conversations")
      .update({
        active_branch_id: TEST_AI_CHAT_CLIENT_BRANCH_ID,
      })
      .eq("id", TEST_AI_CHAT_CLIENT_CONVERSATION_ID),
  );
  await checked(
    admin
      .from("ai_chat_conversations")
      .update({
        active_branch_id: TEST_AI_CHAT_CARE_TEAM_BRANCH_ID,
      })
      .eq("id", TEST_AI_CHAT_CARE_TEAM_CONVERSATION_ID),
  );
  await checked(
    admin.from("ai_chat_messages").insert([
      {
        id: TEST_AI_CHAT_MESSAGE_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_AI_CHAT_GENERAL_CONVERSATION_ID,
        created_by_user_id: users.memberUserId,
        role: "user",
        author_user_id: users.memberUserId,
      },
    ]),
  );
  await checked(
    admin.from("ai_chat_message_versions").insert([
      {
        id: TEST_AI_CHAT_MESSAGE_VERSION_ID,
        tenant_id: TEST_TENANT_ID,
        conversation_id: TEST_AI_CHAT_GENERAL_CONVERSATION_ID,
        message_id: TEST_AI_CHAT_MESSAGE_ID,
        branch_id: TEST_AI_CHAT_GENERAL_BRANCH_ID,
        created_by_user_id: users.memberUserId,
        body: "Visible AI chat message body",
        body_sha256: "sha256-visible-ai-chat-message",
        content_status: "active",
      },
    ]),
  );
}

async function cleanup(admin: SupabaseClient) {
  await admin.from("processed_inbound_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_message_versions").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_messages").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_runs").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_run_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_tool_calls").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_context_snapshots").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_source_refs").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_memory_summaries").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_provider_egress_manifests").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_mutation_ledger").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_branches").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_chat_conversations").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("audio_transcript_correction_idempotency").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("audio_transcript_corrections").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("audio_transcription_records").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("visual_corrections").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("inbound_message_bundle_items").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("visual_analysis_records").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("inbound_message_bundles").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("media_assets").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("mobile_install_audit_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("billing_event_ledger").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("billing_customers").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("tenant_entitlements").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("commercial_invites").delete().in("id", [TEST_COMMERCIAL_INVITE_ID, OTHER_COMMERCIAL_INVITE_ID]);
  await admin.from("risk_activity_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("human_control_sessions").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("context_intake_proposals").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("channel_message_revisions").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("channel_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("channel_actor_bindings").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("channel_account_bindings").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("channel_adapter_rollback_controls").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("internal_copilot_messages").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("internal_copilot_tool_calls").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("channel_deliveries").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("inbound_quarantines").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("notification_receipts").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("conversation_read_receipts").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("notifications").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("data_requests").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("client_ai_status_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("client_assignments").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("handoff_cases").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("ai_decisions").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("risk_assessments").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("conversation_memories").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("messages").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("client_channels").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("conversations").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("clients").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("dietitians").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("tenant_memberships").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("tenants").delete().in("id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
}

async function checked(result: PromiseLike<{ error: unknown }> | { error: unknown }) {
  const response = await result;
  if (response.error) {
    throw response.error instanceof Error ? response.error : new Error(JSON.stringify(response.error));
  }
}
