export const STAGE_4B3_PROVIDER_GATE_VERSION = "p85-stage-4b3-provider-gate-v1";

export const STAGE_4B3_MOCK_VISION_ENV_FLAG = "MANU_ALLOW_MOCK_VISION";
export const STAGE_4B3_REAL_VISION_EGRESS_ENV_FLAG = "MANU_ALLOW_REAL_VISION_EGRESS";

export type Stage4B3VisionProviderGateEvaluation = {
  packVersion: string;
  mockVisionAllowed: boolean;
  realVisionEgressAllowed: boolean;
  blockingReasons: string[];
};

export function isStage4B3MockVisionAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[STAGE_4B3_MOCK_VISION_ENV_FLAG] === "true";
}

export function isStage4B3RealVisionEgressAllowed(): boolean {
  return false;
}

export function evaluateStage4B3VisionProviderGate(
  env: NodeJS.ProcessEnv = process.env,
): Stage4B3VisionProviderGateEvaluation {
  const blockingReasons: string[] = [];
  const mockVisionAllowed = isStage4B3MockVisionAllowed(env);

  if (!mockVisionAllowed) {
    blockingReasons.push("mock_vision_gate_disabled");
  }

  if (env[STAGE_4B3_REAL_VISION_EGRESS_ENV_FLAG] === "true") {
    blockingReasons.push("real_vision_egress_forbidden");
  }

  return {
    packVersion: STAGE_4B3_PROVIDER_GATE_VERSION,
    mockVisionAllowed,
    realVisionEgressAllowed: false,
    blockingReasons,
  };
}
