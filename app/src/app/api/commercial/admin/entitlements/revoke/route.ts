import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  isCommercialAdminStoreConfigured,
  recordCommercialAdminOperationBlocked,
  revokeCommercialAdminEntitlement,
} from "@/lib/commercial-admin-store";
import { validateCommercialAdminEntitlementRevokeRequest } from "@/lib/phase-83f-commercial-admin";
import { getSupabaseAdminClient } from "@/lib/supabase";

type RevokeEntitlementBody = {
  tenantId?: string;
  mobileInstallOnly?: boolean;
};

export async function POST(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "commercial_admin_unauthorized", blockingReasons: access.blockingReasons },
      { status: 401 },
    );
  }
  if (!isCommercialAdminStoreConfigured()) {
    return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
  }

  let body: RevokeEntitlementBody;
  try {
    body = (await request.json()) as RevokeEntitlementBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateCommercialAdminEntitlementRevokeRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.blockingReasons[0], blockingReasons: validation.blockingReasons },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
  }

  try {
    const result = await revokeCommercialAdminEntitlement(admin, {
      tenantId: validation.tenantId ?? "",
      actorSummary: access.actorSummary ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "entitlement_revoke_failed";
    await recordCommercialAdminOperationBlocked(admin, {
      operation: "entitlement_revoke",
      blockingReasons: [message],
      targetTenantId: validation.tenantId,
      actorSummary: access.actorSummary ?? undefined,
    }).catch(() => undefined);
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
