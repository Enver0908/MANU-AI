import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { AppDomainError } from "@/lib/app-errors";
import { insertAccountSecurityEvent } from "@/lib/account-security-store";
import {
  createMutableSupabaseServerClient,
  resolveAuthRouteIpKey,
} from "@/lib/phase-85-stage-4d-auth-server";
import {
  ACCOUNT_SECURITY_RATE_LIMITS,
  AccountSecurityValidationError,
  buildAccountSecurityIdempotencyKey,
  buildAccountRecoveryCallbackUrl,
  genericMagicLinkAcceptedResponse,
  validateAccountEmail,
} from "@/lib/phase-85-stage-4d-account-security";
import { resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit } from "@/lib/rate-limit";
import { getSupabaseConfig } from "@/lib/supabase";

const UNKNOWN_AUTH_USER_ID = "00000000-0000-0000-0000-000000000000";

type PasswordResetBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: PasswordResetBody = {};
  try {
    const parsed = await request.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as PasswordResetBody;
    }
  } catch {
  }

  let email: string | null = null;
  let authUserId = UNKNOWN_AUTH_USER_ID;
  let tenantId: string | undefined;
  let dietitianId: string | undefined;

  if (body.email) {
    try {
      email = validateAccountEmail(body.email);
    } catch (error) {
      if (error instanceof AccountSecurityValidationError) {
        return NextResponse.json({ error: error.code }, { status: 400 });
      }
      throw error;
    }
  } else {
    const { supabase } = await createMutableSupabaseServerClient();
    const {
      data: { user },
    } = await supabase?.auth.getUser() ?? { data: { user: null } };
    if (!user?.email) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    email = validateAccountEmail(user.email);
    authUserId = user.id;
    try {
      const tenantContext = await resolveAppTenantContext();
      tenantId = tenantContext.tenantId;
      dietitianId = tenantContext.dietitianId;
    } catch {
    }
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
    redirectTo: buildAccountRecoveryCallbackUrl(),
  });

  await insertAccountSecurityEvent({
    tenantId,
    authUserId,
    dietitianId,
    eventType: "password_reset_requested",
    outcome: "accepted",
    idempotencyKey: buildAccountSecurityIdempotencyKey("password_reset_requested", email),
  }).catch(() => undefined);

  return NextResponse.json(
    {
      accepted: true,
      message: genericMagicLinkAcceptedResponse().message,
    },
    { status: 202 },
  );
}
