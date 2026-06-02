import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addSupabaseClientContextUpdate,
  approveSupabaseDraftMessage,
  dismissSupabaseDraftMessage,
  loadSupabaseState,
  patchSupabaseClientRecord,
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

  it("blocks auditor access to raw client, message, AI, handoff, risk, and copilot tables", async () => {
    const auditor = await signIn("rls-auditor@manu.local");

    for (const [table, column] of [
      ["clients", "id"],
      ["messages", "id"],
      ["ai_decisions", "id"],
      ["handoff_cases", "id"],
      ["risk_assessments", "id"],
      ["inbound_quarantines", "id"],
      ["internal_copilot_messages", "id"],
      ["internal_copilot_tool_calls", "id"],
    ] as const) {
      const response = await auditor.from(table).select(column);
      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(0);
    }
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
    expect(riskAssessment.data?.classifier_version).toBe("dietetic-risk-v0.3.0");
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
    expect(next.inboundQuarantines).toHaveLength(1);
    expect(JSON.stringify(next.inboundQuarantines[0])).not.toContain("Group message must not be stored");
    expect(next.messages).toHaveLength(beforeMessages);
    expect(next.riskAssessments).toHaveLength(beforeRiskAssessments);
    expect(next.aiDecisions).toHaveLength(beforeDecisions);
    expect(next.handoffCases).toHaveLength(beforeHandoffs);

    const quarantine = await admin
      .from("inbound_quarantines")
      .select("channel, source_conversation_type, reason")
      .eq("tenant_id", state.tenant.id)
      .eq("source_conversation_id", "rls-group")
      .single();

    expect(quarantine.error).toBeNull();
    expect(quarantine.data).toEqual({
      channel: "whatsapp",
      source_conversation_type: "group",
      reason: "whatsapp_group_unsupported",
    });

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

  it("persists draft approve and dismiss updates through transactional RPC", async () => {
    await resetSupabaseState();
    const state = await loadSupabaseState();
    const copilotClient = state.clients.find((client) => client.aiMode === "copilot");

    expect(copilotClient).toBeDefined();

    const withDraft = await runSupabaseSimulation({
      clientId: copilotClient!.id,
      body: "Ara ogun icin ne yiyebilirim?",
      idempotencyKey: `draft-approve-${Date.now()}`,
    });
    const draft = withDraft.messages.find((message) => message.status === "draft");
    expect(draft).toBeDefined();

    await approveSupabaseDraftMessage(draft!.id, "Edited safe reply");

    const approved = await admin
      .from("messages")
      .select("body, status, approved_by_dietitian_id")
      .eq("id", draft!.id)
      .single();

    expect(approved.error).toBeNull();
    expect(approved.data).toMatchObject({
      body: "Edited safe reply",
      status: "sent",
      approved_by_dietitian_id: state.dietitian.id,
    });

    const withSecondDraft = await runSupabaseSimulation({
      clientId: copilotClient!.id,
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
      answers: { daily_routine: "Updated routine for transactional RPC test." },
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
        dietitian_id: TEST_DIETITIAN_ID,
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
        dietitian_id: TEST_DIETITIAN_ID,
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
      },
      {
        id: OTHER_MESSAGE_ID,
        tenant_id: OTHER_TENANT_ID,
        conversation_id: OTHER_CONVERSATION_ID,
        sender: "client",
        origin: "client_inbound",
        body: "Hidden risk message",
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
        entity_type: "handoff_case",
        entity_id: "test-handoff",
        title: "Visible notification",
        body: "Review required.",
      },
      {
        id: OTHER_NOTIFICATION_ID,
        tenant_id: OTHER_TENANT_ID,
        type: "handoff_urgent",
        entity_type: "handoff_case",
        entity_id: "other-handoff",
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
}

async function cleanup(admin: SupabaseClient) {
  await admin.from("processed_inbound_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("internal_copilot_messages").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("internal_copilot_tool_calls").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("inbound_quarantines").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
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
