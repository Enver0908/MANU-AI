import { describe, expect, it } from "vitest";
import {
  buildProductionWorkerOperationsManifest,
  evaluateProductionWorkerReadiness,
  PRODUCTION_WORKER_COMMANDS,
} from "./production-worker-release-contracts";

describe("production worker and release contracts", () => {
  it("publishes every required worker command with a one-shot validation command", () => {
    const manifest = buildProductionWorkerOperationsManifest();

    expect(manifest.productionPilotGo).toBe(false);
    expect(manifest.workerCommands).toHaveLength(PRODUCTION_WORKER_COMMANDS.length);
    expect(manifest.workerCommands.map((worker) => worker.id)).toEqual([
      "media-stage4b3",
      "media-lifecycle",
      "audio-stage4b4",
      "audio-lifecycle-stage4b4",
      "ai-chat-stage4c",
      "ai-chat-lifecycle-stage4c",
    ]);
    expect(manifest.workerCommands.every((worker) => worker.onceCommand.includes(":once"))).toBe(true);
  });

  it("blocks worker production start without env, GO approval, release verification, and operator ownership", () => {
    const decision = evaluateProductionWorkerReadiness({
      workerId: "ai-chat-stage4c",
      env: {
        MANU_DEV_FALLBACK_STORE: "true",
        MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
      },
      productionGoApproved: false,
      releasePackageVerified: false,
      incidentRunbookApproved: false,
      rollbackOwnerAssigned: false,
    });

    expect(decision.readyToRunInProduction).toBe(false);
    expect(decision.blockingReasons).toContain("NEXT_PUBLIC_SUPABASE_URL is required");
    expect(decision.blockingReasons).toContain("SUPABASE_SERVICE_ROLE_KEY is required");
    expect(decision.blockingReasons).toContain("dev fallback store must be disabled");
    expect(decision.blockingReasons).toContain("production GO approval is required");
    expect(decision.blockingReasons).toContain("release package verification is required");
    expect(decision.blockingReasons).toContain("approved incident runbook is required");
    expect(decision.blockingReasons).toContain("rollback owner assignment is required");
  });

  it("allows a worker readiness decision only when every operational precondition is satisfied", () => {
    const decision = evaluateProductionWorkerReadiness({
      workerId: "media-stage4b3",
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      },
      productionGoApproved: true,
      releasePackageVerified: true,
      incidentRunbookApproved: true,
      rollbackOwnerAssigned: true,
    });

    expect(decision.readyToRunInProduction).toBe(true);
    expect(decision.command).toBe("npm run worker:media:stage4b3");
    expect(decision.blockingReasons).toEqual([]);
  });
});
