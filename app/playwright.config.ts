import { defineConfig, devices } from "@playwright/test";

/**
 * Stage 5 Faz 9 browser matrix:
 * - Existing Chromium projects keep visual snapshot compatibility.
 * - `mobile-ios` is Chromium iOS *emulation* — not real Safari.
 * - Real WebKit (mobile/tablet) and Firefox (desktop) run Stage 5 shell a11y/responsive suites only.
 */
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
      // Chromium device emulation of iPhone — not a real Safari/WebKit proof.
      name: "mobile-ios",
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-mobile",
      testMatch: /stage-5-shell\.(accessibility|responsive)\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
    {
      name: "webkit-tablet",
      testMatch: /stage-5-shell\.(accessibility|responsive)\.spec\.ts/,
      use: { ...devices["iPad Pro 11"], browserName: "webkit" },
    },
    {
      name: "firefox-desktop",
      testMatch: /stage-5-shell\.(accessibility|responsive)\.spec\.ts/,
      use: { ...devices["Desktop Firefox"], browserName: "firefox", viewport: { width: 1440, height: 900 } },
    },
  ],
});
