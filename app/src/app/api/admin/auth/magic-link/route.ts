import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { getSupabaseConfig } from "@/lib/supabase";
import {
  MAGIC_LINK_RATE_LIMIT,
  sendMagicLinkWithRetry,
  validateMagicLinkRequest,
} from "@/lib/phase-84d-customer-auth";
import {
  buildAdminAuthCallbackUrlWithNext,
  evaluateAdminAllowlistAccess,
  resolveAdminEmailAllowlist,
} from "@/lib/phase-84f-admin-console";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

type AdminMagicLinkBody = {
  email?: string;
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

  let body: AdminMagicLinkBody;
  try {
    body = (await request.json()) as AdminMagicLinkBody;
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

  const allowlist = evaluateAdminAllowlistAccess(
    validation.normalizedEmail,
    resolveAdminEmailAllowlist(),
  );
  if (!allowlist.allowed) {
    return NextResponse.json(
      { error: "admin_access_denied", blockingReasons: allowlist.blockingReasons },
      { status: 403 },
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

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { error } = await sendMagicLinkWithRetry(() =>
    supabase.auth.signInWithOtp({
      email: validation.normalizedEmail,
      options: {
        emailRedirectTo: buildAdminAuthCallbackUrlWithNext("/admin"),
      },
    }),
  );

  if (error) {
    const status = error.status === 429 || error.status === 503 ? error.status : 500;
    return NextResponse.json({ error: "magic_link_send_failed" }, { status });
  }

  return NextResponse.json({
    sent: true,
    normalizedEmail: validation.normalizedEmail,
  });
}
