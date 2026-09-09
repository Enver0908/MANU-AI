import { expect, test, type Page } from "@playwright/test";
import {
  conversationComposerInput,
  openConversation,
  openMessagingSection,
  openVisibleShellNavOrHref,
  visibleShellNavButton,
  bootstrapDashboard,
  assertRemovedProductionChrome,
  seedInboundSimulation,
  reloadAuthenticatedShell,
} from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

function visibleTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

async function returnToDashboardHome(page: Page) {
  await visibleShellNavButton(page, /Ana Sayfa|Home/i).click();
  await expect(page.getByRole("heading", { name: "Günlük iş girişi" })).toBeVisible();
}

async function openHomeWithActiveClient(page: Page) {
  await bootstrapDashboard(page);
  await visibleShellNavButton(page, /Danışanlar|Danisanlar/).click();
  await page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" }).click();
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();
  await returnToDashboardHome(page);
  await expect(page.getByTestId("overview-work-areas")).toBeVisible();
}

test("public landing and purchase intro render without app data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AIya", exact: true })).toBeVisible();
  const mobileMenuButton = page.getByRole("button", { name: /Menüyü aç/i });
  if (await mobileMenuButton.isVisible()) {
    await mobileMenuButton.click();
  }
  await expect(page.getByRole("link", { name: "Giriş yap" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Bize ulaşın" }).first()).toBeVisible();
  await expect(page.getByLabel("AIya ürün önizlemesi")).toBeVisible();
  await expect(page.getByRole("link", { name: "Davet koduyla başla" })).toHaveCount(0);
  await expect(page.getByText("NO-GO")).toHaveCount(0);

  await page.goto("/purchase");
  await expect(page.getByRole("heading", { name: "Davetli erişimi doğrulayın", level: 1, exact: true })).toBeVisible();
  await expect(page.getByLabel("Onaylı e-posta adresiniz")).toBeVisible();
  await expect(page.getByLabel("Davet kodu")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
});

test("dashboard core views render in fallback mode", async ({ page }) => {
  await bootstrapDashboard(page);
  await assertRemovedProductionChrome(page);
  await expect(page.getByTestId("shell-header-bell")).toBeVisible();

  await visibleShellNavButton(page, /Danışanlar|Danisanlar/).click();
  await page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" }).click();
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();
  await expect(page.getByText("AI Asistan ozeti")).toBeVisible();
  await visibleTestId(page, "tab-tab_personal_form").click();
  await expect(page.getByTestId("client-form-panel")).toBeVisible();
  const workspaceBack = page.getByTestId("client-workspace-back");
  if (await workspaceBack.isVisible()) {
    await workspaceBack.click();
    await expect(page.getByTestId("client-task-hub")).toBeVisible();
  }
  await visibleTestId(page, "tab-tab_food_rules").click();
  await expect(page.getByTestId("active-nutrition-plan-panel")).toBeVisible();
  if (await workspaceBack.isVisible()) {
    await workspaceBack.click();
  }
  await visibleTestId(page, "tab-tab_menu").click();
  await expect(page.getByTestId("menu-workflow-panel")).toBeVisible();
  if (await workspaceBack.isVisible()) {
    await workspaceBack.click();
  }
  await visibleTestId(page, "tab-tab_ai_assistant").click();
  await expect(page.getByText("Guvenlik kontrol listesi")).toBeVisible();

  await openMessagingSection(page);
  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByText("Kaynak etiketli mesaj geçmişi")).toBeVisible();
  await expect(page.getByRole("button", { name: "Manuel yanıtı kaydet" })).toBeVisible();

  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth < 1200) {
    const back = page.getByRole("button", { name: "Konuşma listesine dön" });
    if (await back.isVisible()) {
      await back.click();
      await expect(page.getByTestId("messaging-list-scroll")).toBeVisible();
    }
    await visibleShellNavButton(page, /Uyarılar|Uyarilar/).click();
    await expect(page.getByTestId("alerts-panel")).toBeVisible();
    await openVisibleShellNavOrHref(page, /Bildirimler/, "/dashboard?section=notifications");
    await expect(page.getByTestId("notifications-panel")).toBeVisible();
    await openVisibleShellNavOrHref(page, /Diğer|Diger/, "/dashboard/more");
    await expect(page.getByTestId("more-item-logout")).toBeVisible();
    await expect(page.getByTestId("more-item-settings")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    return;
  }

  await expect(page.getByTestId("shell-logout")).toBeVisible();
  await seedInboundSimulation(page, {
    clientId: "client-elif",
    body: "D vitamini takviyesi kullanayim mi?",
    idempotencyKey: `visual-yellow-${Date.now()}`,
  });
  await reloadAuthenticatedShell(page);

  await openMessagingSection(page);
  await openConversation(page, "conversation-client-elif", "client-elif");
  await expect(page.getByTestId("conversation-yellow-draft-review")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "İncelenmiş manuel yanıtı gönder" })).toBeVisible();

  await conversationComposerInput(page).fill(
    "BuCokUzunTekKelimeTasmasiniKontrolEtmekIcinYazildiBuCokUzunTekKelimeTasmasiniKontrolEtmekIcinYazildi",
  );
  await page.getByRole("button", { name: "Manuel yanıtı kaydet" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

  await visibleShellNavButton(page, /Danışanlar|Danisanlar/).click();
  await page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" }).click();
  await visibleTestId(page, "tab-tab_ai_assistant").click();
  const dietPlanReviewed = page.getByTestId("client-detail").getByLabel("Diet plan reviewed");
  await expect(dietPlanReviewed).toBeVisible();
  const dietPlanEditable = await dietPlanReviewed.isEnabled();
  if (dietPlanEditable) {
    await dietPlanReviewed.click();
    await expect(dietPlanReviewed).not.toBeChecked();
    await seedInboundSimulation(page, {
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: `visual-safety-${Date.now()}`,
    });
    await visibleShellNavButton(page, /Danışanlar|Danisanlar/).click();
    await page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" }).click();
    await visibleTestId(page, "tab-tab_ai_assistant").click();
    await dietPlanReviewed.click();
    await expect(dietPlanReviewed).toBeChecked();
  }

  await seedInboundSimulation(page, {
    clientId: "client-mert",
    body: "Alerjiden nefes alamiyorum, bogazim sisti.",
    idempotencyKey: `visual-red-${Date.now()}`,
  });
  await seedInboundSimulation(page, {
    clientId: "client-elif",
    body: "Yeni taslak bildirimini hazirla.",
    idempotencyKey: `visual-notification-first-${Date.now()}`,
  });
  await seedInboundSimulation(page, {
    clientId: "client-elif",
    body: "Ayni taslagi yeniden degerlendir.",
    idempotencyKey: `visual-notification-second-${Date.now()}`,
  });
  await reloadAuthenticatedShell(page);

  await visibleShellNavButton(page, /Uyarılar|Uyarilar/).click();
  await expect(page.getByTestId("alerts-panel")).toBeVisible();
  await expect(page.getByTestId("alerts-panel")).toHaveScreenshot("stage4b-alerts-panel.png", {
    animations: "disabled",
    maxDiffPixels: 8_000,
    maskColor: "#e7e5e4",
    mask: [
      page.getByTestId("alerts-panel").locator('[data-testid^="clinical-alert-row-"] .text-xs'),
      page.getByTestId("alerts-panel").locator("p.text-xs"),
    ],
  });
  await page.getByLabel("Uyarı ara").focus();
  await expect(page.getByLabel("Uyarı ara")).toBeFocused();
  await expect(page.getByTestId("alerts-panel").getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Tümü/i })).toBeVisible();
  await expect(page.getByLabel("Uyarı ara")).toBeVisible();
  const alertsStickyFilters = page.locator('[data-testid="alerts-panel"] .sticky');
  await expect(alertsStickyFilters).toBeVisible();
  const alertRow = page.locator('[data-testid^="clinical-alert-row-"]').first();
  if (await alertRow.count()) {
    const alertRowBox = await alertRow.boundingBox();
    expect(alertRowBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(alertRowBox?.height ?? 0).toBeLessThanOrEqual(140);
  }
  await page.getByLabel("Uyarı ara").fill(
    "UzunAramaMetniTasmaKontroluIcinYazildiUzunAramaMetniTasmaKontroluIcin",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

  await visibleShellNavButton(page, "Bildirimler").click();
  await expect(page.getByTestId("notifications-panel")).toBeVisible();
  await expect(page.getByTestId("notifications-panel")).toHaveScreenshot("stage4b-notifications-panel.png", {
    animations: "disabled",
    maxDiffPixels: 12_000,
    maskColor: "#e7e5e4",
    mask: [
      page.getByTestId("notifications-panel").locator('[data-testid^="system-notification-row-"] .text-xs'),
      page.getByTestId("notifications-panel").locator("p.text-xs"),
    ],
  });
  await page.getByLabel("Bildirim ara").focus();
  await expect(page.getByLabel("Bildirim ara")).toBeFocused();
  await expect(page.getByTestId("notifications-panel").getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Aktif/i })).toBeVisible();
  await expect(page.getByLabel("Bildirim ara")).toBeVisible();
  const notificationsStickyFilters = page.locator('[data-testid="notifications-panel"] .sticky');
  await expect(notificationsStickyFilters).toBeVisible();
  const notificationRow = page.locator('[data-testid^="system-notification-row-"]').first();
  if (await notificationRow.count()) {
    const notificationRowBox = await notificationRow.boundingBox();
    expect(notificationRowBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(notificationRowBox?.height ?? 0).toBeLessThanOrEqual(200);
  }
  await page.getByLabel("Bildirim ara").fill(
    "UzunBildirimAramaMetniTasmaKontroluIcinYazildiUzunBildirimAramaMetni",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);

  const formsNav = page.getByRole("button", { name: "Formlar" });
  if (await formsNav.isVisible()) {
    await formsNav.click();
    await expect(page.getByRole("heading", { name: "Dinamik form şemaları" })).toBeVisible();
    await expect(page.getByLabel("Şema başlığı")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  }
});

test("dashboard work areas route through the active client and AI Chat guards", async ({ page }) => {
  await openHomeWithActiveClient(page);

  const workAreas = page.getByTestId("overview-work-areas");
  await expect(workAreas.getByRole("button")).toHaveCount(4);
  for (const testId of [
    "overview-work-area-forms",
    "overview-work-area-nutrition",
    "overview-work-area-menu",
    "overview-work-area-ai-chat",
  ]) {
    await expect(page.getByTestId(testId)).toBeEnabled();
  }

  const clientTasks = [
    {
      testId: "overview-work-area-forms",
      task: "forms",
      path: "/api/clients/client-mert/forms",
      panel: "client-form-panel",
    },
    {
      testId: "overview-work-area-nutrition",
      task: "nutrition",
      path: "/api/clients/client-mert/food-rule-profile",
      panel: "active-nutrition-plan-panel",
    },
    {
      testId: "overview-work-area-menu",
      task: "menu",
      path: "/api/clients/client-mert/menu-plans",
      panel: "menu-workflow-panel",
    },
  ] as const;
  const requests: Array<{ method: string; path: string }> = [];
  page.on("request", (request) => {
    requests.push({ method: request.method(), path: new URL(request.url()).pathname });
  });

  for (const clientTask of clientTasks) {
    const requestsBefore = requests.length;
    const taskResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" && new URL(response.url()).pathname === clientTask.path,
    );
    await page.getByTestId(clientTask.testId).click();
    await expect(page).toHaveURL(
      new RegExp(`section=clients.*clientId=client-mert.*clientTask=${clientTask.task}`),
    );
    await taskResponse;
    await expect(page.getByTestId(clientTask.panel)).toBeVisible();

    // The task click must stay on the bounded Stage 6 resource path.
    const taskRequests = requests.slice(requestsBefore);
    expect(taskRequests).toContainEqual({ method: "GET", path: clientTask.path });
    expect(taskRequests).not.toContainEqual({ method: "GET", path: "/api/app-state" });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await returnToDashboardHome(page);
    await expect(page.getByTestId("overview-work-areas")).toBeVisible();
  }

  await page.getByTestId("overview-work-area-ai-chat").click();
  await expect(page).toHaveURL(/\/dashboard\/ai-chat$/);
  expect(page.url()).not.toMatch(/clientId=/);
  await expect(page.getByTestId("ai-chat-workspace")).toBeVisible();
});

test("dashboard work areas stay guarded when the client context is invalid", async ({ page }) => {
  await bootstrapDashboard(page);
  await page.goto("/dashboard?clientId=missing-client");
  await expect(page.getByTestId("overview-work-areas")).toBeVisible();

  for (const testId of [
    "overview-work-area-forms",
    "overview-work-area-nutrition",
    "overview-work-area-menu",
  ]) {
    await expect(page.getByTestId(testId)).toBeDisabled();
    await expect(page.getByTestId(testId)).toContainText("Aktif danışan gerekli");
  }
  await expect(page).toHaveURL(/clientId=missing-client/);
});

test("dashboard work area shortcuts remain keyboard-operable", async ({ page }) => {
  await openHomeWithActiveClient(page);
  const shortcut = page.getByTestId("overview-work-area-forms");
  await shortcut.focus();
  await expect(shortcut).toBeFocused();

  const taskResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/clients/client-mert/forms",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/section=clients.*clientId=client-mert.*clientTask=forms/);
  await taskResponse;
  await expect(page.getByTestId("client-form-panel")).toBeVisible();
});

test("retired simulator query section redirects to dashboard home", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard?section=simulator");
  await expect(page).toHaveURL(/\/dashboard\/?$/);
  await expect(page.getByRole("heading", { name: "Günlük iş girişi" })).toBeVisible();
  await expect(page.getByTestId("visual-simulator-panel")).toHaveCount(0);
  await expect(page.getByTestId("voice-simulator-panel")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gelen mesaj simülatörü" })).toHaveCount(0);
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
