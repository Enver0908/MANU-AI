import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isLocalDemoFixtureEnabled,
  isLocalDemoLoginAllowed,
  isLocalhostHostname,
  resolveRequestHostname,
} from "./demo-fixture-access";
import {
  callCleanupRpc,
  CLEANUP_INVENTORY_MANIFEST,
  DEMO_CLEANUP_TABLES,
  DEMO_TENANT_UUID,
  extractProjectRef,
  hashInventory,
  isLocalSupabaseUrl,
  parseCleanupArgs,
  validateBackupManifest,
  validateCleanupInventoryManifest,
} from "../../scripts/hosted-sandbox-demo-cleanup.mjs";

const storeSource = readFileSync(fileURLToPath(new URL("./supabase-store.ts", import.meta.url)), "utf8");

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) {
    return "";
  }
  const openBrace = source.indexOf("{", start);
  if (openBrace < 0) {
    return "";
  }

  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  return "";
}

describe("hosted sandbox tenant isolation", () => {
  it("allows local demo fixture only in development with explicit flag", () => {
    expect(isLocalDemoFixtureEnabled({ NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" })).toBe(true);
    expect(isLocalDemoFixtureEnabled({ NODE_ENV: "production", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" })).toBe(false);
    expect(isLocalDemoFixtureEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("allows demo login only on localhost in development", () => {
    expect(
      isLocalDemoLoginAllowed(
        { NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" },
        "localhost",
      ),
    ).toBe(true);
    expect(
      isLocalDemoLoginAllowed(
        { NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" },
        "sandbox.manu.ai",
      ),
    ).toBe(false);
    expect(
      isLocalDemoLoginAllowed(
        { NODE_ENV: "production", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" },
        "localhost",
      ),
    ).toBe(false);
  });

  it("recognizes localhost hostnames and ignores untrusted forwarded hosts", () => {
    expect(isLocalhostHostname("127.0.0.1")).toBe(true);
    expect(isLocalhostHostname("sandbox.manu.ai")).toBe(false);
    expect(resolveRequestHostname(new Headers({ host: "localhost:3000" }))).toBe("localhost");
    expect(resolveRequestHostname(new Headers({ "x-forwarded-host": "127.0.0.1:3000" }))).toBe("");
    expect(
      resolveRequestHostname(
        new Headers({
          host: "sandbox.manu.ai",
          "x-forwarded-host": "localhost",
        }),
      ),
    ).toBe("sandbox.manu.ai");
  });

  it("keeps hosted Supabase read paths off ensureDemoData", () => {
    const guardedFunctions = [
      "export async function loadSupabaseState",
      "export async function loadSupabaseWindowedDashboardPayload",
      "async function loadSupabaseClientOperationState",
      "async function loadSupabaseHandoffOperationState",
      "async function loadSupabaseDraftOperationState",
      "async function loadSupabaseClientCreateContext",
    ];

    for (const signature of guardedFunctions) {
      const body = functionBody(storeSource, signature);
      expect(body.length).toBeGreaterThan(0);
      expect(body).not.toContain("ensureDemoData(");
    }
  });

  it("limits ensureDemoData to local demo reset and explicit demo seed helpers", () => {
    const ensureDemoDataCalls = [...storeSource.matchAll(/ensureDemoData\(/g)].map((match) => match.index ?? 0);
    const allowedContexts = [
      functionBody(storeSource, "export async function resetSupabaseState"),
      functionBody(storeSource, "export async function ensureSupabaseDemoDataForUser"),
      functionBody(storeSource, "async function ensureDemoData"),
    ];

    for (const index of ensureDemoDataCalls) {
      const allowed = allowedContexts.some((context) => {
        const contextStart = storeSource.indexOf(context.slice(0, 40));
        const contextEnd = contextStart + context.length;
        return contextStart >= 0 && index >= contextStart && index <= contextEnd;
      });
      expect(allowed).toBe(true);
    }
  });

  it("parses cleanup dry-run and apply flags fail-closed by default", () => {
    expect(parseCleanupArgs(["--dry-run"])).toEqual({ dryRun: true, apply: false });
    expect(parseCleanupArgs(["--apply"])).toEqual({ dryRun: false, apply: true });
    expect(parseCleanupArgs([])).toEqual({ dryRun: true, apply: false });
  });

  it("extracts project refs and classifies local Supabase URLs", () => {
    expect(extractProjectRef("https://abcdef.supabase.co")).toBe("abcdef");
    expect(extractProjectRef("http://127.0.0.1:54321")).toBeNull();
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://abcdef.supabase.co")).toBe(false);
  });

  it("hashes inventory summaries deterministically", () => {
    const inventory = [{ table: "clients", count: 2 }, { table: "tenants", count: 1 }];
    const first = hashInventory(inventory);
    const second = hashInventory(inventory);
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
  });

  it("defines the fixed demo tenant inventory tables", () => {
    expect(DEMO_TENANT_UUID).toBe("00000000-0000-4000-8000-000000000001");
    expect(CLEANUP_INVENTORY_MANIFEST.schemaVersion).toBe(1);
    expect(CLEANUP_INVENTORY_MANIFEST.tenantId).toBe(DEMO_TENANT_UUID);
    expect(DEMO_CLEANUP_TABLES.some((entry) => entry.table === "ai_chat_messages")).toBe(true);
    expect(DEMO_CLEANUP_TABLES.some((entry) => entry.table === "media_assets")).toBe(true);
    expect(DEMO_CLEANUP_TABLES.some((entry) => entry.table === "billing_customers")).toBe(true);
    expect(DEMO_CLEANUP_TABLES.some((entry) => entry.table === "tenant_entitlements")).toBe(true);
    expect(DEMO_CLEANUP_TABLES.at(-1)).toEqual({ table: "tenants", column: "id" });
  });

  it("rejects incomplete or unsafe cleanup inventory manifests", () => {
    expect(() => validateCleanupInventoryManifest({ schemaVersion: 1, tenantId: DEMO_TENANT_UUID, tables: [] })).toThrow(
      "cleanup_inventory_manifest_tables_missing",
    );
    expect(() =>
      validateCleanupInventoryManifest({
        schemaVersion: 1,
        tenantId: DEMO_TENANT_UUID,
        tables: [
          { table: "tenant_entitlements", column: "tenant_id" },
          { table: "unsafe-name", column: "tenant_id" },
          { table: "tenants", column: "id" },
        ],
      }),
    ).toThrow("cleanup_inventory_manifest_identifier_invalid");
    expect(() =>
      validateCleanupInventoryManifest({
        schemaVersion: 1,
        tenantId: DEMO_TENANT_UUID,
        tables: [{ table: "tenant_entitlements", column: "tenant_id" }],
      }),
    ).toThrow("cleanup_inventory_manifest_tenants_must_be_last");
  });

  it("delegates cleanup apply to the transactional database RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const admin = {
      async rpc(name: string, args: Record<string, unknown>) {
        calls.push({ name, args });
        return {
          data: {
            mode: "apply",
            tenantId: DEMO_TENANT_UUID,
            inventory: [{ table: "tenants", column: "id", count: 1 }],
            totalRows: 1,
            deleted: true,
            postInventory: [{ table: "tenants", column: "id", count: 0 }],
            postTotalRows: 0,
          },
          error: null,
        };
      },
    };

    const result = await callCleanupRpc(admin, {
      apply: true,
      cleanupInventory: CLEANUP_INVENTORY_MANIFEST.tables,
    });

    expect(result.mode).toBe("apply");
    expect(result.postTotalRows).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.name).toBe("cleanup_hosted_sandbox_demo_tenant");
    expect(calls[0]?.args).toMatchObject({
      p_tenant_id: DEMO_TENANT_UUID,
      p_apply: true,
    });
    expect(calls[0]?.args.p_expected_inventory).toEqual(CLEANUP_INVENTORY_MANIFEST.tables);
  });

  it("requires backup manifest fields before apply", () => {
    expect(() => validateBackupManifest({ projectRef: "local-dev" })).toThrow("backup_manifest_incomplete");
    expect(validateBackupManifest({
      projectRef: "local-dev",
      backupSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toEqual({
      projectRef: "local-dev",
      backupSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });
});
