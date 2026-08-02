import { type NextRequest } from "next/server";
import { shellErrorResponse, shellJsonResponse } from "@/lib/phase-85-stage-5-shell-api";
import { parseShellPreferencesPatchBody } from "@/lib/phase-85-stage-5-shell-contracts";
import { rejectClientSuppliedSessionIdentity } from "@/lib/phase-85-stage-5-shell-session";
import {
  enforceShellPreferencesRateLimit,
  resolveShellReadAccountContext,
} from "@/lib/phase-85-stage-5-shell-route";
import { updateShellPreferences } from "@/lib/phase-85-stage-5-shell-store";

export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return shellJsonResponse({ error: "invalid_json" }, 400);
  }

  try {
    rejectClientSuppliedSessionIdentity(body);
    const patch = parseShellPreferencesPatchBody(body);
    const context = await resolveShellReadAccountContext();
    await enforceShellPreferencesRateLimit(context);
    return shellJsonResponse(await updateShellPreferences(context, patch));
  } catch (error) {
    return shellErrorResponse(error);
  }
}
