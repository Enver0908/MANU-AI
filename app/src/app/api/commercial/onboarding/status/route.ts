import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isCommercialBillingStoreConfigured } from "@/lib/commercial-billing-store";
import { evaluateCommercialEntitlementExpiry } from "@/lib/phase-83b-commercial-entitlement-model";
import { loadOnboardingClaimEvaluation, loadOnboardingClaimPendingState } from "@/lib/commercial-onboarding-store";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  selectInvitedEmailForStatus,
  validateOnboardingClaimReference,
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

  const referenceValidation = validateOnboardingClaimReference({
    sessionId: request.nextUrl.searchParams.get("session_id"),
    inviteId: request.nextUrl.searchParams.get("invite_id"),
  });
  if (!referenceValidation.valid || !referenceValidation.reference) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: referenceValidation.blockingReasons },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const user = await resolveAuthenticatedUser();
  const { invite, entitlement, evaluation } = await loadOnboardingClaimEvaluation(admin, {
    reference: referenceValidation.reference,
    userId: user?.id ?? null,
    userEmail: user?.email ?? null,
    isAuthenticated: Boolean(user),
  });

  const entitlementActiveNow =
    entitlement?.status === "active" &&
    evaluateCommercialEntitlementExpiry({
      entitlementStatus: entitlement.status,
      billingMethod: entitlement.billingMethod,
      paidThrough: entitlement.paidThrough,
    }).activeNow;
  if (!user) {
    return NextResponse.json({
      authenticated: false,
      checkoutSessionRecognized: Boolean(
        invite && invite.status === "consumed" && entitlementActiveNow && invite.tenantId,
      ),
      requiresAuthentication: true,
    });
  }

  const claimPending = await loadOnboardingClaimPendingState(admin, {
    authUserId: user.id,
    commercialInviteId: evaluation.commercialInviteId,
    claimable: evaluation.claimable,
    alreadyClaimed: evaluation.alreadyClaimed,
  });

  return NextResponse.json({
    authenticated: true,
    sessionId: referenceValidation.reference.sessionId,
    inviteId: referenceValidation.reference.inviteId,
    invitedEmail: selectInvitedEmailForStatus({
      isAuthenticated: true,
      userEmail: user.email ?? null,
      inviteEmail: invite?.normalizedEmail ?? null,
    }),
    claimable: evaluation.claimable,
    alreadyClaimed: evaluation.alreadyClaimed,
    passwordReady: claimPending,
    claimPending,
    blockingReasons: evaluation.blockingReasons,
    tenantId: evaluation.tenantId,
  });
}
