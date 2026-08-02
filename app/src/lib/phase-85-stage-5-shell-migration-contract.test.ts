import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802090000_phase_85_stage_5_shell_foundation.sql",
);

describe("phase-85-stage-5-shell migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("creates session activity and shell preference tables with RLS and no direct grants", () => {
    expect(sql).toContain("create table app_session_activity");
    expect(sql).toContain("create table app_user_shell_preferences");
    expect(sql).toContain("alter table app_session_activity enable row level security");
    expect(sql).toContain("alter table app_user_shell_preferences enable row level security");
    expect(sql).toContain("revoke all on table app_session_activity from public, anon, authenticated");
    expect(sql).toContain("revoke all on table app_user_shell_preferences from public, anon, authenticated");
  });

  it("defines assert, touch, and preferences RPCs", () => {
    expect(sql).toContain("p85_stage_5_assert_session_activity_v1");
    expect(sql).toContain("p85_stage_5_touch_session_activity_v1");
    expect(sql).toContain("p85_stage_5_update_shell_preferences_v1");
    expect(sql).toContain("interval '15 minutes'");
    expect(sql).toContain("interval '1 minute'");
  });

  it("extends account security audit for session lifecycle events", () => {
    expect(sql).toContain("'session_locked'");
    expect(sql).toContain("'session_started'");
  });
});
