import { expect, test } from "@playwright/test";

test("public landing and purchase intro render without app data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "SiriusAI", exact: true })).toBeVisible();
  const mobileMenuButton = page.getByRole("button", { name: /Menüyü aç/i });
  if (await mobileMenuButton.isVisible()) {
    await mobileMenuButton.click();
  }
  await expect(page.getByRole("link", { name: "Giriş yap" })).toBeVisible();
  await expect(page.getByRole("link", { name: "İletişime geç" }).first()).toBeVisible();
  await expect(page.getByLabel("SiriusAI ürün önizlemesi")).toBeVisible();
  await expect(page.getByRole("link", { name: "Davet koduyla başla" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Davet koduyla başla" }).first().click();
  await expect(page.getByRole("heading", { name: "Davet koduyla başla", level: 1, exact: true })).toBeVisible();
  await expect(page.getByLabel("Onaylı e-posta adresiniz")).toBeVisible();
  await expect(page.getByLabel("Davet kodu")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});

test("dashboard core views render in fallback mode", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible();
  await expect(page.getByText("PWA hazır")).toBeVisible();

  await page.getByRole("button", { name: "Danışanlar" }).click();
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();
  await expect(page.getByText("AI Asistan ozeti")).toBeVisible();
  await page.getByTestId("tab-tab_ai_assistant").click();
  await expect(page.getByText("Guvenlik kontrol listesi")).toBeVisible();

  await page.getByRole("button", { name: "Görüşme" }).click();
  await expect(page.getByText("Kaynak etiketli görüşme zaman çizelgesi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manuel yanıtı kaydet" })).toBeVisible();

  await page.getByRole("button", { name: "Simülatör" }).click();
  await expect(page.getByRole("heading", { name: "Gelen mesaj simülatörü" })).toBeVisible();
  const simulatorSection = page
    .getByRole("heading", { name: "Gelen mesaj simülatörü" })
    .locator("xpath=ancestor::section[1]");
  const runInboundButton = page.getByRole("button", { name: "Gelen akışı çalıştır" });
  await expect(runInboundButton).toBeVisible();
  const runInboundBox = await runInboundButton.boundingBox();
  expect(runInboundBox?.height ?? 0).toBeGreaterThanOrEqual(44);

  await simulatorSection.getByRole("combobox").selectOption({ label: "Elif Demir" });
  await simulatorSection.getByLabel("İstek anahtarı").fill(`visual-yellow-${Date.now()}`);
  await simulatorSection.getByLabel("Gelen mesaj").fill("D vitamini takviyesi kullanayim mi?");
  await page.getByRole("button", { name: "Gelen akışı çalıştır" }).click();
  await expect(page.getByText("draft_for_approval")).toBeVisible();

  await page.getByRole("button", { name: "Görüşme" }).click();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit & send" })).toBeVisible();

  await page.getByLabel("Yanıt metni", { exact: true }).fill(
    "BuCokUzunTekKelimeTasmasiniKontrolEtmekIcinYazildiBuCokUzunTekKelimeTasmasiniKontrolEtmekIcinYazildi",
  );
  await page.getByRole("button", { name: "Manuel yanıtı kaydet" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

  await page.getByRole("button", { name: "Danışanlar" }).click();
  await page.getByRole("button", { name: /Mert Kaya/ }).click();
  await page.getByTestId("tab-tab_ai_assistant").click();
  await page.getByLabel("Diet plan reviewed").click();
  await expect(page.getByLabel("Diet plan reviewed")).not.toBeChecked();

  await page.getByRole("button", { name: "Simülatör" }).click();
  await simulatorSection.getByRole("combobox").selectOption({ label: "Mert Kaya" });
  await simulatorSection.getByLabel("İstek anahtarı").fill(`visual-safety-${Date.now()}`);
  await simulatorSection.getByLabel("Gelen mesaj").fill("Bugun kahvaltida ne yiyebilirim?");
  await page.getByRole("button", { name: "Gelen akışı çalıştır" }).click();
  await expect(page.getByText("mandatory_safety_fields_missing")).toBeVisible();

  await page.getByRole("button", { name: "Danışanlar" }).click();
  await page.getByRole("button", { name: /Mert Kaya/ }).click();
  await page.getByTestId("tab-tab_ai_assistant").click();
  await page.getByLabel("Diet plan reviewed").click();
  await expect(page.getByLabel("Diet plan reviewed")).toBeChecked();

  await page.getByRole("button", { name: "Simülatör" }).click();
  await simulatorSection.getByRole("combobox").selectOption({ label: "Mert Kaya" });
  await simulatorSection.getByLabel("İstek anahtarı").fill(`visual-red-${Date.now()}`);
  await simulatorSection.getByLabel("Gelen mesaj").fill("Alerjiden nefes alamiyorum, bogazim sisti.");
  await page.getByRole("button", { name: "Gelen akışı çalıştır" }).click();
  await expect(page.getByText("handoff").first()).toBeVisible();

  await page.getByRole("button", { name: "Devirler" }).click();
  await expect(page.getByRole("heading", { name: "Devir kuyruğu" })).toBeVisible();
  await expect(page.getByText("possible_severe_allergic_reaction")).toBeVisible();

  await page.getByRole("button", { name: "Formlar" }).click();
  await expect(page.getByRole("heading", { name: "Dinamik form şemaları" })).toBeVisible();
  await expect(page.getByLabel("Şema başlığı")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});

test("purchase success and cancel pages render without app data", async ({ page }) => {
  await page.goto("/purchase/success");
  await expect(page.getByRole("heading", { name: "Ödeme doğrulandı" })).toBeVisible();
  await expect(page.getByLabel("Ödeme e-postası")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hesabını oluştur/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /onboarding ekranına geçin/i })).toBeVisible();

  await page.goto("/purchase/cancel");
  await expect(page.getByRole("heading", { name: "Ödeme tamamlanmadı" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Tekrar dene" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});

test("app install center shows fallback blocked state without Supabase", async ({ page }) => {
  await page.goto("/app-install");
  await expect(page.getByRole("heading", { name: "Mobil kurulum kapalı" })).toBeVisible();
  await expect(
    page.getByText("Mobil uygulama kurulumu yalnızca aktif abonelikli Supabase hesapları için kullanılabilir."),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});
