import { cookies } from "next/headers";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase";
import { isSupabaseStoreConfigured } from "./supabase-store";
import {
  evaluateMobileInstallCenterAccess,
  type MobileInstallCenterAccessInput,
} from "./phase-83d-pwa-install-gate";
import { loadTenantEntitlementByTenantId } from "./commercial-billing-store";

export type MobileInstallAccessState =
  | {
      gate: "granted";
      tenantId: string;
      dietitianId: string;
      displayName: string;
    }
  | { gate: "blocked"; blockingReasons: string[] }
  | { gate: "unauthenticated" }
  | { gate: "fallback_demo" };

export async function resolveMobileInstallAccess(): Promise<MobileInstallAccessState> {
  if (!isSupabaseStoreConfigured() || !isSupabaseConfigured()) {
    return { gate: "fallback_demo" };
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
    return { gate: "unauthenticated" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { gate: "unauthenticated" };
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: dietitian } = membership
    ? await supabase
        .from("dietitians")
        .select("id, display_name")
        .eq("tenant_id", membership.tenant_id)
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  const admin = (await import("./supabase")).getSupabaseAdminClient();
  const entitlement =
    membership && admin
      ? await loadTenantEntitlementByTenantId(admin, membership.tenant_id)
      : null;

  const accessInput: MobileInstallCenterAccessInput = {
    isAuthenticated: true,
    hasTenantMembership: Boolean(membership),
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus: entitlement?.status ?? null,
  };

  const access = evaluateMobileInstallCenterAccess(accessInput);
  if (!access.allowed) {
    return { gate: "blocked", blockingReasons: access.blockingReasons };
  }

  return {
    gate: "granted",
    tenantId: membership!.tenant_id,
    dietitianId: dietitian!.id,
    displayName: dietitian!.display_name || user.email || "Dietitian",
  };
}
