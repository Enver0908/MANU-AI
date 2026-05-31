import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "./languages";
import { assertDashboardMessagesComplete, t } from "./i18n";

describe("dashboard i18n", () => {
  it("keeps dashboard messages complete for every supported language", () => {
    expect(() => assertDashboardMessagesComplete()).not.toThrow();
    expect(SUPPORTED_LANGUAGES.map((language) => t(language.code, "forms"))).toHaveLength(7);
  });
});
