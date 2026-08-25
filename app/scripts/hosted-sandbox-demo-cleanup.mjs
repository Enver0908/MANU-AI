import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const DEMO_TENANT_UUID = "00000000-0000-4000-8000-000000000001";
export const DEMO_EMAIL = "demo@manu.local";

export const DEMO_CLEANUP_TABLES = [
  { table: "processed_inbound_events", column: "tenant_id" },
  { table: "channel_adapter_rollback_controls", column: "tenant_id" },
  { table: "client_food_rule_profiles", column: "tenant_id" },
  { table: "client_menu_plans", column: "tenant_id" },
  { table: "client_context_updates", column: "tenant_id" },
  { table: "client_form_responses", column: "tenant_id" },
  { table: "client_form_schemas", column: "tenant_id" },
  { table: "dietitian_form_responses", column: "tenant_id" },
  { table: "dietitian_form_schemas", column: "tenant_id" },
  { table: "dietitian_voice_samples", column: "tenant_id" },
  { table: "internal_copilot_messages", column: "tenant_id" },
  { table: "internal_copilot_tool_calls", column: "tenant_id" },
  { table: "data_requests", column: "tenant_id" },
  { table: "notification_receipts", column: "tenant_id" },
  { table: "conversation_read_receipts", column: "tenant_id" },
  { table: "notifications", column: "tenant_id" },
  { table: "channel_deliveries", column: "tenant_id" },
  { table: "context_intake_proposals", column: "tenant_id" },
  { table: "risk_activity_events", column: "tenant_id" },
  { table: "human_control_sessions", column: "tenant_id" },
  { table: "channel_message_revisions", column: "tenant_id" },
  { table: "channel_events", column: "tenant_id" },
  { table: "channel_actor_bindings", column: "tenant_id" },
  { table: "channel_account_bindings", column: "tenant_id" },
  { table: "inbound_quarantines", column: "tenant_id" },
  { table: "audit_events", column: "tenant_id" },
  { table: "handoff_cases", column: "tenant_id" },
  { table: "messages", column: "tenant_id" },
  { table: "ai_decisions", column: "tenant_id" },
  { table: "risk_assessments", column: "tenant_id" },
  { table: "conversation_memories", column: "tenant_id" },
  { table: "conversations", column: "tenant_id" },
  { table: "client_channels", column: "tenant_id" },
  { table: "client_ai_status_events", column: "tenant_id" },
  { table: "client_assignments", column: "tenant_id" },
  { table: "clients", column: "tenant_id" },
  { table: "dietitian_voice_profiles", column: "tenant_id" },
  { table: "dietitians", column: "tenant_id" },
  { table: "tenant_memberships", column: "tenant_id" },
  { table: "tenant_entitlements", column: "tenant_id" },
  { table: "tenants", column: "id" },
];

export function parseCleanupArgs(argv = process.argv.slice(2)) {
  const apply = argv.includes("--apply");
  const dryRun = argv.includes("--dry-run") || !apply;
  return { dryRun, apply };
}

export function extractProjectRef(supabaseUrl) {
  const match = String(supabaseUrl).match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

export function isLocalSupabaseUrl(supabaseUrl) {
  const normalized = String(supabaseUrl).toLowerCase();
  return normalized.includes("localhost") || normalized.includes("127.0.0.1");
}

export function hashInventory(inventory) {
  return createHash("sha256").update(JSON.stringify(inventory)).digest("hex");
}

export function readBackupManifest(manifestPath) {
  const raw = readFileSync(manifestPath, "utf8");
  return validateBackupManifest(JSON.parse(raw));
}

export function validateBackupManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("backup_manifest_invalid");
  }
  if (!manifest.projectRef || !manifest.backupSha256) {
    throw new Error("backup_manifest_incomplete");
  }
  return manifest;
}

export async function countRows(admin, table, column, tenantId) {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, tenantId);
  if (error) {
    throw new Error(`inventory_failed:${table}:${error.message}`);
  }
  return count ?? 0;
}

export async function buildDemoInventory(admin, tenantId = DEMO_TENANT_UUID) {
  const inventory = [];
  for (const entry of DEMO_CLEANUP_TABLES) {
    const count = await countRows(admin, entry.table, entry.column, tenantId);
    inventory.push({ table: entry.table, count });
  }
  return inventory;
}

export async function auditDemoMembershipUsers(admin, tenantId = DEMO_TENANT_UUID) {
  const memberships = await admin.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId);
  if (memberships.error) {
    throw new Error(`membership_audit_failed:${memberships.error.message}`);
  }

  const unexpectedUsers = [];
  for (const membership of memberships.data ?? []) {
    const user = await admin.auth.admin.getUserById(membership.user_id);
    if (user.error) {
      throw new Error(`auth_user_lookup_failed:${membership.user_id}`);
    }
    const email = user.data.user?.email ?? "";
    if (email !== DEMO_EMAIL) {
      unexpectedUsers.push({ userId: membership.user_id, email });
    }
  }
  return unexpectedUsers;
}

export async function auditCrossTenantMemberships(admin, tenantId = DEMO_TENANT_UUID) {
  const memberships = await admin.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId);
  if (memberships.error) {
    throw new Error(`membership_audit_failed:${memberships.error.message}`);
  }

  const crossTenantUsers = [];
  for (const membership of memberships.data ?? []) {
    const allMemberships = await admin
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", membership.user_id);
    if (allMemberships.error) {
      throw new Error(`membership_audit_failed:${membership.user_id}`);
    }
    const tenantIds = new Set((allMemberships.data ?? []).map((row) => row.tenant_id));
    if (tenantIds.size > 1) {
      crossTenantUsers.push({ userId: membership.user_id, tenantIds: [...tenantIds] });
    }
  }
  return crossTenantUsers;
}

export function validateCleanupEnvironment(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("supabase_not_configured");
  }

  const projectRef = extractProjectRef(url);
  if (!projectRef) {
    throw new Error("project_ref_unresolved");
  }

  const expectedProjectRef = env.MANU_HOSTED_SANDBOX_PROJECT_REF;
  if (expectedProjectRef && expectedProjectRef !== projectRef) {
    throw new Error("project_ref_mismatch");
  }

  if (!isLocalSupabaseUrl(url) && env.MANU_HOSTED_SANDBOX_CLEANUP_APPROVED !== "true") {
    throw new Error("remote_cleanup_not_approved");
  }

  return { url, serviceRoleKey, projectRef };
}

export async function runDemoCleanup(options = {}) {
  const env = options.env ?? process.env;
  const { dryRun, apply } = parseCleanupArgs(options.argv ?? []);
  const requestId = options.requestId ?? randomUUID();
  const { url, serviceRoleKey, projectRef } = validateCleanupEnvironment(env);

  if (apply) {
    const manifestPath = env.MANU_HOSTED_SANDBOX_BACKUP_MANIFEST;
    if (!manifestPath) {
      throw new Error("backup_manifest_missing");
    }
    const manifest = readBackupManifest(path.resolve(manifestPath));
    if (manifest.projectRef !== projectRef) {
      throw new Error("backup_manifest_project_ref_mismatch");
    }
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const unexpectedUsers = await auditDemoMembershipUsers(admin);
  if (unexpectedUsers.length > 0) {
    throw new Error("unexpected_auth_users");
  }

  const crossTenantUsers = await auditCrossTenantMemberships(admin);
  if (crossTenantUsers.length > 0) {
    throw new Error("cross_tenant_memberships");
  }

  const inventory = await buildDemoInventory(admin);
  const inventoryHash = hashInventory(inventory);
  const totalRows = inventory.reduce((sum, row) => sum + row.count, 0);

  if (dryRun && !apply) {
    return {
      mode: "dry-run",
      requestId,
      projectRef,
      inventory,
      inventoryHash,
      totalRows,
      deleted: false,
    };
  }

  if (!apply) {
    throw new Error("apply_flag_required");
  }

  for (const entry of DEMO_CLEANUP_TABLES) {
    const { error } = await admin.from(entry.table).delete().eq(entry.column, DEMO_TENANT_UUID);
    if (error) {
      throw new Error(`delete_failed:${entry.table}:${error.message}`);
    }
  }

  const postInventory = await buildDemoInventory(admin);
  const postTotalRows = postInventory.reduce((sum, row) => sum + row.count, 0);
  if (postTotalRows !== 0) {
    throw new Error("cleanup_incomplete");
  }

  return {
    mode: "apply",
    requestId,
    projectRef,
    inventory,
    inventoryHash,
    totalRows,
    deleted: true,
    postInventory,
    postTotalRows,
  };
}

function logCleanupResult(result) {
  const lines = [
    `requestId=${result.requestId}`,
    `mode=${result.mode}`,
    `projectRef=${result.projectRef}`,
    `inventoryHash=${result.inventoryHash}`,
    `totalRows=${result.totalRows}`,
  ];
  for (const row of result.inventory) {
    if (row.count > 0) {
      lines.push(`table=${row.table} count=${row.count}`);
    }
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    const result = await runDemoCleanup();
    logCleanupResult(result);
  } catch (error) {
    process.stderr.write(`FAIL hosted-sandbox demo cleanup: ${error.message}\n`);
    process.exit(1);
  }
}
