import { NextResponse, type NextRequest } from "next/server";
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
    const nextState = createClientInState(getFallbackState(), {
      fullName: body.fullName,
      channel: body.channel === "telegram" ? "telegram" : "whatsapp",
      channelUserId: body.channelUserId || "",
      primaryPhoneE164: body.primaryPhoneE164,
      communicationLanguage: body.communicationLanguage,
    });

    return NextResponse.json(saveFallbackState(nextState));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
