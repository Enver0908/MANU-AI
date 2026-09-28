import { assertActiveCommercialEntitlement } from "./commercial-entitlement-access";
import {
  requireCapability,
  resolveAccountTenantContext,
  resolveAccountTenantContextForSessionActivity,
  type AccountTenantContext,
} from "./auth-context";
import { assertRateLimit, RATE_LIMITS } from "./rate-limit";
import { SHELL_API_RATE_LIMITS } from "./phase-85-stage-5-shell-contracts";
import { assertSupabaseShellStoreConfigured } from "./phase-85-stage-5-shell-store";
import { isSupabaseStoreConfigured } from "./supabase-store";

export async function resolveShellReadAccountContext(): Promise<AccountTenantContext> {
  assertSupabaseShellStoreConfigured(isSupabaseStoreConfigured());
  const context = await resolveAccountTenantContext();
  const entitlementStartedAt = performance.now();
  await assertActiveCommercialEntitlement(context.tenantId);
  requireCapability(context, "read_app_state");
  return {
    ...context,
    ...(process.env.AIYA_PERF_DIAGNOSTIC === "1"
      ? {
          authTiming: {
            ...context.authTiming,
            entitlementMs: performance.now() - entitlementStartedAt,
          },
        }
      : {}),
  };
}

export async function resolveShellSessionActivityContext(): Promise<AccountTenantContext> {
  assertSupabaseShellStoreConfigured(isSupabaseStoreConfigured());
  const context = await resolveAccountTenantContextForSessionActivity();
  const entitlementStartedAt = performance.now();
  await assertActiveCommercialEntitlement(context.tenantId);
  requireCapability(context, "read_app_state");
  return {
    ...context,
    ...(process.env.AIYA_PERF_DIAGNOSTIC === "1"
      ? {
          authTiming: {
            ...context.authTiming,
            entitlementMs: performance.now() - entitlementStartedAt,
          },
        }
      : {}),
  };
}

export async function enforceShellBootstrapRateLimit(context: AccountTenantContext) {
  await assertRateLimit({
    key: context.userId,
    scope: SHELL_API_RATE_LIMITS.bootstrap.scope,
    tenantId: context.tenantId,
    limit: SHELL_API_RATE_LIMITS.bootstrap.limit,
    windowMs: SHELL_API_RATE_LIMITS.bootstrap.windowMs,
  });
}

export async function enforceShellPreferencesRateLimit(context: AccountTenantContext) {
  await assertRateLimit({
    key: context.userId,
    scope: SHELL_API_RATE_LIMITS.preferences.scope,
    tenantId: context.tenantId,
    limit: SHELL_API_RATE_LIMITS.preferences.limit,
    windowMs: SHELL_API_RATE_LIMITS.preferences.windowMs,
  });
}

export async function enforceShellSessionActivityRateLimit(context: AccountTenantContext) {
  await assertRateLimit({
    key: context.userId,
    scope: SHELL_API_RATE_LIMITS.sessionActivity.scope,
    tenantId: context.tenantId,
    limit: RATE_LIMITS.shellSessionActivity.limit,
    windowMs: RATE_LIMITS.shellSessionActivity.windowMs,
  });
}

export async function enforceShellClientSearchRateLimit(context: AccountTenantContext) {
  await assertRateLimit({
    key: context.userId,
    scope: SHELL_API_RATE_LIMITS.clientSearch.scope,
    tenantId: context.tenantId,
    limit: SHELL_API_RATE_LIMITS.clientSearch.limit,
    windowMs: SHELL_API_RATE_LIMITS.clientSearch.windowMs,
  });
}
