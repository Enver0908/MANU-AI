import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  ACCOUNT_RECOVERY_FLOW_COOKIE_NAME,
  ACCOUNT_RECOVERY_FLOW_TTL_SECONDS,
  buildAccountRecoveryFlowCookieValue,
} from "@/lib/phase-85-stage-4d-account-security";

type FragmentSessionBody = {
  accessToken?: string;
  refreshToken?: string;
  flowType?: string;
};

function isUsableAccessToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 16 && value.length <= 4096;
}

function isUsableRefreshToken(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.length <= 4096;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  let body: FragmentSessionBody;
  try {
    body = (await request.json()) as FragmentSessionBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isUsableAccessToken(body.accessToken) || !isUsableRefreshToken(body.refreshToken)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const accessToken = body.accessToken.trim();
  const refreshToken = body.refreshToken.trim();

  const cookieStore = await cookies();
  let authCookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  let authHeadersToSet: Record<string, string> = {};

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet, headers) => {
      authCookiesToSet = cookiesToSet;
      authHeadersToSet = headers;
    },
  });

  if (!supabase) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 503 });
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    return NextResponse.json({ error: "session_exchange_failed" }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  if (body.flowType === "recovery") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      response.cookies.set(
        ACCOUNT_RECOVERY_FLOW_COOKIE_NAME,
        buildAccountRecoveryFlowCookieValue({ authUserId: user.id }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          path: "/",
          maxAge: ACCOUNT_RECOVERY_FLOW_TTL_SECONDS,
        },
      );
    }
  }
  authCookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(authHeadersToSet).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
