import { type NextRequest } from "next/server";
import { shellErrorResponse, shellJsonResponse } from "@/lib/phase-85-stage-5-shell-api";
import { parseShellClientVersionParam } from "@/lib/phase-85-stage-5-shell-contracts";
import { resolveShellReadAccountContext } from "@/lib/phase-85-stage-5-shell-route";
import { resolveShellVersion } from "@/lib/phase-85-stage-5-shell-store";

export async function GET(request: NextRequest) {
  try {
    await resolveShellReadAccountContext();
    const clientVersion = parseShellClientVersionParam(
      request.nextUrl.searchParams.get("clientVersion"),
    );
    return shellJsonResponse(resolveShellVersion(clientVersion));
  } catch (error) {
    return shellErrorResponse(error);
  }
}
