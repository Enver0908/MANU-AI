import { shellErrorResponse, shellJsonResponse, toShellSessionActivityDto } from "@/lib/phase-85-stage-5-shell-api";
import { rejectClientSuppliedSessionIdentity, touchShellSessionActivity } from "@/lib/phase-85-stage-5-shell-session";
import {
  enforceShellSessionActivityRateLimit,
  resolveShellSessionActivityContext,
} from "@/lib/phase-85-stage-5-shell-route";

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> | null = null;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    rejectClientSuppliedSessionIdentity(body);
    const context = await resolveShellSessionActivityContext();
    await enforceShellSessionActivityRateLimit(context);
    const activity = await touchShellSessionActivity(context.supabase);
    return shellJsonResponse(toShellSessionActivityDto(activity));
  } catch (error) {
    return shellErrorResponse(error);
  }
}
