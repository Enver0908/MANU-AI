import assert from "node:assert/strict";
import test from "node:test";
import { compareObjectNames, extractCatalogFromDump, extractMigrationObjects, parseMigrationListOutput } from "./phase-2-contract.mjs";

test("phase 2 parses aligned and divergent migration rows without accepting silent drift", () => {
  const aligned = parseMigrationListOutput("  20260904181000 | 20260904181000 | 2026-09-04 18:10:00");
  assert.deepEqual(aligned, [{ local: "20260904181000", remote: "20260904181000" }]);
  const divergent = parseMigrationListOutput("  20260904181000 |                  | 2026-09-04 18:10:00\n  20260904182000 | 20260904182100 | 2026-09-04 18:20:00");
  assert.deepEqual(divergent, [
    { local: "20260904181000", remote: null },
    { local: "20260904182000", remote: "20260904182100" },
  ]);
});

test("phase 2 catalog extraction records functions, tables, indexes, RLS and grants", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aiya-phase-2-"));
  fs.writeFileSync(path.join(temp, "20260904181000_probe.sql"), [
    "create table if not exists public.probe_table (id uuid primary key);",
    "create unique index if not exists probe_table_id_idx on public.probe_table (id);",
    "alter table public.probe_table enable row level security;",
    "create policy probe_policy on public.probe_table using (true);",
    "create or replace function public.probe_rpc(p_id uuid, p_now timestamptz default now(), p_limit int default 2) returns jsonb language sql as $$ select '{}'::jsonb $$;",
    "grant execute on function public.probe_rpc(uuid) to service_role;",
  ].join("\n"));
  const manifest = extractMigrationObjects(temp);
  assert.deepEqual(manifest.objects.tables, ["probe_table"]);
  assert.deepEqual(manifest.objects.functions, ["probe_rpc(uuid, timestamptz, integer)"]);
  assert.deepEqual(manifest.objects.indexes, ["probe_table_id_idx"]);
  assert.deepEqual(manifest.objects.policies, ["probe_policy"]);
  assert.deepEqual(manifest.objects.rlsTables, ["probe_table"]);
  fs.rmSync(temp, { recursive: true, force: true });
});

test("phase 2 catalog comparison exposes missing objects", () => {
  assert.deepEqual(compareObjectNames(["a", "b"], ["a", "c"]), { missing: ["b"], extra: ["c"] });
  const catalog = extractCatalogFromDump('CREATE TYPE "public"."probe_type" AS ENUM (\'x\'); CREATE TABLE IF NOT EXISTS "public"."a" (id uuid); CREATE FUNCTION "public"."f"("p_id" "uuid") RETURNS jsonb LANGUAGE sql AS $$ select \'{}\'::jsonb $$;');
  assert.deepEqual(catalog.types, ["probe_type"]);
  assert.deepEqual(catalog.tables, ["a"]);
  assert.deepEqual(catalog.functions, ["f(uuid)"]);
});
