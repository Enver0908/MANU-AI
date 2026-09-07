import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { insertAccountSecurityEvent } from "@/lib/account-security-store";
import { authErrorResponse, resolveAccountTenantContext } from "@/lib/auth-context";
import {
  createMutableSupabaseServerClient,
  resolveAuthRouteIpKey,
} from "@/lib/phase-85-stage-4d-auth-server";
import {
  ACCOUNT_SECURITY_RATE_LIMITS,
  AccountSecurityValidationError,
  buildAccountSecurityIdempotencyKey,
  buildEmailChangeCallbackUrl,
  mapSupabaseAuthErrorMessage,
  validateAccountEmail,
} from "@/lib/phase-85-stage-4d-account-security";
import { assertRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase";

type EmailChangeBody = {
  newEmail?: string;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: EmailChangeBody;
  try {
    body = (await request.json()) as EmailChangeBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let newEmail: string;
  try {
    newEmail = validateAccountEmail(body.newEmail);
  } catch (error) {
    if (error instanceof AccountSecurityValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const { supabase, applyAuthMutations } = await createMutableSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const currentEmail = normalizeComparableEmail(user.email);
  if (currentEmail && currentEmail === newEmail) {
    return NextResponse.json({ error: "same_email" }, { status: 400 });
  }

  try {
    await assertRateLimit({
      key: resolveAuthRouteIpKey(request, user.id),
      scope: ACCOUNT_SECURITY_RATE_LIMITS.emailChange.scope,
      limit: ACCOUNT_SECURITY_RATE_LIMITS.emailChange.limit,
      windowMs: ACCOUNT_SECURITY_RATE_LIMITS.emailChange.windowMs,
    });
  } catch (error) {
    if (error instanceof AppDomainError && error.status === 429) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }
    throw error;
  }

  let tenantContext;
  try {
    tenantContext = await resolveAccountTenantContext();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: buildEmailChangeCallbackUrl() },
  );

  if (error) {
    const code = mapSupabaseAuthErrorMessage(error.message);
    await insertAccountSecurityEvent({
      tenantId: tenantContext.tenantId,
      authUserId: user.id,
      dietitianId: tenantContext.dietitianId,
      eventType: "email_change_requested",
      outcome: "failure",
      idempotencyKey: buildAccountSecurityIdempotencyKey("email_change_requested", user.id),
      metadata: { providerCode: code },
    });
    const status = code === "email_already_registered" ? 409 : 400;
    return NextResponse.json({ error: code }, { status });
  }

  const audit = await insertAccountSecurityEvent({
    tenantId: tenantContext.tenantId,
    authUserId: user.id,
    dietitianId: tenantContext.dietitianId,
    eventType: "email_change_requested",
    outcome: "accepted",
    idempotencyKey: buildAccountSecurityIdempotencyKey("email_change_requested", user.id),
  });

  const response = NextResponse.json({
    requested: true,
    pendingVerification: true,
    auditPersisted: audit.persisted,
    ...(audit.persisted ? {} : { auditWarning: "audit_persist_failed" }),
  });
  return applyAuthMutations(response);
}

function normalizeComparableEmail(email: string | null | undefined) {
  return String(email || "").trim().toLowerCase();
}
