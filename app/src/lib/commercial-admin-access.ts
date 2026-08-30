import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { readCommercialAdminTokenFromRequest } from "./commercial-admin-request";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabase";
import { createSupabaseServerReadOnlyClient } from "./supabase-server-readonly";
import { evaluateCommercialAdminGate } from "./phase-83f-commercial-admin";
import {
  evaluateAdminAllowlistAccess,
  resolveAdminEmailAllowlist,
} from "./phase-84f-admin-console";

export type CommercialAdminAccessMode = "supabase_allowlist" | "token_emergency";

export type CommercialAdminAccessResult = {
  allowed: boolean;
  mode: CommercialAdminAccessMode | null;
  actorSummary: string | null;
  blockingReasons: string[];
};

export async function evaluateCommercialAdminAccess(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CommercialAdminAccessResult> {
  const tokenGate = evaluateCommercialAdminGate({
    allowCommercialAdmin: env.MANU_ALLOW_COMMERCIAL_ADMIN,
    configuredToken: env.MANU_COMMERCIAL_ADMIN_TOKEN,
    suppliedToken: readCommercialAdminTokenFromRequest(request),
  });

  if (tokenGate.allowed) {
    return {
      allowed: true,
      mode: "token_emergency",
      actorSummary: "commercial_admin_token",
      blockingReasons: [],
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      allowed: false,
      mode: null,
      actorSummary: null,
      blockingReasons: [...tokenGate.blockingReasons, "supabase_auth_not_configured"],
    };
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });

  if (!supabase) {
    return {
      allowed: false,
      mode: null,
      actorSummary: null,
      blockingReasons: [...tokenGate.blockingReasons, "supabase_auth_not_configured"],
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = evaluateAdminAllowlistAccess(user?.email, resolveAdminEmailAllowlist(env));
  if (allowlist.allowed) {
    return {
      allowed: true,
      mode: "supabase_allowlist",
      actorSummary: allowlist.normalizedEmail,
      blockingReasons: [],
    };
  }

  return {
    allowed: false,
    mode: null,
    actorSummary: null,
    blockingReasons: [
      ...allowlist.blockingReasons,
      ...tokenGate.blockingReasons.filter((reason) => reason !== "commercial admin token is required"),
    ],
  };
}

export async function evaluateCommercialAdminAllowlistSessionAccess(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<CommercialAdminAccessResult> {
  if (!isSupabaseConfigured()) {
    return {
      allowed: false,
      mode: null,
      actorSummary: null,
      blockingReasons: ["supabase_auth_not_configured"],
    };
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient({
    getAll: () => cookieStore.getAll(),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  });

  if (!supabase) {
    return {
      allowed: false,
      mode: null,
      actorSummary: null,
      blockingReasons: ["supabase_auth_not_configured"],
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = evaluateAdminAllowlistAccess(user?.email, resolveAdminEmailAllowlist(env));
  return {
    allowed: allowlist.allowed,
    mode: allowlist.allowed ? "supabase_allowlist" : null,
    actorSummary: allowlist.allowed ? allowlist.normalizedEmail : null,
    blockingReasons: allowlist.blockingReasons,
  };
}

export async function resolveAdminSessionEmail() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerReadOnlyClient({
    getAll: () => cookieStore.getAll(),
  });

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allowlist = evaluateAdminAllowlistAccess(user?.email, resolveAdminEmailAllowlist());
  return allowlist.allowed ? allowlist.normalizedEmail : null;
}
