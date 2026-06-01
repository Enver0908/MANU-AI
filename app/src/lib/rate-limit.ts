import { createHmac } from "node:crypto";
import { AppDomainError } from "./app-errors";
import { getSupabaseAdminClient } from "./supabase";

type RateLimitInput = {
  key: string;
  scope: RateLimitScope;
  tenantId?: string;
  limit: number;
  windowMs: number;
};

export type RateLimitScope = "simulator" | "channel_inbound" | "manual_reply" | "draft_review" | "internal_copilot";

type RateLimitRpcResponse = {
  allowed?: boolean;
  count?: number;
  limit?: number;
  resetAt?: string;
  scope?: string;
};

type RateLimitRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const globalRateLimitStore = globalThis as typeof globalThis & {
  manuRateLimitBuckets?: Map<string, Bucket>;
};
let rateLimitRpcClientForTests: RateLimitRpcClient | null = null;

function buckets() {
  globalRateLimitStore.manuRateLimitBuckets ??= new Map();
  return globalRateLimitStore.manuRateLimitBuckets;
}

export async function assertRateLimit({ key, scope, tenantId, limit, windowMs }: RateLimitInput) {
  const supabase =
    tenantId && process.env.MANU_DEV_FALLBACK_STORE !== "true"
      ? rateLimitRpcClientForTests || getSupabaseAdminClient()
      : null;
  if (supabase && tenantId) {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_tenant_id: tenantId,
      p_scope: scope,
      p_key_hash: hashRateLimitKey(key),
      p_limit: limit,
      p_window_seconds: Math.ceil(windowMs / 1000),
    });
    if (error) throw error;
    const decision = data as RateLimitRpcResponse | null;
    if (decision?.allowed === false) {
      throw new AppDomainError(429, "rate_limit_exceeded");
    }
    return;
  }

  const now = Date.now();
  const store = buckets();
  const bucketKey = `${scope}:${key}`;
  const current = store.get(bucketKey);

  if (!current || current.resetAt <= now) {
    store.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new AppDomainError(429, "rate_limit_exceeded");
  }

  current.count += 1;
}

export function resetRateLimits() {
  buckets().clear();
  rateLimitRpcClientForTests = null;
}

export function setRateLimitRpcClientForTests(client: RateLimitRpcClient | null) {
  rateLimitRpcClientForTests = client;
}

export const RATE_LIMITS = {
  simulator: { scope: "simulator", limit: 20, windowMs: 60_000 },
  channelInbound: { scope: "channel_inbound", limit: 30, windowMs: 60_000 },
  manualReply: { scope: "manual_reply", limit: 30, windowMs: 60_000 },
  draftReview: { scope: "draft_review", limit: 40, windowMs: 60_000 },
  internalCopilot: { scope: "internal_copilot", limit: 20, windowMs: 60_000 },
} as const;

function hashRateLimitKey(key: string) {
  const secret =
    process.env.MANU_RATE_LIMIT_KEY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "local-development-rate-limit-key";
  return createHmac("sha256", secret).update(key).digest("hex");
}
