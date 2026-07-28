import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";
import { resolveMobileInstallAccess } from "@/lib/commercial-install-access";
import {
  isMobileInstallAuditEventType,
  sanitizeMobileInstallUserAgentSummary,
} from "@/lib/phase-83d-pwa-install-gate";

type AuditBody = {
  eventType?: string;
};

export async function POST(request: NextRequest) {
  if (!isSupabaseStoreConfigured()) {
    return NextResponse.json({ error: "commercial_billing_not_configured" }, { status: 503 });
  }

  const access = await resolveMobileInstallAccess();
  if (access.gate !== "granted") {
    return NextResponse.json({ error: "mobile_install_not_allowed" }, { status: 403 });
  }

  let body: AuditBody;
  try {
    body = (await request.json()) as AuditBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.eventType || !isMobileInstallAuditEventType(body.eventType)) {
    return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });

  if (!supabase) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const userAgentSummary = sanitizeMobileInstallUserAgentSummary(
    request.headers.get("user-agent") || "unknown",
  );

  const { error } = await supabase.from("mobile_install_audit_events").insert({
    tenant_id: access.tenantId,
    dietitian_id: access.dietitianId,
    auth_user_id: user.id,
    event_type: body.eventType,
    user_agent_summary: userAgentSummary,
  });

  if (error) {
    return NextResponse.json({ error: "audit_insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ recorded: true, eventType: body.eventType });
}
