import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { insertAccountSecurityEvent } from "@/lib/account-security-store";
import { resolveAppTenantContext } from "@/lib/auth-context";
import {
  createMutableSupabaseServerClient,
  resolveAuthRouteIpKey,
} from "@/lib/phase-85-stage-4d-auth-server";
import {
  ACCOUNT_SECURITY_RATE_LIMITS,
  AccountSecurityValidationError,
  buildAccountSecurityIdempotencyKey,
  mapSupabaseAuthErrorMessage,
  validatePasswordPair,
  validateNonce,
} from "@/lib/phase-85-stage-4d-account-security";
import { assertRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase";

type PasswordBody = {
  password?: string;
  passwordConfirmation?: string;
  nonce?: string;
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

  let tenantContext: Awaited<ReturnType<typeof resolveAppTenantContext>> | null = null;
  try {
    tenantContext = await resolveAppTenantContext();
  } catch {
    tenantContext = null;
  }

  const hasNonce = typeof body.nonce === "string" && body.nonce.trim().length > 0;
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
      eventType: hasNonce ? "password_updated" : "recovery_password_set",
      outcome: "failure",
      idempotencyKey: buildAccountSecurityIdempotencyKey(
        hasNonce ? "password_updated" : "recovery_password_set",
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
    eventType: hasNonce ? "password_updated" : "recovery_password_set",
    outcome: "success",
    idempotencyKey: buildAccountSecurityIdempotencyKey(
      hasNonce ? "password_updated" : "recovery_password_set",
      user.id,
    ),
  });

  const response = NextResponse.json({
    updated: true,
    auditPersisted: audit.persisted,
    ...(audit.persisted ? {} : { auditWarning: "audit_persist_failed" }),
  });
  return applyAuthMutations(response);
}
