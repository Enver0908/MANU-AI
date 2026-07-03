import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { resolveCustomerSessionFacts } from "@/lib/customer-auth-session";
import {
  deriveCustomerAuthRedirect,
  resolveAppBaseUrl,
  sanitizePostAuthRedirectPath,
} from "@/lib/phase-84d-customer-auth";
import { resolveAdminAppBaseUrl } from "@/lib/phase-84f-admin-console";
import { createSupabaseServerClient, getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase";

type AuthCookieMutation = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

const SUPPORTED_EMAIL_OTP_TYPES = new Set([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function applyAuthSessionMutations(
  response: NextResponse,
  cookiesToSet: AuthCookieMutation[],
  headersToSet: Record<string, string>,
) {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  Object.entries(headersToSet).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function buildExternalRedirectUrl(path: string, authErrorBase: string) {
  const baseUrl = authErrorBase === "/admin" || path.startsWith("/admin")
    ? resolveAdminAppBaseUrl()
    : resolveAppBaseUrl();
  return new URL(path, baseUrl);
}

function renderFragmentSessionBridge(nextPath: string | null, authErrorBase: string) {
  const config = getSupabaseConfig();
  const fallbackUrl = buildExternalRedirectUrl(
    `${authErrorBase}?error=auth_callback_failed`,
    authErrorBase,
  ).toString();
  const destination = buildExternalRedirectUrl(nextPath ?? "/dashboard", authErrorBase).toString();
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>SiriusAI authentication</title>
</head>
<body>
  <script>
    (async () => {
      const fallbackUrl = ${JSON.stringify(fallbackUrl)};
      const destination = ${JSON.stringify(destination)};
      const supabaseUrl = ${JSON.stringify(config?.url ?? "")};
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (!accessToken || !refreshToken || !supabaseUrl) {
        window.location.replace(fallbackUrl);
        return;
      }
      try {
        const response = await fetch("/api/auth/session-from-fragment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken }),
          credentials: "same-origin"
        });
        if (!response.ok) {
          window.location.replace(fallbackUrl);
          return;
        }
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        window.location.replace(destination);
      } catch {
        window.location.replace(fallbackUrl);
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const requestedNext = sanitizePostAuthRedirectPath(request.nextUrl.searchParams.get("next"));
  const authErrorBase = requestedNext?.startsWith("/admin") ? "/admin" : "/login";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(buildExternalRedirectUrl(`${authErrorBase}?error=auth_not_configured`, authErrorBase));
  }

  const authError = request.nextUrl.searchParams.get("error_description")
    ?? request.nextUrl.searchParams.get("error");
  if (authError) {
    return NextResponse.redirect(buildExternalRedirectUrl(`${authErrorBase}?error=auth_callback_failed`, authErrorBase));
  }

  const cookieStore = await cookies();
  let authCookiesToSet: AuthCookieMutation[] = [];
  let authHeadersToSet: Record<string, string> = {};

  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet, headers) => {
      authCookiesToSet = cookiesToSet;
      authHeadersToSet = headers;
    },
  });

  if (!supabase) {
    return NextResponse.redirect(buildExternalRedirectUrl(`${authErrorBase}?error=auth_not_configured`, authErrorBase));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(buildExternalRedirectUrl(`${authErrorBase}?error=auth_callback_failed`, authErrorBase));
    }
  }

  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const otpType = request.nextUrl.searchParams.get("type");
  if (!code && tokenHash && otpType) {
    if (!SUPPORTED_EMAIL_OTP_TYPES.has(otpType)) {
      return NextResponse.redirect(buildExternalRedirectUrl(`${authErrorBase}?error=auth_callback_failed`, authErrorBase));
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType as "email" | "email_change" | "invite" | "magiclink" | "recovery" | "signup",
    });
    if (error) {
      return NextResponse.redirect(buildExternalRedirectUrl(`${authErrorBase}?error=auth_callback_failed`, authErrorBase));
    }
  }

  if (!code && !tokenHash) {
    return renderFragmentSessionBridge(requestedNext, authErrorBase);
  }

  const facts = await resolveCustomerSessionFacts(supabase);
  const destination = requestedNext ?? deriveCustomerAuthRedirect(facts);
  const response = NextResponse.redirect(buildExternalRedirectUrl(destination, authErrorBase));
  return applyAuthSessionMutations(response, authCookiesToSet, authHeadersToSet);
}
