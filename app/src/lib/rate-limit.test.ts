import { beforeEach, describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { assertRateLimit, resetRateLimits, setRateLimitRpcClientForTests } from "./rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    delete process.env.MANU_DEV_FALLBACK_STORE;
    resetRateLimits();
  });

  it("blocks repeated operations for the same scoped key", async () => {
    await assertRateLimit({ key: "tenant-a:client-a", scope: "simulator", limit: 2, windowMs: 60_000 });
    await assertRateLimit({ key: "tenant-a:client-a", scope: "simulator", limit: 2, windowMs: 60_000 });

    await expect(
      assertRateLimit({ key: "tenant-a:client-a", scope: "simulator", limit: 2, windowMs: 60_000 }),
    ).rejects.toThrow(new AppDomainError(429, "rate_limit_exceeded"));
  });

  it("keeps separate scoped keys isolated", async () => {
    await assertRateLimit({ key: "tenant-a:client-a", scope: "simulator", limit: 1, windowMs: 60_000 });

    await expect(
      assertRateLimit({ key: "tenant-a:client-b", scope: "simulator", limit: 1, windowMs: 60_000 }),
    ).resolves.toBeUndefined();
  });

  it("isolates the same key across scopes", async () => {
    await assertRateLimit({ key: "tenant-a:client-a", scope: "simulator", limit: 1, windowMs: 60_000 });

    await expect(
      assertRateLimit({ key: "tenant-a:client-a", scope: "manual_reply", limit: 1, windowMs: 60_000 }),
    ).resolves.toBeUndefined();
  });

  it("uses hashed keys for the Supabase rate-limit RPC", async () => {
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    setRateLimitRpcClientForTests({
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: { allowed: true }, error: null };
      },
    });

    await assertRateLimit({
      key: "tenant-a:manual:client-secret-phone",
      tenantId: "00000000-0000-4000-8000-000000000001",
      scope: "manual_reply",
      limit: 1,
      windowMs: 60_000,
    });

    expect(calls[0].name).toBe("consume_rate_limit");
    expect(calls[0].args.p_key_hash).not.toBe("tenant-a:manual:client-secret-phone");
    expect(String(calls[0].args.p_key_hash)).toHaveLength(64);
  });

  it("maps Supabase rate-limit denials to controlled 429 errors", async () => {
    setRateLimitRpcClientForTests({
      rpc: async () => ({ data: { allowed: false }, error: null }),
    });

    await expect(
      assertRateLimit({
        key: "tenant-a:manual:client-a",
        tenantId: "00000000-0000-4000-8000-000000000001",
        scope: "manual_reply",
        limit: 1,
        windowMs: 60_000,
      }),
    ).rejects.toThrow(new AppDomainError(429, "rate_limit_exceeded"));
  });
});
