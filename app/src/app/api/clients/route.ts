import { NextResponse, type NextRequest } from "next/server";
import {
  buildClientCreateValidationState,
  mergeScopedClientCreateIntoAppState,
} from "@/lib/phase-79c-scoped-client-mutation";
import { createClientInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { domainErrorResponse } from "@/lib/app-errors";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { createSupabaseClientRecord, isSupabaseStoreConfigured } from "@/lib/supabase-store";
import type { Channel, SupportedLanguageCode } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    fullName?: string;
    channel?: Channel;
    channelUserId?: string;
    primaryPhoneE164?: string;
    communicationLanguage?: SupportedLanguageCode;
  };

  if (!body.fullName?.trim()) {
    return NextResponse.json({ error: "fullName_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "create_client");
      return NextResponse.json(
        await createSupabaseClientRecord(
          {
            fullName: body.fullName,
            channel: body.channel === "telegram" ? "telegram" : "whatsapp",
            channelUserId: body.channelUserId || "",
            primaryPhoneE164: body.primaryPhoneE164,
            communicationLanguage: body.communicationLanguage,
          },
          tenantContext,
        ),
      );
    } catch (error) {
      try {
        return authErrorResponse(error);
      } catch (authError) {
        return domainErrorResponse(authError);
      }
    }
  }

  try {
    const base = getFallbackState();
    const validationState = buildClientCreateValidationState(base);
    const next = createClientInState(validationState, {
      fullName: body.fullName,
      channel: body.channel === "telegram" ? "telegram" : "whatsapp",
      channelUserId: body.channelUserId || "",
      primaryPhoneE164: body.primaryPhoneE164,
      communicationLanguage: body.communicationLanguage,
    });
    const newClient = next.clients[next.clients.length - 1];
    const newConversation = next.conversations.find((item) => item.clientId === newClient.id);

    saveFallbackState(mergeScopedClientCreateIntoAppState(base, newClient, newConversation));
    return NextResponse.json({ kind: "client_create", client: newClient, conversation: newConversation });
  } catch (error) {
    return domainErrorResponse(error);
  }
}
