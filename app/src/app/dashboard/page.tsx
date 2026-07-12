import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardApp } from "@/components/dashboard-app";
import { DashboardGatedState } from "@/components/auth-states";
import { PwaSubscriberShell } from "@/components/pwa-subscriber-shell";
import { resolveCustomerSessionFacts } from "@/lib/customer-auth-session";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";
import { loadTenantEntitlementByTenantId } from "@/lib/commercial-billing-store";
import {
  deriveDashboardAccessGate,
  type DashboardAccessGate,
} from "@/lib/phase-83e3-app-shell";
import { deriveCustomerAuthRedirect } from "@/lib/phase-84d-customer-auth";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

type DashboardAuthState =
  | { gate: "fallback" }
  | {
      gate: "resolved";
      hasTenantMembership: boolean;
      hasDietitianProfile: boolean;
      entitlementStatus: CommercialEntitlementStatus | null;
      displayName: string;
      role: string;
    };

async function resolveDashboardAuth(): Promise<DashboardAuthState> {
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
    };
  }

  const { data: dietitian } = await supabase
    .from("dietitians")
    .select("id, display_name")
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
  };
}

export default async function DashboardPage() {
  const auth = await resolveDashboardAuth();

  if (auth.gate === "fallback") {
    return (
      <PwaSubscriberShell registerServiceWorker={false}>
        <Suspense fallback={null}>
          <DashboardApp />
        </Suspense>
      </PwaSubscriberShell>
    );
  }

  const gate: DashboardAccessGate = deriveDashboardAccessGate({
    hasTenantMembership: auth.hasTenantMembership,
    hasDietitianProfile: auth.hasDietitianProfile,
    entitlementStatus: auth.entitlementStatus,
  });

  if (gate !== "ok") {
    return <DashboardGatedState gate={gate} />;
  }

  const installAccess = await resolveMobileInstallAccess();
  const registerServiceWorker = installAccess.gate === "granted";

  return (
    <PwaSubscriberShell registerServiceWorker={registerServiceWorker}>
      <Suspense fallback={null}>
        <DashboardApp
          authInfo={{ displayName: auth.displayName, role: auth.role }}
          commercialInfo={{
            subscriptionStatus: auth.entitlementStatus,
            installReady: registerServiceWorker,
          }}
        />
      </Suspense>
    </PwaSubscriberShell>
  );
}
