import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  inviteCommercialAdminCustomer,
  listCommercialAdminCustomers,
  lookupCommercialAdminAuthUserIdByEmail,
} from "./commercial-admin-store";
import { createFallbackShellBootstrap } from "./phase-85-stage-5-shell-provider-state";
import { buildReleaseIdentity } from "../../scripts/lib/release-identity.mjs";

const appRoot = process.cwd();

describe("Faz 8 commercial admin store", () => {
  it("pages auth users until the 201st match instead of stopping at page 1", async () => {
    const listUsers = vi.fn(async ({ page }: { page: number }) => {
      if (page === 1) {
        return {
          data: {
            users: Array.from({ length: 200 }, (_, index) => ({
              id: `user-${index + 1}`,
              email: `page1-${index + 1}@example.com`,
            })),
          },
          error: null,
        };
      }
      return {
        data: {
          users: [{ id: "user-201", email: "target@example.com" }],
        },
        error: null,
      };
    });
    const admin = { auth: { admin: { listUsers } } };
    await expect(lookupCommercialAdminAuthUserIdByEmail(admin as never, "target@example.com")).resolves.toBe(
      "user-201",
    );
    expect(listUsers).toHaveBeenCalledTimes(2);
    expect(listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 200 });
    expect(listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 });
  });

  it("lists customers through one bounded projection RPC for 50 and 200 limits", async () => {
    const rpc = vi.fn(async (_name: string, args: { p_limit?: number }) => ({
      data: Array.from({ length: args.p_limit === 200 ? 2 : 1 }, (_, index) => ({
        normalizedEmail: `c${index}@example.com`,
        tenantIds: [],
        latestInvite: null,
        latestEntitlement: null,
        hasOwnerMembership: false,
      })),
      error: null,
    }));
    const admin = { rpc, from: vi.fn() };
    await listCommercialAdminCustomers(admin as never, { limit: 50 });
    await listCommercialAdminCustomers(admin as never, { limit: 200 });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(admin.from).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0]?.[0]).toBe("commercial_admin_list_customers_v1");
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_limit: 50 });
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({ p_limit: 200 });
  });

  it("invites through the atomic RPC and retries email send without creating a second tenant", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        status: "created",
        created: true,
        resent: false,
        inviteId: "invite-1",
        email: "new@example.com",
      },
      error: null,
    }));
    const sendSetupEmail = vi
      .fn()
      .mockRejectedValueOnce(new Error("setup_email_failed"))
      .mockResolvedValueOnce(undefined);
    const admin = { rpc, auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } } };

    await expect(
      inviteCommercialAdminCustomer(admin as never, {
        email: "new@example.com",
        paidThrough: new Date(Date.now() + 86_400_000).toISOString(),
        setupEmail: { sendSetupEmail, lookupAuthUserIdByEmail: async () => null },
      }),
    ).rejects.toThrow("setup_email_failed");

    await expect(
      inviteCommercialAdminCustomer(admin as never, {
        email: "new@example.com",
        paidThrough: new Date(Date.now() + 86_400_000).toISOString(),
        setupEmail: { sendSetupEmail, lookupAuthUserIdByEmail: async () => null },
      }),
    ).resolves.toMatchObject({ inviteId: "invite-1" });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(sendSetupEmail).toHaveBeenCalledTimes(2);
  });
});

describe("Faz 8 dashboard leftovers", () => {
  it("disables simulator in fallback bootstrap and removes unused destination callbacks", () => {
    const fallback = createFallbackShellBootstrap();
    expect(fallback.navigation.find((item) => item.id === "simulator")).toMatchObject({
      enabled: false,
      disabledReason: "feature_disabled",
    });
    const navigation = readFileSync(path.join(appRoot, "src/components/dashboard/dashboard-navigation.tsx"), "utf8");
    const shell = readFileSync(path.join(appRoot, "src/components/dashboard/dashboard-shell.tsx"), "utf8");
    expect(navigation).not.toContain("onNavigateDestination");
    expect(shell).not.toContain("onNavigateDestination");
  });

  it("keeps customer search submit-only in the admin console", () => {
    const source = readFileSync(path.join(appRoot, "src/components/commercial-admin-console.tsx"), "utf8");
    expect(source).toContain("setAppliedCustomerSearch");
    expect(source).toContain("void loadCustomers(");
    expect(source).not.toMatch(/loadOperations[\s\S]{0,80}\[customerSearch\]/);
  });
});

describe("Faz 8 authority documents", () => {
  it("keeps unique requirement IDs, PLAN (7) P-steps, and a single active plan status", () => {
    const docsRoot = path.join(appRoot, "..", "docs");
    const matrix = readFileSync(
      path.join(docsRoot, "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_REQUIREMENT_MATRIX.md"),
      "utf8",
    );
    const plan = readFileSync(
      path.join(docsRoot, "PUBLIC_SURFACE_AUTH_ONBOARDING_PWA_ACTION_PLAN.md"),
      "utf8",
    );
    const ids = [...matrix.matchAll(/^\| (SESSION|AUTH|ADMIN|DASHBOARD|PUBLIC|PWA|GOVERNANCE)-\d+ \|/gm)].map(
      (match) => match[0].replace(/^\| /, "").replace(/ \|$/, "").trim(),
    );
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan).toMatch(/^Status: `FAZ_8_RECLOSURE_IN_PROGRESS`/m);
    expect(plan.split(/\r?\n/, 8).join("\n")).not.toContain("PHASE_3_CLOSED_LOCAL_ONLY");
    expect(plan).toContain("P0.2 Gereksinimleri `SESSION`, `AUTH`, `ADMIN`, `DASHBOARD`, `PUBLIC`, `PWA`, `GOVERNANCE`");
    for (const step of [
      "P0.1",
      "P1.9",
      "P2.9",
      "P3.10",
      "P4.11",
      "P5.10",
      "P6.10",
      "P7.12",
      "F8.1",
      "F8.8",
    ]) {
      expect(plan).toContain(step);
      expect(matrix).toContain(step);
    }
  });
});

describe("Faz 8 release identity", () => {
  it("binds release identity commitSha to git rev-parse HEAD", () => {
    const repoRoot = path.join(appRoot, "..");
    const env = { ...process.env };
    delete env.MANU_RELEASE_COMMIT_SHA;
    const identity = buildReleaseIdentity({ repoRoot, env });
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
    expect(head.status).toBe(0);
    expect(identity.commitSha).toBe(String(head.stdout).trim());
  });
});
