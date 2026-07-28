import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase";

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
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "anonymous";
  return `${ip}:${suffix}`;
}
