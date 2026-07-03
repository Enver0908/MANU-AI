import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  isCommercialBillingStoreConfigured,
  loadTenantEntitlementByTenantId,
} from "@/lib/commercial-billing-store";
import {
  claimCommercialOnboardingWorkspace,
  insertCommercialOnboardingEvent,
  loadCommercialInviteByCheckoutSessionId,
  loadTenantOwnerUserId,
  loadUserTenantClaimState,
} from "@/lib/commercial-onboarding-store";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  evaluateOnboardingClaim,
  validateOnboardingSessionId,
} from "@/lib/phase-84e-customer-onboarding";

type ClaimBody = {
  sessionId?: string;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured() || !isCommercialBillingStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionValidation = validateOnboardingSessionId(body.sessionId);
  if (!sessionValidation.valid) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: sessionValidation.blockingReasons },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const invite = await loadCommercialInviteByCheckoutSessionId(admin, sessionValidation.sessionId);
  const entitlement = invite?.tenantId
    ? await loadTenantEntitlementByTenantId(admin, invite.tenantId)
    : null;
  const claimState = invite?.tenantId
    ? await loadUserTenantClaimState(admin, { tenantId: invite.tenantId, userId: user.id })
    : {
        hasMembershipOnTenant: false,
        hasDietitianProfileOnTenant: false,
        dietitianTenantId: null,
      };
  const existingOwnerUserId = invite?.tenantId
    ? await loadTenantOwnerUserId(admin, invite.tenantId)
    : null;

  const evaluation = evaluateOnboardingClaim({
    sessionId: sessionValidation.sessionId,
    isAuthenticated: true,
    userId: user.id,
    userEmail: user.email,
    invite: invite
      ? {
          id: invite.id,
          normalizedEmail: invite.normalizedEmail,
          status: invite.status,
          tenantId: invite.tenantId,
          tenantSeedMetadata: invite.tenantSeedMetadata,
        }
      : null,
    entitlementStatus: entitlement?.status ?? null,
    existingOwnerUserId,
    hasMembershipOnTenant: claimState.hasMembershipOnTenant,
    hasDietitianProfileOnTenant: claimState.hasDietitianProfileOnTenant,
    dietitianTenantId: claimState.dietitianTenantId,
  });

  if (!evaluation.claimable) {
    await insertCommercialOnboardingEvent(admin, {
      eventType: "claim_blocked",
      normalizedEmail: user.email,
      authUserId: user.id,
      commercialInviteId: evaluation.commercialInviteId,
      tenantId: evaluation.tenantId,
      checkoutSessionId: sessionValidation.sessionId,
      payloadSummary: { blockingReasons: evaluation.blockingReasons },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        error: "claim_blocked",
        blockingReasons: evaluation.blockingReasons,
      },
      { status: 403 },
    );
  }

  if (evaluation.alreadyClaimed) {
    return NextResponse.json({
      claimed: true,
      alreadyClaimed: true,
      tenantId: evaluation.tenantId,
      redirectUrl: "/dashboard",
    });
  }

  try {
    const result = await claimCommercialOnboardingWorkspace(admin, {
      tenantId: evaluation.tenantId!,
      userId: user.id,
      normalizedEmail: invite!.normalizedEmail,
      commercialInviteId: invite!.id,
      checkoutSessionId: sessionValidation.sessionId,
      tenantSeedMetadata: invite!.tenantSeedMetadata,
    });

    return NextResponse.json({
      claimed: true,
      alreadyClaimed: result.alreadyClaimed,
      tenantId: result.tenantId,
      redirectUrl: "/dashboard",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "claim_failed";
    await insertCommercialOnboardingEvent(admin, {
      eventType: "claim_blocked",
      normalizedEmail: user.email,
      authUserId: user.id,
      commercialInviteId: evaluation.commercialInviteId,
      tenantId: evaluation.tenantId,
      checkoutSessionId: sessionValidation.sessionId,
      payloadSummary: { error: message },
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
