export const PRODUCTION_WORKER_RELEASE_CONTRACT_VERSION =
  "production-readiness-stage-1-phase-5-worker-release-v1";

export const PRODUCTION_WORKER_COMMANDS = [
  {
    id: "media-stage4b3",
    command: "npm run worker:media:stage4b3",
    onceCommand: "npm run worker:media:stage4b3:once",
    purpose: "Sanitized visual media analysis queue.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "media-lifecycle",
    command: "npm run worker:media:lifecycle",
    onceCommand: "npm run worker:media:lifecycle:once",
    purpose: "Visual media retention and object cleanup queue.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "audio-stage4b4",
    command: "npm run worker:audio:stage4b4",
    onceCommand: "npm run worker:audio:stage4b4:once",
    purpose: "Audio admission, transcription, and transcript bridge supervisor.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "audio-lifecycle-stage4b4",
    command: "npm run worker:audio:lifecycle:stage4b4",
    onceCommand: "npm run worker:audio:lifecycle:stage4b4:once",
    purpose: "Audio retention and object cleanup queue.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "ai-chat-stage4c",
    command: "npm run worker:ai-chat:stage4c",
    onceCommand: "npm run worker:ai-chat:stage4c:once",
    purpose: "AI Chat generation, attachment scan/parse, and deletion queues.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    id: "ai-chat-lifecycle-stage4c",
    command: "npm run worker:ai-chat:lifecycle:stage4c",
    onceCommand: "npm run worker:ai-chat:lifecycle:stage4c:once",
    purpose: "AI Chat lifecycle retention and purge queue.",
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
] as const;

export type ProductionWorkerId = (typeof PRODUCTION_WORKER_COMMANDS)[number]["id"];

export type ProductionWorkerReadinessInput = {
  workerId: ProductionWorkerId;
  env: Partial<Record<string, string | undefined>>;
  productionGoApproved: boolean;
  releasePackageVerified: boolean;
  incidentRunbookApproved: boolean;
  rollbackOwnerAssigned: boolean;
};

export type ProductionWorkerReadinessDecision = {
  version: typeof PRODUCTION_WORKER_RELEASE_CONTRACT_VERSION;
  workerId: ProductionWorkerId;
  readyToRunInProduction: boolean;
  command: string;
  onceCommand: string;
  blockingReasons: string[];
};

export function evaluateProductionWorkerReadiness(
  input: ProductionWorkerReadinessInput,
): ProductionWorkerReadinessDecision {
  const worker = PRODUCTION_WORKER_COMMANDS.find((item) => item.id === input.workerId);
  if (!worker) {
    throw new Error(`unknown_worker:${input.workerId}`);
  }

  const blockingReasons: string[] = [];
  for (const envName of worker.requiredEnv) {
    if (!input.env[envName]?.trim()) {
      blockingReasons.push(`${envName} is required`);
    }
  }
  if (input.env.MANU_DEV_FALLBACK_STORE === "true") {
    blockingReasons.push("dev fallback store must be disabled");
  }
  if (input.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK === "true") {
    blockingReasons.push("mock WhatsApp webhook flag must be disabled");
  }
  if (input.env.MANU_ALLOW_MOCK_VISION === "true") {
    blockingReasons.push("mock vision flag must be disabled");
  }
  if (input.env.MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION === "true") {
    blockingReasons.push("mock voice transcription flag must be disabled");
  }
  if (!input.productionGoApproved) {
    blockingReasons.push("production GO approval is required");
  }
  if (!input.releasePackageVerified) {
    blockingReasons.push("release package verification is required");
  }
  if (!input.incidentRunbookApproved) {
    blockingReasons.push("approved incident runbook is required");
  }
  if (!input.rollbackOwnerAssigned) {
    blockingReasons.push("rollback owner assignment is required");
  }

  return {
    version: PRODUCTION_WORKER_RELEASE_CONTRACT_VERSION,
    workerId: worker.id,
    readyToRunInProduction: blockingReasons.length === 0,
    command: worker.command,
    onceCommand: worker.onceCommand,
    blockingReasons,
  };
}

export function buildProductionWorkerOperationsManifest() {
  return {
    schemaVersion: PRODUCTION_WORKER_RELEASE_CONTRACT_VERSION,
    productionPilotGo: false,
    workerCommands: PRODUCTION_WORKER_COMMANDS.map((worker) => ({ ...worker })),
    requiredBeforeProductionStart: [
      "release package verification",
      "production GO approval",
      "approved incident runbook",
      "assigned rollback owner",
      "production Supabase URL and service role key",
      "demo/mock flags disabled",
    ],
  };
}
