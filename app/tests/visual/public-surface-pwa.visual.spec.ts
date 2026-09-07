import { expect, test, type Page } from "@playwright/test";
import { assertRemovedProductionChrome, bootstrapDashboard } from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(1);
}

async function assertPrimaryControlReachable(page: Page, name: string | RegExp) {
  const control = page.getByRole("button", { name }).or(page.getByRole("link", { name })).first();
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
}

test("360px public login onboarding and app-install stay readable without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AIya", exact: true })).toBeVisible();
  const menuButton = page.getByRole("button", { name: /Menüyü aç/i });
  if (await menuButton.isVisible()) {
    await menuButton.click();
  }
  await expect(page.getByRole("link", { name: "Bize ulaşın" }).locator("visible=true").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Giriş yap" }).locator("visible=true").first()).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "E-posta ve şifreyle giriş" })).toBeVisible();
  await expect(page.getByLabel("E-posta adresi")).toBeVisible();
  await expect(page.getByLabel("Şifre")).toBeVisible();
  await assertPrimaryControlReachable(page, "Giriş yap");
  await page.keyboard.press("Tab");
  const loginFocused = await page.evaluate(() => document.activeElement?.tagName ?? "BODY");
  expect(["BODY", "HTML"]).not.toContain(loginFocused);
  await assertNoHorizontalOverflow(page);

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
  await assertNoHorizontalOverflow(page);

  await page.goto("/app-install");
  await expect(page.getByRole("heading", { name: "Mobil kurulum kapalı" })).toBeVisible();
  await expect(page.getByText(/klinik veriler|sağlık verisi|danışan kaydı/i)).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test("tablet and desktop public auth surfaces keep focus order and no overlap overflow", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "E-posta ve şifreyle giriş" })).toBeVisible();
  await page.getByLabel("E-posta adresi").focus();
  await expect(page.getByLabel("E-posta adresi")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Şifre")).toBeFocused();
  await assertNoHorizontalOverflow(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "AIya yönetim girişi" })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("installed-style Android PWA dashboard hides Phase 1 chrome and privacy-locks offline", async ({ page }) => {
  // Installed Android PWA is the same authenticated shell (manifest start_url=/dashboard).
  // Do not stub matchMedia before bootstrap; an incomplete MediaQueryList can fail-close the shell.
  await bootstrapDashboard(page);
  await assertRemovedProductionChrome(page);
  await expect(page.getByTestId("authenticated-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Günlük iş girişi" })).toBeVisible();
  await assertNoHorizontalOverflow(page);

  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByTestId("shell-blocker")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("shell-blocker")).toHaveAttribute("data-shell-runtime", "offline");
  await expect(page.getByText("İnternet bağlantısı gerekli")).toBeVisible();
  await expect(page.getByText("Korumalı içerik çevrimdışıyken açılamaz")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Günlük iş girişi" })).toHaveCount(0);
  await expect(page.getByTestId("client-roster-item")).toHaveCount(0);
});
