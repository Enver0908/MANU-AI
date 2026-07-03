import type { NextRequest } from "next/server";
import { AppDomainError } from "./app-errors";
import { NextResponse } from "next/server";
import {
  COMMERCIAL_PUBLIC_RATE_LIMITS,
  type CommercialPublicRateLimitRoute,
  resolveCommercialPublicRateLimitKey,
} from "./phase-83g-entitlement-hardening";
import { assertRateLimit } from "./rate-limit";

export async function assertCommercialPublicRateLimit(
  request: NextRequest,
  route: CommercialPublicRateLimitRoute,
  email?: string,
) {
  const config = COMMERCIAL_PUBLIC_RATE_LIMITS[route];
  const scope =
    route === "invite_status"
      ? "commercial_invite_status"
      : route === "checkout_create"
        ? "commercial_checkout_create"
        : "commercial_contact_leads";

  try {
    await assertRateLimit({
      key: resolveCommercialPublicRateLimitKey(request, email),
      scope,
      limit: config.limit,
      windowMs: config.windowMs,
    });
  } catch (error) {
    if (error instanceof AppDomainError && error.status === 429) {
      throw error;
    }
    throw error;
  }
}

export function commercialRateLimitResponse(error: unknown) {
  if (error instanceof AppDomainError && error.status === 429) {
    return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
  }
  throw error;
}
