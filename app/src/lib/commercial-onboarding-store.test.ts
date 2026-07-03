import { describe, expect, it } from "vitest";
import { claimCommercialOnboardingWorkspace } from "./commercial-onboarding-store";

function createClaimClient(input: {
  initialDietitianTenantId?: string | null;
  conflictDietitianTenantId?: string | null;
}) {
  let membershipExists = false;
  let dietitianTenantId = input.initialDietitianTenantId ?? null;
  const events: Array<Record<string, unknown>> = [];

  return {
    events,
    client: {
      from(table: string) {
        const filters: Record<string, string> = {};
        return {
          select() {
            return this;
          },
          eq(column: string, value: string) {
            filters[column] = value;
            return this;
          },
          maybeSingle: async () => {
            if (table === "tenant_memberships") {
              return { data: membershipExists ? { id: "membership-1" } : null, error: null };
            }
            if (table === "dietitians") {
              return {
                data: dietitianTenantId ? { id: "dietitian-1", tenant_id: dietitianTenantId } : null,
                error: null,
              };
            }
            return { data: null, error: null };
          },
          upsert: async () => {
            membershipExists = true;
            return { error: null };
          },
          insert: async (row: Record<string, unknown>) => {
            if (table === "dietitians") {
              dietitianTenantId = input.conflictDietitianTenantId ?? String(row.tenant_id);
              return {
                error: {
                  code: "23505",
                  message: "duplicate key value violates unique constraint",
                },
              };
            }
            if (table === "commercial_onboarding_events") {
              events.push(row);
            }
            return { error: null };
          },
        };
      },
    },
  };
}

describe("commercial onboarding store", () => {
  it("treats same-tenant dietitian unique conflicts as idempotent claims", async () => {
    const store = createClaimClient({ conflictDietitianTenantId: "tenant-1" });

    const result = await claimCommercialOnboardingWorkspace(store.client as never, {
      tenantId: "tenant-1",
      userId: "user-1",
      normalizedEmail: "owner@example.com",
      commercialInviteId: "invite-1",
      checkoutSessionId: "cs_test_123",
      now: "2026-07-03T00:00:00.000Z",
    });

    expect(result).toEqual({ tenantId: "tenant-1", alreadyClaimed: true });
    expect(store.events).toHaveLength(1);
  });

  it("keeps foreign-tenant dietitian conflicts fail-closed", async () => {
    const store = createClaimClient({ conflictDietitianTenantId: "tenant-2" });

    await expect(
      claimCommercialOnboardingWorkspace(store.client as never, {
        tenantId: "tenant-1",
        userId: "user-1",
        normalizedEmail: "owner@example.com",
        commercialInviteId: "invite-1",
        checkoutSessionId: "cs_test_123",
        now: "2026-07-03T00:00:00.000Z",
      }),
    ).rejects.toThrow("dietitian_profile_bound_elsewhere");
  });
});
