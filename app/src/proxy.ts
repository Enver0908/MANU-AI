import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "./lib/supabase";
import {
  isAdminHost,
  resolveAdminHostInternalPath,
  shouldRewriteAdminHostPath,
} from "./lib/phase-84f-admin-console";
import { resolveAppBaseUrl } from "./lib/phase-84d-customer-auth";

export async function proxy(request: NextRequest) {
  const hostname = request.nextUrl.hostname;
  const pathname = request.nextUrl.pathname;

  if (isAdminHost(hostname) && shouldRewriteAdminHostPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = resolveAdminHostInternalPath(pathname);
    return NextResponse.rewrite(url);
  }

  if (pathname === "/commercial-admin" || pathname === "/commercial-admin/") {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

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
      const loginUrl = new URL("/login", resolveAppBaseUrl());
      loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  const isLocalDev = hostname === "localhost" || hostname === "127.0.0.1";
  const isDemoActive = request.cookies.get("manu_ai_demo_session")?.value === "active";

  if (!isLocalDev && !isDemoActive) {
    return NextResponse.redirect(new URL("/", resolveAppBaseUrl()));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/commercial-admin/:path*",
    "/((?!api|_next|auth|favicon.ico|manifest.webmanifest|sw.js|icons).*)",
  ],
};
