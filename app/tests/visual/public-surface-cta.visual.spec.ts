import { expect, test } from "@playwright/test";

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
}

test("public landing CTAs are contact and login without invite-start links", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AIya", exact: true })).toBeVisible();
  const mobileMenuButton = page.getByRole("button", { name: /Menüyü aç/i });
  if (await mobileMenuButton.isVisible()) {
    await mobileMenuButton.click();
  }

  const contactCta = page.getByRole("link", { name: "Bize ulaşın" }).locator("visible=true").first();
  const loginCta = page.getByRole("link", { name: "Giriş yap" }).locator("visible=true").first();
  await expect(contactCta).toBeVisible();
  await expect(loginCta).toBeVisible();
  await expect(page.getByRole("link", { name: "Davet koduyla başla" })).toHaveCount(0);
  await expect(page.getByText("NO-GO")).toHaveCount(0);
  await expect(page.getByText(/sandbox/i)).toHaveCount(0);

  const contactBox = await contactCta.boundingBox();
  expect(contactBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await assertNoHorizontalOverflow(page);

  await contactCta.click();
  await expect(page.getByRole("heading", { name: "Erişim talebi bırakın" })).toBeVisible();
  await expect(page.getByText("Onay sonrası kurulum bağlantısı e-posta ile gelir")).toBeVisible();
  await expect(page.getByText(/davet kodu/i)).toHaveCount(0);
});

test("customer login and admin login remain separate routes", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "E-posta ve şifreyle giriş" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Bize ulaşın" })).toBeVisible();
  await expect(page.getByText("NO-GO")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "AIya yönetim girişi" })).toBeVisible();
  await expect(page.getByLabel("Yönetici e-posta")).toBeVisible();
  await expect(page.getByText("NO-GO")).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});

test("purchase remains available by direct URL without public nav CTA", async ({ page }) => {
  await page.goto("/purchase");
  await expect(page.getByRole("heading", { name: "Davetli erişimi doğrulayın" })).toBeVisible();
  await expect(page.getByLabel("Davet kodu")).toBeVisible();
  await expect(page.getByText(/sandbox/i)).toHaveCount(0);
  await assertNoHorizontalOverflow(page);
});
