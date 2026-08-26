export type TrustedProxyDecision = {
  trusted: boolean;
  host: string;
  clientIp: string;
  source: "direct" | "trusted-proxy";
};

export const TRUSTED_PROXY_SENTINEL_HEADER = "x-manu-trusted-proxy";
export const TRUSTED_PROXY_SENTINEL_VALUE = "nginx";

export function shouldTrustProxyHeaders(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.MANU_TRUST_PROXY_HEADERS === "true";
}

export function stripHostPort(host: string): string {
  return host.split(",")[0]?.trim().split(":")[0]?.trim() ?? "";
}

function firstForwardedHop(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

export function hasTrustedProxySentinel(headers: Headers): boolean {
  return headers.get(TRUSTED_PROXY_SENTINEL_HEADER)?.trim() === TRUSTED_PROXY_SENTINEL_VALUE;
}

export function isTrustedProxyHeaderRequest(
  headers: Headers,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return shouldTrustProxyHeaders(env) && hasTrustedProxySentinel(headers);
}

export function resolveTrustedHost(
  headers: Headers,
  directHost: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): TrustedProxyDecision {
  const host = stripHostPort(directHost);
  if (!isTrustedProxyHeaderRequest(headers, env)) {
    return {
      trusted: false,
      host,
      clientIp: "anonymous",
      source: "direct",
    };
  }

  const forwardedHost = stripHostPort(headers.get("x-forwarded-host") ?? "");
  return {
    trusted: true,
    host: forwardedHost || host,
    clientIp: firstForwardedHop(headers) || "anonymous",
    source: "trusted-proxy",
  };
}

export function resolveTrustedClientIp(
  headers: Headers,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): TrustedProxyDecision {
  if (!isTrustedProxyHeaderRequest(headers, env)) {
    return {
      trusted: false,
      host: "",
      clientIp: "anonymous",
      source: "direct",
    };
  }

  const forwarded = firstForwardedHop(headers);
  return {
    trusted: true,
    host: "",
    clientIp: forwarded || "anonymous",
    source: "trusted-proxy",
  };
}

export function headersFromGetter(get: (name: string) => string | null): Headers {
  const headers = new Headers();
  for (const name of ["host", "x-forwarded-host", "x-forwarded-for", "x-real-ip", TRUSTED_PROXY_SENTINEL_HEADER]) {
    const value = get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}
