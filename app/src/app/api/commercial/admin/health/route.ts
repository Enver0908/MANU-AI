import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  buildCommercialAdminStoreHealthReport,
  classifyCommercialAdminStoreError,
  resolveCommercialAdminStoreEnv,
} from "@/lib/phase-83f-commercial-admin";
import { isStripeBillingConfigured } from "@/lib/phase-83c-stripe-billing-gate";
import { getSupabaseAdminClient } from "@/lib/supabase";

const COMMERCIAL_ADMIN_HEALTH_TABLES = [
  { table: "commercial_invites", column: "id" },
  { table: "tenant_entitlements", column: "tenant_id" },
  { table: "billing_event_ledger", column: "id" },
  { table: "commercial_admin_audit_events", column: "id" },
  { table: "commercial_leads", column: "id" },
  { table: "commercial_onboarding_events", column: "id" },
] as const;

const COMMERCIAL_ADMIN_HEALTH_PROBE_TIMEOUT_MS = 2_500;

async function withProbeTimeout<T>(probe: Promise<T>) {
  return Promise.race([
    probe,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("commercial_admin_store_probe_timeout")), COMMERCIAL_ADMIN_HEALTH_PROBE_TIMEOUT_MS);
    }),
  ]);
}

async function probeCommercialAdminTables() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { ok: false, blockingReasons: ["commercial_admin_not_configured"] };
  }

  const results = await Promise.all(COMMERCIAL_ADMIN_HEALTH_TABLES.map(async (check) => {
    try {
      const result = await withProbeTimeout<{ error: unknown }>(
        Promise.resolve(admin.from(check.table).select(check.column).limit(1)),
      );
      const { error } = result;
      if (error) {
        return `${check.table}:${classifyCommercialAdminStoreError(error)}`;
      }
      return null;
    } catch (error) {
      return `${check.table}:${classifyCommercialAdminStoreError(error)}`;
    }
  }));
  const blockingReasons = results.filter((reason): reason is string => Boolean(reason));

  return {
    ok: blockingReasons.length === 0,
    blockingReasons,
  };
}

export async function GET(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: "commercial_admin_unauthorized", blockingReasons: access.blockingReasons },
      { status: 401 },
    );
  }

  const storeEnv = resolveCommercialAdminStoreEnv();
  const probe = storeEnv.configured
    ? await probeCommercialAdminTables()
    : { ok: false, blockingReasons: ["commercial_admin_store_env_blocked"] };
  const report = buildCommercialAdminStoreHealthReport({
    gateAllowed: access.allowed,
    gateBlockingReasons: access.blockingReasons,
    storeConfigured: storeEnv.configured,
    storeBlockingReasons: storeEnv.blockingReasons,
    probeOk: probe.ok,
    probeBlockingReasons: probe.blockingReasons,
  });

  return NextResponse.json(
    {
      ...report,
      supabaseUrlConfigured: storeEnv.supabaseUrlConfigured,
      serviceRoleConfigured: storeEnv.serviceRoleConfigured,
      devFallbackStore: storeEnv.devFallbackStore,
      stripeSandboxConfigured: isStripeBillingConfigured(),
    },
    { status: report.healthy ? 200 : 503 },
  );
}
