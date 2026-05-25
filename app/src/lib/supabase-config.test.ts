import { afterEach, describe, expect, it } from "vitest";
import { isSupabaseConfigured } from "./supabase";
import { isSupabaseStoreConfigured } from "./supabase-store";

const originalEnv = { ...process.env };

describe("Supabase fallback configuration", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("forces fallback mode even when Supabase environment variables exist", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
    process.env.MANU_DEV_FALLBACK_STORE = "true";

    expect(isSupabaseConfigured()).toBe(false);
    expect(isSupabaseStoreConfigured()).toBe(false);
  });
});
