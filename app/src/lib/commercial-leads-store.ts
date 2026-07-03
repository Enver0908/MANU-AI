import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "./supabase";
import {
  type CommercialLeadListItem,
  type CommercialLeadStatus,
  sanitizeCommercialLeadForAdmin,
} from "./phase-84c-contact-leads";

export type CommercialLeadRow = {
  id: string;
  contact_name: string;
  normalized_email: string;
  clinic_name: string;
  message: string;
  source_path: string;
  status: CommercialLeadStatus;
  created_at: string;
  updated_at: string;
};

function mapLeadRow(row: CommercialLeadRow): CommercialLeadListItem {
  return sanitizeCommercialLeadForAdmin({
    id: row.id,
    contactName: row.contact_name,
    normalizedEmail: row.normalized_email,
    clinicName: row.clinic_name,
    message: row.message,
    sourcePath: row.source_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function isCommercialLeadsStoreConfigured() {
  return getSupabaseAdminClient() !== null;
}

export async function insertCommercialLead(
  admin: SupabaseClient,
  input: {
    contactName: string;
    normalizedEmail: string;
    clinicName: string;
    message: string;
    sourcePath: string;
    now?: string;
  },
) {
  const now = input.now ?? new Date().toISOString();
  const { data, error } = await admin
    .from("commercial_leads")
    .insert({
      contact_name: input.contactName,
      normalized_email: input.normalizedEmail,
      clinic_name: input.clinicName,
      message: input.message,
      source_path: input.sourcePath,
      status: "new",
      created_at: now,
      updated_at: now,
    })
    .select("id, contact_name, normalized_email, clinic_name, message, source_path, status, created_at, updated_at")
    .single();

  if (error || !data) {
    throw error ?? new Error("commercial_lead_insert_failed");
  }

  return mapLeadRow(data as CommercialLeadRow);
}

export async function listCommercialLeads(
  admin: SupabaseClient,
  input?: { limit?: number; status?: CommercialLeadStatus | null },
) {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 100);
  let query = admin
    .from("commercial_leads")
    .select("id, contact_name, normalized_email, clinic_name, message, source_path, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as CommercialLeadRow[]).map(mapLeadRow);
}

export async function updateCommercialLeadStatus(
  admin: SupabaseClient,
  input: { leadId: string; status: CommercialLeadStatus; now?: string },
) {
  const now = input.now ?? new Date().toISOString();
  const { data, error } = await admin
    .from("commercial_leads")
    .update({
      status: input.status,
      updated_at: now,
    })
    .eq("id", input.leadId)
    .select("id, contact_name, normalized_email, clinic_name, message, source_path, status, created_at, updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("lead_not_found");
  }

  return mapLeadRow(data as CommercialLeadRow);
}
