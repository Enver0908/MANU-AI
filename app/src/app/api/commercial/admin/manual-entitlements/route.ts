import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAllowlistSessionAccess } from "@/lib/commercial-admin-access";
import {
  applyCommercialAdminManualEntitlement,
  isCommercialAdminStoreConfigured,
  recordCommercialAdminOperationBlocked,
} from "@/lib/commercial-admin-store";
import { validateCommercialAdminManualEntitlementRequest } from "@/lib/phase-83f-commercial-admin";
import { getSupabaseAdminClient } from "@/lib/supabase";

type ManualEntitlementBody = {
  action?: string;
  inviteId?: string;
  paymentReference?: string;
  paidThrough?: string;
  requestId?: string;
  expectedRevision?: number | null;
};

function adminUnauthorized(blockingReasons: string[]) {
  return NextResponse.json(
    { error: "commercial_admin_unauthorized", blockingReasons },
    { status: 401 },
  );
}

function adminUnavailable() {
  return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const access = await evaluateCommercialAdminAllowlistSessionAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "origin_mismatch", blockingReasons: ["same_origin_required"] },
      { status: 403 },
    );
  }
  if (!isCommercialAdminStoreConfigured()) {
    return adminUnavailable();
  }

  let body: ManualEntitlementBody;
  try {
    body = (await request.json()) as ManualEntitlementBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateCommercialAdminManualEntitlementRequest(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.blockingReasons[0], blockingReasons: validation.blockingReasons },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  try {
    const result = await applyCommercialAdminManualEntitlement(admin, {
      action: validation.action!,
      inviteId: validation.inviteId!,
      paymentReference: validation.paymentReference!,
      paidThrough: validation.paidThrough!,
      requestId: validation.requestId!,
      expectedRevision: validation.expectedRevision,
      actorSummary: access.actorSummary ?? undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "manual_entitlement_failed";
    await recordCommercialAdminOperationBlocked(admin, {
      operation: "manual_entitlement",
      blockingReasons: [message],
      targetInviteId: validation.inviteId,
      actorSummary: access.actorSummary ?? undefined,
    }).catch(() => undefined);

    const status = message.includes("not_found") ? 404 : message.includes("conflict") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
