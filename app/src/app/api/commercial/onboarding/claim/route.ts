import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isCommercialBillingStoreConfigured } from "@/lib/commercial-billing-store";
import {
  claimCommercialOnboardingWorkspace,
  insertCommercialOnboardingEvent,
  loadOnboardingClaimEvaluation,
} from "@/lib/commercial-onboarding-store";
import { createSupabaseServerClient, getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { validateOnboardingClaimReference } from "@/lib/phase-84e-customer-onboarding";

type ClaimBody = {
  sessionId?: string;
  inviteId?: string;
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

  const referenceValidation = validateOnboardingClaimReference(body);
  if (!referenceValidation.valid || !referenceValidation.reference) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: referenceValidation.blockingReasons },
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

  const claimReference = referenceValidation.reference;
  const { invite, evaluation } = await loadOnboardingClaimEvaluation(admin, {
    reference: claimReference,
    userId: user.id,
    userEmail: user.email,
    isAuthenticated: true,
  });

  if (!evaluation.claimable) {
    await insertCommercialOnboardingEvent(admin, {
      eventType: "claim_blocked",
      normalizedEmail: user.email,
      authUserId: user.id,
      commercialInviteId: evaluation.commercialInviteId,
      tenantId: evaluation.tenantId,
      checkoutSessionId: claimReference.sessionId,
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
      checkoutSessionId: claimReference.sessionId,
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
      checkoutSessionId: claimReference.sessionId,
      payloadSummary: { error: message },
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
