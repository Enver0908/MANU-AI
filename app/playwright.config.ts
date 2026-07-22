import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next start --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      MANU_DEV_FALLBACK_STORE: "true",
      MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true",
      MANU_ALLOW_MOCK_VISION: "true",
      MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
      MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: "synthetic-visual-smoke-secret",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      // AI Chat routes are force-dynamic, so this server-only flag (and the
      // in-memory store fallback) are re-evaluated per request by
      // `next start` without requiring a rebuild.
      AI_CHAT_UI_ENABLED: "true",
      AI_CHAT_DETERMINISTIC_MODE: "true",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop-xl",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1728, height: 1117 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile-android",
      use: { ...devices["Pixel 5"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-ios",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
  ],
});
