import { NextResponse } from "next/server";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import {
  isSupabaseStoreConfigured,
  loadSupabaseOperationalFoundationInspection,
} from "@/lib/supabase-store";

export async function GET() {
  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ error: "rbac_forbidden_read_operational_foundation" }, { status: 403 });
  }

  try {
    const tenantContext = await resolveAppTenantContext();
    requireCapability(tenantContext, "read_operational_foundation");
    return NextResponse.json(await loadSupabaseOperationalFoundationInspection(tenantContext));
  } catch (error) {
    return authErrorResponse(error);
  }
}
