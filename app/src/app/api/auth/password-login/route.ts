import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AppDomainError } from "@/lib/app-errors";
import { insertAccountSecurityEvent } from "@/lib/account-security-store";
import { resolveAuthRouteIpKey } from "@/lib/phase-85-stage-4d-auth-server";
import {
  ACCOUNT_SECURITY_RATE_LIMITS,
  AccountSecurityValidationError,
  buildAccountSecurityIdempotencyKey,
  genericMagicLinkAcceptedResponse,
  mapSupabaseAuthErrorMessage,
  validateAccountEmail,
} from "@/lib/phase-85-stage-4d-account-security";
import { sanitizePostAuthRedirectPath } from "@/lib/phase-84d-customer-auth";
import { assertRateLimit } from "@/lib/rate-limit";
import { getSupabaseConfig } from "@/lib/supabase";

const UNKNOWN_AUTH_USER_ID = "00000000-0000-0000-0000-000000000000";

type PasswordLoginBody = {
  email?: string;
  password?: string;
  next?: string;
};

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: PasswordLoginBody;
  try {
    body = (await request.json()) as PasswordLoginBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let email: string;
  try {
    email = validateAccountEmail(body.email);
  } catch (error) {
    if (error instanceof AccountSecurityValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length < 1 || password.length > 128) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  try {
    await assertRateLimit({
      key: resolveAuthRouteIpKey(request, email),
      scope: ACCOUNT_SECURITY_RATE_LIMITS.passwordLogin.scope,
      limit: ACCOUNT_SECURITY_RATE_LIMITS.passwordLogin.limit,
      windowMs: ACCOUNT_SECURITY_RATE_LIMITS.passwordLogin.windowMs,
    });
  } catch (error) {
    if (error instanceof AppDomainError && error.status === 429) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }
    throw error;
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await insertAccountSecurityEvent({
      authUserId: UNKNOWN_AUTH_USER_ID,
      eventType: "password_login",
      outcome: "failure",
      idempotencyKey: buildAccountSecurityIdempotencyKey("password_login", email),
      metadata: { providerCode: mapSupabaseAuthErrorMessage(error?.message) },
    }).catch(() => undefined);

    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { createMutableSupabaseServerClient } = await import("@/lib/phase-85-stage-4d-auth-server");
  const { supabase: serverSupabase, applyAuthMutations } = await createMutableSupabaseServerClient();
  if (!serverSupabase) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const setSession = await serverSupabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (setSession.error) {
    return NextResponse.json({ error: "session_exchange_failed" }, { status: 500 });
  }

  await insertAccountSecurityEvent({
    authUserId: data.user.id,
    eventType: "password_login",
    outcome: "success",
    idempotencyKey: buildAccountSecurityIdempotencyKey("password_login", data.user.id),
  }).catch(() => undefined);

  const nextPath = sanitizePostAuthRedirectPath(body.next);
  const response = NextResponse.json({
    authenticated: true,
    next: nextPath ?? "/dashboard",
    message: genericMagicLinkAcceptedResponse().message,
  });
  return applyAuthMutations(response);
}
