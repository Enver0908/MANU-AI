import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  isCommercialAdminStoreConfigured,
  listCommercialAdminSubscriptionSummaries,
} from "@/lib/commercial-admin-store";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
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

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
  }

  const subscriptions = await listCommercialAdminSubscriptionSummaries(admin);
  return NextResponse.json({ subscriptions });
}
