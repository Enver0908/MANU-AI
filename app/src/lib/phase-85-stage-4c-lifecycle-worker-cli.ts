import { createClient } from "@supabase/supabase-js";
import { resolveAiChatStore } from "./phase-85-stage-4c-store";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MANU_STAGE4C_LIFECYCLE_INTERVAL_MS || "60000");
const workerId = process.env.MANU_STAGE4C_LIFECYCLE_WORKER_ID || "stage4c-ai-chat-lifecycle-worker";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name}_required`);
  }
  return value;
}

async function tick() {
  void workerId;
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = resolveAiChatStore();
  await store.runLifecycleRetentionSweeps();
  await store.processLifecycleDeletionBatch(4);
}

async function main() {
  if (once) {
    await tick();
    return;
  }

  while (true) {
    await tick();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
