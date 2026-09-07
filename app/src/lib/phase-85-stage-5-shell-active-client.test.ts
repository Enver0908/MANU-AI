import { describe, expect, it } from "vitest";
import { getDefaultDashboardUrlState } from "./phase-85-stage-4b-dashboard-routing";
import {
  buildShellClientSwitchConfirmMessage,
  buildShellHighImpactConfirmMessage,
  buildShellHomeActions,
  formatShellClientIdentity,
  resolveEffectiveShellActiveClientId,
  resolveShellClientStatusStrip,
  shouldShowShellActiveClientControl,
  ShellDestinationViewStateRegistry,
  type ShellActiveClientDto,
} from "./phase-85-stage-5-shell-contracts";
import { buildShellHomeActionHref } from "./phase-85-stage-5-shell-home-actions";

const sampleClient: ShellActiveClientDto = {
  id: "00000000-0000-4000-8000-000000000099",
  fullName: "Ayşe Yılmaz",
  referenceShort: "01234567",
  riskLevel: "yellow",
  handoffState: "open",
  channelReadiness: "ready",
  aiMode: "copilot",
};

describe("phase-85-stage-5-shell active client context", () => {
  it("resolves selection precedence as URL > preference > unbound", () => {
    expect(
      resolveEffectiveShellActiveClientId({
        urlClientId: "00000000-0000-4000-8000-000000000001",
        preferenceClientId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe("00000000-0000-4000-8000-000000000001");

    expect(
      resolveEffectiveShellActiveClientId({
        urlClientId: null,
        preferenceClientId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe("00000000-0000-4000-8000-000000000002");

    expect(
      resolveEffectiveShellActiveClientId({
        urlClientId: "  ",
        preferenceClientId: null,
      }),
    ).toBeNull();
  });

  it("hides active-client control on settings, more, and general AI chat", () => {
    expect(shouldShowShellActiveClientControl("home")).toBe(true);
    expect(shouldShowShellActiveClientControl("clients")).toBe(true);
    expect(shouldShowShellActiveClientControl("settings")).toBe(false);
    expect(shouldShowShellActiveClientControl("more")).toBe(false);
    expect(shouldShowShellActiveClientControl("ai_chat")).toBe(false);
  });

  it("orders status chips risk → handoff → channel → AI and fails closed to unknown", () => {
    const chips = resolveShellClientStatusStrip(sampleClient);
    expect(chips.map((chip) => chip.key)).toEqual(["risk", "handoff", "channel", "ai"]);
    expect(chips[0]?.label).toBe("Risk sarı");

    expect(resolveShellClientStatusStrip(null)).toEqual([
      { key: "unknown", label: "Durum bilinmiyor" },
    ]);
    expect(resolveShellClientStatusStrip(sampleClient, { stale: true })).toEqual([
      { key: "unknown", label: "Durum bilinmiyor" },
    ]);
    expect(
      resolveShellClientStatusStrip({ ...sampleClient, riskLevel: "unknown" }),
    ).toEqual([{ key: "unknown", label: "Durum bilinmiyor" }]);
  });

  it("repeats full name and short reference in high-impact and dirty-switch confirms", () => {
    expect(formatShellClientIdentity(sampleClient)).toBe("Ayşe Yılmaz · 01234567");
    expect(buildShellClientSwitchConfirmMessage(sampleClient)).toContain("Ayşe Yılmaz · 01234567");
    expect(buildShellHighImpactConfirmMessage("Kaldırmayı onayla", sampleClient)).toContain(
      "Danışan: Ayşe Yılmaz · 01234567",
    );
  });

  it("builds home action deep links in fixed order with handoff severity and resume destination", () => {
    const actions = buildShellHomeActions({
      badgeCounts: { alerts: 2, handoffs: 1, messages: 3, notifications: 4 },
      lastDestinationId: "messages",
      role: "dietitian",
    });
    expect(actions.map((action) => action.id)).toEqual([
      "alerts",
      "handoffs",
      "messages",
      "notifications",
      "resume_last_work",
    ]);

    const current = getDefaultDashboardUrlState();
    const handoffHref = buildShellHomeActionHref(actions[1]!, {
      clientId: sampleClient.id,
      current,
    });
    expect(handoffHref).toContain("section=alerts");
    expect(handoffHref).toContain("alertSeverity=red");
    expect(handoffHref).toContain(`clientId=${sampleClient.id}`);

    const resumeHref = buildShellHomeActionHref(actions[4]!, {
      clientId: sampleClient.id,
      current: { ...current, section: "messages", conversationQuery: "bekleyen" },
    });
    expect(resumeHref).toContain("section=messages");
    expect(resumeHref).toContain("conversationQuery=bekleyen");
  });

  it("keeps destination view-state in memory only", () => {
    const registry = new ShellDestinationViewStateRegistry();
    registry.save("clients", { search: "ayşe", tab: "tab_ai_assistant", scrollTop: 120 });
    expect(registry.restore("clients")).toEqual({
      search: "ayşe",
      tab: "tab_ai_assistant",
      scrollTop: 120,
    });
    registry.clear("clients");
    expect(registry.restore("clients")).toBeNull();
  });
});
