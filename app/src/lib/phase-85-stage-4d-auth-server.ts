import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase";
import { headersFromGetter, resolveTrustedClientIp } from "./trusted-proxy";

type AuthCookieMutation = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export async function createMutableSupabaseServerClient() {
  const cookieStore = await cookies();
  let authCookiesToSet: AuthCookieMutation[] = [];
  let authHeadersToSet: Record<string, string> = {};

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet, headers) => {
      authCookiesToSet = cookiesToSet;
      authHeadersToSet = headers;
    },
  });

  function applyAuthMutations(response: NextResponse) {
    authCookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    Object.entries(authHeadersToSet).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  return { supabase, applyAuthMutations, cookieStore };
}

export function resolveAuthRouteIpKey(request: { headers: { get(name: string): string | null } }, suffix: string) {
  const headers = headersFromGetter((name) => request.headers.get(name));
  const decision = resolveTrustedClientIp(headers);
  return `${decision.clientIp}:${suffix}`;
}
