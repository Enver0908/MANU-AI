/**
 * Phase 84G subscription operations hardening: admin revoke vs Stripe cancel,
 * audit coverage helpers, and defensive UX copy for billing/onboarding edge states.
 */

import type { CommercialEntitlementStatus } from "./phase-83b-commercial-entitlement-model";

export const PHASE_84G_VERSION = "phase84g-subscription-operations-v1";

export type StripeSubscriptionCancelRequestInput = {
  tenantId?: string | null;
};

export type StripeSubscriptionCancelRequestValidation = {
  valid: boolean;
  tenantId: string | null;
  blockingReasons: string[];
};

export type StripeSubscriptionCancelPlan = {
  allowed: boolean;
  blockingReasons: string[];
};

export function validateStripeSubscriptionCancelRequest(
  input: StripeSubscriptionCancelRequestInput,
): StripeSubscriptionCancelRequestValidation {
  const tenantId = input.tenantId?.trim() || null;
  const blockingReasons: string[] = [];
  if (!tenantId) {
    blockingReasons.push("tenant_id_required");
  }
  return {
    valid: blockingReasons.length === 0,
    tenantId,
    blockingReasons,
  };
}

export function deriveStripeSubscriptionCancelPlan(input: {
  entitlementStatus: CommercialEntitlementStatus | null;
  stripeSubscriptionId: string | null;
  stripeSandboxConfigured: boolean;
}): StripeSubscriptionCancelPlan {
  const blockingReasons: string[] = [];

  if (!input.stripeSandboxConfigured) {
    blockingReasons.push("stripe_sandbox_not_configured");
  }
  if (!input.entitlementStatus) {
    blockingReasons.push("entitlement_not_found");
  }
  if (!input.stripeSubscriptionId) {
    blockingReasons.push("stripe_subscription_id_missing");
  }
  if (input.entitlementStatus === "canceled") {
    blockingReasons.push("stripe_subscription_already_canceled");
  }

  return {
    allowed: blockingReasons.length === 0,
    blockingReasons,
  };
}

export function canAdminRevokeAppAccess(status: CommercialEntitlementStatus | null | undefined) {
  if (!status) {
    return false;
  }
  return status !== "revoked";
}

export function canAdminCancelStripeSubscription(input: {
  entitlementStatus: CommercialEntitlementStatus | null | undefined;
  stripeSubscriptionId: string | null | undefined;
  stripeSandboxConfigured: boolean;
}) {
  return deriveStripeSubscriptionCancelPlan({
    entitlementStatus: input.entitlementStatus ?? null,
    stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    stripeSandboxConfigured: input.stripeSandboxConfigured,
  }).allowed;
}

export function describeEntitlementStatusLabel(status: CommercialEntitlementStatus | null | undefined) {
  switch (status) {
    case "active":
      return "Aktif";
    case "past_due":
      return "Ödeme gecikmiş";
    case "canceled":
      return "Stripe aboneliği iptal";
    case "revoked":
      return "Uygulama erişimi kapatıldı";
    case "checkout_started":
      return "Ödeme başlatıldı";
    case "invited":
      return "Davetli";
    default:
      return "—";
  }
}

export function describeOnboardingBlockingReason(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("authentication_required")) {
    return "Önce oturum açmanız gerekir.";
  }
  if (normalized.includes("checkout_session_not_found")) {
    return "Ödeme oturumu bulunamadı. Satın alma bağlantınızı kontrol edin.";
  }
  if (normalized.includes("invite_not_consumed")) {
    return "Davet henüz ödeme ile tüketilmedi. Ödeme doğrulamasını bekleyin.";
  }
  if (normalized.includes("tenant_not_provisioned")) {
    return "Çalışma alanı henüz oluşturulmadı. Birkaç dakika sonra tekrar deneyin.";
  }
  if (normalized.includes("entitlement_not_active")) {
    return "Abonelik aktif değil. Ödeme gecikmesi, iptal veya erişim kapatma olabilir.";
  }
  if (normalized.includes("authenticated_email_mismatch")) {
    return "Oturum e-postası ödeme davetiyle eşleşmiyor. Ödeme sırasında kullandığınız e-posta ile giriş yapın.";
  }
  if (normalized.includes("tenant_already_claimed")) {
    return "Bu çalışma alanı başka bir hesaba bağlı.";
  }
  if (normalized.includes("dietitian_profile_bound_elsewhere")) {
    return "Profiliniz farklı bir çalışma alanına bağlı. Destek ile iletişime geçin.";
  }
  if (normalized.includes("revoked")) {
    return "Erişiminiz yönetim tarafından kapatıldı.";
  }
  if (normalized.includes("canceled")) {
    return "Stripe aboneliği iptal edilmiş.";
  }
  if (normalized.includes("past_due")) {
    return "Ödeme gecikmiş. Abonelik yenilenene kadar erişim kısıtlı olabilir.";
  }
  return "Çalışma alanı şu an bağlanamıyor. Destek ile iletişime geçin.";
}

export function describeCommercialBlockingReason(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("consumed")) {
    return "Bu davet zaten kullanılmış. Giriş yapın veya destek ile iletişime geçin.";
  }
  if (normalized.includes("revoked")) {
    return "Davet veya erişim iptal edilmiş.";
  }
  if (normalized.includes("checkout")) {
    return "Devam eden bir ödeme oturumu var. Mevcut oturumu tamamlayın veya süresinin dolmasını bekleyin.";
  }
  if (normalized.includes("past_due")) {
    return "Abonelik ödemesi gecikmiş. Erişim için ödeme güncellenmelidir.";
  }
  if (normalized.includes("canceled")) {
    return "Abonelik iptal edilmiş.";
  }
  if (normalized.includes("stripe_subscription_id_missing")) {
    return "Stripe abonelik kaydı bulunamadı.";
  }
  if (normalized.includes("stripe_sandbox_not_configured")) {
    return "Stripe sandbox yapılandırılmamış.";
  }
  if (normalized.includes("stripe_subscription_already_canceled")) {
    return "Stripe aboneliği zaten iptal edilmiş.";
  }
  if (normalized.includes("entitlement is already revoked")) {
    return "Uygulama erişimi zaten kapatılmış.";
  }
  return describeOnboardingBlockingReason(reason);
}

export function summarizePhase84gSubscriptionOperations() {
  return {
    phase84gVersion: PHASE_84G_VERSION,
    appAccessRevokeLabel: "Erişimi kapat",
    stripeCancelLabel: "Stripe aboneliğini iptal et",
    stripeCancelEndpoint: "/api/commercial/admin/subscriptions/cancel",
    productionPilotGo: false,
  };
}
