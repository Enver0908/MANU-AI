import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase";

export type AppTenantContext = {
  tenantId: string;
  dietitianId: string;
  userId: string;
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
    .select("tenant_id")
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

  return {
    tenantId: membership.data.tenant_id,
    dietitianId: dietitian.data.id,
    userId: user.id,
  };
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AppAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  throw error;
}
