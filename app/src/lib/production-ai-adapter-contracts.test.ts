import { describe, expect, it } from "vitest";
import {
  buildGeminiSafetySettingsContract,
  evaluateProductionAiAdapterReadiness,
  evaluateProductionAiPayloadSafety,
} from "./production-ai-adapter-contracts";
import { TURKEY_FIRST_DIRECT_LAUNCH_SCOPE } from "./production-readiness-contracts";

const allApprovals = {
  vendorRiskApproved: true,
  clinicalSafetyApproved: true,
  privacyLegalApproved: true,
  providerTrainingDisabled: true,
  providerRetentionDisabledOrBounded: true,
  nativeTokenCountingVerified: true,
  safetySettingsConfigured: true,
};

const safeBoundary = {
  env: {
    NODE_ENV: "production",
    MANU_APP_ENV: "production",
    MANU_ALLOW_REAL_GEMINI: "true",
  },
  approvedGateIdsSource: "server_authority" as const,
  approvedGateIds: [
    "legal_privacy_review",
    "clinical_taxonomy_approval",
    "provider_vendor_review",
    "channel_policy_review",
    "incident_response_runbook",
    "backup_restore_test",
    "secret_rotation_plan",
    "dependency_audit_clearance",
  ],
  launchAuthorizationApproved: true,
  tenantEntitlementActive: true,
  tenantPermissionGranted: true,
  contextAuthority: "server" as const,
  launchScope: TURKEY_FIRST_DIRECT_LAUNCH_SCOPE,
};

describe("production AI adapter contracts", () => {
  it("blocks real provider calls when external approvals are missing even if env flags are present", () => {
    const decision = evaluateProductionAiAdapterReadiness({
      provider: "gemini",
      operation: "ai_text_generate",
      model: "gemini-3.7-flash",
      approvalState: { ...allApprovals, clinicalSafetyApproved: false },
      boundary: safeBoundary,
      payloadSafety: {
        riskLevel: "green",
        serializedCharCount: 1200,
        topLevelKeys: ["promptContext", "contextManifest", "responsePlan"],
        attachmentStatuses: [],
      },
    });

    expect(decision.realProviderCallAllowed).toBe(false);
    expect(decision.blockingReasons).toContain("clinical safety approval is missing");
  });

  it("allows readiness only when launch gates, approvals, model, and payload safety all pass", () => {
    const decision = evaluateProductionAiAdapterReadiness({
      provider: "gemini",
      operation: "ai_text_generate",
      model: "gemini-3.7-flash",
      approvalState: allApprovals,
      boundary: safeBoundary,
      payloadSafety: {
        riskLevel: "green",
        serializedCharCount: 1200,
        topLevelKeys: ["promptContext", "contextManifest", "responsePlan"],
        attachmentStatuses: [],
      },
    });

    expect(decision.realProviderCallAllowed).toBe(true);
    expect(decision.blockingReasons).toEqual([]);
  });

  it("fails closed for raw clinical payload keys, non-ready attachments, and red risk", () => {
    const safety = evaluateProductionAiPayloadSafety({
      riskLevel: "red",
      serializedCharCount: 1000,
      topLevelKeys: ["promptContext", "healthProfile", "rawMessages"],
      attachmentStatuses: ["ready", "review_required"],
      mediaEvidence: {
        sanitizedImageOnly: false,
        acceptedTranscriptOnly: false,
        extractedTextReviewedOrDeterministic: true,
        malwareScanPassed: false,
      },
    });

    expect(safety.ok).toBe(false);
    expect(safety.blockingReasons).toContain("red risk payload must not reach an AI provider");
    expect(safety.blockingReasons.join(" ")).toContain("healthProfile");
    expect(safety.blockingReasons).toContain("all provider-bound attachments must be ready");
    expect(safety.blockingReasons).toContain("provider-bound files require malware scan pass evidence");
  });

  it("builds a conservative Gemini safety settings contract", () => {
    expect(buildGeminiSafetySettingsContract()).toEqual([
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
    ]);
  });
});
