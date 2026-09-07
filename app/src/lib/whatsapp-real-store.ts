import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import { buildWhatsAppRealEventAdmission, hasWhatsAppAccountSelector, WHATSAPP_REAL_CONTRACT_VERSION } from "./whatsapp-real-contracts";
import { encryptWhatsAppServerPayload } from "./whatsapp-real-crypto";
import type { RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";

export type WhatsAppRealIngressEnqueueResult =
  | { ok: true; accepted: true; queued: number; ignored: number; duplicates: number; quarantined: number }
  | { ok: false; status: 400 | 503; code: "malformed_payload" | "storage_unavailable" | "payload_encryption_unavailable"; reason?: string };

type WhatsAppBindingRow = {
  id: string;
  tenant_id: string;
};

export async function enqueueWhatsAppRealIngress(input: {
  rawBody: string;
  payload: unknown;
  now?: string;
}): Promise<WhatsAppRealIngressEnqueueResult> {
  const admission = buildWhatsAppRealEventAdmission(input.payload);
  if (!admission.ok) {
    return { ok: false, status: 400, code: "malformed_payload", reason: admission.reason };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, status: 503, code: "storage_unavailable" };
  }

  let queued = 0;
  let ignored = 0;
  let duplicates = 0;
  let quarantined = 0;

  for (const candidate of admission.candidates) {
    if (!hasWhatsAppAccountSelector(candidate)) {
      ignored += 1;
      continue;
    }

    const binding = await resolveRealWhatsAppBinding(supabase, candidate);
    if (!binding) {
      ignored += 1;
      continue;
    }

    const aad = `${binding.tenant_id}:${binding.id}:${candidate.providerEventId ?? "no-event-id"}:${candidate.payloadDigest}`;
    const encrypted = encryptWhatsAppServerPayload({
      plaintext: JSON.stringify(candidate),
      aad,
      masterKeyBase64: process.env.MANU_WHATSAPP_INGRESS_MASTER_KEY_BASE64,
      keyVersion: process.env.MANU_WHATSAPP_INGRESS_KEY_VERSION,
    });
    if (!encrypted) {
      return { ok: false, status: 503, code: "payload_encryption_unavailable" };
    }

    const { data, error } = await supabase.rpc("enqueue_whatsapp_real_ingress_job", {
      p_account_binding_id: binding.id,
      p_tenant_id: binding.tenant_id,
      p_event_kind: candidate.eventKind,
      p_provider_account_id: candidate.providerAccountId,
      p_provider_event_id: candidate.providerEventId,
      p_provider_message_id: candidate.providerMessageId,
      p_from_identity: candidate.fromIdentity,
      p_to_identity: candidate.toIdentity,
      p_counterparty_identity: candidate.counterpartyIdentity,
      p_payload_digest: candidate.payloadDigest,
      p_payload_ciphertext: encrypted.ciphertext,
      p_payload_iv: encrypted.iv,
      p_payload_auth_tag: encrypted.authTag,
      p_payload_aad: aad,
      p_key_version: encrypted.keyVersion,
      p_payload_schema_version: WHATSAPP_REAL_CONTRACT_VERSION,
      p_provider_time: candidate.providerTime,
      p_observed_at: input.now ?? new Date().toISOString(),
    });

    if (error) {
      return { ok: false, status: 503, code: "storage_unavailable", reason: error.message };
    }

    const status = readRpcStatus(data);
    if (status === "queued") queued += 1;
    else if (status === "duplicate") duplicates += 1;
    else if (status === "quarantined") quarantined += 1;
    else ignored += 1;
  }

  return { ok: true, accepted: true, queued, ignored, duplicates, quarantined };
}

async function resolveRealWhatsAppBinding(
  supabase: SupabaseClient,
  candidate: RawChannelEventCandidate,
): Promise<WhatsAppBindingRow | null> {
  let query = supabase
    .from("channel_account_bindings")
    .select("id, tenant_id")
    .eq("provider", "whatsapp_cloud")
    .eq("operating_mode", "real")
    .eq("lifecycle_status", "active")
    .is("revoked_at", null)
    .limit(2);

  if (candidate.wabaId) query = query.eq("waba_id", candidate.wabaId);
  if (candidate.businessPhoneNumberId) query = query.eq("business_phone_number_id", candidate.businessPhoneNumberId);
  if (!candidate.wabaId && !candidate.businessPhoneNumberId && candidate.providerAccountId) {
    query = query.eq("provider_account_id", candidate.providerAccountId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length !== 1) {
    return null;
  }

  return data[0] as WhatsAppBindingRow;
}

function readRpcStatus(data: unknown): string {
  if (Array.isArray(data)) {
    return readRpcStatus(data[0]);
  }
  if (data && typeof data === "object" && "status" in data && typeof data.status === "string") {
    return data.status;
  }
  return "ignored";
}
