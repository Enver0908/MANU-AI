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
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], browserName: "chromium", viewport: { width: 1440, height: 900 } },
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
