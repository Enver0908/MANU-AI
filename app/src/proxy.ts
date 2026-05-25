import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "./lib/supabase";

export async function proxy(request: NextRequest) {
  if (isSupabaseConfigured()) {
    let response = NextResponse.next({
      request,
    });
    const supabase = createSupabaseServerClient({
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    });

    const {
      data: { user },
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (!user) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return response;
  }

  const hostname = request.nextUrl.hostname;
  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";
  const isDemoActive = request.cookies.get("manu_ai_demo_session")?.value === "active";

  if (!isLocalDev && !isDemoActive) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
