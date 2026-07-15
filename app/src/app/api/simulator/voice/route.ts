import { NextResponse, type NextRequest } from "next/server";
import { domainErrorResponse } from "@/lib/app-errors";
import { runFallbackStage4B4VoiceSimulation, saveFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { Stage4B4VoiceFixtureId } from "@/lib/phase-85-stage-4b4-audio-fixture-resolver";
import {
  STAGE_4B4_TRANSCRIPTION_FIXTURE_SCENE_IDS,
  type Stage4B4TranscriptionFixtureSceneId,
} from "@/lib/phase-85-stage-4b4-transcription-fixture-manifest";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

function parseBurstMessages(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseFixtureId(value: FormDataEntryValue | null): Stage4B4VoiceFixtureId {
  if (value === "stereo_voice_note") return "stereo_voice_note";
  return "golden_voice_note";
}

function parseTranscriptionSceneId(value: FormDataEntryValue | null): Stage4B4TranscriptionFixtureSceneId | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return STAGE_4B4_TRANSCRIPTION_FIXTURE_SCENE_IDS.includes(value as Stage4B4TranscriptionFixtureSceneId)
    ? (value as Stage4B4TranscriptionFixtureSceneId)
    : undefined;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "multipart_form_required" }, { status: 400 });
  }

  const form = await request.formData();
  const clientId = typeof form.get("clientId") === "string" ? String(form.get("clientId")).trim() : "";
  const idempotencyKey =
    typeof form.get("idempotencyKey") === "string" ? String(form.get("idempotencyKey")).trim() : "";
  if (!clientId || !idempotencyKey) {
    return NextResponse.json({ error: "client_id_and_idempotency_key_required" }, { status: 400 });
  }

  const fixtureId = parseFixtureId(form.get("fixtureId"));
  const transcriptionSceneId = parseTranscriptionSceneId(form.get("transcriptionSceneId"));
  const burstMessages = parseBurstMessages(form.get("burstMessages"));
  const flushSilence = form.get("flushSilence") !== "false";

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "simulate_inbound");
      await assertRateLimit({
        key: `${tenantContext.tenantId}:simulator:voice:${clientId}`,
        tenantId: tenantContext.tenantId,
        ...RATE_LIMITS.simulator,
      });
      const { runSupabaseStage4B4VoiceSimulation } = await import("@/lib/supabase-store");
      return NextResponse.json(
        await runSupabaseStage4B4VoiceSimulation(
          {
            clientId,
            idempotencyKey,
            fixtureId,
            transcriptionSceneId,
            burstMessages,
            flushSilence,
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
    await assertRateLimit({
      key: `fallback:simulator:voice:${clientId}`,
      ...RATE_LIMITS.simulator,
    });
    const nextState = await runFallbackStage4B4VoiceSimulation({
      clientId,
      idempotencyKey,
      fixtureId,
      transcriptionSceneId,
      burstMessages,
      flushSilence,
    });
    saveFallbackState(nextState);
    return NextResponse.json(nextState);
  } catch (error) {
    return domainErrorResponse(error);
  }
}
