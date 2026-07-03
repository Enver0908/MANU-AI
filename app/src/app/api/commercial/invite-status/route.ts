import { NextResponse, type NextRequest } from "next/server";
import {
  assertCommercialPublicRateLimit,
  commercialRateLimitResponse,
} from "@/lib/commercial-public-rate-limit";
import {
  evaluateCommercialInviteEligibility,
  isCommercialBillingStoreConfigured,
  loadCommercialInviteByEmail,
} from "@/lib/commercial-billing-store";

type InviteStatusBody = {
  email?: string;
  inviteToken?: string;
};

export async function POST(request: NextRequest) {
  if (!isCommercialBillingStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  let body: InviteStatusBody;
  try {
    body = (await request.json()) as InviteStatusBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.email || !body.inviteToken) {
    return NextResponse.json({ error: "email_and_invite_token_required" }, { status: 400 });
  }

  try {
    await assertCommercialPublicRateLimit(request, "invite_status", body.email);
  } catch (error) {
    return commercialRateLimitResponse(error);
  }

  const admin = (await import("@/lib/supabase")).getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const invite = await loadCommercialInviteByEmail(admin, body.email);
  const eligibility = evaluateCommercialInviteEligibility({
    invite,
    email: body.email,
    inviteToken: body.inviteToken,
  });

  return NextResponse.json({
    eligible: eligibility.allowed,
    normalizedEmail: eligibility.normalizedEmail,
    blockingReasons: eligibility.blockingReasons,
  });
}
