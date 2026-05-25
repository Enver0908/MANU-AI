import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseConfig() {
  if (process.env.MANU_DEV_FALLBACK_STORE === "true") {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null;
}

export function getSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  browserClient ??= createBrowserClient(config.url, config.anonKey);
  return browserClient;
}

export function getSupabaseStatus() {
  return getSupabaseBrowserClient() ? "configured" : "local-demo";
}

export function createSupabaseServerClient({
  getAll,
  setAll,
}: {
  getAll: () => { name: string; value: string }[];
  setAll?: (
    cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>,
    headers: Record<string, string>,
  ) => void;
}) {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll,
      setAll,
    },
  });
}

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
