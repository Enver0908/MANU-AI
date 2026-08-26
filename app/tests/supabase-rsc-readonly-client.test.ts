import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createReadOnlyCookieAdapter, createSupabaseServerReadOnlyClient } from "@/lib/supabase-server-readonly";

describe("supabase RSC read-only client", () => {
  it("records cookie mutations without writing them", () => {
    const adapter = createReadOnlyCookieAdapter(() => [{ name: "sb-access-token", value: "cookie" }]);
    expect(adapter.getAll()).toEqual([{ name: "sb-access-token", value: "cookie" }]);
    adapter.setAll([
      { name: "sb-access-token", value: "rotated", options: { path: "/", httpOnly: true } },
    ]);
    expect(adapter.ignoredMutations).toEqual([
      { name: "sb-access-token", value: "rotated", options: { path: "/", httpOnly: true } },
    ]);
  });

  it("does not throw when a read-only client is constructed without cookie writers", () => {
    const previousFallback = process.env.MANU_DEV_FALLBACK_STORE;
    process.env.MANU_DEV_FALLBACK_STORE = "true";
    try {
      expect(
        createSupabaseServerReadOnlyClient({
          getAll: () => [],
        }),
      ).toBeNull();
    } finally {
      if (previousFallback === undefined) {
        delete process.env.MANU_DEV_FALLBACK_STORE;
      } else {
        process.env.MANU_DEV_FALLBACK_STORE = previousFallback;
      }
    }
  });

  it("keeps RSC readers on the read-only factory", () => {
    const files = [
      "../src/lib/dashboard-server-auth.ts",
      "../src/lib/settings-server-read.ts",
      "../src/lib/commercial-install-access.ts",
      "../src/app/onboarding/page.tsx",
      "../src/app/account/recovery/page.tsx",
    ];
    for (const relative of files) {
      const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
      expect(source, relative).toContain("createSupabaseServerReadOnlyClient");
      expect(source, relative).not.toContain("cookieStore.set(");
    }
  });
});
