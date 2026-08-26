import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isAllowedCommercialEmail, normalizeCommercialEmail } from "@/lib/commercial-email";

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));

function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    specifier = `./${specifier.slice(2)}`;
    fromFile = join(srcRoot, "placeholder.ts");
  } else if (!specifier.startsWith(".")) {
    return null;
  }
  const base = join(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function collectImportedModules(entryPath: string, seen = new Set<string>()): string[] {
  if (seen.has(entryPath)) {
    return [...seen];
  }
  seen.add(entryPath);
  const source = readFileSync(entryPath, "utf8");
  const importPattern = /^(?!import\s+type\s).*from\s+["']([^"']+)["']/gm;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(source))) {
    const next = resolveImport(entryPath, match[1]);
    if (next) {
      collectImportedModules(next, seen);
    }
  }
  return [...seen];
}

describe("commercial auth browser boundary", () => {
  it("keeps email helpers free of Node crypto", () => {
    expect(normalizeCommercialEmail("  Dietitian@Example.COM ")).toBe("dietitian@example.com");
    expect(isAllowedCommercialEmail("dietitian@example.com", ["example.com"])).toBe(true);
    expect(isAllowedCommercialEmail("dietitian@other.com", ["example.com"])).toBe(false);
    const emailSource = readFileSync(fileURLToPath(new URL("../src/lib/commercial-email.ts", import.meta.url)), "utf8");
    expect(emailSource).not.toMatch(/node:crypto|from ["']crypto["']/);
  });

  it("does not let admin or customer login clients import node:crypto", () => {
    const adminGraph = collectImportedModules(
      fileURLToPath(new URL("../src/components/admin-login-form.tsx", import.meta.url)),
    );
    const customerGraph = collectImportedModules(
      fileURLToPath(new URL("../src/components/customer-login-form.tsx", import.meta.url)),
    );

    for (const filePath of [...adminGraph, ...customerGraph]) {
      const source = readFileSync(filePath, "utf8");
      expect(source, filePath).not.toMatch(/from ["']node:crypto["']|from ["']crypto["']/);
    }
  });

  it("isolates token hashing to the server module", () => {
    const serverSource = readFileSync(
      fileURLToPath(new URL("../src/lib/phase-83b-commercial-entitlement-model.server.ts", import.meta.url)),
      "utf8",
    );
    const clientModel = readFileSync(
      fileURLToPath(new URL("../src/lib/phase-83b-commercial-entitlement-model.ts", import.meta.url)),
      "utf8",
    );
    expect(serverSource).toContain('from "node:crypto"');
    expect(serverSource).toContain("hashCommercialInviteToken");
    expect(clientModel).not.toMatch(/node:crypto|hashCommercialInviteToken/);
  });
});
