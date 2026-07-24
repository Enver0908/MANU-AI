import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSource = readFileSync(
  resolve(__dirname, "../../supabase/migrations/20260725110000_phase_85_stage_4c_remediation_multimodal_runtime.sql"),
  "utf8",
);

describe("Stage 4C multimodal runtime migration", () => {
  it("creates message-attachment join table with composite foreign keys", () => {
    expect(migrationSource).toContain("create table if not exists ai_chat_message_attachments");
    expect(migrationSource).toContain("ai_chat_message_attachments_version_conversation_fk");
    expect(migrationSource).toContain("ai_chat_message_attachments_attachment_conversation_fk");
  });

  it("defines attachment upload and lifecycle RPCs", () => {
    expect(migrationSource).toContain("p85_stage_4c_create_attachment_upload_session_v1");
    expect(migrationSource).toContain("p85_stage_4c_complete_attachment_upload_v1");
    expect(migrationSource).toContain("p85_stage_4c_list_message_attachment_derivatives_v1");
    expect(migrationSource).toContain("p85_stage_4c_transfer_attachment_to_client_record_v1");
  });

  it("extends send_message with attachment ids and no base64 path", () => {
    expect(migrationSource).toContain("p_attachment_ids uuid[]");
    expect(migrationSource).toContain("create or replace function p85_stage_4c_send_message_v1");
  });

  it("uses tenant/user/conversation/attachment object key layout", () => {
    expect(migrationSource).toContain("p85_stage_4c_build_attachment_object_key");
    expect(migrationSource).toContain("p_user_id::text");
  });
});
