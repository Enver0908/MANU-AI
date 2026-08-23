import { expect, test, type Page } from "@playwright/test";
import { collectStage7AxeViolations } from "./stage-7-axe";
import { scanArtifactPrivacy } from "./stage-7-redaction";

const PUBLIC_COMMERCIAL_ROUTES = [
  "/",
  "/login",
  "/purchase",
  "/purchase/cancel",
  "/purchase/success?session_id=cs_test_stage7_0001",
  "/onboarding",
  "/app-install",
  "/admin",
  "/commercial-admin/emergency",
] as const;

const CHROMIUM_FULL = new Set([
  "stage-7-chromium-desktop",
  "stage-7-chromium-reflow",
  "stage-7-chromium-landscape",
]);
const WEBKIT_SMOKE = new Set(["stage-7-webkit-iphone", "stage-7-webkit-ipad"]);
const FIREFOX_SMOKE = new Set(["stage-7-firefox-desktop"]);

const LONG_DE =
  "Sehr geehrtes Team, wir benötigen eine ausführliche Abstimmung zur ernährungsmedizinischen Begleitung, Terminorganisation und klinischen Dokumentation für unsere Praxisgemeinschaft.";
const LONG_PT =
  "Prezada equipe, precisamos de um alinhamento detalhado sobre acompanhamento nutricional, organização da clínica e documentação do programa piloto para os pacientes.";

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
  expect(overflow, "public/commercial routes must not overflow horizontally").toBeLessThanOrEqual(1);
}

async function tabUntil(
  page: Page,
  selector: string,
  maxTabs = 36,
) {
  for (let index = 0; index < maxTabs; index += 1) {
    const focused = await page.evaluate((target) => {
      const active = document.activeElement;
      return Boolean(active && (active.id === target.replace("#", "") || active.closest(target)));
    }, selector);
    if (focused) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`keyboard focus did not reach ${selector}`);
}

test.describe("stage 7.2 public and commercial surfaces", () => {
  test("chromium public/commercial routes keep lang, title, geometry, and axe A/AA", async ({ page }, testInfo) => {
    test.skip(!CHROMIUM_FULL.has(testInfo.project.name), "Chromium viewport matrix only");
    test.setTimeout(90_000);

    for (const route of PUBLIC_COMMERCIAL_ROUTES) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await documentChrome(page);
      await assertNoHorizontalOverflow(page);
      const violations = await collectStage7AxeViolations(page);
      expect(violations, `${route} axe ${JSON.stringify(violations)}`).toEqual([]);
    }
  });

  test("chromium contact accepts long German and Portuguese copy without overflow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-desktop", "Representative Chromium desktop only");
    await page.goto("/#contact", { waitUntil: "domcontentloaded" });
    await page.locator("#contact-lead-name").fill("Klinik Beispiel");
    await page.locator("#contact-lead-email").fill("clinic@example.com");
    await page.locator("#contact-lead-clinic").fill("Ernährungspraxis");
    await page.locator("#contact-lead-message").fill(`${LONG_DE}\n${LONG_PT}`);
    await assertNoHorizontalOverflow(page);
    const clipped = await page.locator("#contact-lead-message").evaluate((node) => {
      const el = node as HTMLElement;
      return el.scrollWidth - el.clientWidth > 8 && getComputedStyle(el).whiteSpace === "nowrap";
    });
    expect(clipped).toBe(false);
  });

  test("keyboard-only contact, login, onboarding, and admin login", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "stage-7-chromium-desktop", "Keyboard coverage on Chromium desktop");
    test.setTimeout(60_000);

    await page.goto("/#contact", { waitUntil: "domcontentloaded" });
    await tabUntil(page, "#contact-lead-name");
    await page.keyboard.type("Ada Klinik");
    await page.keyboard.press("Tab");
    await page.keyboard.type("ada@example.com");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Ada Clinic");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Pilot program request");
    const contactFocused = await page.evaluate(() => document.activeElement?.id ?? "");
    expect(["contact-lead-message", "contact-lead-clinic", "contact-lead-email"]).toContain(contactFocused);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await tabUntil(page, "#customer-login-email");
    await page.keyboard.type("not-an-email");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#customer-login-error")).toBeVisible();
    await expect(page.locator("#customer-login-email")).toHaveAttribute("aria-invalid", "true");

    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await documentChrome(page);
    await page.keyboard.press("Tab");
    const onboardingTag = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
    expect(onboardingTag).not.toBe("BODY");

    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await tabUntil(page, "#admin-login-email");
    await page.keyboard.type("not-an-email");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("webkit iPhone/iPad smoke on public and auth routes", async ({ page }, testInfo) => {
    test.skip(!WEBKIT_SMOKE.has(testInfo.project.name), "WebKit smoke only");
    for (const route of ["/", "/login", "/admin"] as const) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await documentChrome(page);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("firefox login and admin smoke", async ({ page }, testInfo) => {
    test.skip(!FIREFOX_SMOKE.has(testInfo.project.name), "Firefox smoke only");
    for (const route of ["/login", "/admin"] as const) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await documentChrome(page);
      await assertNoHorizontalOverflow(page);
    }
  });

  test("phase 7.2 spec source stays free of forbidden artifacts", () => {
    expect(scanArtifactPrivacy(`${LONG_DE} ${LONG_PT} clinic@example.com ada@example.com`)).toEqual([]);
  });
});
