import { expect, test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  assertRemovedProductionChrome,
  bootstrapDashboard,
  conversationComposerInput,
  ensureMessagingListVisible,
  openConversation,
  openMessagingSection,
  seedInboundSimulation,
  reloadAuthenticatedShell,
} from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

test("stage 4b-2 messaging surfaces render across viewports", async ({ page }) => {
  await bootstrapDashboard(page);
  await assertRemovedProductionChrome(page);
  await openMessagingSection(page);
  await ensureMessagingListVisible(page);
  await page.getByLabel("Konuşma ara").focus();
  await expect(page.getByLabel("Konuşma ara")).toBeFocused();
  await assertNoHorizontalOverflow(page);

  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByTestId("conversation-panel")).toBeVisible();
  await expect(page.getByTestId("conversation-open-workspace")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gelen mesajı simüle et" })).toHaveCount(0);
  const composer = conversationComposerInput(page);
  await composer.focus();
  await expect(composer).toBeFocused();
  await assertNoHorizontalOverflow(page);

  await seedInboundSimulation(page, {
    clientId: "client-elif",
    body: "D vitamin takviyesi kullanayim mi?",
    idempotencyKey: `visual-4b2-yellow-${Date.now()}`,
  });
  await reloadAuthenticatedShell(page);

  await openMessagingSection(page);
  await openConversation(page, "conversation-client-elif", "client-elif");
  await expect(page.getByTestId("conversation-yellow-draft-review")).toBeVisible({ timeout: 20_000 });
  await assertNoHorizontalOverflow(page);

  await seedInboundSimulation(page, {
    clientId: "client-mert",
    body: "Alerjiden nefes alamiyorum, bogazim sisti.",
    idempotencyKey: `visual-4b2-red-${Date.now()}`,
  });
  await reloadAuthenticatedShell(page);

  await openMessagingSection(page);
  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByTestId("conversation-red-banner")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("conversation-open-workspace")).toBeVisible();
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
        canActivateAi: false,
        canConfigureAi: false,
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
  await assertNoHorizontalOverflow(page);
});
