import { describe, expect, it } from "vitest";
import {
  isP85Stage4AResolvableStructuredNotification,
  resolveP85Stage4AStructuredNotificationTab,
} from "./phase-85-stage-4a-post-if-remediation";
import type { NotificationRecord } from "./types";

describe("phase 85 stage 4A post-IF remediation helpers", () => {
  it("maps structured notification targets to allowlisted client tabs", () => {
    expect(resolveP85Stage4AStructuredNotificationTab("menu")).toBe("tab_menu");
    expect(resolveP85Stage4AStructuredNotificationTab("active_nutrition_plan")).toBe("tab_food_rules");
    expect(resolveP85Stage4AStructuredNotificationTab("client_form")).toBe("tab_personal_form");
    expect(resolveP85Stage4AStructuredNotificationTab("diet_plan")).toBe("tab_critical_context");
  });

  it("rejects unknown notification target panels", () => {
    expect(resolveP85Stage4AStructuredNotificationTab("admin")).toBeNull();
    expect(resolveP85Stage4AStructuredNotificationTab(null)).toBeNull();
  });

  it("only exposes unresolved P85-IF-E structured notifications as resolvable", () => {
    const base = {
      dedupeKey: "p85-if-e:structured:client-1:menu:message-1",
      resolvedAt: null,
      targetPanel: "menu",
    } satisfies Pick<NotificationRecord, "dedupeKey" | "resolvedAt" | "targetPanel">;

    expect(isP85Stage4AResolvableStructuredNotification(base)).toBe(true);
    expect(isP85Stage4AResolvableStructuredNotification({ ...base, resolvedAt: "2026-07-11T00:00:00.000Z" })).toBe(false);
    expect(isP85Stage4AResolvableStructuredNotification({ ...base, dedupeKey: "other" })).toBe(false);
    expect(isP85Stage4AResolvableStructuredNotification({ ...base, targetPanel: "admin" })).toBe(false);
  });
});
