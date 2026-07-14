import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import {
  extractWebhookPayloadAndSecret,
  isCanonicalMockWebhookGateEnabled,
  resolveWebhookStatusCode,
  STAGE_4B3_MOCK_WEBHOOK_SECRET_HEADER,
} from "@/lib/phase-85-stage-4b3-canonical-ingress";
import { isMockWhatsAppWebhookEnabled } from "@/lib/whatsapp-mock-webhook";
import { isSupabaseStoreConfigured, runSupabaseSecureWhatsAppIngress } from "@/lib/supabase-store";

export async function GET() {
  if (!isMockWhatsAppWebhookEnabled()) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }

  return NextResponse.json({ error: "mock_webhook_post_only" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  if (!isMockWhatsAppWebhookEnabled()) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { sanitizedPayload, providedSecret } = extractWebhookPayloadAndSecret(
    payload,
    request.headers.get(STAGE_4B3_MOCK_WEBHOOK_SECRET_HEADER),
  );

  if (!isCanonicalMockWebhookGateEnabled(process.env, providedSecret)) {
    return NextResponse.json({ error: "secure_ingress_gate_disabled" }, { status: 403 });
  }

  try {
    if (isSupabaseStoreConfigured()) {
      const secure = await runSupabaseSecureWhatsAppIngress(sanitizedPayload, providedSecret);
      return NextResponse.json(secure.webhookResult, {
        status: resolveWebhookStatusCode(secure.ingress, secure.webhookResult),
      });
    }

    const before = getFallbackState();
    const { processCanonicalWhatsAppIngressInState } = await import("@/lib/phase-85-stage-4b3-canonical-ingress");
    const { state, result, ingress } = await processCanonicalWhatsAppIngressInState(before, sanitizedPayload, {
      providedSecret,
      bootstrapDemoBindings: true,
    });
    if (ingress.ok) {
      saveFallbackState(state);
    }
    return NextResponse.json(result, { status: resolveWebhookStatusCode(ingress, result) });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
