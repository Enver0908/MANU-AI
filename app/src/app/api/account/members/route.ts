import { NextResponse } from "next/server";
import { authErrorResponse, resolveAccountTenantContext } from "@/lib/auth-context";
import { canManageAccountSettings } from "@/lib/phase-85-stage-4d-account-contracts";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function GET() {
  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ error: "members_unavailable" }, { status: 503 });
  }

  try {
    const tenantContext = await resolveAccountTenantContext();
    if (!canManageAccountSettings(tenantContext.role)) {
      return NextResponse.json({ error: "rbac_forbidden_read_account_members" }, { status: 403 });
    }

    const { data, error } = await tenantContext.supabase.rpc("p85_stage4d_read_account_members");
    if (error) {
      return NextResponse.json({ error: "members_read_failed" }, { status: 500 });
    }

    return NextResponse.json({ members: Array.isArray(data) ? data : [] });
  } catch (error) {
    return authErrorResponse(error);
  }
}

