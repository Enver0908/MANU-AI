import { NextResponse, type NextRequest } from "next/server";
import { evaluateCommercialAdminAccess } from "@/lib/commercial-admin-access";
import {
  isCommercialLeadsStoreConfigured,
  listCommercialLeads,
  updateCommercialLeadStatus,
} from "@/lib/commercial-leads-store";
import { recordCommercialAdminLeadStatusUpdate } from "@/lib/commercial-admin-store";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  type CommercialLeadStatus,
  validateCommercialLeadStatusUpdate,
} from "@/lib/phase-84c-contact-leads";

type UpdateLeadBody = {
  leadId?: string;
  status?: string;
};

function adminUnauthorized(blockingReasons: string[]) {
  return NextResponse.json(
    { error: "commercial_admin_unauthorized", blockingReasons },
    { status: 401 },
  );
}

function adminUnavailable() {
  return NextResponse.json({ error: "commercial_admin_not_configured" }, { status: 503 });
}

export async function GET(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (!isCommercialLeadsStoreConfigured()) {
    return adminUnavailable();
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && ["new", "contacted", "closed"].includes(statusParam)
      ? (statusParam as CommercialLeadStatus)
      : null;

  try {
    const leads = await listCommercialLeads(admin, {
      limit: Number.isFinite(limit) ? limit : 50,
      status,
    });
    return NextResponse.json({ leads });
  } catch {
    return NextResponse.json({ error: "commercial_leads_load_failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const access = await evaluateCommercialAdminAccess(request);
  if (!access.allowed) {
    return adminUnauthorized(access.blockingReasons);
  }
  if (!isCommercialLeadsStoreConfigured()) {
    return adminUnavailable();
  }

  let body: UpdateLeadBody;
  try {
    body = (await request.json()) as UpdateLeadBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateCommercialLeadStatusUpdate(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: validation.blockingReasons },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return adminUnavailable();
  }

  try {
    const { data: existingRow } = await admin
      .from("commercial_leads")
      .select("status, normalized_email")
      .eq("id", validation.leadId)
      .maybeSingle();

    const lead = await updateCommercialLeadStatus(admin, {
      leadId: validation.leadId,
      status: validation.status,
    });

    if (existingRow) {
      await recordCommercialAdminLeadStatusUpdate(admin, {
        leadId: lead.id,
        previousStatus: existingRow.status as string,
        nextStatus: lead.status,
        normalizedEmail: lead.normalizedEmail,
        actorSummary: access.actorSummary ?? undefined,
      });
    }

    return NextResponse.json({ lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "lead_update_failed";
    const status = message === "lead_not_found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
