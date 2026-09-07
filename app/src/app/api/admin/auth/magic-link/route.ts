import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError, apiErrorResponse, createApiRequestId, rateLimitErrorResponse } from "@/lib/app-errors";
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
import { resolveAuthRouteIpKey } from "@/lib/phase-85-stage-4d-auth-server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@supabase/supabase-js";

type AdminMagicLinkBody = {
  email?: string;
};

export async function POST(request: NextRequest) {
  const requestId = createApiRequestId();
  const config = getSupabaseConfig();
  if (!config) {
    return apiErrorResponse("auth_not_configured", 503, requestId);
  }

  let body: AdminMagicLinkBody;
  try {
    body = (await request.json()) as AdminMagicLinkBody;
  } catch {
    return apiErrorResponse("invalid_json", 400, requestId);
  }

  const validation = validateMagicLinkRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "validation_failed", requestId, blockingReasons: validation.blockingReasons },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const allowlist = evaluateAdminAllowlistAccess(
    validation.normalizedEmail,
    resolveAdminEmailAllowlist(),
  );
  if (!allowlist.allowed) {
    return NextResponse.json(
      { error: "admin_access_denied", requestId, blockingReasons: allowlist.blockingReasons },
      { status: 403, headers: { "Cache-Control": "no-store" } },
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
      return rateLimitErrorResponse(requestId);
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
    if (error.status === 429) {
      return rateLimitErrorResponse(requestId);
    }
    const status = error.status === 503 ? 503 : 500;
    return apiErrorResponse("magic_link_send_failed", status, requestId);
  }

  return NextResponse.json(
    {
      sent: true,
      normalizedEmail: validation.normalizedEmail,
      requestId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
