import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OverviewPanel } from "./overview-panel";

const baseProps = {
  pendingMessageCount: 0,
  pendingAlertCount: 0,
  pendingNotificationCount: 0,
  onOpenClients: vi.fn(),
  onOpenMessages: vi.fn(),
  onOpenAlerts: vi.fn(),
  onOpenNotifications: vi.fn(),
  onOpenClientTask: vi.fn(),
  onOpenAiChat: vi.fn(),
};

describe("OverviewPanel work areas", () => {
  it("renders all four shortcuts enabled for an active client and allowed AI Chat", () => {
    const html = renderToStaticMarkup(
      <OverviewPanel
        {...baseProps}
        clientWorkAreaAvailability={{ state: "enabled", clientName: "Mert Kaya" }}
        aiChatAvailability={{ state: "enabled" }}
      />,
    );

    expect(html).toContain('data-testid="overview-work-areas"');
    expect(html).toContain('data-testid="overview-work-area-forms"');
    expect(html).toContain('data-testid="overview-work-area-nutrition"');
    expect(html).toContain('data-testid="overview-work-area-menu"');
    expect(html).toContain('data-testid="overview-work-area-ai-chat"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain("Mert Kaya için aç");
    expect(html).toContain("Kullanıma hazır");
  });

  it("keeps client shortcuts disabled when no active client exists", () => {
    const html = renderToStaticMarkup(
      <OverviewPanel
        {...baseProps}
        clientWorkAreaAvailability={{ state: "disabled", reason: "client_required" }}
        aiChatAvailability={{ state: "disabled", reason: "feature_disabled" }}
      />,
    );

    expect((html.match(/disabled=""/g) ?? []).length).toBe(4);
    expect((html.match(/Aktif danışan gerekli/g) ?? []).length).toBe(3);
    expect(html).toContain("GO doğrulamasına kadar kapalı");
  });

  it("maps denied AI Chat states to visible safe status text", () => {
    const roleDenied = renderToStaticMarkup(
      <OverviewPanel
        {...baseProps}
        clientWorkAreaAvailability={{ state: "disabled", reason: "client_required" }}
        aiChatAvailability={{ state: "disabled", reason: "role_forbidden" }}
      />,
    );
    const accessUnknown = renderToStaticMarkup(
      <OverviewPanel
        {...baseProps}
        clientWorkAreaAvailability={{ state: "disabled", reason: "client_required" }}
        aiChatAvailability={{ state: "disabled", reason: "access_unverified" }}
      />,
    );

    expect(roleDenied).toContain("Bu rol için erişim yok");
    expect(accessUnknown).toContain("Erişim doğrulanamadı");
    expect(roleDenied).not.toContain("rbac_forbidden");
  });
});
