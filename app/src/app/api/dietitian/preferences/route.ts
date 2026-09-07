import { NextResponse, type NextRequest } from "next/server";
import { authErrorResponse, requireCapability, resolveAccountTenantContext } from "@/lib/auth-context";
import {
  OwnProfileValidationError,
  parseOwnProfilePatchBody,
} from "@/lib/phase-85-stage-4d-own-profile";
import { isSupabaseStoreConfigured, updateSupabaseOwnProfile } from "@/lib/supabase-store";

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let patch;
  try {
    patch = parseOwnProfilePatchBody(body);
  } catch (error) {
    if (error instanceof OwnProfileValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ error: "profile_mutation_unavailable" }, { status: 503 });
  }

  try {
    const tenantContext = await resolveAccountTenantContext();
    requireCapability(tenantContext, "update_own_profile");
    const result = await updateSupabaseOwnProfile(patch, tenantContext, tenantContext.supabase);
    return NextResponse.json({ ...result, compatibilityEndpoint: "/api/account/profile" });
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;
      if (message === "unauthenticated" || message === "supabase_not_configured") {
        return NextResponse.json({ error: message }, { status: 401 });
      }
      if (
        message === "no_tenant_membership" ||
        message === "no_dietitian_profile" ||
        message === "rbac_forbidden_update_own_profile"
      ) {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (
        message === "invalid_display_name" ||
        message === "invalid_ui_language" ||
        message === "invalid_timezone" ||
        message === "profile_patch_empty" ||
        message === "unknown_field"
      ) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }
    return authErrorResponse(error);
  }
}
