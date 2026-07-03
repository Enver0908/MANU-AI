import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_LEAD_FIELD_LIMITS,
  sanitizeCommercialLeadForAdmin,
  summarizePhase84cContactLeads,
  validateCommercialLeadCreate,
  validateCommercialLeadStatusUpdate,
} from "./phase-84c-contact-leads";

describe("phase 84c contact leads", () => {
  it("validates required lead fields and normalizes email", () => {
    const result = validateCommercialLeadCreate({
      contactName: "  Ayşe Yılmaz ",
      email: " Clinic@Example.COM ",
      clinicName: "Örnek Klinik",
      message: "Erişim talebi",
      sourcePath: "/#contact",
    });

    expect(result.valid).toBe(true);
    expect(result.normalizedEmail).toBe("clinic@example.com");
    expect(result.contactName).toBe("Ayşe Yılmaz");
    expect(result.sourcePath).toBe("/#contact");
  });

  it("rejects missing fields and honeypot spam submissions", () => {
    expect(
      validateCommercialLeadCreate({
        email: "bad-email",
        message: "",
      }).blockingReasons,
    ).toEqual(["contact_name_required", "email_invalid", "message_required"]);

    const spam = validateCommercialLeadCreate({
      contactName: "Bot",
      email: "bot@example.com",
      message: "spam",
      companyWebsite: "https://spam.example",
    });
    expect(spam.spam).toBe(true);
    expect(spam.valid).toBe(false);
  });

  it("trims oversized text fields to safe limits", () => {
    const longName = "a".repeat(COMMERCIAL_LEAD_FIELD_LIMITS.contactName + 20);
    const longMessage = "b".repeat(COMMERCIAL_LEAD_FIELD_LIMITS.message + 50);
    const result = validateCommercialLeadCreate({
      contactName: longName,
      email: "lead@example.com",
      message: longMessage,
    });

    expect(result.contactName).toHaveLength(COMMERCIAL_LEAD_FIELD_LIMITS.contactName);
    expect(result.message).toHaveLength(COMMERCIAL_LEAD_FIELD_LIMITS.message);
    expect(result.valid).toBe(true);
  });

  it("validates admin status updates", () => {
    expect(validateCommercialLeadStatusUpdate({ leadId: "lead-1", status: "contacted" }).valid).toBe(true);
    expect(validateCommercialLeadStatusUpdate({ leadId: "", status: "new" }).blockingReasons).toContain(
      "lead_id_required",
    );
    expect(validateCommercialLeadStatusUpdate({ leadId: "lead-1", status: "archived" }).blockingReasons).toContain(
      "lead_status_invalid",
    );
  });

  it("sanitizes admin list items without extra fields", () => {
    const lead = sanitizeCommercialLeadForAdmin({
      id: "00000000-0000-4000-8000-000000000001",
      contactName: "Lead",
      normalizedEmail: "lead@example.com",
      clinicName: "Klinik",
      message: "Merhaba",
      sourcePath: "/",
      status: "new",
      createdAt: "2026-07-02T12:00:00.000Z",
      updatedAt: "2026-07-02T12:00:00.000Z",
    });

    expect(JSON.stringify(summarizePhase84cContactLeads())).toContain("/api/contact/leads");
    expect(lead).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      contactName: "Lead",
      normalizedEmail: "lead@example.com",
      clinicName: "Klinik",
      message: "Merhaba",
      sourcePath: "/",
      status: "new",
      createdAt: "2026-07-02T12:00:00.000Z",
      updatedAt: "2026-07-02T12:00:00.000Z",
    });
  });
});
