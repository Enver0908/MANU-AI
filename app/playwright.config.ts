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
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    colorScheme: "light",
    reducedMotion: "reduce",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
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
      testIgnore: /stage-7\//,
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop-xl",
      testIgnore: /stage-7\//,
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1728, height: 1117 } },
    },
    {
      name: "tablet",
      testIgnore: /stage-7\//,
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "mobile-android",
      testIgnore: /stage-7\//,
      use: { ...devices["Pixel 5"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      // Chromium device emulation of iPhone — not a real Safari/WebKit proof.
      name: "mobile-ios",
      testIgnore: /stage-7\//,
      use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "stage-7-chromium-desktop",
      testMatch: /stage-7\/.*\.spec\.ts/,
      timeout: 40_000,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        serviceWorkers: "block",
        actionTimeout: 8_000,
        navigationTimeout: 15_000,
      },
    },
    {
      name: "stage-7-chromium-desktop-xl",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 1728, height: 1117 },
        serviceWorkers: "block",
      },
    },
    {
      name: "stage-7-chromium-tablet",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
        serviceWorkers: "block",
      },
    },
    {
      name: "stage-7-chromium-android",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        serviceWorkers: "block",
      },
    },
    {
      name: "stage-7-chromium-reflow",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 720 },
        serviceWorkers: "block",
      },
    },
    {
      name: "stage-7-chromium-landscape",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 844, height: 390 },
        serviceWorkers: "block",
      },
    },
    {
      name: "stage-7-webkit-iphone",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: { ...devices["iPhone 13"], browserName: "webkit", serviceWorkers: "block" },
    },
    {
      name: "stage-7-webkit-ipad",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: { ...devices["iPad Pro 11"], browserName: "webkit", serviceWorkers: "block" },
    },
    {
      name: "stage-7-firefox-desktop",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        ...devices["Desktop Firefox"],
        browserName: "firefox",
        viewport: { width: 1440, height: 900 },
        serviceWorkers: "block",
      },
    },
    {
      name: "stage-7-pwa",
      testMatch: /stage-7\/.*\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        serviceWorkers: "allow",
      },
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
