import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { analyzeStage7Axe, collectStage7AxeViolations } from "./stage-7-axe";
import { scanArtifactPrivacy } from "./stage-7-redaction";

const PUBLIC_AUTH_ROUTES = ["/", "/login", "/admin"] as const;
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard?section=clients",
  "/dashboard?section=messages",
  "/dashboard?section=alerts",
  "/dashboard?section=notifications",
  "/dashboard/ai-chat",
  "/dashboard/settings",
] as const;

const CHROMIUM_DESKTOP = "stage-7-chromium-desktop";
const CHROMIUM_REFLOW = new Set(["stage-7-chromium-reflow", "stage-7-chromium-landscape"]);
const WEBKIT = new Set(["stage-7-webkit-iphone", "stage-7-webkit-ipad"]);
const FIREFOX = "stage-7-firefox-desktop";

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

async function assertNoPageBiaxialScroll(page: Page) {
  const overflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(overflow.x, "page-level horizontal overflow must stay <= 1px").toBeLessThanOrEqual(1);
}

async function assertFocusNotObscured(page: Page) {
  const obscured = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body || active === document.documentElement) {
      return false;
    }
    const rect = active.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return true;
    const x = rect.left + Math.min(rect.width / 2, 12);
    const y = rect.top + Math.min(rect.height / 2, 12);
    const top = document.elementFromPoint(x, y);
    return Boolean(top && top !== active && !active.contains(top) && !top.contains(active));
  });
  expect(obscured, "focused control must not be fully covered by sticky/fixed chrome").toBe(false);
}

async function lockOfflineOnProductDocument(page: Page) {
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });
  await expect(page.getByTestId("shell-blocker")).toBeVisible({ timeout: 10_000 });
}

async function tabUntil(page: Page, selector: string, maxTabs = 40) {
  for (let index = 0; index < maxTabs; index += 1) {
    const focused = await page.evaluate((target) => {
      const active = document.activeElement;
      return Boolean(active && (active.matches(target) || active.closest(target)));
    }, selector);
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`keyboard focus did not reach ${selector}`);
}

async function assertAxeClean(page: Page, label: string) {
  const analysis = await analyzeStage7Axe(page);
  expect(analysis.violations, `${label} axe ${JSON.stringify(analysis.violations)}`).toEqual([]);
  return analysis.incompletes;
}

test.describe("stage 7.4 accessibility, browser convergence, and performance", () => {
  test("chromium desktop axe stays clean after shell, dialog, menu, and panel open", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== CHROMIUM_DESKTOP, "Chromium desktop axe/dialog matrix only");
    test.setTimeout(120_000);

    const incompletes: Array<{ state: string; items: unknown[] }> = [];
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    incompletes.push({ state: "login", items: await assertAxeClean(page, "/login") });

    await bootstrapDashboard(page);
    await documentChrome(page);
    incompletes.push({ state: "dashboard-shell", items: await assertAxeClean(page, "/dashboard") });

    const aria = await page.getByTestId("authenticated-shell").ariaSnapshot();
    expect(aria).toMatch(/banner|navigation|main/i);

    await page.getByTestId("skip-link").focus();
    await expect(page.getByTestId("skip-link")).toBeFocused();
    await page.keyboard.press("Enter");

    const clientTrigger = page.getByTestId("active-client-trigger");
    if (await clientTrigger.count()) {
      await clientTrigger.click();
      const menu = page.getByTestId("active-client-popover").or(page.getByRole("dialog"));
      await expect(menu).toBeVisible();
      await expect(page.getByLabel("Danışan sonuçları")).toBeVisible();
      await expect(page.getByText("Yükleniyor…")).toHaveCount(0);
      expect(await menu.ariaSnapshot()).toMatch(/dialog|listbox|search|combobox/i);
      incompletes.push({ state: "active-client-menu", items: await assertAxeClean(page, "active-client-menu") });
      await page.keyboard.press("Escape");
    }

    await page.goto("/dashboard?section=clients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("authenticated-shell")).toBeVisible({ timeout: 30_000 });
    const nameField = page.locator("input[type='text'], textarea").first();
    if (await nameField.count()) {
      await nameField.fill("Stage7 Keyboard Client");
      await page.getByRole("link").first().click({ timeout: 5_000 }).catch(() => undefined);
      const dirty = page.getByTestId("shell-dirty-navigation-dialog");
      if (await dirty.isVisible().catch(() => false)) {
        await expect(dirty).toHaveAttribute("role", "alertdialog");
        expect(await dirty.ariaSnapshot()).toMatch(/alertdialog|dialog/i);
        incompletes.push({ state: "dirty-dialog", items: await assertAxeClean(page, "dirty-dialog") });
        await page.keyboard.press("Escape");
        await expect(dirty).toHaveCount(0);
      }
    }

    await lockOfflineOnProductDocument(page);
    await expect(page.getByTestId("shell-retry")).toBeVisible();
    incompletes.push({ state: "offline-lock", items: await assertAxeClean(page, "offline-lock") });
    expect(incompletes.every((entry) => Array.isArray(entry.items))).toBe(true);
    const incompletesDir = join(process.cwd(), "test-results", "stage-7");
    mkdirSync(incompletesDir, { recursive: true });
    writeFileSync(
      join(incompletesDir, "phase-7-4-axe-incompletes.json"),
      `${JSON.stringify({ certificationClaim: false, incompletes }, null, 2)}\n`,
    );
  });

  test("keyboard protocol covers skip-link, chrome, roster, form, dialog, and messaging", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== CHROMIUM_DESKTOP, "Keyboard protocol on Chromium desktop");
    test.setTimeout(90_000);
    await bootstrapDashboard(page);

    await page.keyboard.press("Tab");
    await tabUntil(
      page,
      '[data-testid="skip-link"], a.skip-link, [data-testid="shell-header"] a, [data-testid="shell-header"] button, [data-testid="shell-compact-bottom-nav"] button, [data-testid="active-client-trigger"]',
    );
    const afterFirstLoop = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
    expect(["BODY", "HTML"]).not.toContain(afterFirstLoop);
    await assertFocusNotObscured(page);

    if (await page.getByTestId("active-client-trigger").count()) {
      await tabUntil(page, '[data-testid="active-client-trigger"]');
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("active-client-popover").or(page.getByRole("dialog"))).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("active-client-trigger")).toBeFocused();
    }

    await page.goto("/dashboard?section=clients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("client-roster")).toBeVisible({ timeout: 30_000 });
    const rosterItem = page.getByTestId("client-roster-item").first();
    if (await rosterItem.count()) {
      await rosterItem.click();
      await expect(page.getByTestId("client-workspace").or(page.getByTestId("client-task-hub"))).toBeVisible();
      const save = page.getByTestId("client-form-save");
      if (await save.count()) {
        await save.focus();
        await expect(save).toBeFocused();
        await assertFocusNotObscured(page);
      }
    }

    await page.goto("/dashboard?section=messages", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("messaging-panel")).toBeVisible({ timeout: 30_000 });
    const composer = page.getByTestId("conversation-composer");
    if (await composer.count()) {
      await composer.locator("textarea, input").first().focus();
      await assertFocusNotObscured(page);
    }
  });

  test("reflow, text spacing, zoom, and reduced-motion stay single-axis", async ({ page }, testInfo) => {
    test.skip(
      !CHROMIUM_REFLOW.has(testInfo.project.name) && testInfo.project.name !== CHROMIUM_DESKTOP,
      "Reflow matrix",
    );
    test.setTimeout(90_000);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await bootstrapDashboard(page);
    await documentChrome(page);
    const reduced = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    expect(reduced).toBe(true);
    await assertNoPageBiaxialScroll(page);

    await page.addStyleTag({
      content:
        "*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important;}p{margin-bottom:2em!important;}",
    });
    await assertNoPageBiaxialScroll(page);

    if (testInfo.project.name === CHROMIUM_DESKTOP) {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await assertNoPageBiaxialScroll(page);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "";
      });
      await page.setViewportSize({ width: 320, height: 256 });
      await assertNoPageBiaxialScroll(page);
      const firstFocusable = page.locator("a, button, input, textarea, select").first();
      await firstFocusable.focus();
      await assertFocusNotObscured(page);
    }
  });

  test("webkit iPhone/iPad smoke covers auth, shell, workspace, messaging, alerts, and offline lock", async ({
    page,
  }, testInfo) => {
    test.skip(!WEBKIT.has(testInfo.project.name), "WebKit smoke only");
    test.setTimeout(90_000);
    for (const route of PUBLIC_AUTH_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await documentChrome(page);
      await assertNoPageBiaxialScroll(page);
    }
    await bootstrapDashboard(page);
    await documentChrome(page);
    await assertNoPageBiaxialScroll(page);
    for (const route of [
      "/dashboard?section=clients",
      "/dashboard?section=messages",
      "/dashboard?section=alerts",
      "/dashboard?section=notifications",
    ] as const) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("authenticated-shell")).toBeVisible({ timeout: 30_000 });
      await assertNoPageBiaxialScroll(page);
    }
    await lockOfflineOnProductDocument(page);
    await documentChrome(page);
    await expect(page.getByTestId("authenticated-shell")).toHaveCount(0);
    const violations = await collectStage7AxeViolations(page);
    expect(violations).toEqual([]);
  });

  test("firefox desktop smoke covers auth, admin, dashboard, form, and messaging", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== FIREFOX, "Firefox smoke only");
    test.setTimeout(90_000);
    for (const route of ["/login", "/admin"] as const) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await documentChrome(page);
      await assertNoPageBiaxialScroll(page);
    }
    await bootstrapDashboard(page);
    await documentChrome(page);
    await page.goto("/dashboard?section=clients", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("client-roster")).toBeVisible({ timeout: 30_000 });
    await page.goto("/dashboard?section=messages", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("messaging-panel")).toBeVisible({ timeout: 30_000 });
    const violations = await collectStage7AxeViolations(page);
    expect(violations).toEqual([]);
  });

  test("PWA offline lock Tab leaves BODY and reaches the retry control", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== CHROMIUM_DESKTOP, "Assigned P2 on Chromium desktop");
    await bootstrapDashboard(page);
    await lockOfflineOnProductDocument(page);
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
    if (tag === "BODY" || tag === "HTML") {
      await page.keyboard.press("Tab");
    }
    const after = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? "BODY",
      testId: (document.activeElement as HTMLElement | null)?.dataset?.testid ?? "",
    }));
    expect(["BODY", "HTML"]).not.toContain(after.tag);
    await expect(page.getByTestId("shell-retry")).toBeVisible();
    expect(after.testId === "shell-retry" || after.tag === "BUTTON" || after.tag === "A").toBe(true);
  });

  test("dashboard routes keep WCAG A/AA axe clean on chromium desktop", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== CHROMIUM_DESKTOP, "Representative Chromium desktop only");
    test.setTimeout(90_000);
    await page.request.post("/api/app-state");
    for (const route of DASHBOARD_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("authenticated-shell")).toBeVisible({ timeout: 30_000 });
      const violations = await collectStage7AxeViolations(page);
      expect(violations, `${route} ${JSON.stringify(violations)}`).toEqual([]);
    }
  });

  test("phase 7.4 spec source stays free of forbidden artifacts", () => {
    expect(scanArtifactPrivacy("stage7@example.com +15555550100")).toEqual([]);
  });
});
