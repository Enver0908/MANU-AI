import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertActiveCommercialEntitlement } from "./commercial-entitlement-access";
import {
  assertShellSessionActivity,
  readVerifiedSessionIdFromAccessToken,
  touchShellSessionActivity,
} from "./phase-85-stage-5-shell-session";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase";
import type { TenantRole } from "./types";
import { hasCapability, type AppCapability } from "./app-capability-contracts";

export { hasCapability, type AppCapability } from "./app-capability-contracts";

export type AppTenantContext = {
  tenantId: string;
  dietitianId: string;
  userId: string;
  role: TenantRole;
};

export type AccountTenantContext = AppTenantContext & {
  supabase: SupabaseClient;
  sessionId: string;
};

export type ResolveAccountTenantContextOptions = {
  recordSessionActivity?: boolean;
};

export class AppAuthError extends Error {
  status: 400 | 401 | 403;

  constructor(status: 400 | 401 | 403, message: string) {
    super(message);
    this.name = "AppAuthError";
    this.status = status;
  }
}

export async function resolveAppTenantContext(): Promise<AppTenantContext> {
  const accountContext = await resolveAccountTenantContext();
  await assertActiveCommercialEntitlement(accountContext.tenantId);
  return {
    tenantId: accountContext.tenantId,
    dietitianId: accountContext.dietitianId,
    userId: accountContext.userId,
    role: accountContext.role,
  };
}

/**
 * Activity-endpoint resolver only. Records interactive session touch but cannot unlock
 * an already locked session.
 */
export async function resolveAccountTenantContextForSessionActivity(): Promise<AccountTenantContext> {
  return resolveAccountTenantContext({ recordSessionActivity: true });
}

export async function resolveAccountTenantContext(
  options: ResolveAccountTenantContextOptions = {},
): Promise<AccountTenantContext> {
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

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const verifiedSessionId = readVerifiedSessionIdFromAccessToken(session?.access_token);
  if (sessionError || !verifiedSessionId) {
    throw new AppAuthError(401, "session_claim_missing");
  }

  const sessionActivity = options.recordSessionActivity
    ? await touchShellSessionActivity(supabase)
    : await assertShellSessionActivity(supabase);

  const context = {
    tenantId: membership.data.tenant_id,
    dietitianId: dietitian.data.id,
    userId: user.id,
    role: membership.data.role as TenantRole,
    sessionId: sessionActivity.sessionId || verifiedSessionId,
    supabase,
  };

  return context;
}

export function requireCapability(context: AppTenantContext, capability: AppCapability) {
  if (!hasCapability(context.role, capability)) {
    if (capability === "internal_copilot_chat") {
      throw new AppAuthError(403, "internal_copilot_forbidden");
    }
    if (capability === "dietitian_ai_chat") {
      throw new AppAuthError(403, "dietitian_ai_chat_forbidden");
    }
    throw new AppAuthError(403, `rbac_forbidden_${capability}`);
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AppAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
