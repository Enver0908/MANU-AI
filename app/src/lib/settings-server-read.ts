import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadTenantEntitlementByTenantId } from "@/lib/commercial-billing-store";
import { resolveCustomerSessionFacts } from "@/lib/customer-auth-session";
import { normalizeLanguageCode, type SupportedLanguageCode } from "@/lib/languages";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import {
  deriveDashboardAccessGate,
  type DashboardAccessGate,
} from "@/lib/phase-83e3-app-shell";
import { evaluateMobileInstallCenterAccess } from "@/lib/phase-83d-pwa-install-gate";
import { deriveCustomerAuthRedirect } from "@/lib/phase-84d-customer-auth";
import {
  assertSettingsReadModelHasNoInternalIds,
  buildFallbackSettingsAccountReadModel,
  maskEmailForSettings,
  projectBillingVisibility,
  SETTINGS_ROOT_PATH,
  type SettingsAccountReadModel,
} from "@/lib/phase-85-stage-4d-settings-contracts";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import type { TenantRole } from "@/lib/types";

export type SettingsServerReadResult =
  | { kind: "fallback"; model: SettingsAccountReadModel }
  | { kind: "gate"; gate: Exclude<DashboardAccessGate, "ok">; uiLanguage: SupportedLanguageCode }
  | { kind: "ok"; model: SettingsAccountReadModel };

/**
 * Server-side Stage 4D settings read model. Cookie-bound auth is authoritative.
 * No tenant/user/dietitian/Stripe ids are returned to the client.
 */
export async function resolveSettingsAccountReadModel(): Promise<SettingsServerReadResult> {
  if (!isSupabaseStoreConfigured() || !isSupabaseConfigured()) {
    const model = buildFallbackSettingsAccountReadModel();
    assertSettingsReadModelHasNoInternalIds(model);
    return { kind: "fallback", model };
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
    const model = buildFallbackSettingsAccountReadModel();
    assertSettingsReadModelHasNoInternalIds(model);
    return { kind: "fallback", model };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(SETTINGS_ROOT_PATH)}`);
  }

  let membership: { tenant_id: string; role: string } | null = null;
  try {
    const membershipResult = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipResult.error) {
      throw membershipResult.error;
    }
    membership = membershipResult.data;
  } catch {
    return {
      kind: "gate",
      gate: "no_membership",
      uiLanguage: normalizeLanguageCode(undefined),
    };
  }

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
      kind: "gate",
      gate: "no_membership",
      uiLanguage: normalizeLanguageCode(undefined),
    };
  }

  let dietitian: { display_name: string | null; ui_language: string | null } | null = null;
  try {
    const dietitianResult = await supabase
      .from("dietitians")
      .select("display_name, ui_language")
      .eq("tenant_id", membership.tenant_id)
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (dietitianResult.error) {
      throw dietitianResult.error;
    }
    dietitian = dietitianResult.data;
  } catch {
    return {
      kind: "gate",
      gate: "no_dietitian_profile",
      uiLanguage: normalizeLanguageCode(undefined),
    };
  }

  const uiLanguage = normalizeLanguageCode(dietitian?.ui_language);

  let tenantName = "Çalışma alanı";
  try {
    const tenantResult = await supabase
      .from("tenants")
      .select("name")
      .eq("id", membership.tenant_id)
      .maybeSingle();
    if (!tenantResult.error && tenantResult.data?.name) {
      tenantName = String(tenantResult.data.name);
    }
  } catch {
    // Keep generic workspace label; do not expose query details.
  }

  const admin = getSupabaseAdminClient();
  let entitlementStatus: CommercialEntitlementStatus | null = null;
  try {
    const entitlement = admin ? await loadTenantEntitlementByTenantId(admin, membership.tenant_id) : null;
    entitlementStatus = entitlement?.status ?? null;
  } catch {
    entitlementStatus = null;
  }

  const gate = deriveDashboardAccessGate({
    hasTenantMembership: true,
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus,
  });

  if (gate !== "ok") {
    return { kind: "gate", gate, uiLanguage };
  }

  const installAccess = evaluateMobileInstallCenterAccess({
    isAuthenticated: true,
    hasTenantMembership: true,
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus,
  });

  const role = (membership.role || "member") as TenantRole | "member";
  const model: SettingsAccountReadModel = {
    runtime: {
      mode: "configured",
      identityActionsAvailable: true,
      billingActionsAvailable: role === "owner" || role === "admin",
      pwaActionsAvailable: installAccess.allowed,
    },
    profile: {
      displayName: dietitian?.display_name || user.email || "Diyetisyen",
      uiLanguage,
    },
    security: {
      available: true,
      emailMasked: maskEmailForSettings(user.email),
      emailVerified: Boolean(user.email_confirmed_at),
      lastSignInAt: typeof user.last_sign_in_at === "string" ? user.last_sign_in_at : null,
    },
    workspace: {
      name: tenantName,
      role,
      membershipActive: true,
    },
    billing: projectBillingVisibility({
      role,
      entitlementStatus,
      mode: "configured",
    }),
    application: {
      available: true,
      installReady: installAccess.allowed,
      installState: installAccess.allowed ? "ready" : "blocked",
    },
  };

  assertSettingsReadModelHasNoInternalIds(model);
  return { kind: "ok", model };
}
