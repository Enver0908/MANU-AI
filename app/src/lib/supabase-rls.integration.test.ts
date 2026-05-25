import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  loadSupabaseState,
  patchSupabaseClientRecord,
  resetSupabaseState,
  runSupabaseSimulation,
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
const TEST_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000912";
const OTHER_ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000913";
const TEST_DATA_REQUEST_ID = "00000000-0000-4000-8000-000000000914";
const OTHER_DATA_REQUEST_ID = "00000000-0000-4000-8000-000000000915";
const PASSWORD = "manu-rls-test-password";

const maybeDescribe = shouldRun ? describe : describe.skip;

maybeDescribe("Supabase RLS tenant isolation", () => {
  let admin: SupabaseClient;
  let memberUserId = "";
  let outsiderUserId = "";

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
    await seedTenants(admin, memberUserId);
  });

  afterAll(async () => {
    if (admin) {
      await cleanup(admin);
      if (memberUserId) await admin.auth.admin.deleteUser(memberUserId);
      if (outsiderUserId) await admin.auth.admin.deleteUser(outsiderUserId);
    }
  });

  it("allows a tenant member to read only their tenant rows", async () => {
    const member = await signIn("rls-member@manu.local");

    const ownClients = await member.from("clients").select("id, tenant_id").eq("tenant_id", TEST_TENANT_ID);
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

    const assignments = await member.from("client_assignments").select("id");
    expect(assignments.error).toBeNull();
    expect(assignments.data).toEqual([{ id: TEST_ASSIGNMENT_ID }]);

    const dataRequests = await member.from("data_requests").select("id");
    expect(dataRequests.error).toBeNull();
    expect(dataRequests.data).toEqual([{ id: TEST_DATA_REQUEST_ID }]);
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

    const assignments = await outsider.from("client_assignments").select("id");
    expect(assignments.error).toBeNull();
    expect(assignments.data).toHaveLength(0);

    const dataRequests = await outsider.from("data_requests").select("id");
    expect(dataRequests.error).toBeNull();
    expect(dataRequests.data).toHaveLength(0);
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
    expect(riskAssessment.data?.classifier_version).toBe("dietetic-risk-v0.2.0");
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

async function seedTenants(admin: SupabaseClient, memberUserId: string) {
  await checked(admin.from("tenants").insert({ id: TEST_TENANT_ID, name: "RLS Test Tenant" }));
  await checked(admin.from("tenants").insert({ id: OTHER_TENANT_ID, name: "Other RLS Tenant" }));
  await checked(
    admin.from("tenant_memberships").insert({
      tenant_id: TEST_TENANT_ID,
      user_id: memberUserId,
      role: "owner",
    }),
  );
  await checked(
    admin.from("dietitians").insert({
      id: TEST_DIETITIAN_ID,
      tenant_id: TEST_TENANT_ID,
      display_name: "RLS Test Dietitian",
      auth_user_id: memberUserId,
    }),
  );
  await checked(
    admin.from("clients").insert({
      id: TEST_CLIENT_ID,
      tenant_id: TEST_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      full_name: "Visible RLS Client",
      selected_persona_id: "balanced_coach",
    }),
  );
  await checked(
    admin.from("clients").insert({
      id: OTHER_CLIENT_ID,
      tenant_id: OTHER_TENANT_ID,
      dietitian_id: TEST_DIETITIAN_ID,
      full_name: "Hidden RLS Client",
      selected_persona_id: "balanced_coach",
    }),
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
      },
      {
        id: OTHER_ASSIGNMENT_ID,
        tenant_id: OTHER_TENANT_ID,
        client_id: OTHER_CLIENT_ID,
        dietitian_id: TEST_DIETITIAN_ID,
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
}

async function cleanup(admin: SupabaseClient) {
  await admin.from("notifications").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("data_requests").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("client_ai_status_events").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("client_assignments").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("risk_assessments").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("conversation_memories").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
  await admin.from("messages").delete().in("tenant_id", [TEST_TENANT_ID, OTHER_TENANT_ID]);
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
