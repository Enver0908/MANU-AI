import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

async function bootstrapSettings(page: Page) {
  await page.request.post("/api/app-state");
}

async function isCompactViewport(page: Page) {
  const viewport = page.viewportSize();
  return !viewport || viewport.width < 1024;
}

test("settings nav is a real route link on desktop and mobile", async ({ page }) => {
  await bootstrapSettings(page);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible();

  const settingsLink = page.getByRole("link", { name: "Ayarlar" }).first();
  await expect(settingsLink).toBeVisible();
  await expect(settingsLink).toHaveAttribute("href", "/dashboard/settings");

  await settingsLink.click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByTestId("settings-fallback-banner")).toBeVisible();
});

test("invalid settings tab deep-links fall back to profile", async ({ page }) => {
  await bootstrapSettings(page);
  await page.goto("/dashboard/settings?tab=not-a-real-tab");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByTestId("settings-section-profile")).toBeVisible();
});

test("settings tabs switch across five sections in fallback demo", async ({ page }) => {
  await bootstrapSettings(page);
  await page.goto("/dashboard/settings");
  await expect(page.getByTestId("settings-page")).toBeVisible();
  await expect(page.getByTestId("settings-fallback-banner")).toBeVisible();

  const compact = await isCompactViewport(page);
  const tabs = [
    ["security", "settings-section-security"],
    ["workspace", "settings-section-workspace"],
    ["billing", "settings-section-billing"],
    ["application", "settings-section-application"],
    ["profile", "settings-section-profile"],
  ] as const;

  for (const [tab, sectionTestId] of tabs) {
    if (compact) {
      await page.getByRole("tab", { name: new RegExp(tab === "profile" ? "Profil" : tab === "security" ? "Güvenlik" : tab === "workspace" ? "Çalışma" : tab === "billing" ? "Plan" : "Uygulama") }).click();
    } else {
      await page.getByTestId(`settings-nav-${tab}`).click();
    }
    await expect(page).toHaveURL(tab === "profile" ? /\/dashboard\/settings$/ : new RegExp(`[?&]tab=${tab}`));
    await expect(page.getByTestId(sectionTestId)).toBeVisible();
  }

  await expect(page.getByTestId("settings-billing-portal")).toHaveCount(0);
  await expect(page.getByTestId("settings-profile-save")).toHaveCount(0);
});

test("settings page has no serious or critical accessibility violations", async ({ page }) => {
  await bootstrapSettings(page);
  await page.goto("/dashboard/settings?tab=workspace");
  await expect(page.getByTestId("settings-page")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious).toEqual([]);
});

test("settings content remains usable without horizontal overflow", async ({ page }) => {
  await bootstrapSettings(page);
  await page.goto("/dashboard/settings?tab=billing");
  await expect(page.getByTestId("settings-page")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
    };
  });
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
