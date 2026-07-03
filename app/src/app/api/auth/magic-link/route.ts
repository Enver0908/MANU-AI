import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { isRegisteredCommercialCustomerEmail } from "@/lib/customer-auth-store";
import { insertCommercialOnboardingEvent } from "@/lib/commercial-onboarding-store";
import { getSupabaseConfig, getSupabaseAdminClient } from "@/lib/supabase";
import {
  buildAuthCallbackUrlWithNext,
  MAGIC_LINK_RATE_LIMIT,
  sanitizePostAuthRedirectPath,
  validateMagicLinkRequest,
} from "@/lib/phase-84d-customer-auth";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

type MagicLinkBody = {
  email?: string;
  next?: string;
  checkoutSessionId?: string;
};

function resolveRateLimitKey(request: NextRequest, email: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "anonymous";
  return `${ip}:${email}`;
}

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
      key: resolveRateLimitKey(request, validation.normalizedEmail),
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

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const registered = await isRegisteredCommercialCustomerEmail(admin, validation.normalizedEmail);
  if (!registered) {
    return NextResponse.json(
      {
        error: "customer_access_not_found",
        blockingReasons: ["no_registered_commercial_customer"],
      },
      { status: 403 },
    );
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await supabase.auth.signInWithOtp({
    email: validation.normalizedEmail,
    options: {
      emailRedirectTo: buildAuthCallbackUrlWithNext(body.next),
    },
  });

  if (error) {
    return NextResponse.json({ error: "magic_link_send_failed" }, { status: 500 });
  }

  const checkoutSessionId = body.checkoutSessionId?.trim() || null;
  await insertCommercialOnboardingEvent(admin, {
    eventType: "magic_link_requested",
    normalizedEmail: validation.normalizedEmail,
    checkoutSessionId,
    payloadSummary: {
      next: sanitizePostAuthRedirectPath(body.next),
    },
  }).catch(() => undefined);

  return NextResponse.json({
    sent: true,
    normalizedEmail: validation.normalizedEmail,
  });
}
