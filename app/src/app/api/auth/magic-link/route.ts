import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { insertCommercialOnboardingEvent } from "@/lib/commercial-onboarding-store";
import { getSupabaseConfig } from "@/lib/supabase";
import {
  buildAuthCallbackUrlWithNext,
  MAGIC_LINK_RATE_LIMIT,
  sanitizePostAuthRedirectPath,
  validateMagicLinkRequest,
} from "@/lib/phase-84d-customer-auth";
import { genericMagicLinkAcceptedResponse } from "@/lib/phase-85-stage-4d-account-security";
import { resolveAuthRouteIpKey } from "@/lib/phase-85-stage-4d-auth-server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

type MagicLinkBody = {
  email?: string;
  next?: string;
  checkoutSessionId?: string;
};

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig();
  if (!config) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: MagicLinkBody;
  try {
    body = (await request.json()) as MagicLinkBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateMagicLinkRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: validation.blockingReasons },
      { status: 400 },
    );
  }

  try {
    await assertRateLimit({
      key: resolveAuthRouteIpKey(request, validation.normalizedEmail),
      scope: "auth_magic_link",
      limit: MAGIC_LINK_RATE_LIMIT.limit,
      windowMs: MAGIC_LINK_RATE_LIMIT.windowMs,
    });
  } catch (error) {
    if (error instanceof AppDomainError && error.status === 429) {
      return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
    }
    throw error;
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  await supabase.auth.signInWithOtp({
    email: validation.normalizedEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: buildAuthCallbackUrlWithNext(body.next),
    },
  });

  const checkoutSessionId = body.checkoutSessionId?.trim() || null;
  const { getSupabaseAdminClient } = await import("@/lib/supabase");
  const admin = getSupabaseAdminClient();
  if (admin) {
    await insertCommercialOnboardingEvent(admin, {
      eventType: "magic_link_requested",
      normalizedEmail: validation.normalizedEmail,
      checkoutSessionId,
      payloadSummary: {
        next: sanitizePostAuthRedirectPath(body.next),
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    ...genericMagicLinkAcceptedResponse(),
    sent: true,
  });
}
