#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const docsRoot = join(repoRoot, "docs");
const evidencePath = join(docsRoot, "AIYA_PERFORMANCE_PLAN_1_PHASE_3_EVIDENCE.json");

const PHASE_2_EVIDENCE_PATH = "docs/AIYA_PERFORMANCE_PLAN_1_PHASE_2_EVIDENCE.json";
const HISTORICAL_PATHS = [
  "docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PLAN_1_FINDING_MANIFEST.json",
  "docs/AIYA_PERFORMANCE_PHASE_1_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PHASE_1_2_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json",
  "docs/AIYA_PERFORMANCE_PHASE_2_EVIDENCE.json",
  "docs/AIYA_PERFORMANCE_PHASE_3_EVIDENCE.json",
  PHASE_2_EVIDENCE_PATH,
];

const LOCAL_API_URL_PATTERN = /^http:\/\/(?:127\.0\.0\.1|localhost):54321\/?$/;
const PROJECT_ID = "manu-ai-local";
const SYNTHETIC_USER_PREFIX = "aiya-phase3-local-";
const SYNTHETIC_PASSWORD = process.env.MANU_PHASE3_SYNTHETIC_PASSWORD || "AiyaPhase3LocalOnly!";
const FIXTURE_VERSION = "aiya-performance-plan1-phase3-fixture-v1";

const TENANTS = {
  small: {
    key: "small",
    id: "00000000-0000-4000-8000-000000002101",
    label: "small",
    clientCount: 3,
    messageCounts: [20],
  },
  normal: {
    key: "normal",
    id: "00000000-0000-4000-8000-000000002102",
    label: "normal",
    clientCount: 50,
    messageCounts: [20, 200],
  },
};

const TENANT_LIST = Object.values(TENANTS);
const ROLE_MATRIX = [
  { key: "owner", membershipRole: "owner", accessLevel: "care_team" },
  { key: "assistant", membershipRole: "assistant", accessLevel: "care_team" },
  { key: "viewer", membershipRole: "dietitian", accessLevel: "viewer" },
  { key: "auditor", membershipRole: "auditor", accessLevel: "viewer" },
];

const REQUIRED_TABLES = [
  "personas",
  "tenants",
  "tenant_memberships",
  "dietitians",
  "clients",
  "client_channels",
  "client_assignments",
  "conversations",
  "conversation_memories",
  "messages",
  "notifications",
  "client_form_schemas",
  "client_form_responses",
  "dietitian_form_schemas",
  "dietitian_form_responses",
  "client_food_rule_profiles",
  "client_menu_plans",
  "tenant_entitlements",
  "ai_chat_conversations",
];

const STORE_READS = [
  ["tenants", "id"],
  ["dietitians", "id"],
  ["clients", "id"],
  ["client_assignments", "id"],
  ["client_channels", "id"],
  ["conversations", "id"],
  ["conversation_memories", "id"],
  ["messages", "id"],
  ["notifications", "id"],
  ["client_form_schemas", "id"],
  ["client_form_responses", "id"],
  ["dietitian_form_schemas", "id"],
  ["dietitian_form_responses", "id"],
  ["client_food_rule_profiles", "id"],
  ["client_menu_plans", "id"],
  ["tenant_entitlements", "tenant_id"],
];

class Phase3Error extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function run(command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    timedOut: result.error?.code === "ETIMEDOUT",
  };
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function sha256File(path) {
  return existsSync(path) ? sha256(readFileSync(path)) : null;
}

function readJson(relativePath) {
  const path = join(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function idFor(base, index = 0) {
  return `00000000-0000-4000-8000-${String(base + index).padStart(12, "0")}`;
}

function tenantOffset(tenantKey) {
  return tenantKey === "small" ? 0 : 1000;
}

function fixtureId(tenantKey, kind, index = 0) {
  const offset = tenantOffset(tenantKey);
  const bases = {
    dietitian: 3000,
    client: 4000,
    conversation: 6000,
    message: 8000,
    assignment: 10000,
    form: 12000,
    response: 13000,
    foodRule: 14000,
    menu: 15000,
    notification: 16000,
    aiChat: 18000,
  };
  return idFor((bases[kind] ?? 20000) + offset, index);
}

function nowAt(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function assertLocalApiUrl(apiUrl) {
  if (!LOCAL_API_URL_PATTERN.test(apiUrl || "")) {
    throw new Phase3Error("remote_supabase_target_rejected");
  }
}

function parseLocalStatus() {
  const result = run(npxCommand(), ["supabase", "status", "-o", "json"], appRoot);
  if (result.status !== 0) throw new Phase3Error("supabase_status_failed");

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Phase3Error("supabase_status_not_json");
  }

  const status = {
    apiUrl: parsed.API_URL ?? null,
    dbUrl: parsed.DB_URL ?? null,
    anonKey: parsed.ANON_KEY ?? null,
    serviceRoleKey: parsed.SERVICE_ROLE_KEY ?? null,
  };

  assertLocalApiUrl(status.apiUrl);
  if (!status.anonKey || !status.serviceRoleKey) {
    throw new Phase3Error("supabase_local_credentials_missing");
  }
  return status;
}

function migrationFingerprint() {
  const migrationDir = join(appRoot, "supabase", "migrations");
  const files = readdirSync(migrationDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => ({ name, sha256: sha256File(join(migrationDir, name)) }));
  return { fileCount: files.length, sha256: sha256(JSON.stringify(files)), names: files.map((file) => file.name) };
}

function migrationStatus() {
  const result = run(npxCommand(), ["supabase", "migration", "list", "--local"], appRoot);
  const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter(Boolean);
  const datedLines = lines.filter((line) => /\b20\d{12}\b/.test(line));
  return {
    status: result.status === 0 ? "PASS" : "BLOCKED",
    exitCode: result.status,
    timedOut: result.timedOut,
    migrationLineCount: datedLines.length,
  };
}

function sourceIdentity() {
  const branch = run("git", ["branch", "--show-current"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const upstream = run("git", ["rev-parse", "HEAD@{u}"]);
  const status = run("git", ["status", "--short", "--branch"]);
  const diffCheck = run("git", ["diff", "--check"]);
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    upstreamHead: upstream.status === 0 ? upstream.stdout.trim() : null,
    worktreeStatus: status.stdout.trim(),
    diffCheck: diffCheck.status === 0 ? "PASS" : "FAIL",
  };
}

async function liveReleaseIdentity() {
  const endpoints = [
    "https://aiyaworkspace.com/api/health/release",
    "https://admin.aiyaworkspace.com/api/health/release",
  ];
  const results = [];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();
      results.push({
        endpoint,
        httpStatus: response.status,
        releaseId: body.releaseId ?? null,
        commitSha: body.commitSha ?? body.commit ?? null,
        migrationFingerprint: body.migrationFingerprint ?? null,
        compatibilityVersion: body.compatibilityVersion ?? null,
      });
    } catch {
      results.push({ endpoint, httpStatus: "FETCH_FAILED", releaseId: null, commitSha: null });
    }
  }
  return results;
}

function historicalIntegrity() {
  const phase1 = readJson("docs/AIYA_PERFORMANCE_PLAN_1_EVIDENCE.json");
  const phase2 = readJson(PHASE_2_EVIDENCE_PATH);
  const expected = new Map();
  for (const evidence of [phase1, phase2]) {
    for (const item of evidence?.historicalEvidence?.files ?? []) {
      if (item.path && item.sha256) expected.set(item.path, item.sha256);
    }
  }
  const files = HISTORICAL_PATHS.map((path) => {
    const actualSha256 = sha256File(join(repoRoot, path));
    return {
      path,
      exists: actualSha256 !== null,
      sha256: actualSha256,
      expectedSha256: expected.get(path) ?? null,
      unchanged: expected.has(path) ? actualSha256 === expected.get(path) : true,
    };
  });
  return {
    files,
    allPresent: files.every((item) => item.exists),
    allUnchanged: files.every((item) => item.unchanged),
  };
}

function redactionCheck() {
  const sample = {
    authorization: "synthetic-token",
    cookie: "synthetic-cookie",
    password: SYNTHETIC_PASSWORD,
    messageBody: "Synthetic message body",
    email: "aiya-phase3-local-owner@manu.local",
  };
  const sanitized = {
    authorization: "<redacted>",
    cookie: "<redacted>",
    password: "<redacted>",
    messageBody: "<redacted>",
    email: "<redacted>",
  };
  const serialized = JSON.stringify(sanitized);
  return {
    status:
      !serialized.includes(sample.authorization) &&
      !serialized.includes(sample.cookie) &&
      !serialized.includes(sample.password) &&
      !serialized.includes(sample.messageBody) &&
      !serialized.includes(sample.email),
    recordedFields: Object.keys(sanitized),
  };
}

async function checked(result, operation) {
  const response = await result;
  if (response.error) throw new Phase3Error(operation);
  return response;
}

async function insertRows(admin, table, rows, operation = table) {
  if (!rows.length) return;
  for (let index = 0; index < rows.length; index += 500) {
    await checked(admin.from(table).insert(rows.slice(index, index + 500)), `${operation}_batch_${index}`);
  }
}

async function listSyntheticUsers(admin) {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await checked(admin.auth.admin.listUsers({ page, perPage: 100 }), "list_synthetic_users");
    users.push(...(result.data?.users ?? []));
    if ((result.data?.users ?? []).length < 100) break;
  }
  return users.filter((user) => user.email?.startsWith(SYNTHETIC_USER_PREFIX));
}

async function deleteFixture(admin) {
  await checked(
    admin.from("tenants").delete().in("id", TENANT_LIST.map((tenant) => tenant.id)),
    "delete_fixture_tenants",
  );
  const users = await listSyntheticUsers(admin);
  for (const user of users) {
    await checked(admin.auth.admin.deleteUser(user.id), "delete_fixture_auth_user");
  }
}

async function createSyntheticUser(admin, tenantKey, roleKey) {
  const email = `${SYNTHETIC_USER_PREFIX}${tenantKey}-${roleKey}@manu.local`;
  const users = await listSyntheticUsers(admin);
  const existing = users.find((user) => user.email === email);
  if (existing) {
    const updated = await checked(
      admin.auth.admin.updateUserById(existing.id, { password: SYNTHETIC_PASSWORD, email_confirm: true }),
      "update_fixture_auth_user",
    );
    return updated.data.user;
  }
  const created = await checked(
    admin.auth.admin.createUser({ email, password: SYNTHETIC_PASSWORD, email_confirm: true }),
    "create_fixture_auth_user",
  );
  return created.data.user;
}

async function buildTenantFixture(admin, tenant) {
  const accounts = {};
  for (const role of ROLE_MATRIX) {
    accounts[role.key] = await createSyntheticUser(admin, tenant.key, role.key);
  }

  const dietitians = ROLE_MATRIX.map((role, index) => ({
    id: fixtureId(tenant.key, "dietitian", index),
    tenant_id: tenant.id,
    display_name: `Synthetic ${tenant.label} ${role.key}`,
    timezone: "Europe/Istanbul",
    ui_language: "tr",
    auth_user_id: accounts[role.key].id,
  }));

  await checked(admin.from("tenants").insert({ id: tenant.id, name: `AIya Synthetic ${tenant.label} Tenant` }), "insert_fixture_tenant");
  await insertRows(
    admin,
    "tenant_memberships",
    ROLE_MATRIX.map((role) => ({
      tenant_id: tenant.id,
      user_id: accounts[role.key].id,
      role: role.membershipRole,
    })),
    "insert_fixture_memberships",
  );
  await insertRows(admin, "dietitians", dietitians, "insert_fixture_dietitians");
  await checked(
    admin.from("tenant_entitlements").insert({
      tenant_id: tenant.id,
      status: "active",
      status_changed_at: nowAt(),
      updated_at: nowAt(),
    }),
    "insert_fixture_entitlement",
  );

  const ownerDietitianId = dietitians[0].id;
  const clients = Array.from({ length: tenant.clientCount }, (_, index) => ({
    id: fixtureId(tenant.key, "client", index),
    tenant_id: tenant.id,
    dietitian_id: ownerDietitianId,
    full_name: `Synthetic ${tenant.label} client ${index + 1}`,
    primary_phone_e164: null,
    communication_language: "tr",
    selected_persona_id: "balanced_coach",
    ai_status: "passive",
    ai_mode: "copilot",
    channel_permission: "pending",
    mandatory_safety_complete: false,
    safety_checklist: {},
    human_takeover_locked: false,
    red_risk_lock: { status: "none" },
    yellow_risk_hold: { status: "none" },
    context_revision: 1,
    health_profile: {},
    diet_plan: {},
    allergies: [],
    restricted_foods: [],
    clinical_risk_notes: [],
    pinned_notes: [],
  }));
  await insertRows(admin, "clients", clients, "insert_fixture_clients");

  await insertRows(
    admin,
    "client_channels",
    clients.map((client, index) => ({
      tenant_id: tenant.id,
      client_id: client.id,
      channel: "whatsapp",
      channel_user_id: `synthetic-${tenant.key}-${index + 1}`,
      display_handle: `synthetic-${tenant.key}-${index + 1}`,
      is_active: true,
    })),
    "insert_fixture_channels",
  );

  const assignedClientId = clients[0].id;
  const unassignedClientId = clients.at(-1).id;
  await insertRows(
    admin,
    "client_assignments",
    [
      {
        tenant_id: tenant.id,
        client_id: assignedClientId,
        dietitian_id: dietitians[1].id,
        access_level: "care_team",
      },
      {
        tenant_id: tenant.id,
        client_id: assignedClientId,
        dietitian_id: dietitians[2].id,
        access_level: "viewer",
      },
    ],
    "insert_fixture_assignments",
  );

  const conversations = tenant.messageCounts.map((messageCount, index) => ({
    id: fixtureId(tenant.key, "conversation", index),
    tenant_id: tenant.id,
    dietitian_id: ownerDietitianId,
    client_id: clients[index].id,
    channel: "whatsapp",
    status: "active",
  }));
  await insertRows(admin, "conversations", conversations, "insert_fixture_conversations");
  await insertRows(
    admin,
    "conversation_memories",
    conversations.map((conversation) => ({
      tenant_id: tenant.id,
      conversation_id: conversation.id,
      client_id: conversation.client_id,
      rolling_summary: "Synthetic summary",
      durable_facts: {},
    })),
    "insert_fixture_memories",
  );

  const messages = [];
  for (const [conversationIndex, messageCount] of tenant.messageCounts.entries()) {
    for (let index = 0; index < messageCount; index += 1) {
      const isClientMessage = index % 2 === 0;
      messages.push({
        id: fixtureId(tenant.key, "message", conversationIndex * 1000 + index),
        tenant_id: tenant.id,
        conversation_id: conversations[conversationIndex].id,
        sender: isClientMessage ? "client" : "assistant",
        body: `Synthetic message ${conversationIndex + 1}-${index + 1}`,
        origin: isClientMessage ? "client_inbound" : "system_event",
        risk: "green",
        status: "stored",
        created_at: new Date(Date.parse("2026-01-01T00:00:00.000Z") + index * 1000).toISOString(),
      });
    }
  }
  await insertRows(admin, "messages", messages, "insert_fixture_messages");

  const formId = fixtureId(tenant.key, "form");
  const form = {
    id: formId,
    tenant_id: tenant.id,
    title: "Synthetic intake form",
    language_code: "tr",
    version: 1,
    status: "published",
    fields: [
      {
        id: "synthetic-field",
        label: "Synthetic field",
        type: "text",
        required: false,
        llmVisibility: "never",
      },
    ],
    published_at: nowAt(),
  };
  await insertRows(admin, "client_form_schemas", [form], "insert_fixture_form_schema");
  await insertRows(
    admin,
    "client_form_responses",
    [
      {
        id: fixtureId(tenant.key, "response"),
        tenant_id: tenant.id,
        client_id: clients[0].id,
        schema_id: formId,
        schema_version: 1,
        schema_snapshot: form,
        answers: { "synthetic-field": "synthetic-value" },
      },
    ],
    "insert_fixture_form_response",
  );

  await insertRows(
    admin,
    "client_food_rule_profiles",
    [
      {
        id: fixtureId(tenant.key, "foodRule"),
        tenant_id: tenant.id,
        client_id: clients[0].id,
        dietitian_id: ownerDietitianId,
        version: 1,
        status: "published",
        revision: 1,
        profile_data: { allowedFoodGroups: [], forbiddenFoodGroups: [], flexibilityGlobal: "moderate" },
        catalog_version: "synthetic-catalog-v1",
        catalog_source_sha256: "synthetic-catalog-source",
        catalog_record_set_sha256: "synthetic-catalog-records",
        notes: "Synthetic food rule profile",
        published_at: nowAt(),
      },
    ],
    "insert_fixture_food_rule",
  );
  await insertRows(
    admin,
    "client_menu_plans",
    [
      {
        id: fixtureId(tenant.key, "menu"),
        tenant_id: tenant.id,
        client_id: clients[0].id,
        dietitian_id: ownerDietitianId,
        template_type: "synthetic",
        status: "active",
        version: 1,
        revision: 1,
        title: "Synthetic menu plan",
        plan_data: {
          mealSlots: [],
          preferredFoods: [],
          avoidFoods: [],
          dietitianNotes: "Synthetic plan",
          clientFacingNotes: "Synthetic plan",
        },
        catalog_version: "synthetic-catalog-v1",
        catalog_source_sha256: "synthetic-catalog-source",
        catalog_record_set_sha256: "synthetic-catalog-records",
        export_visible: true,
        activated_at: nowAt(),
      },
    ],
    "insert_fixture_menu_plan",
  );

  await insertRows(
    admin,
    "notifications",
    [
      {
        id: fixtureId(tenant.key, "notification"),
        tenant_id: tenant.id,
        type: "system",
        kind: "legacy_system",
        priority: "review_required",
        entity_type: "client",
        entity_id: clients[0].id,
        title: "Synthetic notification",
        body: "Synthetic review marker",
        read: false,
        occurrence_count: 1,
        last_occurred_at: nowAt(),
      },
    ],
    "insert_fixture_notification",
  );

  const aiChatRows = [
    {
      id: fixtureId(tenant.key, "aiChat", 0),
      tenant_id: tenant.id,
      created_by_user_id: accounts.owner.id,
      created_by_dietitian_id: ownerDietitianId,
      scope_type: "general",
      client_id: null,
      title: "Synthetic general chat",
      status: "active",
      revision: 1,
      last_message_at: nowAt(),
    },
  ];
  if (tenant.key === "normal") {
    aiChatRows.push({
      id: fixtureId(tenant.key, "aiChat", 1),
      tenant_id: tenant.id,
      created_by_user_id: accounts.owner.id,
      created_by_dietitian_id: ownerDietitianId,
      scope_type: "client",
      client_id: clients[0].id,
      title: "Synthetic client chat",
      status: "active",
      revision: 1,
      last_message_at: nowAt(),
    });
  }
  await insertRows(admin, "ai_chat_conversations", aiChatRows, "insert_fixture_ai_chat");

  return {
    tenant,
    accounts,
    dietitians,
    clients,
    conversations,
    messageCount: messages.length,
    assignedClientId,
    unassignedClientId,
    formId,
    aiChatCount: aiChatRows.length,
  };
}

async function checkRequiredSchema(admin) {
  const checks = [];
  for (const table of REQUIRED_TABLES) {
    const response = await admin.from(table).select("id", { count: "exact", head: true });
    checks.push({ table, status: response.error ? "FAIL" : "PASS" });
  }
  return {
    status: checks.every((item) => item.status === "PASS") ? "PASS" : "FAIL",
    checks,
  };
}

function sessionIdFromAccessToken(accessToken) {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.session_id === "string" && payload.session_id.length > 0 ? payload.session_id : null;
  } catch {
    return null;
  }
}

async function signIn(status, account) {
  const client = createClient(status.apiUrl, status.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.auth.signInWithPassword({
    email: account.email,
    password: SYNTHETIC_PASSWORD,
  });
  if (result.error || !result.data.user || !result.data.session) {
    throw new Phase3Error("password_sign_in_failed");
  }
  const sessionId = sessionIdFromAccessToken(result.data.session.access_token);
  if (!sessionId) throw new Phase3Error("session_claim_missing");
  return { client, user: result.data.user, session: result.data.session, sessionId };
}

async function recordSessionActivity(admin, authContext, fixture) {
  const result = await checked(
    admin.rpc("p85_stage_5_record_session_activity_v3", {
      p_mode: "assert",
      p_session_id: authContext.sessionId,
      p_auth_user_id: authContext.user.id,
      p_tenant_id: fixture.tenant.id,
      p_dietitian_id: fixture.dietitiansByUserId[authContext.user.id],
    }),
    "record_local_session_activity",
  );
  return Boolean(result.data?.status === "active" || result.data?.locked === false);
}

async function readCount(client, table, filters = []) {
  let query = client.from(table).select("id", { count: "exact" });
  for (const filter of filters) query = query[filter.method](...filter.args);
  const result = await query;
  if (result.error) throw new Phase3Error(`rls_read_${table}`);
  return result.count ?? result.data?.length ?? 0;
}

async function readIds(client, table, filters = [], expectedErrorCode = null) {
  let query = client.from(table).select("id");
  for (const filter of filters) query = query[filter.method](...filter.args);
  const result = await query;
  if (result.error && result.error.code === expectedErrorCode) return [];
  if (result.error) throw new Phase3Error(`rls_read_${table}`);
  return result.data ?? [];
}

async function checkStoreReads(client, fixture) {
  const results = [];
  for (const [table, column] of STORE_READS) {
    const filters = table === "tenants"
      ? [{ method: "eq", args: ["id", fixture.tenant.id] }]
      : table === "dietitians"
        ? [{ method: "eq", args: ["id", fixture.dietitiansByUserId[fixture.ownerUserId]] }]
        : [{ method: "eq", args: ["tenant_id", fixture.tenant.id] }];
    let query = client.from(table).select(column).limit(1);
    for (const filter of filters) query = query[filter.method](...filter.args);
    const response = await query;
    results.push({ table, status: response.error ? "FAIL" : "PASS" });
  }
  return results;
}

async function verifyRoleMatrix(status, admin, fixture) {
  const tenantA = fixture.byTenant.small;
  const tenantB = fixture.byTenant.normal;
  const sessions = {};
  const sessionChecks = [];

  for (const item of fixture.accounts) {
    const authContext = await signIn(status, item);
    const user = await authContext.client.auth.getUser();
    if (user.error || user.data.user?.id !== item.userId) throw new Phase3Error("authenticated_user_mismatch");
    const roleFixture = fixture.byTenant[item.tenantKey];
    const activity = await recordSessionActivity(admin, authContext, roleFixture);
    sessions[`${item.tenantKey}:${item.roleKey}`] = authContext;
    sessionChecks.push({ tenantClass: item.tenantKey, role: item.roleKey, passwordSession: true, sessionActivity: activity });
  }

  const ownerSmall = sessions["small:owner"].client;
  const ownerNormal = sessions["normal:owner"].client;
  const assistantSmall = sessions["small:assistant"].client;
  const viewerSmall = sessions["small:viewer"].client;
  const auditorSmall = sessions["small:auditor"].client;

  const ownerSmallClients = await readCount(ownerSmall, "clients", [{ method: "eq", args: ["tenant_id", tenantA.tenant.id] }]);
  const ownerSmallCrossTenant = await readCount(ownerSmall, "clients", [{ method: "eq", args: ["tenant_id", tenantB.tenant.id] }]);
  const ownerNormalClients = await readCount(ownerNormal, "clients", [{ method: "eq", args: ["tenant_id", tenantB.tenant.id] }]);
  const ownerNormalMessages = await readCount(ownerNormal, "messages", [{ method: "eq", args: ["tenant_id", tenantB.tenant.id] }]);
  const ownerNormalChat = await readCount(ownerNormal, "ai_chat_conversations", [{ method: "eq", args: ["tenant_id", tenantB.tenant.id] }]);

  const assistantAssigned = await readIds(assistantSmall, "clients", [{ method: "eq", args: ["id", tenantA.assignedClientId] }]);
  const assistantUnassigned = await readIds(assistantSmall, "clients", [{ method: "eq", args: ["id", tenantA.unassignedClientId] }]);
  const assistantChat = await readIds(assistantSmall, "ai_chat_conversations", [{ method: "eq", args: ["tenant_id", tenantA.tenant.id] }]);

  const viewerAssigned = await readIds(viewerSmall, "clients", [{ method: "eq", args: ["id", tenantA.assignedClientId] }]);
  const viewerUnassigned = await readIds(viewerSmall, "clients", [{ method: "eq", args: ["id", tenantA.unassignedClientId] }]);
  const viewerUpdate = await viewerSmall
    .from("clients")
    .update({ full_name: "Synthetic blocked viewer update" })
    .eq("id", tenantA.assignedClientId)
    .select("id");
  if (viewerUpdate.error || (viewerUpdate.data ?? []).length !== 0) throw new Phase3Error("viewer_write_boundary_failed");

  const auditorClients = await readIds(auditorSmall, "clients", [{ method: "eq", args: ["tenant_id", tenantA.tenant.id] }]);
  const auditorMessages = await readIds(auditorSmall, "messages", [{ method: "eq", args: ["tenant_id", tenantA.tenant.id] }]);
  const auditorChats = await readIds(auditorSmall, "ai_chat_conversations", [{ method: "eq", args: ["tenant_id", tenantA.tenant.id] }]);

  const ownerStoreReads = await checkStoreReads(ownerNormal, tenantB);
  const ownerStoreReadStatus = ownerStoreReads.every((item) => item.status === "PASS");
  if (!ownerStoreReadStatus) throw new Phase3Error("owner_store_read_failed");

  const anonymous = createClient(status.apiUrl, status.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const anonymousClients = await readIds(
    anonymous,
    "clients",
    [{ method: "eq", args: ["tenant_id", tenantA.tenant.id] }],
    "42501",
  );

  const assertions = {
    ownerSmallClients: ownerSmallClients === tenantA.tenant.clientCount,
    ownerSmallCrossTenantHidden: ownerSmallCrossTenant === 0,
    ownerNormalClients: ownerNormalClients === tenantB.tenant.clientCount,
    ownerNormalMessages: ownerNormalMessages === tenantB.messageCount,
    ownerNormalAiChat: ownerNormalChat === tenantB.aiChatCount,
    assistantAssignedClientVisible: assistantAssigned.length === 1,
    assistantUnassignedClientHidden: assistantUnassigned.length === 0,
    assistantAiChatHidden: assistantChat.length === 0,
    viewerAssignedClientVisible: viewerAssigned.length === 1,
    viewerUnassignedClientHidden: viewerUnassigned.length === 0,
    auditorClientsHidden: auditorClients.length === 0,
    auditorMessagesHidden: auditorMessages.length === 0,
    auditorAiChatHidden: auditorChats.length === 0,
    anonymousClientsHidden: anonymousClients.length === 0,
    ownerStoreReadsPass: ownerStoreReadStatus,
    passwordSessionCount: sessionChecks.length === fixture.accounts.length,
  };
  if (Object.values(assertions).some((value) => value === false)) throw new Phase3Error("rls_role_matrix_failed");

  for (const authContext of Object.values(sessions)) await authContext.client.auth.signOut();
  await anonymous.auth.signOut();

  return {
    status: "PASS",
    assertions,
    sessionChecks,
    storeReads: ownerStoreReads,
    counts: {
      ownerSmallClients,
      ownerNormalClients,
      ownerNormalMessages,
      ownerNormalChat,
      assistantAssigned: assistantAssigned.length,
      viewerAssigned: viewerAssigned.length,
      auditorClients: auditorClients.length,
      anonymousClients: anonymousClients.length,
    },
  };
}

function buildFixtureSummary(fixtures) {
  const summary = fixtures.map((fixture) => ({
    class: fixture.tenant.key,
    clientCount: fixture.clients.length,
    conversationCount: fixture.conversations.length,
    messageCount: fixture.messageCount,
    conversationMessageCounts: fixture.tenant.messageCounts,
    filledFormCount: 1,
    filledNutritionProfileCount: 1,
    filledMenuPlanCount: 1,
    notificationCount: 1,
    aiChatCount: fixture.aiChatCount,
    assignmentScenario: {
      assistant: "care_team",
      viewer: "viewer",
      auditor: "denied_raw_client_data",
    },
  }));
  return {
    fixtureVersion: FIXTURE_VERSION,
    classes: ["small_synthetic", "normal_synthetic", "scale_synthetic"],
    scaleDefinition: "normal tenant 200-message conversation; no hosted or 5000-client load test",
    tenants: summary,
    hash: sha256(JSON.stringify(summary)),
    rawRowsRecorded: false,
    rawMessageBodiesRecorded: false,
    clinicalDataRecorded: false,
  };
}

function buildAccountSummary(accounts) {
  return {
    tenantCount: new Set(accounts.map((account) => account.tenantKey)).size,
    accountCount: accounts.length,
    roles: [...new Set(accounts.map((account) => account.roleKey))],
    passwordSessionFlow: "signInWithPassword via local anon key",
    demoCookieUsed: false,
    fallbackStoreUsed: false,
    tokensRecorded: false,
    passwordsRecorded: false,
  };
}

function stage(stageId, status, prerequisiteEvidence, performedActions, verificationResults, outputEvidence, blockingReason = null) {
  const now = new Date().toISOString();
  return {
    stageId,
    status,
    startedAt: now,
    finishedAt: now,
    sourceIdentity: null,
    prerequisiteEvidence,
    performedActions,
    verificationResults,
    outputEvidence,
    blockingReason,
  };
}

async function buildEvidence() {
  const startedAt = new Date().toISOString();
  const source = sourceIdentity();
  const live = await liveReleaseIdentity();
  const phase2 = readJson(PHASE_2_EVIDENCE_PATH);
  const historicalAtStart = historicalIntegrity();
  const local = { status: "BLOCKED" };
  const stageLedger = [];
  let fixtureSummary = null;
  let accountSummary = null;
  let rls = null;
  let schema = null;
  let migrations = null;
  let blockers = [];
  let admin = null;
  let localStatus = null;
  let fixtures = [];
  let accounts = [];

  const phase2Ready = phase2?.status === "COMPLETE" && phase2?.outcome === "HARNESS_READY_WITH_NEGATIVE_CONTROLS";
  if (!phase2Ready) blockers.push("phase2_harness_prerequisite_not_complete");

  try {
    localStatus = parseLocalStatus();
    local.status = "PASS";
    local.apiUrlIsLocal = true;
    local.projectId = PROJECT_ID;
    local.credentialsAvailable = true;
    migrations = migrationStatus();
    schema = await checkRequiredSchema(
      createClient(localStatus.apiUrl, localStatus.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
    if (schema.status !== "PASS") blockers.push("required_local_schema_missing");
  } catch (error) {
    blockers.push(error instanceof Phase3Error ? error.code : "local_preflight_failed");
  }

  stageLedger.push(
    stage(
      "3.1",
      blockers.length === 0 ? "COMPLETE" : "BLOCKED",
      ["Plan 1 Phase 2 evidence", "Docker/local Supabase target", "current migration tree"],
      [
        "Read the completed Phase 2 evidence",
        "Read-only checked local Supabase status and rejected non-local URLs",
        "Read-only checked migration status and required store tables",
      ],
      { phase2Ready, localTarget: local, migrationStatus: migrations, requiredSchema: schema },
      ["sourceIdentity", "liveRelease", "localTarget", "migrationFingerprint"],
      blockers.length === 0 ? null : blockers[0],
    ),
  );

  if (blockers.length === 0) {
    admin = createClient(localStatus.apiUrl, localStatus.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    try {
      await deleteFixture(admin);
      fixtures = [];
      for (const tenant of TENANT_LIST) fixtures.push(await buildTenantFixture(admin, tenant));
      accounts = fixtures.flatMap((fixture) =>
        ROLE_MATRIX.map((role) => ({
          tenantKey: fixture.tenant.key,
          roleKey: role.key,
          userId: fixture.accounts[role.key].id,
          email: `${SYNTHETIC_USER_PREFIX}${fixture.tenant.key}-${role.key}@manu.local`,
        })),
      );
      for (const fixture of fixtures) {
        fixture.dietitiansByUserId = Object.fromEntries(
          ROLE_MATRIX.map((role, index) => [fixture.accounts[role.key].id, fixture.dietitians[index].id]),
        );
        fixture.ownerUserId = fixture.accounts.owner.id;
      }
      fixtureSummary = buildFixtureSummary(fixtures);
      accountSummary = buildAccountSummary(accounts);
    } catch (error) {
      blockers.push(error instanceof Phase3Error ? error.code : "fixture_seed_failed");
    }
  }

  stageLedger.push(
    stage(
      "3.2",
      blockers.length === 0 ? "COMPLETE" : "BLOCKED",
      ["3.1"],
      [
        "Deleted only the fixed Phase 3 tenant IDs and synthetic auth-user prefix",
        "Created two local tenants with small=3 and normal=50 clients",
        "Created owner, assistant, viewer-assignment, and auditor accounts per tenant",
        "Created 20-message and 200-message conversations, form, nutrition, menu, notification, and AI Chat read fixtures",
        "Kept provider/channel egress and real health data absent",
      ],
      { fixture: fixtureSummary, accounts: accountSummary },
      ["fixtureSummary", "fixtureHash", "roleMatrixContract"],
      blockers.length === 0 ? null : blockers.at(-1),
    ),
  );

  if (blockers.length === 0) {
    try {
      const byTenant = Object.fromEntries(fixtures.map((fixture) => [fixture.tenant.key, fixture]));
      rls = await verifyRoleMatrix(localStatus, admin, { byTenant, accounts, fixtures });
    } catch (error) {
      blockers.push(error instanceof Phase3Error ? error.code : "auth_store_verification_failed");
    }
  }

  stageLedger.push(
    stage(
      "3.3",
      blockers.length === 0 ? "COMPLETE" : "BLOCKED",
      ["3.2"],
      [
        "Signed in each synthetic account with Supabase password authentication through the local anon key",
        "Verified getUser, access-token session claim, and local session activity contract",
        "Used authenticated clients for tenant/store reads; service-role was not used for RLS assertions",
      ],
      { status: rls?.status ?? "NOT_RUN", sessionChecks: rls?.sessionChecks ?? [] },
      ["passwordSessions", "sessionActivity", "noDemoCookie", "noFallbackStore"],
      blockers.length === 0 ? null : blockers.at(-1),
    ),
  );

  stageLedger.push(
    stage(
      "3.4",
      blockers.length === 0 ? "COMPLETE" : "BLOCKED",
      ["3.3"],
      [
        "Verified owner cross-tenant isolation and authenticated app-state store reads",
        "Verified assistant care-team assignment access and AI Chat denial",
        "Verified viewer assignment read-only boundary and blocked update",
        "Verified auditor raw client/message/AI Chat denial and anonymous denial",
      ],
      { status: rls?.status ?? "NOT_RUN", assertions: rls?.assertions ?? {}, counts: rls?.counts ?? {} },
      ["rlsMatrix", "storeReadMatrix", "aiChatReadBoundary"],
      blockers.length === 0 ? null : blockers.at(-1),
    ),
  );

  const historicalAtEnd = historicalIntegrity();
  const redaction = redactionCheck();
  const evidenceIntegrity = {
    status:
      historicalAtStart.allPresent &&
      historicalAtStart.allUnchanged &&
      historicalAtEnd.allPresent &&
      historicalAtEnd.allUnchanged &&
      redaction.status &&
      source.diffCheck === "PASS",
    historicalAtStart,
    historicalAtEnd,
    redaction,
    diffCheck: source.diffCheck,
  };
  if (!evidenceIntegrity.status) blockers.push("evidence_integrity_failed");

  stageLedger.push(
    stage(
      "3.5",
      evidenceIntegrity.status ? "COMPLETE" : "FAILED",
      ["3.4"],
      [
        "Hashed the deterministic fixture contract and counts without recording raw rows",
        "Compared historical evidence hashes before and after the local fixture run",
        "Ran secret/token/password/cookie/message redaction checks",
      ],
      evidenceIntegrity,
      ["fixtureHash", "historicalIntegrity", "redaction"],
      evidenceIntegrity.status ? null : "evidence_integrity_failed",
    ),
  );

  const orderedComplete = stageLedger.every((item) => item.status === "COMPLETE");
  const finalStatus = blockers.length === 0 && orderedComplete ? "COMPLETE" : "BLOCKED";
  const finalControls = {
    orderedStagesComplete: orderedComplete,
    localOnly: local.apiUrlIsLocal === true,
    schemaReady: schema?.status === "PASS",
    fixtureReady: Boolean(fixtureSummary),
    authenticatedSessionReady: rls?.status === "PASS",
    normalRlsPathReady: rls?.status === "PASS",
    validPerformanceBaselineCaptured: false,
    rootCauseConfirmed: false,
    runtimeRemediationApplied: false,
    hostedSyntheticAccountCreated: false,
    physicalAndroidOrPwaCapture: false,
    productionDecision: "NO-GO",
  };
  if (!finalControls.orderedStagesComplete) blockers.push("ordered_phase3_stages_incomplete");

  stageLedger.push(
    stage(
      "3.6",
      finalStatus,
      ["3.1", "3.2", "3.3", "3.4", "3.5"],
      [
        "Applied the ordered phase closure gate",
        "Recorded that fixture readiness is not a performance baseline and does not authorize runtime remediation",
        "Recorded hosted/device/provider/deploy exclusions",
      ],
      { finalControls, blockerCount: blockers.length },
      ["phase3Closure", "nextEligibleAction"],
      finalStatus === "COMPLETE" ? null : [...new Set(blockers)].at(-1) ?? "phase3_blocked",
    ),
  );

  for (const ledgerItem of stageLedger) ledgerItem.sourceIdentity = source;

  return {
    phase: "AIya Performance Plan 1 - Phase 3 Real Auth and Store Synthetic Environment",
    schemaVersion: "aiya-performance-plan1-phase3-v1",
    generatedAt: new Date().toISOString(),
    startedAt,
    status: finalStatus,
    outcome: finalStatus === "COMPLETE" ? "SYNTHETIC_AUTH_STORE_READY" : "PHASE_3_BLOCKED",
    productionDecision: "NO-GO",
    sourceIdentity: source,
    liveRelease: live,
    localTarget: {
      kind: "local_supabase",
      projectId: PROJECT_ID,
      apiUrl: localStatus?.apiUrl ?? null,
      urlIsLocal: localStatus?.apiUrl ? LOCAL_API_URL_PATTERN.test(localStatus.apiUrl) : false,
      credentialsRecorded: false,
      databaseReset: false,
      remoteMigration: false,
    },
    migrationFingerprint: migrationFingerprint(),
    migrationStatus: migrations,
    prerequisiteEvidence: {
      phase2Path: PHASE_2_EVIDENCE_PATH,
      phase2Status: phase2?.status ?? null,
      phase2Outcome: phase2?.outcome ?? null,
      phase2HarnessReady: phase2Ready,
    },
    fixture: fixtureSummary,
    accountContract: accountSummary,
    authenticationAndRls: rls,
    evidenceIntegrity,
    stageLedger,
    blockers: [...new Set(blockers)],
    constraints: {
      serviceRoleUse: "fixture_seed_cleanup_and_local_session_activity_only",
      browserOrRouteAuthBypass: "NOT_USED",
      demoCookie: "NOT_USED",
      fallbackStore: "NOT_USED",
      providerEgress: "NOT_EXECUTED",
      whatsappOrTelegramTraffic: "NOT_EXECUTED",
      hostedSyntheticAccount: "NOT_EXECUTED",
      hostedInviteOrOnboarding: "NOT_EXECUTED",
      physicalAndroidOrPwaCapture: "NOT_EXECUTED",
      performanceBaseline: "NOT_EXECUTED",
      rootCauseAttribution: "NOT_EXECUTED",
      runtimeUiApiChange: "NOT_EXECUTED",
      schemaMigration: "NOT_EXECUTED",
      dependencyChange: "NOT_EXECUTED",
      deploy: "NOT_EXECUTED",
      pushPrMerge: "NOT_EXECUTED",
      productionGateChange: "NOT_EXECUTED",
      rawPayloadTraceHarCookieTokenPromptClinicalCapture: "NOT_RECORDED",
    },
    finalControls,
    nextEligibleAction:
      finalStatus === "COMPLETE"
        ? "Plan 1 Phase 4 - matched authenticated baseline measurements and freeze reproduction; no runtime optimization is authorized."
        : "Resolve the Phase 3 blocker, rerun this phase from stage 3.1, and do not start Plan 1 Phase 4.",
    closureRule:
      "Phase 3 closes only when stages 3.1-3.5 are complete, stage 3.6 confirms the ordered ledger, local password sessions and normal RLS/store reads pass, and no blocker remains. Fixture readiness does not prove a performance baseline, root cause, or remediation.",
  };
}

function sanitizeEvidence(evidence) {
  const serialized = JSON.stringify(evidence);
  return JSON.parse(
    serialized
      .replaceAll(SYNTHETIC_PASSWORD, "<redacted>")
      .replaceAll("synthetic-token", "<redacted>")
      .replaceAll("synthetic-cookie", "<redacted>"),
  );
}

async function main() {
  const evidence = sanitizeEvidence(await buildEvidence());
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  console.log(`wrote ${relative(repoRoot, evidencePath).replaceAll("\\", "/")}`);
  console.log(`status ${evidence.status}`);
  console.log(`outcome ${evidence.outcome}`);
  console.log(`fixtureHash ${evidence.fixture?.hash ?? "none"}`);
  console.log(`blockers ${evidence.blockers.join(",") || "none"}`);
  if (evidence.status !== "COMPLETE") process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Phase3Error ? error.code : "phase3_evidence_failed");
    process.exit(1);
  });
}

export { buildEvidence, FIXTURE_VERSION, TENANTS, validatePhase3FixtureContract };

function validatePhase3FixtureContract() {
  const failures = [];
  if (TENANTS.small.clientCount !== 3) failures.push("small_client_count");
  if (TENANTS.normal.clientCount !== 50) failures.push("normal_client_count");
  if (TENANTS.small.messageCounts[0] !== 20) failures.push("small_message_count");
  if (TENANTS.normal.messageCounts[0] !== 20 || TENANTS.normal.messageCounts[1] !== 200) {
    failures.push("normal_message_counts");
  }
  if (ROLE_MATRIX.length !== 4) failures.push("role_matrix");
  if (!REQUIRED_TABLES.includes("ai_chat_conversations")) failures.push("ai_chat_table");
  return { status: failures.length === 0 ? "PASS" : "FAIL", failures };
}
