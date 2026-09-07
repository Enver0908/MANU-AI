import { resolveTrustedHost } from "./trusted-proxy";

/**
 * Local-only demo fixture gates. Hosted Supabase paths must not seed demo data.
 */

const LOCAL_SUPABASE_API_URL = /^https?:\/\/(?:127\.0\.0\.1|localhost):54321(?:\/)?$/i;

export function isLocalSupabaseApiUrl(url: string | undefined): boolean {
  return LOCAL_SUPABASE_API_URL.test(String(url ?? "").trim());
}

export function isLocalDemoFixtureEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const localApiUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  // Vitest sets NODE_ENV=test. Local RLS/store suites still need to reseed the demo tenant
  // after resetSupabaseState(); hosted URLs stay fail-closed.
  if (env.NODE_ENV === "test" && isLocalSupabaseApiUrl(localApiUrl)) {
    return true;
  }
  return isPublicDemoLoginFlagEnabled(env);
}

export function isLocalhostHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
}

export function isPublicDemoLoginFlagEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "development" && env.MANU_ALLOW_PUBLIC_DEMO_LOGIN === "true";
}

export function isLocalDemoLoginAllowed(
  env: Record<string, string | undefined> = process.env,
  hostname?: string | null,
): boolean {
  if (!isPublicDemoLoginFlagEnabled(env)) {
    return false;
  }
  if (!hostname) {
    return false;
  }
  return isLocalhostHostname(hostname);
}

export function resolveRequestHostname(
  headers: Headers,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const directHost = headers.get("host") || "";
  return resolveTrustedHost(headers, directHost, env).host;
}
