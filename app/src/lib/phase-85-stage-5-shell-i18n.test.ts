import { describe, expect, it } from "vitest";
import { STAGE5_SHELL_OVERFLOW_FIXTURES, stage5ShellMessages } from "./phase-85-stage-5-shell-i18n";
import { assertDashboardMessagesComplete, t } from "./i18n";

describe("phase-85-stage-5-shell-i18n", () => {
  it("keeps seven-language shell keys complete with Turkish fallback", () => {
    expect(() => assertDashboardMessagesComplete()).not.toThrow();
    expect(t("en", "shellDirtyStay")).toBe("Stay here");
    expect(t("de", "shellOfflineTitle")).toContain("Internet");
    expect(t("pt", "shellNavMore")).toBe("Mais");
  });

  it("overflow fixtures for tr/de/pt remain wrappable without hard single-line locks", () => {
    for (const language of ["tr", "de", "pt"] as const) {
      const fixture = STAGE5_SHELL_OVERFLOW_FIXTURES[language];
      for (const [key, value] of Object.entries(fixture)) {
        expect(value.length).toBeGreaterThan(
          stage5ShellMessages[language][key as keyof typeof fixture].length,
        );
        expect(value.includes("\n")).toBe(false);
        expect(value.trim().length).toBeGreaterThan(40);
      }
    }
  });
});
