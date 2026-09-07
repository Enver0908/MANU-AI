import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { insertAccountSecurityEvent } from "@/lib/account-security-store";
import { resolveAccountTenantContext } from "@/lib/auth-context";
import {
  createMutableSupabaseServerClient,
  resolveAuthRouteIpKey,
} from "@/lib/phase-85-stage-4d-auth-server";
import {
  ACCOUNT_RECOVERY_FLOW_COOKIE_NAME,
  ACCOUNT_SECURITY_RATE_LIMITS,
  AccountSecurityValidationError,
  buildAccountSecurityIdempotencyKey,
  mapSupabaseAuthErrorMessage,
  validatePasswordPair,
  validateNonce,
  verifyAccountRecoveryFlowCookie,
} from "@/lib/phase-85-stage-4d-account-security";
import { assertRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured, getSupabaseAdminClient } from "@/lib/supabase";
import { isCommercialBillingStoreConfigured } from "@/lib/commercial-billing-store";
import { loadOnboardingClaimEvaluation, insertCommercialOnboardingEvent } from "@/lib/commercial-onboarding-store";
import {
  canSetOnboardingPassword,
  validateOnboardingClaimReference,
} from "@/lib/phase-84e-customer-onboarding";

type PasswordBody = {
  password?: string;
  passwordConfirmation?: string;
  nonce?: string;
  sessionId?: string;
  inviteId?: string;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: PasswordBody;
  try {
    body = (await request.json()) as PasswordBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let password: string;
  try {
    password = validatePasswordPair(body.password, body.passwordConfirmation);
  } catch (error) {
    if (error instanceof AccountSecurityValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const { supabase, applyAuthMutations, cookieStore } = await createMutableSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    await assertRateLimit({
      key: resolveAuthRouteIpKey(request, user.id),
      scope: ACCOUNT_SECURITY_RATE_LIMITS.passwordUpdate.scope,
      limit: ACCOUNT_SECURITY_RATE_LIMITS.passwordUpdate.limit,
      windowMs: ACCOUNT_SECURITY_RATE_LIMITS.passwordUpdate.windowMs,
    });
  } catch (error) {
    if (error instanceof AppDomainError && error.status === 429) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }
    throw error;
  }

  let tenantContext: Awaited<ReturnType<typeof resolveAccountTenantContext>> | null = null;
  try {
    tenantContext = await resolveAccountTenantContext();
  } catch {
    tenantContext = null;
  }

  const hasNonce = typeof body.nonce === "string" && body.nonce.trim().length > 0;
  const recoveryCookieValue = cookieStore.get(ACCOUNT_RECOVERY_FLOW_COOKIE_NAME)?.value;
  const hasRecoveryFlowCookie = verifyAccountRecoveryFlowCookie({
    value: recoveryCookieValue,
    authUserId: user.id,
  });
  const onboardingReference = validateOnboardingClaimReference({
    sessionId: body.sessionId,
    inviteId: body.inviteId,
  });
  const isOnboardingPasswordSetup = !hasNonce && !hasRecoveryFlowCookie && onboardingReference.valid;
  let onboardingClaimContext: {
    inviteId: string | null;
    tenantId: string | null;
    email: string;
  } | null = null;

  if (!hasNonce && !hasRecoveryFlowCookie && !isOnboardingPasswordSetup) {
    return NextResponse.json({ error: "invalid_or_expired_nonce" }, { status: 401 });
  }

  if (isOnboardingPasswordSetup) {
    if (!isCommercialBillingStoreConfigured()) {
      return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
    }
    const admin = getSupabaseAdminClient();
    if (!admin || !onboardingReference.reference) {
      return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
    }
    const { evaluation } = await loadOnboardingClaimEvaluation(admin, {
      reference: onboardingReference.reference,
      userId: user.id,
      userEmail: user.email ?? null,
      isAuthenticated: true,
    });
    if (!canSetOnboardingPassword(evaluation)) {
      return NextResponse.json(
        {
          error: evaluation.alreadyClaimed ? "invalid_or_expired_nonce" : "onboarding_password_blocked",
          blockingReasons: evaluation.blockingReasons,
        },
        { status: evaluation.alreadyClaimed ? 401 : 403 },
      );
    }
    onboardingClaimContext = {
      inviteId: evaluation.commercialInviteId,
      tenantId: evaluation.tenantId,
      email: user.email ?? "",
    };
  }

  const updatePayload = hasNonce
    ? { password, nonce: validateNonce(body.nonce) }
    : { password };

  const { error } = await supabase.auth.updateUser(updatePayload);
  if (error) {
    const code = mapSupabaseAuthErrorMessage(error.message);
    await insertAccountSecurityEvent({
      tenantId: tenantContext?.tenantId,
      authUserId: user.id,
      dietitianId: tenantContext?.dietitianId,
      eventType: hasNonce || isOnboardingPasswordSetup ? "password_updated" : "recovery_password_set",
      outcome: "failure",
      idempotencyKey: buildAccountSecurityIdempotencyKey(
        hasNonce || isOnboardingPasswordSetup ? "password_updated" : "recovery_password_set",
        user.id,
      ),
      metadata: { providerCode: code },
    });
    const status = code === "invalid_or_expired_nonce" || code === "recovery_expired" ? 401 : 400;
    return NextResponse.json({ error: code }, { status });
  }

  const audit = await insertAccountSecurityEvent({
    tenantId: tenantContext?.tenantId,
    authUserId: user.id,
    dietitianId: tenantContext?.dietitianId,
    eventType: hasNonce || isOnboardingPasswordSetup ? "password_updated" : "recovery_password_set",
    outcome: "success",
    idempotencyKey: buildAccountSecurityIdempotencyKey(
      hasNonce || isOnboardingPasswordSetup ? "password_updated" : "recovery_password_set",
      user.id,
    ),
  });

  if (isOnboardingPasswordSetup && onboardingClaimContext) {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
    }
    await insertCommercialOnboardingEvent(admin, {
      eventType: "claim_pending",
      normalizedEmail: onboardingClaimContext.email || user.email || "",
      authUserId: user.id,
      commercialInviteId: onboardingClaimContext.inviteId,
      tenantId: onboardingClaimContext.tenantId,
      checkoutSessionId: onboardingReference.reference?.sessionId ?? null,
      payloadSummary: { passwordReady: true },
    });
  }

  const response = NextResponse.json({
    updated: true,
    auditPersisted: audit.persisted,
    ...(audit.persisted ? {} : { auditWarning: "audit_persist_failed" }),
  });
  if (!hasNonce) {
    response.cookies.set(ACCOUNT_RECOVERY_FLOW_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 0,
    });
  }
  return applyAuthMutations(response);
}
