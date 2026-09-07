import { NextResponse } from "next/server";
import { AppAuthError, resolveAccountTenantContext } from "@/lib/auth-context";
import {
  isCommercialBillingStoreConfigured,
  loadBillingCustomerByTenantId,
  loadTenantEntitlementByTenantId,
} from "@/lib/commercial-billing-store";
import {
  createStripeBillingClient,
  isStripeBillingConfigured,
  resolveStripeBillingConfig,
} from "@/lib/phase-83c-stripe-billing-gate";
import { buildSettingsHref, resolveBillingPortalState } from "@/lib/phase-85-stage-4d-settings-contracts";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function POST() {
  const billingConfig = resolveStripeBillingConfig();
  if (!isStripeBillingConfigured(billingConfig)) {
    return NextResponse.json({ error: "stripe_sandbox_not_configured" }, { status: 503 });
  }

  if (!isSupabaseStoreConfigured() || !isCommercialBillingStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  let context: Awaited<ReturnType<typeof resolveAccountTenantContext>>;
  try {
    context = await resolveAccountTenantContext();
  } catch (error) {
    if (error instanceof AppAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const entitlement = await loadTenantEntitlementByTenantId(admin, context.tenantId);
  const billingCustomer = await loadBillingCustomerByTenantId(admin, context.tenantId);
  const stripeCustomerId = billingCustomer?.stripeCustomerId ?? entitlement?.stripeCustomerId ?? null;
  const portalState = resolveBillingPortalState({
    mode: "configured",
    role: context.role,
    stripeConfigured: true,
    stripeCustomerId,
    entitlementStatus: entitlement?.status ?? null,
  });

  if (portalState === "forbidden") {
    return NextResponse.json({ error: "billing_portal_forbidden" }, { status: 403 });
  }
  if (portalState === "customer_missing") {
    return NextResponse.json({ error: "stripe_customer_not_found" }, { status: 404 });
  }
  if (portalState !== "available" || !stripeCustomerId) {
    return NextResponse.json({ error: "billing_portal_not_allowed" }, { status: 403 });
  }

  const stripeClient = createStripeBillingClient(billingConfig);
  let portal;
  try {
    portal = await withBillingPortalTimeout(
      stripeClient.createBillingPortalSession({
        stripeCustomerId,
        returnUrl: `${billingConfig.appUrl}${buildSettingsHref("billing")}`,
      }),
    );
  } catch {
    return NextResponse.json({ error: "billing_portal_provider_unavailable" }, { status: 502 });
  }

  return NextResponse.json({ portalUrl: portal.portalUrl });
}

function withBillingPortalTimeout<T>(operation: Promise<T>) {
  const timeoutMs = Number(process.env.MANU_BILLING_PORTAL_TIMEOUT_MS ?? 8000);
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("billing_portal_timeout")), timeoutMs);
    }),
  ]);
}
