import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loadCommercialEntitlementStatusForTenant } from "@/lib/commercial-entitlement-access";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export type AuthState =
  | {
      status: "authenticated";
      tenantId: string;
      dietitianId: string;
      displayName: string;
      role: string;
      entitlementStatus: CommercialEntitlementStatus | null;
    }
  | { status: "no_membership" }
  | { status: "no_dietitian_profile"; tenantId: string }
  | { status: "unauthenticated" }
  | { status: "fallback_demo" };

export async function GET() {
  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ status: "fallback_demo" } satisfies AuthState);
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ status: "unauthenticated" } satisfies AuthState);
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
    return NextResponse.json({ status: "unauthenticated" } satisfies AuthState);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ status: "unauthenticated" } satisfies AuthState);
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ status: "no_membership" } satisfies AuthState);
  }

  const { data: dietitian } = await supabase
    .from("dietitians")
    .select("id, display_name")
    .eq("tenant_id", membership.tenant_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!dietitian) {
    return NextResponse.json({
      status: "no_dietitian_profile",
      tenantId: membership.tenant_id,
    } satisfies AuthState);
  }

  return NextResponse.json({
    status: "authenticated",
    tenantId: membership.tenant_id,
    dietitianId: dietitian.id,
    displayName: dietitian.display_name || user.email || "Dietitian",
    role: membership.role || "member",
    entitlementStatus: await loadCommercialEntitlementStatusForTenant(membership.tenant_id),
  } satisfies AuthState);
}
