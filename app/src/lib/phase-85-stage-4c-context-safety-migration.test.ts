import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AI_CHAT_CONTEXT_TOOLS } from "./phase-85-stage-4c-contracts";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260725100000_phase_85_stage_4c_remediation_context_safety.sql"),
  "utf8",
);

describe("Stage 4C context safety migration", () => {
  it("defines explicit branches for every allowlisted context tool", () => {
    for (const tool of AI_CHAT_CONTEXT_TOOLS) {
      expect(migrationSource).toContain(`'${tool}'`);
    }
  });

  it("does not use catch-all empty rows for unhandled tools", () => {
    expect(migrationSource).not.toMatch(/else\s+v_rows\s*:=\s*'\[\]'::jsonb/i);
    expect(migrationSource).toContain("context_tool_branch_missing");
  });

  it("returns structured ok/empty/failed envelopes", () => {
    expect(migrationSource).toContain("p85_stage_4c_wrap_context_tool_result");
    expect(migrationSource).toContain("'status'");
    expect(migrationSource).toContain("'category_critical'");
  });
});
