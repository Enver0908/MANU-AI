import { describe, expect, it } from "vitest";
import {
  PUBLIC_MARKETING_COPY,
  PUBLIC_MARKETING_SECTIONS,
  SIRIUSAI_PUBLIC_CONTACT_EMAIL,
  buildContactMailtoUrl,
  isPublicDemoLoginEnabled,
} from "./phase-84b-public-website";

describe("phase 84b public website", () => {
  it("uses the public business contact email", () => {
    expect(SIRIUSAI_PUBLIC_CONTACT_EMAIL).toBe("contact@aiyaworkspace.com");
  });

  it("builds a mailto url with encoded subject", () => {
    expect(buildContactMailtoUrl("SiriusAI erişim talebi")).toBe(
      "mailto:contact@aiyaworkspace.com?subject=SiriusAI+eri%C5%9Fim+talebi",
    );
  });

  it("gates public demo login behind development mode and MANU_ALLOW_PUBLIC_DEMO_LOGIN", () => {
    expect(
      isPublicDemoLoginEnabled({ NODE_ENV: "development", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" }),
    ).toBe(true);
    expect(
      isPublicDemoLoginEnabled({ NODE_ENV: "production", MANU_ALLOW_PUBLIC_DEMO_LOGIN: "true" }),
    ).toBe(false);
    expect(isPublicDemoLoginEnabled({ MANU_ALLOW_PUBLIC_DEMO_LOGIN: "false" })).toBe(false);
    expect(isPublicDemoLoginEnabled({})).toBe(false);
  });

  it("defines required marketing sections for the public homepage", () => {
    const ids = PUBLIC_MARKETING_SECTIONS.map((section) => section.id);
    expect(ids).toEqual(["value", "safety", "workflow", "mobile", "governance", "onboarding"]);
    expect(PUBLIC_MARKETING_COPY.brand).toBe("SiriusAI");
    expect(PUBLIC_MARKETING_COPY.contactCta).toBe("Bizimle iletişime geçin");
  });
});
