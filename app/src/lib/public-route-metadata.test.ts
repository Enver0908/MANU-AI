import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AIYA_ADMIN_APP_URL,
  AIYA_APP_URL,
  AIYA_BRAND_NAME,
  buildAdminSurfaceMetadata,
  buildCustomerSurfaceMetadata,
  resolveVisibleTenantDisplayName,
} from "./brand";
import { PUBLIC_MARKETING_COPY } from "./phase-84b-public-website";

function readAppPage(relativePath: string) {
  return readFileSync(join(process.cwd(), "src", relativePath), "utf8");
}

describe("P5.7/P5.8 route metadata", () => {
  it("binds customer routes to aiyaworkspace.com canonical and OG URL", () => {
    const login = buildCustomerSurfaceMetadata({
      path: "/login",
      title: `Giriş | ${PUBLIC_MARKETING_COPY.brand}`,
      description: PUBLIC_MARKETING_COPY.loginBody,
    });

    expect(login.alternates?.canonical).toBe(`${AIYA_APP_URL}/login`);
    expect(login.openGraph?.url).toBe(`${AIYA_APP_URL}/login`);
    expect(login.openGraph?.title).toBe(`Giriş | ${AIYA_BRAND_NAME}`);
    expect(login.description).toBe(PUBLIC_MARKETING_COPY.loginBody);
    expect(String(login.alternates?.canonical)).not.toBe(`${AIYA_APP_URL}/`);
  });

  it("binds admin login metadata to the admin origin instead of the customer domain", () => {
    const admin = buildAdminSurfaceMetadata({
      path: "/admin",
      title: `Yönetim | ${PUBLIC_MARKETING_COPY.brand}`,
      description: "Ticari operasyon paneli: lead, davet, abonelik ve billing ledger.",
    });

    expect(admin.alternates?.canonical).toBe(`${AIYA_ADMIN_APP_URL}/admin`);
    expect(admin.openGraph?.url).toBe(`${AIYA_ADMIN_APP_URL}/admin`);
    expect(String(admin.alternates?.canonical)).not.toContain("https://aiyaworkspace.com/admin");
    expect(String(admin.alternates?.canonical)).toContain("https://admin.aiyaworkspace.com/admin");
  });

  it("defines route-specific metadata helpers on login, admin, purchase, onboarding, and app-install pages", () => {
    expect(readAppPage("app/login/page.tsx")).toContain("buildCustomerSurfaceMetadata");
    expect(readAppPage("app/login/page.tsx")).toContain('path: "/login"');
    expect(readAppPage("app/admin/page.tsx")).toContain("buildAdminSurfaceMetadata");
    expect(readAppPage("app/admin/page.tsx")).toContain('path: "/admin"');
    expect(readAppPage("app/purchase/page.tsx")).toContain("buildCustomerSurfaceMetadata");
    expect(readAppPage("app/purchase/page.tsx")).toContain('path: "/purchase"');
    expect(readAppPage("app/onboarding/page.tsx")).toContain("buildCustomerSurfaceMetadata");
    expect(readAppPage("app/onboarding/page.tsx")).toContain('path: "/onboarding"');
    expect(readAppPage("app/app-install/page.tsx")).toContain("buildCustomerSurfaceMetadata");
    expect(readAppPage("app/app-install/page.tsx")).toContain('path: "/app-install"');
    expect(readAppPage("app/page.tsx")).toContain("buildCustomerSurfaceMetadata");
    expect(readAppPage("app/layout.tsx")).not.toContain("canonical: \"/\"");
  });

  it("does not add a runtime redirect from preview/local origin to the production canonical", () => {
    const layout = readAppPage("app/layout.tsx");
    const login = readAppPage("app/login/page.tsx");
    const admin = readAppPage("app/admin/page.tsx");
    expect(`${layout}\n${login}\n${admin}`).not.toMatch(/redirect\(\s*[`'"]https:\/\/aiyaworkspace\.com/);
    expect(`${layout}\n${login}\n${admin}`).not.toMatch(/redirect\(\s*[`'"]https:\/\/admin\.aiyaworkspace\.com/);
  });
});

describe("P5.9 visible tenant fallback", () => {
  it("uses AIya Workspace unless a real tenant name is provided", () => {
    expect(resolveVisibleTenantDisplayName(null)).toBe("AIya Workspace");
    expect(resolveVisibleTenantDisplayName("  ")).toBe("AIya Workspace");
    expect(resolveVisibleTenantDisplayName("Klinik Ada")).toBe("Klinik Ada");
  });
});
