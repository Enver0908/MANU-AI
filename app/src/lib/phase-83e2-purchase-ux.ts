/**
 * Phase 83E-2 public intro + purchase UX: pure, testable presentation logic.
 *
 * This module owns only view derivation and user-facing copy for the public
 * commercial purchase flow. It performs no network, auth, entitlement, Stripe,
 * or billing mutation; those stay in the existing Phase 83C API routes. Keeping
 * the gating decisions here lets the fail-closed behavior be unit tested without
 * rendering: an ambiguous or error response must never surface as "eligible".
 */

export const PURCHASE_CONTACT_EMAIL = "contact@aiyaworkspace.com";

/**
 * Lightweight client-side email shape check. The server remains the source of
 * truth (it re-normalizes and matches the invite); this only prevents obviously
 * malformed submissions before calling the eligibility endpoint.
 */
export function isLikelyEmail(value: string): boolean {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type InviteEligibilityResponse = {
  eligible?: boolean;
  normalizedEmail?: string;
  blockingReasons?: string[];
  error?: string;
};

export type CheckoutResponse = {
  checkoutUrl?: string;
  sessionId?: string;
  reused?: boolean;
  error?: string;
  blockingReasons?: string[];
};

export type PurchaseGateView =
  | { kind: "eligible"; normalizedEmail: string }
  | { kind: "waitlist"; reasons: string[] }
  | { kind: "not_configured" }
  | { kind: "error"; message: string };

/**
 * Map an eligibility API result to a fail-closed view. Only an explicit
 * `eligible === true` on a 2xx response unlocks checkout; every other outcome
 * (503 not configured, 4xx/5xx, or eligible false) blocks it.
 */
export function derivePurchaseGateView(
  status: number,
  payload: InviteEligibilityResponse,
): PurchaseGateView {
  if (status === 503 || payload.error === "commercial_billing_not_configured") {
    return { kind: "not_configured" };
  }

  if (status < 200 || status >= 300) {
    return {
      kind: "error",
      message: "Uygunluk kontrol edilemedi. Bilgileri kontrol edip tekrar deneyin.",
    };
  }

  if (payload.eligible === true) {
    return { kind: "eligible", normalizedEmail: payload.normalizedEmail ?? "" };
  }

  return { kind: "waitlist", reasons: payload.blockingReasons ?? [] };
}

/**
 * Derive a user-facing checkout error message. Returns null only when checkout
 * genuinely succeeded and a redirect URL is present.
 */
export function deriveCheckoutOutcome(
  status: number,
  payload: CheckoutResponse,
): { redirectUrl: string } | { errorMessage: string } {
  if (status >= 200 && status < 300 && payload.checkoutUrl) {
    return { redirectUrl: payload.checkoutUrl };
  }

  if (status === 503 || payload.error === "stripe_sandbox_not_configured" || payload.error === "commercial_billing_not_configured") {
    return {
      errorMessage: "Ödeme ortamı bu kurulumda yapılandırılmamış. Lütfen ekiple iletişime geçin.",
    };
  }

  if (status === 403 || payload.error === "invite_not_eligible_for_checkout") {
    return {
      errorMessage: "Bu davet şu anda ödemeye uygun değil. Erişim için ekiple iletişime geçin.",
    };
  }

  return { errorMessage: "Ödeme başlatılamadı. Lütfen tekrar deneyin." };
}

/** Translate a backend blocking-reason code into friendly Turkish waitlist copy. */
export function describePurchaseBlockingReason(reason: string): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes("not found")) {
    return "Bu e-posta için aktif bir davet bulunamadı.";
  }
  if (normalized.includes("email does not match")) {
    return "E-posta, davet kaydıyla eşleşmiyor.";
  }
  if (normalized.includes("token does not match")) {
    return "Davet kodu geçersiz.";
  }
  if (normalized.includes("expired")) {
    return "Davetin süresi dolmuş.";
  }
  if (normalized.includes("status must be active")) {
    return "Davet artık aktif değil.";
  }
  return "Erişim için uygunluk doğrulanamadı.";
}

export const PURCHASE_COPY = {
  eyebrow: "SiriusAI",
  landingTitle: "Diyetisyenler için denetimli yapay zekâ mesajlaşma asistanı",
  landingSubtitle:
    "Danışan mesajlarını güvenle yönetin: yapay zekâ taslakları hazırlar, riskli sağlık/beslenme mesajları diyetisyen onayına yükseltilir. Web ve kurulabilir mobil PWA aynı güvenli yüzeyi paylaşır.",
  purchaseTitle: "Satın al",
  purchaseFormTitle: "Davetli erişim kontrolü",
  purchaseSubtitle:
    "Erişim davetlidir. Onaylı e-postanız ve davet kodunuzla uygunluğu doğrulayın, ardından güvenli ödemeye geçin.",
  waitlistTitle: "Şu an için erişiminiz yok",
  waitlistBody:
    "Kaydınız satın almaya uygun değil. Erişim talebi için ekiple iletişime geçebilirsiniz.",
  successTitle: "Ödeme alındı",
  successBody:
    "Ödemeniz alındı. Panele erişmek için önce hesabınızı oluşturup çalışma alanınızı bağlamanız gerekir; demo akışı yerine kayıtlı müşteri e-postanızla giriş yapın.",
  successAccountTitle: "Hesabınızı bağlayın",
  cancelTitle: "Ödeme tamamlanmadı",
} as const;
