import { NextResponse, type NextRequest } from "next/server";
import { getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import {
  isMockWhatsAppWebhookEnabled,
  processWhatsAppMockWebhookInState,
  whatsAppMockWebhookHttpStatus,
} from "@/lib/whatsapp-mock-webhook";
import { isSupabaseStoreConfigured, runSupabaseWhatsAppMockWebhook } from "@/lib/supabase-store";

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

  try {
    if (isSupabaseStoreConfigured()) {
      const { webhookResult } = await runSupabaseWhatsAppMockWebhook(payload);
      return NextResponse.json(webhookResult, { status: whatsAppMockWebhookHttpStatus(webhookResult) });
    }

    const before = getFallbackState();
    const { state, result } = await processWhatsAppMockWebhookInState(before, payload);
    saveFallbackState(state);
    return NextResponse.json(result, { status: whatsAppMockWebhookHttpStatus(result) });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
