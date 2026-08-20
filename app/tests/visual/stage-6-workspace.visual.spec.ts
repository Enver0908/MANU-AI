import { expect, test, type Page } from "@playwright/test";
import {
  conversationComposerInput,
  openConversation,
  openMessagingSection,
  openVisibleShellNavOrHref,
} from "./messaging-visual-helpers";

test.describe.configure({ timeout: 120_000 });

function visibleTestId(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

async function openDashboard(page: Page) {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Operasyon paneli" })).toBeVisible();
}

async function assertNoHorizontalPageScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function openMertWorkspace(page: Page) {
  await page.goto("/dashboard?section=clients");
  await expect(page.getByTestId("client-roster")).toBeVisible();
  await page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" }).click();
  await expect(page.getByTestId("client-workspace-header")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();
}

test("home shows active client and queue entries without invented KPIs", async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByRole("heading", { name: "Günlük iş girişi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aktif danışan" })).toBeVisible();
  await expect(page.getByText("AI gönderimleri")).toHaveCount(0);
  await assertNoHorizontalPageScroll(page);
});

test("client list, hub, and tasks stay usable without horizontal overflow", async ({ page }) => {
  await openDashboard(page);
  await openMertWorkspace(page);
  await expect(page.getByTestId("client-workspace")).toBeVisible();
  await visibleTestId(page, "tab-tab_personal_form").click();
  await expect(page.getByTestId("client-form-panel")).toBeVisible();
  const formSave = page.getByTestId("client-form-save");
  const saveBox = await formSave.boundingBox();
  expect(saveBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  await assertNoHorizontalPageScroll(page);

  const back = page.getByTestId("client-workspace-back");
  const mobileStack = await back.isVisible();
  if (mobileStack) {
    await back.click();
    await expect(page.getByTestId("client-task-hub")).toBeVisible();
    const hubButton = visibleTestId(page, "tab-tab_food_rules");
    const hubBox = await hubButton.boundingBox();
    expect(hubBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  await visibleTestId(page, "tab-tab_food_rules").click();
  await expect(page.getByTestId("active-nutrition-plan-panel")).toBeVisible();
  if (mobileStack) await back.click();
  await visibleTestId(page, "tab-tab_menu").click();
  await expect(page.getByTestId("menu-workflow-panel")).toBeVisible();
  if (mobileStack) await back.click();
  await visibleTestId(page, "tab-tab_ai_assistant").click();
  await expect(page.getByText("Guvenlik kontrol listesi")).toBeVisible();
  await assertNoHorizontalPageScroll(page);

  if (mobileStack) {
    await back.click();
    await expect(page.getByTestId("client-task-hub")).toBeVisible();
    await back.click();
    await expect(page.getByTestId("client-roster")).toBeVisible();
  }
});

test("narrow 320px client hub does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openDashboard(page);
  await openMertWorkspace(page);
  await expect(page.locator('[data-testid="client-task-hub"]:visible, [data-testid="client-detail-tabs"]:visible')).toBeVisible();
  await assertNoHorizontalPageScroll(page);
});

test("inaccessible client deep-link stays fail-closed", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard?section=clients&clientId=missing-client");
  await expect(page.getByTestId("client-workspace-inaccessible")).toBeVisible();
  await expect(page.getByText("Danışan artık erişilemiyor")).toBeVisible();
  await expect(page.getByText("Başka bir danışana yönlendirilmedi.")).toBeVisible();
});

test("desktop keeps the roster beside the workspace", async ({ page }) => {
  const viewport = page.viewportSize();
  test.skip((viewport?.width ?? 0) < 1024, "desktop list/detail only");
  await openDashboard(page);
  await openMertWorkspace(page);
  await expect(page.getByTestId("client-roster")).toBeVisible();
  await expect(page.getByTestId("client-workspace-header")).toBeVisible();
  await expect(page.getByTestId("client-detail-tabs")).toBeVisible();
});

test("keyboard can open a client task from the roster", async ({ page }) => {
  await openDashboard(page);
  await page.goto("/dashboard?section=clients");
  const firstClient = page.getByTestId("client-roster-item").first();
  await firstClient.focus();
  await expect(firstClient).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("client-workspace-header")).toBeVisible();
});

test("client switching keeps an unsaved roster draft behind the central dirty guard", async ({ page }) => {
  await openDashboard(page);
  await page.goto("/dashboard?section=clients");
  await page.getByLabel("Tam ad").fill("Taslak Danışan");

  const mert = page.getByTestId("client-roster-item").filter({ hasText: "Mert Kaya" });
  await mert.click();
  await expect(page.getByTestId("shell-dirty-navigation-dialog")).toBeVisible();
  await expect(page).toHaveURL(/section=clients/);
  await expect(page).not.toHaveURL(/clientId=client-mert/);

  await page.getByTestId("shell-dirty-stay").click();
  await expect(page.getByLabel("Tam ad")).toHaveValue("Taslak Danışan");

  await mert.click();
  await page.getByTestId("shell-dirty-discard").click();
  await expect(page).toHaveURL(/clientId=client-mert/);
  await expect(page.getByRole("heading", { name: "Mert Kaya" })).toBeVisible();
});

test("bounded form refresh marks a successful save clean before task navigation", async ({ page }) => {
  await openDashboard(page);
  await openMertWorkspace(page);
  const broadMutationRefreshes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/app-state") {
      broadMutationRefreshes.push(request.url());
    }
  });
  await visibleTestId(page, "tab-tab_personal_form").click();
  const form = page.getByTestId("client-form-panel");
  await expect(form).toBeVisible();
  const editable = form.locator("textarea").first();
  await editable.fill(`${await editable.inputValue()} güncel`);
  await page.getByTestId("client-form-save").click();
  await expect(page.getByTestId("client-workspace-loading")).toBeHidden();
  await expect(form).toBeVisible();

  const back = page.getByTestId("client-workspace-back");
  if (await back.isVisible()) {
    await back.click();
    await expect(page.getByTestId("shell-dirty-navigation-dialog")).toHaveCount(0);
  }
  await visibleTestId(page, "tab-tab_food_rules").click();
  await expect(page.getByTestId("shell-dirty-navigation-dialog")).toHaveCount(0);
  await expect(page.getByTestId("active-nutrition-plan-panel")).toBeVisible();
  expect(broadMutationRefreshes).toEqual([]);
});

test("workspace tasks load bounded resources lazily without broad app-state reads", async ({ page }) => {
  await openDashboard(page);
  await openMertWorkspace(page);
  const requests: Array<{ method: string; path: string }> = [];
  page.on("request", (request) => {
    requests.push({ method: request.method(), path: new URL(request.url()).pathname });
  });

  const back = page.getByTestId("client-workspace-back");
  const mobileStack = await back.isVisible();
  const tasks = [
    { testId: "tab-tab_personal_form", panel: "client-form-panel", path: "/api/clients/client-mert/forms" },
    { testId: "tab-tab_food_rules", panel: "active-nutrition-plan-panel", path: "/api/clients/client-mert/food-rule-profile" },
    { testId: "tab-tab_menu", panel: "menu-workflow-panel", path: "/api/clients/client-mert/menu-plans" },
  ];

  for (const task of tasks) {
    if (mobileStack && !(await visibleTestId(page, task.testId).isVisible())) {
      await back.click();
      await expect(page.getByTestId("client-task-hub")).toBeVisible();
    }
    const response = page.waitForResponse(
      (candidate) => candidate.request().method() === "GET" && new URL(candidate.url()).pathname === task.path,
    );
    await visibleTestId(page, task.testId).click();
    await response;
    await expect(page.getByTestId(task.panel)).toBeVisible();
  }

  expect(requests.some((request) => request.path === "/api/app-state")).toBe(false);
  for (const task of tasks) {
    expect(requests.filter((request) => request.method === "GET" && request.path === task.path)).toHaveLength(1);
  }
});

test("messaging list and detail split on mobile and stay side by side on desktop", async ({ page }) => {
  await openDashboard(page);
  await openMessagingSection(page);
  await expect(page.getByTestId("messaging-list-scroll")).toBeVisible();
  await openConversation(page, "conversation-client-mert", "client-mert");
  await expect(page.getByTestId("conversation-panel")).toBeVisible();
  const composer = conversationComposerInput(page);
  await composer.focus();
  await expect(composer).toBeFocused();
  await assertNoHorizontalPageScroll(page);

  const back = page.getByRole("button", { name: "Konuşma listesine dön" });
  const compactStack = await back.isVisible();
  if (compactStack) {
    await expect(page.getByTestId("messaging-list-scroll")).toBeHidden();
    await back.click();
    await expect(page.getByTestId("messaging-list-scroll")).toBeVisible();
    await expect(page.getByTestId("conversation-panel")).toHaveCount(0);
  } else {
    await expect(page.getByTestId("messaging-list-scroll")).toBeVisible();
    await expect(page.getByTestId("conversation-panel")).toBeVisible();
  }
});

test("inaccessible conversation target stays fail-closed", async ({ page }) => {
  await page.request.post("/api/app-state");
  await page.goto("/dashboard?section=messages&clientId=missing-client&conversationId=missing-conversation");
  await expect(page.getByTestId("messaging-target-unavailable")).toBeVisible();
  await expect(page.getByText("Artık erişilemiyor")).toBeVisible();
});

test("workspace messaging shortcut and More AI Chat stay capability-filtered", async ({ page }) => {
  await openDashboard(page);
  await openMertWorkspace(page);
  await page.getByTestId("client-workspace-open-messages").click();
  await expect(page.getByTestId("messaging-panel")).toBeVisible();
  await expect(page).toHaveURL(/section=messages/);
  await expect(page).toHaveURL(/clientId=client-mert/);

  await openVisibleShellNavOrHref(page, /Diğer|Diger/, "/dashboard/more");
  await expect(page.getByTestId("more-page")).toBeVisible();
  const aiChat = page.getByTestId("more-item-ai_chat");
  const aiChatDisabled = page.getByTestId("more-item-ai_chat-disabled");
  if (await aiChat.isVisible()) {
    await aiChat.click();
    await expect(page).toHaveURL(/\/dashboard\/ai-chat/);
    expect(page.url()).not.toMatch(/clientId=/);
  } else {
    await expect(aiChatDisabled).toBeVisible();
  }
});
