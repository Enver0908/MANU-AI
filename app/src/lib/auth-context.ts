import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertActiveCommercialEntitlement } from "./commercial-entitlement-access";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase";
import type { TenantRole } from "./types";

export type AppCapability =
  | "read_app_state"
  | "reset_app_state"
  | "create_client"
  | "update_client"
  | "simulate_inbound"
  | "manual_reply"
  | "draft_review"
  | "handoff_update"
  | "notification_update"
  | "export_client"
  | "anonymize_client"
  | "release_takeover"
  | "internal_copilot_chat"
  | "read_operational_foundation"
  | "revoke_tenant_channel_bindings";

export type AppTenantContext = {
  tenantId: string;
  dietitianId: string;
  userId: string;
  role: TenantRole;
};

export class AppAuthError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AppAuthError";
    this.status = status;
  }
}

export async function resolveAppTenantContext(): Promise<AppTenantContext> {
  if (!isSupabaseConfigured()) {
    throw new AppAuthError(401, "supabase_not_configured");
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });

  if (!supabase) {
    throw new AppAuthError(401, "supabase_not_configured");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AppAuthError(401, "unauthenticated");
  }

  const membership = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership.error) {
    throw membership.error;
  }

  if (!membership.data) {
    throw new AppAuthError(403, "no_tenant_membership");
  }

  const dietitian = await supabase
    .from("dietitians")
    .select("id")
    .eq("tenant_id", membership.data.tenant_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (dietitian.error) {
    throw dietitian.error;
  }

  if (!dietitian.data) {
    throw new AppAuthError(403, "no_dietitian_profile");
  }

  const context = {
    tenantId: membership.data.tenant_id,
    dietitianId: dietitian.data.id,
    userId: user.id,
    role: membership.data.role as TenantRole,
  };

  await assertActiveCommercialEntitlement(context.tenantId);

  return context;
}

export function requireCapability(context: AppTenantContext, capability: AppCapability) {
  if (!hasCapability(context.role, capability)) {
    if (capability === "internal_copilot_chat") {
      throw new AppAuthError(403, "internal_copilot_forbidden");
    }
    throw new AppAuthError(403, `rbac_forbidden_${capability}`);
  }
}

export function hasCapability(role: TenantRole, capability: AppCapability) {
  if (capability === "read_operational_foundation" || capability === "revoke_tenant_channel_bindings") {
    return role === "owner" || role === "admin";
  }

  if (role === "owner" || role === "admin" || role === "dietitian") {
    return true;
  }

  if (role === "assistant" || role === "auditor") {
    return capability === "read_app_state";
  }

  return false;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AppAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
