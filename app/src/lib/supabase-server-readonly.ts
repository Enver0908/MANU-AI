import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./supabase";

export type SupabaseCookieMutation = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

export function createReadOnlyCookieAdapter(getAll: () => { name: string; value: string }[]) {
  const ignoredMutations: SupabaseCookieMutation[] = [];
  return {
    getAll,
    setAll(cookiesToSet: SupabaseCookieMutation[]) {
      ignoredMutations.push(...cookiesToSet);
    },
    ignoredMutations,
  };
}

export function createSupabaseServerReadOnlyClient({
  getAll,
}: {
  getAll: () => { name: string; value: string }[];
}) {
  const config = getSupabaseConfig();
  if (!config) {
    return null;
  }

  const adapter = createReadOnlyCookieAdapter(getAll);
  const client = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: adapter.getAll,
      setAll: adapter.setAll,
    },
  });

  return Object.assign(client, { ignoredCookieMutations: adapter.ignoredMutations });
}
