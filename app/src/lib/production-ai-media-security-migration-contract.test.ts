import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260830200000_production_readiness_stage_1_phase_4_ai_media_security.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

const zaiRebaselineMigrationSource = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/20260831090000_zai_glm_provider_rebaseline.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("production AI and media security migration contract", () => {
  it("adds a service-role-only AI provider egress audit ledger without raw prompts", () => {
    expect(migrationSource).toContain("create table if not exists ai_provider_egress_audit");
    expect(migrationSource).toContain("request_digest text not null");
    expect(migrationSource).toContain("response_digest text");
    expect(migrationSource).toContain("payload_schema_version text not null");
    expect(migrationSource).toContain("token_count_method in ('provider_native')");
    expect(migrationSource).toContain("alter table ai_provider_egress_audit enable row level security");
    expect(migrationSource).toContain("revoke all on table ai_provider_egress_audit from public, anon, authenticated");
    expect(migrationSource).toContain("grant select, insert on table ai_provider_egress_audit to service_role");
    expect(migrationSource).not.toContain("raw_prompt");
  });

  it("requires malware scan pass before an attachment becomes provider-egress eligible", () => {
    expect(migrationSource).toContain("add column if not exists malware_scan_status");
    expect(migrationSource).toContain("add column if not exists provider_egress_eligible");
    expect(migrationSource).toContain("provider_egress_eligible = false or malware_scan_status = 'passed'");
  });

  it("rebaselines the active LLM provider to Z.ai while preserving historical Gemini audit readability", () => {
    expect(zaiRebaselineMigrationSource).toContain("provider in ('zai', 'gemini', 'vision', 'ocr', 'transcription')");
    expect(zaiRebaselineMigrationSource).toContain("new application code writes provider = 'zai'");
    expect(zaiRebaselineMigrationSource).toContain("does not enable real AI provider egress");
  });
});
