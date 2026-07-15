import { createClient } from "@supabase/supabase-js";
import { DEMO_TENANT_ID } from "./seed-data";
import { runStage4B4DurableAdmissionWorkerLoop } from "./phase-85-stage-4b4-durable-admission-worker";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MANU_STAGE4B4_ADMISSION_WORKER_INTERVAL_MS || "3000");
const tenantId = process.env.MANU_STAGE4B4_WORKER_TENANT_ID || DEMO_TENANT_ID;
const workerId = process.env.MANU_STAGE4B4_ADMISSION_WORKER_ID || "stage4b4-durable-admission-worker";

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

  let running = true;
  const shutdown = () => {
    running = false;
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(
    once
      ? `[worker:audio:stage4b4:admission] running one admission batch for tenant ${tenantId}`
      : `[worker:audio:stage4b4:admission] polling every ${intervalMs}ms for tenant ${tenantId} (Ctrl+C to stop)`,
  );

  await runStage4B4DurableAdmissionWorkerLoop({
    supabase,
    tenantId,
    workerId,
    intervalMs,
    once,
    shouldContinue: () => running,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
