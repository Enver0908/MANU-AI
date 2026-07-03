import { NextResponse, type NextRequest } from "next/server";
import {
  assertCommercialPublicRateLimit,
  commercialRateLimitResponse,
} from "@/lib/commercial-public-rate-limit";
import {
  ensureTenantEntitlementCheckoutStarted,
  evaluateCommercialInviteEligibility,
  isCommercialBillingStoreConfigured,
  loadCommercialInviteByEmail,
  markCommercialInviteCheckoutStarted,
} from "@/lib/commercial-billing-store";
import {
  createStripeBillingClient,
  evaluateCheckoutEligibility,
  isStripeBillingConfigured,
  resolveStripeBillingConfig,
} from "@/lib/phase-83c-stripe-billing-gate";

type CheckoutBody = {
  email?: string;
  inviteToken?: string;
};

export async function POST(request: NextRequest) {
  const billingConfig = resolveStripeBillingConfig();
  if (!isStripeBillingConfigured(billingConfig)) {
    return NextResponse.json(
      { error: "stripe_sandbox_not_configured", blockingReasons: billingConfig.blockingReasons },
      { status: 503 },
    );
  }

  if (!isCommercialBillingStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.email || !body.inviteToken) {
    return NextResponse.json({ error: "email_and_invite_token_required" }, { status: 400 });
  }

  try {
    await assertCommercialPublicRateLimit(request, "checkout_create", body.email);
  } catch (error) {
    return commercialRateLimitResponse(error);
  }

  const admin = (await import("@/lib/supabase")).getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const invite = await loadCommercialInviteByEmail(admin, body.email);
  const inviteEligibility = evaluateCommercialInviteEligibility({
    invite,
    email: body.email,
    inviteToken: body.inviteToken,
  });

  const checkoutEligibility = evaluateCheckoutEligibility({
    inviteFound: Boolean(invite),
    inviteEligibilityBlockingReasons: inviteEligibility.blockingReasons,
    existingCheckoutSessionId: invite?.checkoutSessionId,
    existingCheckoutStartedAt: invite?.checkoutStartedAt,
  });

  if (!checkoutEligibility.allowed) {
    return NextResponse.json(
      {
        error: "invite_not_eligible_for_checkout",
        blockingReasons: checkoutEligibility.blockingReasons,
      },
      { status: 403 },
    );
  }

  const stripeClient = createStripeBillingClient(billingConfig);
  const appUrl = billingConfig.appUrl!;

  if (checkoutEligibility.reuseExistingSession && checkoutEligibility.existingCheckoutSessionId) {
    const existing = await stripeClient.retrieveCheckoutSession(
      checkoutEligibility.existingCheckoutSessionId,
    );
    return NextResponse.json({
      checkoutUrl: existing.checkoutUrl,
      sessionId: existing.sessionId,
      reused: true,
    });
  }

  const session = await stripeClient.createCheckoutSession({
    normalizedEmail: inviteEligibility.normalizedEmail,
    commercialInviteId: invite!.id,
    successUrl: `${appUrl}/purchase/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/purchase/cancel`,
  });

  await markCommercialInviteCheckoutStarted(admin, {
    inviteId: invite!.id,
    checkoutSessionId: session.sessionId,
  });

  if (invite!.tenantId) {
    await ensureTenantEntitlementCheckoutStarted(admin, {
      tenantId: invite!.tenantId,
      commercialInviteId: invite!.id,
      checkoutSessionId: session.sessionId,
    });
  }

  return NextResponse.json({
    checkoutUrl: session.checkoutUrl,
    sessionId: session.sessionId,
    reused: false,
  });
}
