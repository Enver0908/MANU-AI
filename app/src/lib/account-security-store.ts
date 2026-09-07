import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import {
  type AccountSecurityEventType,
  type AccountSecurityOutcome,
  minimizeAccountSecurityMetadata,
} from "./phase-85-stage-4d-account-security";

export type AccountSecurityAuditInput = {
  tenantId?: string | null;
  authUserId: string;
  dietitianId?: string | null;
  eventType: AccountSecurityEventType;
  outcome: AccountSecurityOutcome;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export async function insertAccountSecurityEvent(
  input: AccountSecurityAuditInput,
  adminClient?: SupabaseClient | null,
) {
  const admin = adminClient ?? getSupabaseAdminClient();
  if (!admin) {
    return { persisted: false, error: "supabase_not_configured" as const };
  }

  const { error } = await admin.from("account_security_events").insert({
    tenant_id: input.tenantId ?? null,
    auth_user_id: input.authUserId,
    dietitian_id: input.dietitianId ?? null,
    event_type: input.eventType,
    outcome: input.outcome,
    idempotency_key: input.idempotencyKey,
    metadata: minimizeAccountSecurityMetadata(input.metadata),
  });

  if (error) {
    return { persisted: false, error: error.message };
  }

  return { persisted: true };
}
