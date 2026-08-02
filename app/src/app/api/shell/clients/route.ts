import { type NextRequest } from "next/server";
import { shellErrorResponse, shellJsonResponse } from "@/lib/phase-85-stage-5-shell-api";
import {
  parseShellClientSearchLimit,
  parseShellClientSearchQuery,
} from "@/lib/phase-85-stage-5-shell-contracts";
import {
  enforceShellClientSearchRateLimit,
  resolveShellReadAccountContext,
} from "@/lib/phase-85-stage-5-shell-route";
import { searchShellClients } from "@/lib/phase-85-stage-5-shell-store";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveShellReadAccountContext();
    await enforceShellClientSearchRateLimit(context);
    const params = request.nextUrl.searchParams;
    const query = parseShellClientSearchQuery(params.get("query"));
    const limit = parseShellClientSearchLimit(params.get("limit"));
    return shellJsonResponse(await searchShellClients(context, { query, limit }));
  } catch (error) {
    return shellErrorResponse(error);
  }
}
