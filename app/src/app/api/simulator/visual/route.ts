import { NextResponse, type NextRequest } from "next/server";
import { domainErrorResponse } from "@/lib/app-errors";
import { runFallbackStage4B3VisualSimulation, saveFallbackState } from "@/lib/app-state-store";
import { authErrorResponse, requireCapability, resolveAppTenantContext } from "@/lib/auth-context";
import { assertRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  STAGE_4B3_VISION_FIXTURE_SCENE_IDS,
  type Stage4B3VisionFixtureSceneId,
} from "@/lib/phase-85-stage-4b3-vision-fixture-manifest";
import { isSupabaseStoreConfigured } from "@/lib/supabase-store";

function parseBurstMessages(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseFixtureSceneId(value: FormDataEntryValue | null): Stage4B3VisionFixtureSceneId | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return STAGE_4B3_VISION_FIXTURE_SCENE_IDS.includes(value as Stage4B3VisionFixtureSceneId)
    ? (value as Stage4B3VisionFixtureSceneId)
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

  const fixtureSceneId = parseFixtureSceneId(form.get("fixtureSceneId"));
  const caption = typeof form.get("caption") === "string" ? String(form.get("caption")).trim() : undefined;
  const burstMessages = parseBurstMessages(form.get("burstMessages"));
  const flushSilence = form.get("flushSilence") !== "false";
  const upload = form.get("image");
  const uploadBytes =
    upload instanceof File && upload.size > 0 ? Buffer.from(await upload.arrayBuffer()) : undefined;

  if (!fixtureSceneId && !uploadBytes) {
    return NextResponse.json({ error: "fixture_or_upload_required" }, { status: 400 });
  }

  if (isSupabaseStoreConfigured()) {
    try {
      const tenantContext = await resolveAppTenantContext();
      requireCapability(tenantContext, "simulate_inbound");
      await assertRateLimit({
        key: `${tenantContext.tenantId}:simulator:visual:${clientId}`,
        tenantId: tenantContext.tenantId,
        ...RATE_LIMITS.simulator,
      });
      const { runSupabaseStage4B3VisualSimulation } = await import("@/lib/supabase-store");
      return NextResponse.json(
        await runSupabaseStage4B3VisualSimulation(
          {
            clientId,
            idempotencyKey,
            fixtureSceneId,
            caption,
            burstMessages,
            flushSilence,
            uploadBytes,
            uploadMimeType: upload instanceof File ? upload.type || "image/jpeg" : undefined,
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
      key: `fallback:simulator:visual:${clientId}`,
      ...RATE_LIMITS.simulator,
    });
    const nextState = await runFallbackStage4B3VisualSimulation({
      clientId,
      idempotencyKey,
      fixtureSceneId,
      caption,
      burstMessages,
      flushSilence,
      uploadBytes,
      uploadMimeType: upload instanceof File ? upload.type || "image/jpeg" : undefined,
    });
    return NextResponse.json(saveFallbackState(nextState));
  } catch (error) {
    return domainErrorResponse(error);
  }
}
