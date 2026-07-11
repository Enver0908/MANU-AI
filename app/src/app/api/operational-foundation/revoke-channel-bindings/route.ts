import { NextResponse } from "next/server";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { isSupabaseStoreConfigured, revokeSupabaseTenantChannelBindings } from "@/lib/supabase-store";

export async function POST() {
  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ error: "rbac_forbidden_revoke_tenant_channel_bindings" }, { status: 403 });
  }

  try {
    const tenantContext = await resolveAppTenantContext();
    requireCapability(tenantContext, "revoke_tenant_channel_bindings");
    return NextResponse.json(await revokeSupabaseTenantChannelBindings(tenantContext));
  } catch (error) {
    return authErrorResponse(error);
  }
}
