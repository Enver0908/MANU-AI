import { NextResponse, type NextRequest } from "next/server";
import {
  assertCommercialPublicRateLimit,
  commercialRateLimitResponse,
} from "@/lib/commercial-public-rate-limit";
import { insertCommercialLead, isCommercialLeadsStoreConfigured } from "@/lib/commercial-leads-store";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { validateCommercialLeadCreate } from "@/lib/phase-84c-contact-leads";

type ContactLeadBody = {
  contactName?: string;
  email?: string;
  clinicName?: string;
  message?: string;
  sourcePath?: string;
  companyWebsite?: string;
};

function leadAcceptedResponse() {
  return NextResponse.json({ accepted: true });
}

export async function POST(request: NextRequest) {
  let body: ContactLeadBody;
  try {
    body = (await request.json()) as ContactLeadBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const validation = validateCommercialLeadCreate(body);
  if (validation.spam) {
    return leadAcceptedResponse();
  }

  if (!validation.valid) {
    return NextResponse.json(
      { error: "validation_failed", blockingReasons: validation.blockingReasons },
      { status: 400 },
    );
  }

  if (!isCommercialLeadsStoreConfigured()) {
    return NextResponse.json({ error: "contact_leads_not_configured" }, { status: 503 });
  }

  try {
    await assertCommercialPublicRateLimit(request, "contact_leads", validation.normalizedEmail);
  } catch (error) {
    return commercialRateLimitResponse(error);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "contact_leads_not_configured" }, { status: 503 });
  }

  try {
    const lead = await insertCommercialLead(admin, {
      contactName: validation.contactName,
      normalizedEmail: validation.normalizedEmail,
      clinicName: validation.clinicName,
      message: validation.message,
      sourcePath: validation.sourcePath,
    });

    return NextResponse.json({
      accepted: true,
      leadId: lead.id,
    });
  } catch {
    return NextResponse.json({ error: "contact_lead_create_failed" }, { status: 500 });
  }
}
