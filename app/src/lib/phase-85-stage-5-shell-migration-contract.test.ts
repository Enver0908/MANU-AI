import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHELL_SESSION_INACTIVITY_MS,
  SHELL_SESSION_INACTIVITY_SQL_INTERVAL,
} from "./phase-85-stage-5-shell-session";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260802090000_phase_85_stage_5_shell_foundation.sql",
);
const remediationMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260803090000_phase_85_stage_5_foundation_remediation.sql",
);

describe("phase-85-stage-5-shell migration contract", () => {
  const sql = readFileSync(migrationPath, "utf8");
  const remediationSql = readFileSync(remediationMigrationPath, "utf8");

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

  it("adds v2 session recording without exception rollback and revokes v1 authenticated execution", () => {
    expect(remediationSql).toContain("p85_stage_5_record_session_activity_v2");
    expect(remediationSql).toContain("'status', 'locked'");
    expect(remediationSql).toContain("return jsonb_build_object");
    expect(remediationSql).toContain("revoke all on function p85_stage_5_assert_session_activity_v1() from public, anon, authenticated");
    expect(remediationSql).toContain("revoke all on function p85_stage_5_touch_session_activity_v1() from public, anon, authenticated");
    expect(remediationSql).toContain("grant execute on function p85_stage_5_record_session_activity_v2(text) to authenticated, service_role");
  });

  it("adds bounded preference clear semantics and shell search indexes", () => {
    expect(remediationSql).toContain("p85_stage_5_update_shell_preferences_v2");
    expect(remediationSql).toContain("p_clear_last_destination boolean default false");
    expect(remediationSql).toContain("jsonb_typeof(v_destination_state) <> 'object' or v_destination_state <> '{}'::jsonb");
    expect(remediationSql).toContain("clients_stage5_shell_full_name_trgm_idx");
    expect(remediationSql).toContain("conversations_stage5_shell_tenant_client_created_idx");
    expect(remediationSql).toContain("messages_stage5_shell_unread_idx");
  });
});

describe("public surface two-hour session idle migration contract", () => {
  const phase2Sql = readFileSync(
    join(process.cwd(), "supabase/migrations/20260903090000_public_surface_session_idle_timeout.sql"),
    "utf8",
  );

  it("uses the same two-hour value as the TypeScript session contract", () => {
    expect(SHELL_SESSION_INACTIVITY_MS).toBe(7_200_000);
    expect(phase2Sql).toContain(SHELL_SESSION_INACTIVITY_SQL_INTERVAL);
    expect(phase2Sql).toContain("p85_stage_5_session_inactivity_window");
    expect(phase2Sql).toContain("p85_stage_5_record_session_activity_v2");
    expect(phase2Sql).toContain("p85_stage_5_assert_session_activity_v1");
    expect(phase2Sql).toContain("p85_stage_5_touch_session_activity_v1");
    expect(phase2Sql).toContain("p85_stage_5_load_shell_bootstrap_v1");
    expect(phase2Sql).not.toContain("interval '15 minutes'");
    expect(phase2Sql).toContain("interval '1 minute'");
    expect(phase2Sql).toContain(
      "revoke all on function p85_stage_5_session_inactivity_window() from public, anon, authenticated",
    );
    expect(phase2Sql).toContain(
      "grant execute on function p85_stage_5_record_session_activity_v2(text) to authenticated, service_role",
    );
  });
});
