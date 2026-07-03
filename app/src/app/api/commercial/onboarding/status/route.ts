import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  isCommercialBillingStoreConfigured,
  loadTenantEntitlementByTenantId,
} from "@/lib/commercial-billing-store";
import {
  loadCommercialInviteByCheckoutSessionId,
  loadTenantOwnerUserId,
  loadUserTenantClaimState,
} from "@/lib/commercial-onboarding-store";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  evaluateOnboardingClaim,
  validateOnboardingSessionId,
} from "@/lib/phase-84e-customer-onboarding";

async function resolveAuthenticatedUser() {
  if (!isSupabaseConfigured()) {
    return null;
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
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function GET(request: NextRequest) {
  if (!isCommercialBillingStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const sessionValidation = validateOnboardingSessionId(
    request.nextUrl.searchParams.get("session_id"),
  );
  if (!sessionValidation.valid) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: sessionValidation.blockingReasons },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const invite = await loadCommercialInviteByCheckoutSessionId(admin, sessionValidation.sessionId);
  const entitlement = invite?.tenantId
    ? await loadTenantEntitlementByTenantId(admin, invite.tenantId)
    : null;

  const user = await resolveAuthenticatedUser();
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      checkoutSessionRecognized: Boolean(
        invite && invite.status === "consumed" && entitlement?.status === "active" && invite.tenantId,
      ),
      requiresAuthentication: true,
    });
  }

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
    userEmail: user.email ?? null,
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

  return NextResponse.json({
    authenticated: true,
    sessionId: sessionValidation.sessionId,
    claimable: evaluation.claimable,
    alreadyClaimed: evaluation.alreadyClaimed,
    blockingReasons: evaluation.blockingReasons,
    tenantId: evaluation.tenantId,
  });
}
