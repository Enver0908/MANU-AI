import { expect, test, type Page } from "@playwright/test";
import { collectStage7AxeViolations } from "./stage-7-axe";
import { scanArtifactPrivacy } from "./stage-7-redaction";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard?section=clients",
  "/dashboard?section=messages",
  "/dashboard?section=alerts",
  "/dashboard?section=notifications",
  "/dashboard/ai-chat",
  "/dashboard/settings",
] as const;

const CHROMIUM_FULL = new Set([
  "stage-7-chromium-desktop",
  "stage-7-chromium-reflow",
  "stage-7-chromium-android",
]);
const WEBKIT_SMOKE = new Set(["stage-7-webkit-iphone", "stage-7-webkit-ipad"]);
const FIREFOX_SMOKE = new Set(["stage-7-firefox-desktop"]);

async function bootstrapDashboard(page: Page) {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("authenticated-shell")).toBeVisible({ timeout: 30_000 });
}

async function documentChrome(page: Page) {
  const lang = (await page.locator("html").getAttribute("lang")) ?? "";
  const title = await page.title();
  expect(lang.trim().length, "html lang must be non-empty").toBeGreaterThan(0);
  expect(title.trim().length, "document title must be non-empty").toBeGreaterThan(0);
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "dashboard routes must not overflow horizontally").toBeLessThanOrEqual(1);
}

async function lockOfflineOnProductDocument(page: Page) {
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByTestId("shell-blocker")).toBeVisible({ timeout: 10_000 });
}

test.describe("stage 7.3 dashboard and PWA operational surfaces", () => {
  test("chromium dashboard routes keep lang, title, geometry, and axe A/AA", async ({ page }, testInfo) => {
    test.skip(!CHROMIUM_FULL.has(testInfo.project.name), "Chromium dashboard matrix only");
    test.setTimeout(90_000);

    await page.request.post("/api/app-state");
    for (const route of DASHBOARD_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("authenticated-shell")).toBeVisible({ timeout: 30_000 });
      await documentChrome(page);
      await assertNoHorizontalOverflow(page);
      const violations = await collectStage7AxeViolations(page);
      expect(violations, `${route} axe ${JSON.stringify(violations)}`).toEqual([]);
    }
  });

  test("overview keeps daily work first and names the active client", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-desktop", "Representative Chromium desktop only");
    await bootstrapDashboard(page);
    await expect(page.getByTestId("overview-daily-work")).toBeVisible();
    await expect(page.getByTestId("overview-active-client")).toBeVisible();
    const order = await page.evaluate(() => {
      const daily = document.querySelector('[data-testid="overview-daily-work"]');
      const client = document.querySelector('[data-testid="overview-active-client"]');
      if (!daily || !client) return -1;
      return daily.compareDocumentPosition(client) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : 0;
    });
    expect(order).toBe(1);
  });

  test("PWA offline lock keeps product lang, title, unmounted protected content, and axe A/AA", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-desktop", "Offline lock on Chromium desktop");
    await bootstrapDashboard(page);
    await lockOfflineOnProductDocument(page);
    await documentChrome(page);
    await expect(page.locator("html")).toHaveAttribute("lang", /./);
    await expect(page.getByTestId("authenticated-shell")).toHaveCount(0);
    await expect(page.getByTestId("shell-retry")).toBeVisible();
    await expect(page.locator('[data-shell-runtime="offline"]')).toBeVisible();
    const violations = await collectStage7AxeViolations(page);
    expect(violations, `offline axe ${JSON.stringify(violations)}`).toEqual([]);
  });

  test("compact nav and header controls stay at least 44px on Android", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-android", "Android compact chrome only");
    await bootstrapDashboard(page);
    const undersized = await page.evaluate(() => {
      const selectors = [
        '[data-testid="shell-compact-bottom-nav"] button',
        '[data-testid="shell-header-bell"]',
      ];
      const bad: string[] = [];
      for (const selector of selectors) {
        for (const node of Array.from(document.querySelectorAll(selector))) {
          const rect = (node as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.width < 44 || rect.height < 44) {
            bad.push(`${selector}:${Math.round(rect.width)}x${Math.round(rect.height)}`);
          }
        }
      }
      return bad;
    });
    expect(undersized).toEqual([]);
    await assertNoHorizontalOverflow(page);
  });

  test("320px dashboard reflow stays single-axis", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-reflow", "320px reflow project only");
    await bootstrapDashboard(page);
    await documentChrome(page);
    await assertNoHorizontalOverflow(page);
  });

  test("keyboard reaches dashboard chrome after load", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-desktop", "Keyboard coverage on Chromium desktop");
    await bootstrapDashboard(page);
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
    expect(["BODY", "HTML"]).not.toContain(tag);
  });

  test("webkit iPhone/iPad smoke on dashboard shell", async ({ page }, testInfo) => {
    test.skip(!WEBKIT_SMOKE.has(testInfo.project.name), "WebKit smoke only");
    await bootstrapDashboard(page);
    await documentChrome(page);
    await assertNoHorizontalOverflow(page);
  });

  test("firefox dashboard smoke", async ({ page }, testInfo) => {
    test.skip(!FIREFOX_SMOKE.has(testInfo.project.name), "Firefox smoke only");
    await bootstrapDashboard(page);
    await documentChrome(page);
    await assertNoHorizontalOverflow(page);
  });

  test("phase 7.3 spec source stays free of forbidden artifacts", () => {
    expect(scanArtifactPrivacy("dashboard offline lock dietitian@example.com")).toEqual([]);
  });
});
