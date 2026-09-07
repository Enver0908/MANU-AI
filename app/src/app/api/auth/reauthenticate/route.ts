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
  buildAccountSecurityIdempotencyKey,
  mapSupabaseAuthErrorMessage,
} from "@/lib/phase-85-stage-4d-account-security";
import { assertRateLimit } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
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
      scope: ACCOUNT_SECURITY_RATE_LIMITS.reauthenticate.scope,
      limit: ACCOUNT_SECURITY_RATE_LIMITS.reauthenticate.limit,
      windowMs: ACCOUNT_SECURITY_RATE_LIMITS.reauthenticate.windowMs,
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

  const { error } = await supabase.auth.reauthenticate();
  if (error) {
    const code = mapSupabaseAuthErrorMessage(error.message);
    await insertAccountSecurityEvent({
      tenantId: tenantContext.tenantId,
      authUserId: user.id,
      dietitianId: tenantContext.dietitianId,
      eventType: "reauthenticate_requested",
      outcome: "failure",
      idempotencyKey: buildAccountSecurityIdempotencyKey("reauthenticate_requested", user.id),
      metadata: { providerCode: code },
    });
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const audit = await insertAccountSecurityEvent({
    tenantId: tenantContext.tenantId,
    authUserId: user.id,
    dietitianId: tenantContext.dietitianId,
    eventType: "reauthenticate_requested",
    outcome: "success",
    idempotencyKey: buildAccountSecurityIdempotencyKey("reauthenticate_requested", user.id),
  });

  const response = NextResponse.json({
    sent: true,
    auditPersisted: audit.persisted,
    ...(audit.persisted ? {} : { auditWarning: "audit_persist_failed" }),
  });
  return applyAuthMutations(response);
}
