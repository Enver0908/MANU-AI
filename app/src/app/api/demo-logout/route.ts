import { NextResponse } from "next/server";
import { insertAccountSecurityEvent } from "@/lib/account-security-store";
import { createMutableSupabaseServerClient } from "@/lib/phase-85-stage-4d-auth-server";
import { buildAccountSecurityIdempotencyKey } from "@/lib/phase-85-stage-4d-account-security";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST() {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/",
    },
  });

  if (isSupabaseStoreConfigured()) {
    const { supabase, applyAuthMutations, cookieStore } = await createMutableSupabaseServerClient();
    const {
      data: { user },
    } = await supabase?.auth.getUser() ?? { data: { user: null } };

    if (supabase) {
      await supabase.auth.signOut({ scope: "local" });
    }

    if (user) {
      await insertAccountSecurityEvent({
        authUserId: user.id,
        eventType: "logout_local",
        outcome: "success",
        idempotencyKey: buildAccountSecurityIdempotencyKey("logout_local", user.id),
      }).catch(() => undefined);
    }

    applyAuthMutations(response);
    cookieStore.getAll().forEach((cookie) => {
      if (cookie.name.startsWith("sb-") || cookie.name === "manu_ai_demo_session") {
        response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
      }
    });
  }

  response.cookies.set("manu_ai_demo_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
