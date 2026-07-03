import { expect, test } from "@playwright/test";

test("customer login page renders magic-link form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Müşteri girişi" })).toBeVisible();
  await expect(page.getByLabel("Kayıtlı müşteri e-postası")).toBeVisible();
  await expect(page.getByRole("button", { name: /Giriş bağlantısı gönder/i })).toBeVisible();
});

test("admin login page renders allowlist guidance", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Yönetim paneli girişi" })).toBeVisible();
  await expect(page.getByLabel("Yönetici e-posta")).toBeVisible();
  await expect(page.getByRole("link", { name: /commercial-admin\/emergency/i })).toBeVisible();
});

test("purchase success onboarding shell renders account CTA", async ({ page }) => {
  await page.goto("/purchase/success?session_id=cs_test_visual");
  await expect(page.getByRole("heading", { name: "Ödeme alındı" })).toBeVisible();
  await expect(page.getByLabel("Ödeme e-postası")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hesabını oluştur/i })).toBeVisible();
});

test("marketing contact form renders on landing", async ({ page }) => {
  await page.goto("/#contact");
  await expect(page.getByRole("heading", { name: "Erişim ve demo talebi" })).toBeVisible();
  await expect(page.getByLabel("Ad soyad")).toBeVisible();
  await expect(page.getByLabel("E-posta")).toBeVisible();
  await expect(page.getByLabel("Mesaj")).toBeVisible();
});

test("onboarding route fails closed without configured auth", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});
