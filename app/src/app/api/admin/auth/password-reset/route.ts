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
  validateAccountEmail,
} from "@/lib/phase-85-stage-4d-account-security";
import { buildAuthCallbackUrlWithNext } from "@/lib/phase-84d-customer-auth";
import {
  evaluateAdminAllowlistAccess,
  resolveAdminEmailAllowlist,
} from "@/lib/phase-84f-admin-console";
import { assertRateLimit } from "@/lib/rate-limit";
import { getSupabaseConfig } from "@/lib/supabase";

const UNKNOWN_AUTH_USER_ID = "00000000-0000-0000-0000-000000000000";

type AdminPasswordResetBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: AdminPasswordResetBody;
  try {
    body = (await request.json()) as AdminPasswordResetBody;
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

  const allowlist = evaluateAdminAllowlistAccess(email, resolveAdminEmailAllowlist());
  if (!allowlist.allowed) {
    return NextResponse.json(
      { error: "admin_access_denied", blockingReasons: allowlist.blockingReasons },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    await assertRateLimit({
      key: resolveAuthRouteIpKey(request, email),
      scope: ACCOUNT_SECURITY_RATE_LIMITS.passwordReset.scope,
      limit: ACCOUNT_SECURITY_RATE_LIMITS.passwordReset.limit,
      windowMs: ACCOUNT_SECURITY_RATE_LIMITS.passwordReset.windowMs,
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

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: buildAuthCallbackUrlWithNext("/account/recovery?next=/admin"),
  });

  await insertAccountSecurityEvent({
    authUserId: UNKNOWN_AUTH_USER_ID,
    eventType: "password_reset_requested",
    outcome: "accepted",
    idempotencyKey: buildAccountSecurityIdempotencyKey("password_reset_requested", email),
  }).catch(() => undefined);

  return NextResponse.json(
    {
      accepted: true,
      message: genericMagicLinkAcceptedResponse().message,
    },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
