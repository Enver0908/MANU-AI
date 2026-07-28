import { NextResponse, type NextRequest } from "next/server";
import { authErrorResponse, resolveAccountTenantContext } from "@/lib/auth-context";
import {
  AccountContractValidationError,
  canManageAccountSettings,
  mapAccountWorkspaceRpcError,
  parseAccountWorkspacePatchBody,
} from "@/lib/phase-85-stage-4d-account-contracts";
import { buildFallbackSettingsAccountReadModel } from "@/lib/phase-85-stage-4d-settings-contracts";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

export async function GET() {
  if (!isSupabaseStoreConfigured()) {
    const model = buildFallbackSettingsAccountReadModel();
    return NextResponse.json({ workspace: model.workspace, runtime: model.runtime });
  }

  let tenantContext;
  try {
    tenantContext = await resolveAccountTenantContext();
  } catch (error) {
    return authErrorResponse(error);
  }

  const { data, error } = await tenantContext.supabase
    .from("tenants")
    .select("name, settings_revision")
    .eq("id", tenantContext.tenantId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "workspace_read_failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "no_tenant_membership" }, { status: 403 });
  }

  return NextResponse.json({
    workspace: {
      name: data.name,
      settingsRevision: typeof data.settings_revision === "number" ? data.settings_revision : 0,
      role: tenantContext.role,
      membershipActive: true,
    },
  });
}

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let patch;
  try {
    patch = parseAccountWorkspacePatchBody(body);
  } catch (error) {
    if (error instanceof AccountContractValidationError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    throw error;
  }

  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ error: "workspace_mutation_unavailable" }, { status: 503 });
  }

  try {
    const tenantContext = await resolveAccountTenantContext();
    if (!canManageAccountSettings(tenantContext.role)) {
      return NextResponse.json({ error: "rbac_forbidden_manage_account_settings" }, { status: 403 });
    }

    const { data, error } = await tenantContext.supabase.rpc("p85_stage4d_update_account_workspace", {
      p_name: patch.name,
      p_expected_settings_revision: patch.expectedSettingsRevision,
    });
    if (error) {
      const code = mapAccountWorkspaceRpcError(error.message);
      const status = code === "settings_revision_conflict" ? 409 : code.startsWith("invalid_") ? 400 : 403;
      return NextResponse.json({ error: code }, { status });
    }

    return NextResponse.json({ workspace: data });
  } catch (error) {
    return authErrorResponse(error);
  }
}

