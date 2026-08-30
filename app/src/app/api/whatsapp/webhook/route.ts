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
import {
  evaluateWhatsAppWebhookChallenge,
  isRealWhatsAppWebhookEnabled,
  verifyWhatsAppWebhookSignature,
} from "@/lib/whatsapp-real-contracts";
import { enqueueWhatsAppRealIngress } from "@/lib/whatsapp-real-store";

export async function GET(request: NextRequest) {
  if (isRealWhatsAppWebhookEnabled()) {
    const challenge = evaluateWhatsAppWebhookChallenge(
      {
        mode: request.nextUrl.searchParams.get("hub.mode"),
        verifyToken: request.nextUrl.searchParams.get("hub.verify_token"),
        challenge: request.nextUrl.searchParams.get("hub.challenge"),
      },
      process.env.MANU_WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    );

    if (!challenge.ok) {
      return NextResponse.json({ error: challenge.code }, { status: challenge.status });
    }

    return new NextResponse(challenge.challenge, {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (!isMockWhatsAppWebhookEnabled()) {
    return NextResponse.json({ error: "disabled" }, { status: 403 });
  }

  return NextResponse.json({ error: "mock_webhook_post_only" }, { status: 405 });
}

export async function POST(request: NextRequest) {
  if (isRealWhatsAppWebhookEnabled()) {
    const rawBody = await request.text();
    const signature = verifyWhatsAppWebhookSignature({
      rawBody,
      signatureHeader: request.headers.get("x-hub-signature-256"),
      appSecret: process.env.MANU_WHATSAPP_APP_SECRET,
    });
    if (!signature.ok) {
      return NextResponse.json({ error: signature.code }, { status: 401 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const queued = await enqueueWhatsAppRealIngress({ rawBody, payload });
    if (!queued.ok) {
      return NextResponse.json({ error: queued.code, reason: queued.reason }, { status: queued.status });
    }

    return NextResponse.json(
      {
        accepted: true,
        queued: queued.queued,
        duplicates: queued.duplicates,
        quarantined: queued.quarantined,
        ignored: queued.ignored,
      },
      { status: 200 },
    );
  }

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
