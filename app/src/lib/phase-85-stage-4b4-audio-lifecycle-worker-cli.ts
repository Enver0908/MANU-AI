import { createClient } from "@supabase/supabase-js";
import { createSupabaseStage4B4AudioStorage } from "./phase-85-stage-4b4-audio-storage";
import { runStage4B4AudioLifecycleWorkerLoop } from "./phase-85-stage-4b4-audio-lifecycle-saga";
import { DEMO_TENANT_ID } from "./seed-data";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MANU_STAGE4B4_LIFECYCLE_INTERVAL_MS || "60000");
const tenantId = process.env.MANU_STAGE4B4_LIFECYCLE_TENANT_ID || process.env.MANU_STAGE4B4_WORKER_TENANT_ID || DEMO_TENANT_ID;
const workerId = process.env.MANU_STAGE4B4_LIFECYCLE_WORKER_ID || "stage4b4-audio-lifecycle-worker";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name}_required`);
  }
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = createSupabaseStage4B4AudioStorage(supabase);

  let running = true;
  const shutdown = () => {
    running = false;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(
    once
      ? `[worker:audio:lifecycle:stage4b4] running one lifecycle batch for tenant ${tenantId}`
      : `[worker:audio:lifecycle:stage4b4] polling every ${intervalMs}ms for tenant ${tenantId} (Ctrl+C to stop)`,
  );

  await runStage4B4AudioLifecycleWorkerLoop({
    supabase,
    tenantId,
    workerId,
    storage,
    intervalMs,
    once,
    shouldContinue: () => running,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
