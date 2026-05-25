import { NextResponse, type NextRequest } from "next/server";
import { createClientInState, getFallbackState, saveFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, resolveAppTenantContext } from "@/lib/auth-context";
import { createSupabaseClientRecord, isSupabaseStoreConfigured } from "@/lib/supabase-store";
import type { Channel } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    fullName?: string;
    channel?: Channel;
    channelUserId?: string;
  };

  if (!body.fullName?.trim()) {
    return NextResponse.json({ error: "fullName_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      return NextResponse.json(
        await createSupabaseClientRecord(
          {
            fullName: body.fullName,
            channel: body.channel === "telegram" ? "telegram" : "whatsapp",
            channelUserId: body.channelUserId || "",
          },
          await resolveAppTenantContext(),
        ),
      );
    } catch (error) {
      return authErrorResponse(error);
    }
  }

  const nextState = createClientInState(getFallbackState(), {
    fullName: body.fullName,
    channel: body.channel === "telegram" ? "telegram" : "whatsapp",
    channelUserId: body.channelUserId || "",
  });

  return NextResponse.json(saveFallbackState(nextState));
}
