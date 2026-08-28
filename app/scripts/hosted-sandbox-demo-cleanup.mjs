import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { readBackupManifest } from "./lib/hosted-sandbox-backup-manifest.mjs";

export const DEMO_TENANT_UUID = "00000000-0000-4000-8000-000000000001";
export const DEMO_EMAIL = "demo@manu.local";
export const DEFAULT_CLEANUP_INVENTORY_PATH = fileURLToPath(
  new URL("./hosted-sandbox-demo-cleanup-inventory.json", import.meta.url),
);

export const CLEANUP_INVENTORY_MANIFEST = readCleanupInventoryManifest();
export const DEMO_CLEANUP_TABLES = CLEANUP_INVENTORY_MANIFEST.tables;

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

export function readCleanupInventoryManifest(manifestPath = DEFAULT_CLEANUP_INVENTORY_PATH) {
  const raw = readFileSync(manifestPath, "utf8");
  return validateCleanupInventoryManifest(JSON.parse(raw));
}

export function validateCleanupInventoryManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("cleanup_inventory_manifest_invalid");
  }
  if (manifest.schemaVersion !== 1) {
    throw new Error("cleanup_inventory_manifest_schema_unsupported");
  }
  if (manifest.tenantId !== DEMO_TENANT_UUID) {
    throw new Error("cleanup_inventory_manifest_tenant_mismatch");
  }
  if (!Array.isArray(manifest.tables) || manifest.tables.length === 0) {
    throw new Error("cleanup_inventory_manifest_tables_missing");
  }

  const seen = new Set();
  const tables = manifest.tables.map((entry) => {
    const table = typeof entry?.table === "string" ? entry.table.trim() : "";
    const column = typeof entry?.column === "string" ? entry.column.trim() : "";
    if (!/^[a-z][a-z0-9_]*$/.test(table) || !/^[a-z][a-z0-9_]*$/.test(column)) {
      throw new Error("cleanup_inventory_manifest_identifier_invalid");
    }
    const key = `${table}.${column}`;
    if (seen.has(key)) {
      throw new Error("cleanup_inventory_manifest_duplicate");
    }
    seen.add(key);
    return { table, column };
  });

  if (!tables.some((entry) => entry.table === "tenant_entitlements" && entry.column === "tenant_id")) {
    throw new Error("cleanup_inventory_manifest_entitlements_missing");
  }
  const last = tables.at(-1);
  if (last?.table !== "tenants" || last?.column !== "id") {
    throw new Error("cleanup_inventory_manifest_tenants_must_be_last");
  }

  return { schemaVersion: 1, tenantId: DEMO_TENANT_UUID, tables };
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

export function normalizeCleanupRpcResult(data) {
  if (!data || typeof data !== "object") {
    throw new Error("cleanup_rpc_result_invalid");
  }
  const inventory = Array.isArray(data.inventory) ? data.inventory : [];
  const totalRows = Number(data.totalRows ?? 0);
  if (!Number.isFinite(totalRows) || totalRows < 0) {
    throw new Error("cleanup_rpc_total_invalid");
  }
  return {
    mode: data.mode === "apply" ? "apply" : "dry-run",
    tenantId: typeof data.tenantId === "string" ? data.tenantId : DEMO_TENANT_UUID,
    inventory,
    totalRows,
    deleted: data.deleted === true,
    postInventory: Array.isArray(data.postInventory) ? data.postInventory : undefined,
    postTotalRows: data.postTotalRows === undefined ? undefined : Number(data.postTotalRows),
  };
}

export async function callCleanupRpc(admin, { apply, cleanupInventory }) {
  const { data, error } = await admin.rpc("cleanup_hosted_sandbox_demo_tenant", {
    p_tenant_id: DEMO_TENANT_UUID,
    p_expected_inventory: cleanupInventory,
    p_apply: apply,
  });
  if (error) {
    throw new Error(`cleanup_rpc_failed:${error.message}`);
  }
  return normalizeCleanupRpcResult(data);
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

export async function findDemoAuthUsers(admin, tenantId = DEMO_TENANT_UUID) {
  const memberships = await admin.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId);
  if (memberships.error) {
    throw new Error(`membership_audit_failed:${memberships.error.message}`);
  }

  const users = [];
  for (const membership of memberships.data ?? []) {
    const user = await admin.auth.admin.getUserById(membership.user_id);
    if (user.error) {
      throw new Error(`auth_user_lookup_failed:${membership.user_id}`);
    }
    if (user.data.user?.email === DEMO_EMAIL) {
      users.push({ id: membership.user_id, email: DEMO_EMAIL });
    }
  }
  return users;
}

export async function findDemoStorageObjects(admin, tenantId = DEMO_TENANT_UUID) {
  const storage = admin.schema("storage");
  const { data, error } = await storage
    .from("objects")
    .select("bucket_id,name")
    .ilike("name", `%${tenantId}%`);
  if (error) {
    if (/schema|relation|permission/i.test(error.message)) {
      return [];
    }
    throw new Error(`storage_inventory_failed:${error.message}`);
  }
  return (data ?? []).map((row) => ({ bucketId: row.bucket_id, name: row.name }));
}

export async function deleteDemoStorageObjects(admin, objects) {
  const byBucket = new Map();
  for (const object of objects) {
    if (!byBucket.has(object.bucketId)) byBucket.set(object.bucketId, []);
    byBucket.get(object.bucketId).push(object.name);
  }
  for (const [bucketId, names] of byBucket) {
    const { error } = await admin.storage.from(bucketId).remove(names);
    if (error) {
      throw new Error(`storage_delete_failed:${bucketId}:${error.message}`);
    }
  }
}

export async function deleteDemoAuthUsers(admin, users) {
  for (const user of users) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw new Error(`auth_user_delete_failed:${user.id}`);
    }
  }
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
  const { dryRun, apply } = parseCleanupArgs(options.argv ?? process.argv.slice(2));
  const requestId = options.requestId ?? randomUUID();
  const { url, serviceRoleKey, projectRef } = validateCleanupEnvironment(env);
  const cleanupManifest = readCleanupInventoryManifest(env.MANU_HOSTED_SANDBOX_CLEANUP_INVENTORY ?? DEFAULT_CLEANUP_INVENTORY_PATH);

  if (apply) {
    const manifestPath = env.MANU_HOSTED_SANDBOX_BACKUP_MANIFEST;
    if (!manifestPath) {
      throw new Error("backup_manifest_missing");
    }
    readBackupManifest(path.resolve(manifestPath), { expectedProjectRef: projectRef });
  }

  const admin =
    options.admin ??
    createClient(url, serviceRoleKey, {
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
  const demoAuthUsers = await findDemoAuthUsers(admin);
  const demoStorageObjects = await findDemoStorageObjects(admin);

  const cleanupResult = await callCleanupRpc(admin, {
    apply,
    cleanupInventory: cleanupManifest.tables,
  });
  const inventory = cleanupResult.inventory;
  const inventoryHash = hashInventory(inventory);
  const totalRows = cleanupResult.totalRows;

  if (dryRun && !apply) {
    return {
      mode: "dry-run",
      requestId,
      projectRef,
      inventory,
      inventoryHash,
      totalRows,
      demoAuthUserCount: demoAuthUsers.length,
      demoStorageObjectCount: demoStorageObjects.length,
      deleted: false,
    };
  }

  if (!apply) {
    throw new Error("apply_flag_required");
  }

  const postInventory = cleanupResult.postInventory ?? [];
  const postTotalRows = cleanupResult.postTotalRows ?? 0;
  if (postTotalRows !== 0) {
    throw new Error("cleanup_incomplete");
  }
  await deleteDemoStorageObjects(admin, demoStorageObjects);
  await deleteDemoAuthUsers(admin, demoAuthUsers);

  return {
    mode: "apply",
    requestId,
    projectRef,
    inventory,
    inventoryHash,
    totalRows,
    demoAuthUserCount: demoAuthUsers.length,
    demoStorageObjectCount: demoStorageObjects.length,
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
    `demoAuthUserCount=${result.demoAuthUserCount ?? 0}`,
    `demoStorageObjectCount=${result.demoStorageObjectCount ?? 0}`,
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
