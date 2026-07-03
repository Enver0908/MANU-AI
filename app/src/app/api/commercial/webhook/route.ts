import { NextResponse, type NextRequest } from "next/server";
import {
  applyStripeWebhookProcessResult,
  isCommercialBillingStoreConfigured,
  loadBillingLedgerEntryByStripeEventId,
} from "@/lib/commercial-billing-store";
import {
  createStripeBillingClient,
  isStripeBillingConfigured,
  processStripeBillingWebhookEvent,
  resolveStripeBillingConfig,
} from "@/lib/phase-83c-stripe-billing-gate";

export const runtime = "nodejs";

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

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_stripe_signature" }, { status: 400 });
  }

  const payload = await request.text();
  const stripeClient = createStripeBillingClient(billingConfig);

  let event;
  try {
    event = stripeClient.constructWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: "invalid_stripe_signature" }, { status: 400 });
  }

  const admin = (await import("@/lib/supabase")).getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const existingLedger = await loadBillingLedgerEntryByStripeEventId(admin, event.id);
  const processed = processStripeBillingWebhookEvent({
    event,
    existingLedgerStripeEventId: existingLedger?.stripeEventId ?? null,
  });

  const applied = await applyStripeWebhookProcessResult(admin, {
    result: processed,
    stripeEventId: event.id,
  });

  return NextResponse.json({
    received: true,
    duplicate: applied.duplicate,
    applied: applied.applied,
    tenantId: applied.tenantId,
    eventType: processed.eventType,
    handled: processed.handled,
  });
}
