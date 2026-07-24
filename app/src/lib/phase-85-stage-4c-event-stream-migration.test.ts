import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260725140000_phase_85_stage_4c_remediation_event_stream.sql"),
  "utf8",
);

describe("Stage 4C event stream migration", () => {
  it("publishes ai_chat_run_events to realtime and defines catch-up RPC", () => {
    expect(migrationSource).toContain("supabase_realtime");
    expect(migrationSource).toContain("ai_chat_run_events");
    expect(migrationSource).toContain("p85_stage_4c_catch_up_run_events_v1");
  });

  it("enforces service-role-only execution", () => {
    expect(migrationSource).toContain("service_role_required");
    expect(migrationSource).toContain("revoke all on function p85_stage_4c_catch_up_run_events_v1");
    expect(migrationSource).toContain("grant execute on function p85_stage_4c_catch_up_run_events_v1");
  });
});
