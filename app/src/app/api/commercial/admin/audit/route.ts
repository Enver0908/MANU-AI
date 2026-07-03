import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  isCommercialAdminStoreConfigured,
  listCommercialAdminAuditEvents,
  listCommercialOnboardingAuditEvents,
} from "@/lib/commercial-admin-store";
import { getSupabaseAdminClient } from "@/lib/supabase";

function adminUnauthorized(blockingReasons: string[]) {
  return NextResponse.json(
    { error: "commercial_admin_unauthorized", blockingReasons },
    { status: 401 },
  );
}

function adminUnavailable() {
  return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
}

export async function GET(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (!isCommercialAdminStoreConfigured()) {
    return adminUnavailable();
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const safeLimit = Number.isFinite(limit) ? limit : 50;

  const [adminAudit, onboardingAudit] = await Promise.all([
    listCommercialAdminAuditEvents(admin, { limit: safeLimit }),
    listCommercialOnboardingAuditEvents(admin, { limit: safeLimit }),
  ]);

  return NextResponse.json({
    adminAudit,
    onboardingAudit,
  });
}
