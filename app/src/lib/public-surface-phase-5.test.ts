import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AIYA_ADMIN_APP_URL,
  AIYA_APP_URL,
  AIYA_BRAND_NAME,
  AIYA_COMPATIBILITY_BRAND_NOTES,
  AIYA_TECHNICAL_COMPATIBILITY_NAMES,
  AIYA_WORKSPACE_FALLBACK_NAME,
} from "./brand";
import { PUBLIC_CONTACT_COPY, PUBLIC_MARKETING_COPY } from "./phase-84b-public-website";

const srcRoot = join(process.cwd(), "src");

const PUBLIC_RUNTIME_FILES = [
  "components/public/PublicNavbar.tsx",
  "components/public/HeroSection.tsx",
  "components/public/PublicFooter.tsx",
  "components/public/CommercialShell.tsx",
  "components/public/ContactSection.tsx",
  "components/public/HowItWorksSection.tsx",
  "components/public/SecuritySection.tsx",
  "components/public/MobileSection.tsx",
  "components/aiya-marketing-page.tsx",
  "components/contact-lead-form.tsx",
  "components/customer-login-form.tsx",
  "components/admin-login-form.tsx",
  "components/purchase-flow.tsx",
  "components/purchase-success-onboarding.tsx",
  "components/app-install-center.tsx",
  "app/page.tsx",
  "app/layout.tsx",
  "app/login/page.tsx",
  "app/admin/page.tsx",
  "app/purchase/page.tsx",
  "app/purchase/success/page.tsx",
  "app/purchase/cancel/page.tsx",
  "app/onboarding/page.tsx",
  "app/app-install/page.tsx",
  "lib/phase-84b-public-website.ts",
];

function readRuntime(relativePath: string) {
  const absolutePath = join(srcRoot, relativePath);
  expect(existsSync(absolutePath), relativePath).toBe(true);
  return readFileSync(absolutePath, "utf8");
}

function stripCompatibilityNames(source: string) {
  return AIYA_TECHNICAL_COMPATIBILITY_NAMES.reduce(
    (current, token) => current.replaceAll(token, ""),
    source,
  );
}

describe("P5.1/P5.2 public surface brand classification", () => {
  it("keeps technical compatibility names on the allowlist and separate from visible brand", () => {
    expect(AIYA_BRAND_NAME).toBe("AIya");
    expect(AIYA_APP_URL).toBe("https://aiyaworkspace.com");
    expect(AIYA_ADMIN_APP_URL).toBe("https://admin.aiyaworkspace.com");
    expect(AIYA_WORKSPACE_FALLBACK_NAME).toBe("AIya Workspace");
    expect(AIYA_COMPATIBILITY_BRAND_NOTES.join(" ")).toContain("MANU_*");
    expect(AIYA_COMPATIBILITY_BRAND_NOTES.join(" ")).toContain("x-siriusai-*");
    expect(AIYA_TECHNICAL_COMPATIBILITY_NAMES).toContain("siriusai-app-version");
  });

  it("classifies active public/auth runtime without retired visible brand, domain, or internal launch copy", () => {
    const publicDir = join(srcRoot, "components/public");
    const publicFiles = readdirSync(publicDir).filter((file) => file.endsWith(".tsx"));
    expect(publicFiles.length).toBeGreaterThan(0);

    const scanned = new Set(PUBLIC_RUNTIME_FILES);
    for (const file of publicFiles) {
      scanned.add(`components/public/${file}`);
    }

    for (const relativePath of scanned) {
      const source = stripCompatibilityNames(readRuntime(relativePath));
      expect(source, relativePath).not.toMatch(/siriusai\.store/i);
      expect(source, relativePath).not.toMatch(/\bSiriusAI\b/);
      expect(source, relativePath).not.toContain("NO-GO");
      expect(source, relativePath).not.toMatch(/Production pilot/i);
      expect(source, relativePath).not.toContain("MANU Tenant");
      expect(source, relativePath).not.toMatch(/\bsandbox\b/i);
      expect(source, relativePath).not.toMatch(/simülatör|simulator/i);
    }
  });

  it("keeps layout compatibility metadata while remaining AIya-branded", () => {
    const layout = readFileSync(join(srcRoot, "app/layout.tsx"), "utf8");
    expect(layout).toContain('name="siriusai-app-version"');
    expect(layout).toContain('"siriusai-app-version"');
    expect(layout).not.toContain("canonical: \"/\"");
    expect(layout).toContain("AIYA_BRAND_NAME");
  });
});

describe("P5.3/P5.4 public CTA hierarchy", () => {
  it("uses contact and login CTAs and removes public invite-start links", () => {
    expect(PUBLIC_MARKETING_COPY.contactCta).toBe("Bize ulaşın");
    expect(PUBLIC_MARKETING_COPY.loginLabel).toBe("Giriş yap");

    const navbar = readRuntime("components/public/PublicNavbar.tsx");
    const hero = readRuntime("components/public/HeroSection.tsx");
    const marketing = readRuntime("components/aiya-marketing-page.tsx");

    for (const source of [navbar, hero, marketing]) {
      expect(source).not.toContain("Davet koduyla başla");
      expect(source).not.toContain('href="/purchase"');
    }
    expect(navbar).toContain("Bize ulaşın");
    expect(navbar).toContain("Giriş yap");
    expect(hero).toContain("Bize ulaşın");
    expect(hero).toContain("Giriş yap");
    expect(marketing).toContain("PUBLIC_MARKETING_COPY.contactCta");
    expect(marketing).toContain("PUBLIC_MARKETING_COPY.loginLabel");

    const purchasePage = readRuntime("app/purchase/page.tsx");
    expect(purchasePage).toContain("PurchaseFlow");
    expect(purchasePage).toContain('path: "/purchase"');
  });
});

describe("P5.5 contact copy", () => {
  it("describes review and setup-link onboarding instead of an invite code email", () => {
    expect(PUBLIC_CONTACT_COPY.successBody).toContain("kurulum bağlantısını");
    expect(PUBLIC_CONTACT_COPY.successBody).not.toContain("davet kodu");
    expect(PUBLIC_CONTACT_COPY.processIntro).not.toContain("davet kodu");
    expect(PUBLIC_CONTACT_COPY.processSteps.join(" ")).not.toContain("davet kodu");
    expect(PUBLIC_CONTACT_COPY.errorRetry).toContain("e-posta");
    expect(PUBLIC_CONTACT_COPY.unavailable).toContain("e-posta");

    const contactSection = readRuntime("components/public/ContactSection.tsx");
    expect(contactSection).toContain("PUBLIC_CONTACT_COPY.successBody");
    expect(contactSection).not.toContain("davet kodu");
  });
});
