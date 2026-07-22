import { processAiChatWorkerBatch } from "./phase-85-stage-4c-run-service";
import { resolveAiChatStore } from "./phase-85-stage-4c-store";

const once = process.argv.includes("--once");
const intervalMs = Number(process.env.MANU_STAGE4C_WORKER_INTERVAL_MS || "3000");
const workerId = process.env.MANU_STAGE4C_WORKER_ID || "stage4c-ai-chat-worker";

async function tick() {
  const store = resolveAiChatStore();
  await processAiChatWorkerBatch(store, workerId, 4);
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
