import { resolveTrustedHost } from "./trusted-proxy";

/**
 * Local-only demo fixture gates. Hosted Supabase paths must not seed demo data.
 */

export function isLocalDemoFixtureEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NODE_ENV === "development" && env.MANU_ALLOW_PUBLIC_DEMO_LOGIN === "true";
}

export function isLocalhostHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
}

export function isLocalDemoLoginAllowed(
  env: Record<string, string | undefined> = process.env,
  hostname?: string | null,
): boolean {
  if (!isLocalDemoFixtureEnabled(env)) {
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
