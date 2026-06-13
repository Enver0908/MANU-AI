import { NextResponse, type NextRequest } from "next/server";
import { AppDomainError } from "@/lib/app-errors";
import { domainErrorResponse } from "@/lib/app-errors";
import { getFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { getActiveClientMenuPlanV1Record, listClientMenuPlanV1Records } from "@/lib/phase-77f-client-menu-plan";
import {
  generateMenuPlanDocxBuffer,
  generateMenuPlanPdfBuffer,
} from "@/lib/phase-77j-menu-plan-export-binary";
import {
  assertMenuPlanExportEligible,
  buildClientFacingMenuPlanExportDocument,
  resolveMenuPlanExportFilename,
} from "@/lib/phase-77j-menu-plan-export";
import { isSupabaseStoreConfigured, listSupabaseClientMenuPlans } from "@/lib/supabase-store";

function parseExportFormat(value: string | null): "docx" | "pdf" {
  if (value === "pdf") return "pdf";
  if (value === "docx") return "docx";
  throw new AppDomainError(400, "menu_plan_export_invalid_format");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const format = parseExportFormat(new URL(request.url).searchParams.get("format"));
  const planId = new URL(request.url).searchParams.get("planId");
  const includeRecipes = new URL(request.url).searchParams.get("includeRecipes") !== "false";

  try {
    const state = isSupabaseStoreConfigured()
      ? await (async () => {
          const tenantContext = await resolveAppTenantContext();
          requireCapability(tenantContext, "export_client");
          return listSupabaseClientMenuPlans(id, tenantContext);
        })()
      : (() => {
          return getFallbackState();
        })();

    const client = state.clients.find((item) => item.id === id);
    if (!client || client.lifecycleStatus === "removed_anonymized") {
      throw new AppDomainError(404, "client_not_found");
    }

    const plan =
      (planId ? listClientMenuPlanV1Records(state, id).find((item) => item.id === planId) : null) ||
      getActiveClientMenuPlanV1Record(state, id);
    if (!plan) {
      throw new AppDomainError(404, "client_menu_plan_not_found");
    }

    assertMenuPlanExportEligible(plan);

    const document = buildClientFacingMenuPlanExportDocument(client, plan, { includeRecipes });
    const buffer =
      format === "pdf" ? await generateMenuPlanPdfBuffer(document) : await generateMenuPlanDocxBuffer(document);
    const filename = resolveMenuPlanExportFilename(client.fullName, plan.title, format);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    try {
      return authErrorResponse(error);
    } catch (authError) {
      return domainErrorResponse(authError);
    }
  }
}
