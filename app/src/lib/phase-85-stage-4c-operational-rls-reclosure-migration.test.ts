import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(__dirname, "../../supabase/migrations");
const migrationName = "20260725163000_phase_85_stage_4c_operational_tables_rls_reclosure.sql";
const migrationSource = readFileSync(resolve(migrationsDir, migrationName), "utf8");
const operationalTables = [
  "ai_chat_jobs",
  "ai_chat_deletion_jobs",
  "ai_chat_deletion_ledger",
  "ai_chat_legal_holds",
] as const;

describe("Stage 4C operational-table RLS reclosure migration", () => {
  it("runs after the scale EXPLAIN reclosure migration", () => {
    const migrationNames = readdirSync(migrationsDir).filter((name) => name.endsWith(".sql")).sort();

    expect(migrationNames.indexOf(migrationName)).toBeGreaterThan(
      migrationNames.indexOf("20260725162000_phase_85_stage_4c_remediation_scale_explain_reclosure.sql"),
    );
  });

  it("makes all four operational tables service-role-only with explicit deny policies", () => {
    for (const table of operationalTables) {
      expect(migrationSource).toContain(
        `revoke all on table public.${table} from public, anon, authenticated;`,
      );
      expect(migrationSource).toContain(`grant all on table public.${table} to service_role;`);
      expect(migrationSource).toContain(`alter table public.${table} enable row level security;`);
    }

    expect(migrationSource.match(/for all\s+using \(false\)\s+with check \(false\)/g)).toHaveLength(4);
    expect(migrationSource).not.toMatch(/grant\s+\w+.*\bto\s+(anon|authenticated)\b/i);
    expect(migrationSource).not.toContain("force row level security");
  });
});
