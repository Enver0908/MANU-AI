import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  cancelCommercialAdminStripeSubscription,
  isCommercialAdminStoreConfigured,
  recordCommercialAdminOperationBlocked,
} from "@/lib/commercial-admin-store";
import {
  createStripeBillingClient,
  isStripeBillingConfigured,
  resolveStripeBillingConfig,
} from "@/lib/phase-83c-stripe-billing-gate";
import { validateStripeSubscriptionCancelRequest } from "@/lib/phase-84g-subscription-operations";
import { getSupabaseAdminClient } from "@/lib/supabase";

type CancelSubscriptionBody = {
  tenantId?: string;
};

export async function POST(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "commercial_admin_unauthorized", blockingReasons: access.blockingReasons },
      { status: 401 },
    );
  }
  if (!isCommercialAdminStoreConfigured()) {
    return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
  }

  const stripeConfig = resolveStripeBillingConfig();
  if (!isStripeBillingConfigured(stripeConfig)) {
    return NextResponse.json(
      { error: "stripe_sandbox_not_configured", blockingReasons: stripeConfig.blockingReasons },
      { status: 503 },
    );
  }

  let body: CancelSubscriptionBody;
  try {
    body = (await request.json()) as CancelSubscriptionBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateStripeSubscriptionCancelRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.blockingReasons[0], blockingReasons: validation.blockingReasons },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
  }

  const stripeClient = createStripeBillingClient(stripeConfig);

  try {
    const result = await cancelCommercialAdminStripeSubscription(admin, {
      tenantId: validation.tenantId ?? "",
      actorSummary: access.actorSummary ?? undefined,
      cancelSubscription: (subscriptionId) => stripeClient.cancelSubscription(subscriptionId),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "stripe_subscription_cancel_failed";
    await recordCommercialAdminOperationBlocked(admin, {
      operation: "stripe_subscription_cancel",
      blockingReasons: [message],
      targetTenantId: validation.tenantId,
      actorSummary: access.actorSummary ?? undefined,
    }).catch(() => undefined);
    const status = message.includes("not_found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
