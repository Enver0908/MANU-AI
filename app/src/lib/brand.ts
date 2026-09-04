import type { Metadata } from "next";

export const AIYA_BRAND_NAME = "AIya";
export const AIYA_BRAND_SLUG = "aiya";
export const AIYA_DOMAIN = "aiyaworkspace.com";
export const AIYA_APP_URL = `https://${AIYA_DOMAIN}`;
export const AIYA_ADMIN_DOMAIN = `admin.${AIYA_DOMAIN}`;
export const AIYA_ADMIN_APP_URL = `https://${AIYA_ADMIN_DOMAIN}`;
export const AIYA_PUBLIC_CONTACT_EMAIL = "contact@aiyaworkspace.com";
export const AIYA_WORKSPACE_FALLBACK_NAME = "AIya Workspace";

export const AIYA_PRODUCT_DESCRIPTION =
  "AIya supervised dietitian messaging assistant";

export const AIYA_COMPATIBILITY_BRAND_NOTES = [
  "MANU_* environment variable names remain stable operational contracts.",
  "x-siriusai-* headers, siriusai app-version metadata, and siriusai service-worker cache names remain compatibility identities.",
  "Historical evidence documents can mention MANU-AI, SiriusAI, and siriusai.store as past-state records.",
] as const;

export const AIYA_TECHNICAL_COMPATIBILITY_NAMES = [
  "MANU_",
  "x-siriusai-",
  "siriusai-app-version",
  "siriusai-static",
  "SIRIUSAI_PUBLIC_CONTACT_EMAIL",
] as const;

export function resolveVisibleTenantDisplayName(tenantName?: string | null): string {
  const named = tenantName?.trim();
  return named || AIYA_WORKSPACE_FALLBACK_NAME;
}

function normalizeSurfacePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

function buildAbsoluteUrl(origin: string, path: string): string {
  const normalizedPath = normalizeSurfacePath(path);
  return normalizedPath === "/" ? `${origin}/` : `${origin}${normalizedPath}`;
}

function buildSurfaceMetadata(input: {
  origin: string;
  path: string;
  title: string;
  description: string;
}): Metadata {
  const url = buildAbsoluteUrl(input.origin, input.path);
  return {
    metadataBase: new URL(input.origin),
    title: input.title,
    description: input.description,
    applicationName: AIYA_BRAND_NAME,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: AIYA_BRAND_NAME,
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: input.title,
      description: input.description,
    },
  };
}

export function buildCustomerSurfaceMetadata(input: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  return buildSurfaceMetadata({
    origin: AIYA_APP_URL,
    path: input.path,
    title: input.title,
    description: input.description,
  });
}

export function buildAdminSurfaceMetadata(input: {
  path: string;
  title: string;
  description: string;
}): Metadata {
  return buildSurfaceMetadata({
    origin: AIYA_ADMIN_APP_URL,
    path: input.path,
    title: input.title,
    description: input.description,
  });
}
