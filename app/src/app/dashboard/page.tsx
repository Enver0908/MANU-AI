import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardApp } from "@/components/dashboard-app";
import { NoMembershipState, NoDietitianProfileState } from "@/components/auth-states";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

type DashboardAuthState =
  | { gate: "ok"; displayName: string; role: string }
  | { gate: "no_membership" }
  | { gate: "no_dietitian_profile" }
  | { gate: "fallback" };

async function resolveDashboardAuth(): Promise<DashboardAuthState> {
  if (!isSupabaseStoreConfigured() || !isSupabaseConfigured()) {
    return { gate: "fallback" };
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
    return { gate: "fallback" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { gate: "no_membership" };
  }

  const { data: dietitian } = await supabase
    .from("dietitians")
    .select("id, display_name")
    .eq("tenant_id", membership.tenant_id)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!dietitian) {
    return { gate: "no_dietitian_profile" };
  }

  return {
    gate: "ok",
    displayName: dietitian.display_name || user.email || "Dietitian",
    role: membership.role || "member",
  };
}

export default async function DashboardPage() {
  const auth = await resolveDashboardAuth();

  if (auth.gate === "no_membership") {
    return <NoMembershipState />;
  }

  if (auth.gate === "no_dietitian_profile") {
    return <NoDietitianProfileState />;
  }

  const authInfo = auth.gate === "ok" ? { displayName: auth.displayName, role: auth.role } : undefined;

  return <DashboardApp authInfo={authInfo} />;
}
