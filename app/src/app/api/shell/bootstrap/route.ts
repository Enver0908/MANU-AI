import { type NextRequest } from "next/server";
import { shellBoundedJsonResponse, shellErrorResponse } from "@/lib/phase-85-stage-5-shell-api";
import { parseShellActiveClientIdParam } from "@/lib/phase-85-stage-5-shell-contracts";
import {
  enforceShellBootstrapRateLimit,
  resolveShellReadAccountContext,
} from "@/lib/phase-85-stage-5-shell-route";
import { loadShellBootstrap } from "@/lib/phase-85-stage-5-shell-store";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveShellReadAccountContext();
    await enforceShellBootstrapRateLimit(context);
    const activeClientId = parseShellActiveClientIdParam(
      request.nextUrl.searchParams.get("activeClientId"),
    );
    return shellBoundedJsonResponse(await loadShellBootstrap(context, activeClientId));
  } catch (error) {
    return shellErrorResponse(error);
  }
}
