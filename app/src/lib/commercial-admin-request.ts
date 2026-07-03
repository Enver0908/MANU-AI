import type { NextRequest } from "next/server";
import {
  evaluateCommercialAdminGate,
  resolveCommercialAdminConfig,
} from "./phase-83f-commercial-admin";

export function readCommercialAdminTokenFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  return request.headers.get("x-manu-commercial-admin-token")?.trim() ?? null;
}

export function evaluateCommercialAdminRequest(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
) {
  return evaluateCommercialAdminGate({
    allowCommercialAdmin: env.MANU_ALLOW_COMMERCIAL_ADMIN,
    configuredToken: env.MANU_COMMERCIAL_ADMIN_TOKEN,
    suppliedToken: readCommercialAdminTokenFromRequest(request),
  });
}

export function isCommercialAdminConfigured(env: NodeJS.ProcessEnv = process.env) {
  const config = resolveCommercialAdminConfig(env);
  return config.enabled && config.tokenConfigured;
}
