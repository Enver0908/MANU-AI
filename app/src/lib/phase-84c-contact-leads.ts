/**
 * Phase 84C lead/contact flow: validation, sanitization, and rate-limit config.
 * Storage and HTTP handlers live in commercial-leads-store and API routes.
 */

import {
  normalizeCommercialEmail,
  validateNormalizedCommercialEmail,
} from "./phase-83b-commercial-entitlement-model";

export const PHASE_84C_VERSION = "phase84c-contact-leads-v1";

export const COMMERCIAL_LEAD_STATUSES = ["new", "contacted", "closed"] as const;
export type CommercialLeadStatus = (typeof COMMERCIAL_LEAD_STATUSES)[number];

export const COMMERCIAL_LEAD_FIELD_LIMITS = {
  contactName: 120,
  clinicName: 200,
  message: 4_000,
  sourcePath: 200,
} as const;

export const CONTACT_LEAD_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000,
} as const;

export type CommercialLeadCreateInput = {
  contactName?: string;
  email?: string;
  clinicName?: string;
  message?: string;
  sourcePath?: string;
  /** Hidden honeypot; non-empty submissions are treated as spam. */
  companyWebsite?: string;
};

export type CommercialLeadCreateValidation = {
  valid: boolean;
  spam: boolean;
  blockingReasons: string[];
  normalizedEmail: string;
  contactName: string;
  clinicName: string;
  message: string;
  sourcePath: string;
};

export type CommercialLeadListItem = {
  id: string;
  contactName: string;
  normalizedEmail: string;
  clinicName: string;
  message: string;
  sourcePath: string;
  status: CommercialLeadStatus;
  createdAt: string;
  updatedAt: string;
};

function trimToLimit(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}

export function normalizeCommercialLeadSourcePath(sourcePath?: string) {
  const trimmed = (sourcePath ?? "/").trim();
  if (!trimmed) {
    return "/";
  }
  return trimmed.startsWith("/") ? trimmed.slice(0, COMMERCIAL_LEAD_FIELD_LIMITS.sourcePath) : "/";
}

export function validateCommercialLeadCreate(
  input: CommercialLeadCreateInput,
): CommercialLeadCreateValidation {
  const blockingReasons: string[] = [];
  const spam = Boolean(input.companyWebsite?.trim());

  const contactName = trimToLimit(input.contactName ?? "", COMMERCIAL_LEAD_FIELD_LIMITS.contactName);
  if (!contactName) {
    blockingReasons.push("contact_name_required");
  }

  const normalizedEmail = normalizeCommercialEmail(input.email ?? "");
  const emailValidation = validateNormalizedCommercialEmail(normalizedEmail);
  if (!emailValidation.valid) {
    blockingReasons.push("email_invalid");
  }

  const clinicName = trimToLimit(input.clinicName ?? "", COMMERCIAL_LEAD_FIELD_LIMITS.clinicName);
  const message = trimToLimit(input.message ?? "", COMMERCIAL_LEAD_FIELD_LIMITS.message);
  if (!message) {
    blockingReasons.push("message_required");
  }

  const sourcePath = normalizeCommercialLeadSourcePath(input.sourcePath);

  return {
    valid: blockingReasons.length === 0 && !spam,
    spam,
    blockingReasons,
    normalizedEmail,
    contactName,
    clinicName,
    message,
    sourcePath,
  };
}

export function validateCommercialLeadStatusUpdate(input: {
  leadId?: string;
  status?: string;
}) {
  const blockingReasons: string[] = [];
  const leadId = input.leadId?.trim() ?? "";
  if (!leadId) {
    blockingReasons.push("lead_id_required");
  }

  const status = input.status?.trim() as CommercialLeadStatus | undefined;
  if (!status || !COMMERCIAL_LEAD_STATUSES.includes(status)) {
    blockingReasons.push("lead_status_invalid");
  }

  return {
    valid: blockingReasons.length === 0,
    blockingReasons,
    leadId,
    status: status as CommercialLeadStatus,
  };
}

export function sanitizeCommercialLeadForAdmin(row: CommercialLeadListItem): CommercialLeadListItem {
  return {
    id: row.id,
    contactName: row.contactName,
    normalizedEmail: row.normalizedEmail,
    clinicName: row.clinicName,
    message: row.message,
    sourcePath: row.sourcePath,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function summarizePhase84cContactLeads() {
  return {
    phase84cVersion: PHASE_84C_VERSION,
    table: "commercial_leads",
    statuses: [...COMMERCIAL_LEAD_STATUSES],
    publicEndpoint: "/api/contact/leads",
    adminEndpoint: "/api/commercial/admin/leads",
    rateLimit: CONTACT_LEAD_RATE_LIMIT,
    productionPilotGo: false,
  };
}
