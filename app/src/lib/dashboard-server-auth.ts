import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveCustomerSessionFacts } from "@/lib/customer-auth-session";
import { loadTenantEntitlementByTenantId } from "@/lib/commercial-billing-store";
import { deriveCustomerAuthRedirect } from "@/lib/phase-84d-customer-auth";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { createSupabaseServerReadOnlyClient } from "@/lib/supabase-server-readonly";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import { normalizeLanguageCode, type SupportedLanguageCode } from "@/lib/languages";

export type DashboardAuthState =
  | { gate: "fallback" }
  | {
      gate: "resolved";
      hasTenantMembership: boolean;
      hasDietitianProfile: boolean;
      entitlementStatus: CommercialEntitlementStatus | null;
      displayName: string;
      role: string;
      uiLanguage: SupportedLanguageCode;
      authTiming?: DashboardAuthTiming;
    };

export type DashboardAuthTiming = {
  getUserMs?: number;
  membershipMs?: number;
  customerSessionFactsMs?: number;
  dietitianMs?: number;
  entitlementMs?: number;
  totalMs?: number;
};

/**
 * Shared server-side dashboard auth resolution. Extracted verbatim from
 * `/dashboard/page.tsx` (Faz 4) so the AI Chat routes gate access the same
 * way as the classic dashboard, without duplicating the Supabase session,
 * membership, and entitlement lookups.
 */
export async function resolveDashboardAuth(): Promise<DashboardAuthState> {
  if (!isSupabaseStoreConfigured() || !isSupabaseConfigured()) {
    return { gate: "fallback" };
  }

  const diagnosticEnabled = process.env.AIYA_PERF_DIAGNOSTIC === "1";
  const authStartedAt = performance.now();
  const authTiming: DashboardAuthTiming | undefined = diagnosticEnabled ? {} : undefined;

  const cookieStore = await cookies();
  const supabase = createSupabaseServerReadOnlyClient({
    getAll: () => cookieStore.getAll(),
  });

  if (!supabase) {
    return { gate: "fallback" };
  }

  const getUserStartedAt = performance.now();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (authTiming) authTiming.getUserMs = performance.now() - getUserStartedAt;

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const membershipStartedAt = performance.now();
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (authTiming) authTiming.membershipMs = performance.now() - membershipStartedAt;

  if (!membership) {
    const customerSessionFactsStartedAt = performance.now();
    const facts = await resolveCustomerSessionFacts(supabase);
    if (authTiming) {
      authTiming.customerSessionFactsMs = performance.now() - customerSessionFactsStartedAt;
    }
    const authRedirect = deriveCustomerAuthRedirect(facts);
    if (authRedirect === "/onboarding") {
      redirect("/onboarding");
    }
    if (authRedirect === "/onboarding?state=support") {
      redirect("/onboarding?state=support");
    }

    return {
      gate: "resolved",
      hasTenantMembership: false,
      hasDietitianProfile: false,
      entitlementStatus: null,
      displayName: user.email || "Dietitian",
      role: "member",
      uiLanguage: normalizeLanguageCode(undefined),
      ...(authTiming
        ? { authTiming: { ...authTiming, totalMs: performance.now() - authStartedAt } }
        : {}),
    };
  }

  const dietitianStartedAt = performance.now();
  const { data: dietitian } = await supabase
    .from("dietitians")
    .select("id, display_name, ui_language")
    .eq("tenant_id", membership.tenant_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (authTiming) authTiming.dietitianMs = performance.now() - dietitianStartedAt;

  const admin = getSupabaseAdminClient();
  const entitlementStartedAt = performance.now();
  const entitlement = admin
    ? await loadTenantEntitlementByTenantId(admin, membership.tenant_id)
    : null;
  if (authTiming) authTiming.entitlementMs = performance.now() - entitlementStartedAt;

  return {
    gate: "resolved",
    hasTenantMembership: true,
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus: entitlement?.status ?? null,
    displayName: dietitian?.display_name || user.email || "Dietitian",
    role: membership.role || "member",
    uiLanguage: normalizeLanguageCode(dietitian?.ui_language),
    ...(authTiming
      ? { authTiming: { ...authTiming, totalMs: performance.now() - authStartedAt } }
      : {}),
  };
}
