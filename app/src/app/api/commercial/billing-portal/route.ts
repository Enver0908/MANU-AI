import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  isCommercialBillingStoreConfigured,
  loadBillingCustomerByTenantId,
  loadTenantEntitlementByTenantId,
} from "@/lib/commercial-billing-store";
import {
  createStripeBillingClient,
  evaluateBillingPortalAccess,
  isStripeBillingConfigured,
  resolveStripeBillingConfig,
} from "@/lib/phase-83c-stripe-billing-gate";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST() {
  const billingConfig = resolveStripeBillingConfig();
  if (!isStripeBillingConfigured(billingConfig)) {
    return NextResponse.json(
      { error: "stripe_sandbox_not_configured", blockingReasons: billingConfig.blockingReasons },
      { status: 503 },
    );
  }

  if (!isSupabaseStoreConfigured() || !isCommercialBillingStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
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
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "no_membership" }, { status: 403 });
  }

  const { data: dietitian } = await supabase
    .from("dietitians")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const admin = (await import("@/lib/supabase")).getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const entitlement = await loadTenantEntitlementByTenantId(admin, membership.tenant_id);
  const billingCustomer = await loadBillingCustomerByTenantId(admin, membership.tenant_id);

  const portalAccess = evaluateBillingPortalAccess({
    isAuthenticated: true,
    hasTenantMembership: true,
    hasDietitianProfile: Boolean(dietitian),
    entitlementStatus: entitlement?.status ?? null,
    stripeCustomerId: billingCustomer?.stripeCustomerId ?? entitlement?.stripeCustomerId ?? null,
  });

  if (!portalAccess.allowed) {
    return NextResponse.json(
      { error: "billing_portal_not_allowed", blockingReasons: portalAccess.blockingReasons },
      { status: 403 },
    );
  }

  const stripeCustomerId = billingCustomer?.stripeCustomerId ?? entitlement?.stripeCustomerId;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
  }

  const stripeClient = createStripeBillingClient(billingConfig);
  const portal = await stripeClient.createBillingPortalSession({
    stripeCustomerId,
    returnUrl: `${billingConfig.appUrl}/dashboard`,
  });

  return NextResponse.json({ portalUrl: portal.portalUrl });
}
