import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveCustomerSessionFacts } from "@/lib/customer-auth-session";
import { loadTenantEntitlementByTenantId } from "@/lib/commercial-billing-store";
import { deriveCustomerAuthRedirect } from "@/lib/phase-84d-customer-auth";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
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

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });

  if (!supabase) {
    return { gate: "fallback" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const facts = await resolveCustomerSessionFacts(supabase);
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
    };
  }

  const { data: dietitian } = await supabase
    .from("dietitians")
    .select("id, display_name, ui_language")
    .eq("tenant_id", membership.tenant_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const admin = getSupabaseAdminClient();
  const entitlement = admin
    ? await loadTenantEntitlementByTenantId(admin, membership.tenant_id)
    : null;

  return {
    gate: "resolved",
    hasTenantMembership: true,
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus: entitlement?.status ?? null,
    displayName: dietitian?.display_name || user.email || "Dietitian",
    role: membership.role || "member",
    uiLanguage: normalizeLanguageCode(dietitian?.ui_language),
  };
}
