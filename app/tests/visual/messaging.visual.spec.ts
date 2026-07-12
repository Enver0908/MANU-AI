import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  bootstrapDashboard,
  conversationComposerInput,
  ensureMessagingListVisible,
  openConversation,
  openMessagingSection,
} from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

test("stage 4b-2 messaging surfaces render across viewports", async ({ page }) => {
  await bootstrapDashboard(page);
  await openMessagingSection(page);
  await ensureMessagingListVisible(page);

  await expect(page.getByTestId("messaging-panel")).toHaveScreenshot("stage4b2-messaging-list.png", {
    animations: "disabled",
    maxDiffPixels: 2_000,
    maskColor: "#e7e5e4",
    mask: [
      page.locator('[data-testid^="conversation-list-row-"]'),
      page.locator('[data-testid="conversation-panel"] .text-xs'),
    ],
  });
  await page.getByLabel("Konuşma ara").focus();
  await expect(page.getByLabel("Konuşma ara")).toBeFocused();
  await assertNoHorizontalOverflow(page);

  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByTestId("conversation-panel")).toHaveScreenshot("stage4b2-messaging-detail.png", {
    animations: "disabled",
    maxDiffPixels: 2_000,
    maskColor: "#e7e5e4",
    mask: [page.locator('[data-testid="conversation-panel"] .text-xs')],
  });
  const composer = conversationComposerInput(page);
  await composer.focus();
  await expect(composer).toBeFocused();
  await assertNoHorizontalOverflow(page);

  const simulatorSection = page
    .getByRole("heading", { name: "Gelen mesaj simülatörü" })
    .locator("xpath=ancestor::section[1]");
  await page.getByRole("button", { name: "Simülatör" }).click();
  await simulatorSection.getByRole("combobox").selectOption({ label: "Elif Demir" });
  await simulatorSection.getByLabel("İstek anahtarı").fill(`visual-4b2-yellow-${Date.now()}`);
  await simulatorSection.getByLabel("Gelen mesaj").fill("D vitamin takviyesi kullanayim mi?");
  await page.getByRole("button", { name: "Gelen akışı çalıştır" }).click();
  await expect(page.getByText("draft_for_approval")).toBeVisible({ timeout: 20_000 });

  await openMessagingSection(page);
  await openConversation(page, "conversation-client-elif", "client-elif");
  await expect(page.getByTestId("conversation-yellow-draft-review")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("conversation-yellow-draft-review")).toHaveScreenshot(
    "stage4b2-messaging-yellow-draft.png",
    { animations: "disabled", maxDiffPixels: 2_000 },
  );
  await assertNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Simülatör" }).click();
  await simulatorSection.getByRole("combobox").selectOption({ label: "Mert Kaya" });
  await simulatorSection.getByLabel("İstek anahtarı").fill(`visual-4b2-red-${Date.now()}`);
  await simulatorSection.getByLabel("Gelen mesaj").fill("Alerjiden nefes alamiyorum, bogazim sisti.");
  await page.getByRole("button", { name: "Gelen akışı çalıştır" }).click();
  await expect(page.getByText("handoff").first()).toBeVisible({ timeout: 20_000 });

  await openMessagingSection(page);
  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByTestId("conversation-red-banner")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("conversation-panel")).toHaveScreenshot("stage4b2-messaging-red-manual.png", {
    animations: "disabled",
    maxDiffPixels: 10_000,
    maskColor: "#e7e5e4",
    mask: [
      page.locator('[data-testid="conversation-panel"] .text-xs'),
      page.locator('[data-testid="conversation-panel"] ul'),
    ],
  });
  await conversationComposerInput(page).fill("Acil durumda 112'yi arayin.");
  await assertNoHorizontalOverflow(page);

  await page.route("**/api/conversations/**/messages**", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json?.permissions) {
      json.permissions = {
        ...json.permissions,
        isReadOnly: true,
        canSendManualReply: false,
        canReviewDraft: false,
        canControlAi: false,
        canMutateConversation: false,
      };
    }
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      contentType: "application/json",
      body: JSON.stringify(json),
    });
  });
  await page.reload();
  await bootstrapDashboard(page);
  await openMessagingSection(page);
  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByText("salt okunur", { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("conversation-composer")).toHaveCount(0);
  await expect(page.getByTestId("conversation-yellow-draft-review")).toHaveCount(0);
  await expect(page.getByTestId("conversation-ai-controls")).toHaveCount(0);
  await expect(page.getByTestId("conversation-panel")).toHaveScreenshot("stage4b2-messaging-read-only.png", {
    animations: "disabled",
    maxDiffPixels: 2_000,
  });
  await assertNoHorizontalOverflow(page);
});
