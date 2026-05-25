import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function POST() {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/",
    },
  });

  if (isSupabaseStoreConfigured()) {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient({
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    });

    await supabase?.auth.signOut();
  }

  response.cookies.set("manu_ai_demo_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
