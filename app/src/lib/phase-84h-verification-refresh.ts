/**
 * Phase 84H QA, docs, deployment, and evidence refresh.
 * Pure scenario evaluation for commercial SaaS relaunch acceptance.
 */

import { deriveDashboardAccessGate } from "./phase-83e3-app-shell";
import {
  deriveCommercialAdminEntitlementRevokePlan,
  validateCommercialAdminEntitlementRevokeRequest,
  validateCommercialAdminInviteCreate,
} from "./phase-83f-commercial-admin";
import { PUBLIC_MARKETING_COPY } from "./phase-84b-public-website";
import { AIYA_PUBLIC_CONTACT_EMAIL } from "./brand";
import { validateCommercialLeadCreate, validateCommercialLeadStatusUpdate } from "./phase-84c-contact-leads";
import {
  deriveCustomerAuthRedirect,
  sanitizePostAuthRedirectPath,
  validateMagicLinkRequest,
} from "./phase-84d-customer-auth";
import { evaluateOnboardingClaim, validateOnboardingSessionId } from "./phase-84e-customer-onboarding";
import { evaluateAdminAllowlistAccess } from "./phase-84f-admin-console";
import {
  deriveStripeSubscriptionCancelPlan,
  validateStripeSubscriptionCancelRequest,
} from "./phase-84g-subscription-operations";

export const PHASE_84H_VERSION = "phase84h-verification-refresh-v1";

export const PHASE_84H_QA_SCENARIOS = [
  "landing_primary_ctas",
  "contact_form_validation",
  "magic_link_validation",
  "auth_callback_safe_redirect",
  "onboarding_claim_paths",
  "dashboard_unlock_gate",
  "admin_allowlist_blocks",
  "admin_operations_contracts",
] as const;

export type Phase84hQaScenario = (typeof PHASE_84H_QA_SCENARIOS)[number];

export type Phase84hScenarioEvaluation = {
  scenario: Phase84hQaScenario;
  passed: boolean;
  blockingReasons: string[];
};

export type Phase84hVerificationRefreshStatus = "passed" | "blocked" | "failed";

export type Phase84hVerificationRefreshReport = {
  phase84hVersion: string;
  generatedAt: string;
  verificationStatus: Phase84hVerificationRefreshStatus;
  phase84TrackClosed: boolean;
  productionPilotGoReady: false;
  repoLocalQaComplete: boolean;
  vpsDeploymentVerified: boolean;
  blockingReasons: string[];
  qaScenarios: Phase84hScenarioEvaluation[];
  verificationSummary: {
    targetedPhase84TestFileCount: number;
    targetedPhase84TestsPassed: number;
    visualTestCount: number;
    visualTestsPassed: number;
    appTestPassedCount: number;
    appTestSkippedCount: number;
    lintPassed: boolean;
    productionBuildPassed: boolean;
    releaseVerifyPassed: boolean;
  };
};

export function evaluatePhase84hQaScenario(scenario: Phase84hQaScenario): Phase84hScenarioEvaluation {
  const blockingReasons: string[] = [];

  switch (scenario) {
    case "landing_primary_ctas": {
      if (PUBLIC_MARKETING_COPY.loginLabel !== "Giriş yap") {
        blockingReasons.push("login_cta_label_missing");
      }
      if (PUBLIC_MARKETING_COPY.purchaseLabel !== "Satın al") {
        blockingReasons.push("purchase_cta_label_missing");
      }
      if (PUBLIC_MARKETING_COPY.contactCta !== "Bizimle iletişime geçin") {
        blockingReasons.push("contact_cta_label_missing");
      }
      break;
    }
    case "contact_form_validation": {
      const valid = validateCommercialLeadCreate({
        contactName: "Ayşe Yılmaz",
        email: "lead@example.com",
        message: "Erişim talebi",
      });
      const invalid = validateCommercialLeadCreate({ email: "bad", message: "" });
      if (!valid.valid || valid.normalizedEmail !== "lead@example.com") {
        blockingReasons.push("contact_lead_valid_path_failed");
      }
      if (!invalid.blockingReasons.includes("email_invalid")) {
        blockingReasons.push("contact_lead_invalid_email_not_blocked");
      }
      break;
    }
    case "magic_link_validation": {
      const ok = validateMagicLinkRequest({ email: "user@example.com" });
      const bad = validateMagicLinkRequest({ email: "not-email" });
      if (!ok.valid) {
        blockingReasons.push("magic_link_valid_email_rejected");
      }
      if (!bad.blockingReasons.includes("email_invalid")) {
        blockingReasons.push("magic_link_invalid_email_not_blocked");
      }
      break;
    }
    case "auth_callback_safe_redirect": {
      if (sanitizePostAuthRedirectPath("/dashboard") !== "/dashboard") {
        blockingReasons.push("safe_dashboard_redirect_rejected");
      }
      if (sanitizePostAuthRedirectPath("//evil.example") !== null) {
        blockingReasons.push("open_redirect_not_blocked");
      }
      if (sanitizePostAuthRedirectPath("/api/auth/magic-link") !== null) {
        blockingReasons.push("api_redirect_not_blocked");
      }
      if (
        deriveCustomerAuthRedirect({
          isAuthenticated: false,
          normalizedEmail: null,
          hasTenantMembership: false,
          hasDietitianProfile: false,
          entitlementStatus: null,
          hasClaimablePaidWorkspace: false,
        }) !== "/login"
      ) {
        blockingReasons.push("unauthenticated_redirect_not_login");
      }
      break;
    }
    case "onboarding_claim_paths": {
      if (!validateOnboardingSessionId("cs_test_abc").valid) {
        blockingReasons.push("onboarding_session_id_validation_failed");
      }
      const claim = evaluateOnboardingClaim({
        sessionId: "cs_test_abc",
        isAuthenticated: true,
        userId: "user-1",
        userEmail: "owner@example.com",
        invite: {
          id: "invite-1",
          normalizedEmail: "owner@example.com",
          status: "consumed",
          tenantId: "tenant-1",
          tenantSeedMetadata: {},
        },
        entitlementStatus: "active",
        existingOwnerUserId: null,
        hasMembershipOnTenant: false,
        hasDietitianProfileOnTenant: false,
        dietitianTenantId: null,
      });
      const blocked = evaluateOnboardingClaim({
        sessionId: "cs_test_abc",
        isAuthenticated: true,
        userId: "user-1",
        userEmail: "other@example.com",
        invite: {
          id: "invite-1",
          normalizedEmail: "owner@example.com",
          status: "consumed",
          tenantId: "tenant-1",
          tenantSeedMetadata: {},
        },
        entitlementStatus: "active",
        existingOwnerUserId: null,
        hasMembershipOnTenant: false,
        hasDietitianProfileOnTenant: false,
        dietitianTenantId: null,
      });
      const idempotent = evaluateOnboardingClaim({
        sessionId: "cs_test_abc",
        isAuthenticated: true,
        userId: "user-1",
        userEmail: "owner@example.com",
        invite: {
          id: "invite-1",
          normalizedEmail: "owner@example.com",
          status: "consumed",
          tenantId: "tenant-1",
          tenantSeedMetadata: {},
        },
        entitlementStatus: "active",
        existingOwnerUserId: "user-1",
        hasMembershipOnTenant: true,
        hasDietitianProfileOnTenant: true,
        dietitianTenantId: "tenant-1",
      });
      if (!claim.claimable || claim.blockingReasons.length > 0) {
        blockingReasons.push("onboarding_claim_success_path_failed");
      }
      if (!blocked.blockingReasons.includes("authenticated_email_mismatch")) {
        blockingReasons.push("onboarding_claim_block_path_failed");
      }
      if (!idempotent.alreadyClaimed) {
        blockingReasons.push("onboarding_claim_idempotent_path_failed");
      }
      break;
    }
    case "dashboard_unlock_gate": {
      const unlocked = deriveDashboardAccessGate({
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "active",
      });
      const noMembership = deriveDashboardAccessGate({
        hasTenantMembership: false,
        hasDietitianProfile: false,
        entitlementStatus: null,
      });
      const revoked = deriveDashboardAccessGate({
        hasTenantMembership: true,
        hasDietitianProfile: true,
        entitlementStatus: "revoked",
      });
      if (unlocked !== "ok") {
        blockingReasons.push("dashboard_active_entitlement_not_unlocked");
      }
      if (noMembership === "ok") {
        blockingReasons.push("dashboard_unlocked_without_membership");
      }
      if (revoked !== "revoked_access") {
        blockingReasons.push("dashboard_revoked_entitlement_not_blocked");
      }
      break;
    }
    case "admin_allowlist_blocks": {
      const allowed = evaluateAdminAllowlistAccess(AIYA_PUBLIC_CONTACT_EMAIL);
      const denied = evaluateAdminAllowlistAccess("intruder@example.com");
      if (!allowed.allowed) {
        blockingReasons.push("default_admin_email_not_allowlisted");
      }
      if (denied.allowed) {
        blockingReasons.push("non_admin_email_not_blocked");
      }
      break;
    }
    case "admin_operations_contracts": {
      const invite = validateCommercialAdminInviteCreate({ email: "invite@example.com" });
      const revoke = validateCommercialAdminEntitlementRevokeRequest({ tenantId: "tenant-1" });
      const lead = validateCommercialLeadStatusUpdate({ leadId: "lead-1", status: "contacted" });
      const cancel = validateStripeSubscriptionCancelRequest({ tenantId: "tenant-1" });
      const revokePlan = deriveCommercialAdminEntitlementRevokePlan({ entitlementStatus: "active" });
      const cancelPlan = deriveStripeSubscriptionCancelPlan({
        entitlementStatus: "active",
        stripeSubscriptionId: "sub_123",
        stripeSandboxConfigured: true,
      });
      if (!invite.valid || !revoke.valid || !lead.valid || !cancel.valid) {
        blockingReasons.push("admin_operation_validation_failed");
      }
      if (!revokePlan.allowed || !cancelPlan.allowed) {
        blockingReasons.push("admin_operation_plan_failed");
      }
      break;
    }
    default:
      blockingReasons.push("unknown_scenario");
  }

  return {
    scenario,
    passed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function evaluateAllPhase84hQaScenarios() {
  return PHASE_84H_QA_SCENARIOS.map((scenario) => evaluatePhase84hQaScenario(scenario));
}

export function buildPhase84hVerificationRefreshReport(input: {
  targetedPhase84TestFileCount: number;
  targetedPhase84TestsPassed: number;
  visualTestCount: number;
  visualTestsPassed: number;
  appTestPassedCount: number;
  appTestSkippedCount: number;
  lintPassed: boolean;
  productionBuildPassed: boolean;
  releaseVerifyPassed: boolean;
  vpsDeploymentVerified?: boolean;
  now?: string;
}): Phase84hVerificationRefreshReport {
  const qaScenarios = evaluateAllPhase84hQaScenarios();
  const qaFailed = qaScenarios.filter((scenario) => !scenario.passed);
  const blockingReasons: string[] = qaFailed.flatMap((scenario) =>
    scenario.blockingReasons.map((reason) => `${scenario.scenario}:${reason}`),
  );

  if (input.targetedPhase84TestsPassed <= 0) {
    blockingReasons.push("targeted Phase 84 tests have not passed");
  }
  if (input.visualTestsPassed <= 0) {
    blockingReasons.push("Playwright visual tests have not passed");
  }
  if (input.visualTestsPassed < input.visualTestCount) {
    blockingReasons.push("Playwright visual test count is incomplete");
  }
  if (!input.lintPassed) {
    blockingReasons.push("lint did not pass");
  }
  if (!input.productionBuildPassed) {
    blockingReasons.push("production build did not pass");
  }
  if (!input.releaseVerifyPassed) {
    blockingReasons.push("release verification did not pass");
  }
  if (!input.vpsDeploymentVerified) {
    blockingReasons.push("VPS deployment verification pending");
  }

  const toolchainFailed =
    !input.lintPassed ||
    !input.productionBuildPassed ||
    !input.releaseVerifyPassed ||
    input.targetedPhase84TestsPassed <= 0 ||
    qaFailed.length > 0 ||
    input.visualTestsPassed <= 0 ||
    input.visualTestsPassed < input.visualTestCount;

  const repoLocalQaComplete = !toolchainFailed;
  const vpsDeploymentVerified = input.vpsDeploymentVerified ?? false;

  const verificationStatus: Phase84hVerificationRefreshStatus = toolchainFailed
    ? "failed"
    : !vpsDeploymentVerified
      ? "blocked"
      : "passed";

  return {
    phase84hVersion: PHASE_84H_VERSION,
    generatedAt: input.now ?? new Date().toISOString(),
    verificationStatus,
    phase84TrackClosed: repoLocalQaComplete && vpsDeploymentVerified,
    productionPilotGoReady: false,
    repoLocalQaComplete,
    vpsDeploymentVerified,
    blockingReasons: [...new Set(blockingReasons)],
    qaScenarios,
    verificationSummary: {
      targetedPhase84TestFileCount: input.targetedPhase84TestFileCount,
      targetedPhase84TestsPassed: input.targetedPhase84TestsPassed,
      visualTestCount: input.visualTestCount,
      visualTestsPassed: input.visualTestsPassed,
      appTestPassedCount: input.appTestPassedCount,
      appTestSkippedCount: input.appTestSkippedCount,
      lintPassed: input.lintPassed,
      productionBuildPassed: input.productionBuildPassed,
      releaseVerifyPassed: input.releaseVerifyPassed,
    },
  };
}

export function summarizePhase84hVerificationRefreshReport(report: Phase84hVerificationRefreshReport) {
  return {
    verificationStatus: report.verificationStatus,
    phase84TrackClosed: report.phase84TrackClosed,
    productionPilotGoReady: report.productionPilotGoReady,
    repoLocalQaComplete: report.repoLocalQaComplete,
    vpsDeploymentVerified: report.vpsDeploymentVerified,
    qaScenarioPassCount: report.qaScenarios.filter((scenario) => scenario.passed).length,
    blockingReasonCount: report.blockingReasons.length,
    verificationSummary: report.verificationSummary,
  };
}
