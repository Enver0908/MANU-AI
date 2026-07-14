export const STAGE_4B4_PROVIDER_GATE_VERSION = "p85-stage-4b4-provider-gate-v1";

export const STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG = "MANU_ALLOW_MOCK_VOICE_TRANSCRIPTION";
export const STAGE_4B4_REAL_STT_EGRESS_ENV_FLAG = "MANU_ALLOW_REAL_STT_EGRESS";

export type Stage4B4VoiceTranscriptionProviderGateEvaluation = {
  packVersion: string;
  mockVoiceTranscriptionAllowed: boolean;
  realSttEgressAllowed: boolean;
  blockingReasons: string[];
};

export function isStage4B4MockVoiceTranscriptionAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG] === "true";
}

export function isStage4B4RealSttEgressAllowed(): boolean {
  return false;
}

export function evaluateStage4B4VoiceTranscriptionProviderGate(
  env: NodeJS.ProcessEnv = process.env,
): Stage4B4VoiceTranscriptionProviderGateEvaluation {
  const blockingReasons: string[] = [];

  const mockVoiceTranscriptionAllowed =
    isStage4B4MockVoiceTranscriptionAllowed(env) &&
    env.NODE_ENV !== "production" &&
    env.MANU_HOSTED_SANDBOX_ACTIVE !== "true";
  if (!isStage4B4MockVoiceTranscriptionAllowed(env)) {
    blockingReasons.push("mock_voice_transcription_gate_disabled");
  }
  if (env.NODE_ENV === "production") {
    blockingReasons.push("production_execution_refused");
  }
  if (env.MANU_HOSTED_SANDBOX_ACTIVE === "true") {
    blockingReasons.push("hosted_sandbox_refused");
  }

  if (env[STAGE_4B4_REAL_STT_EGRESS_ENV_FLAG] === "true") {
    blockingReasons.push("real_stt_egress_forbidden");
  }

  return {
    packVersion: STAGE_4B4_PROVIDER_GATE_VERSION,
    mockVoiceTranscriptionAllowed,
    realSttEgressAllowed: false,
    blockingReasons,
  };
}

export function assertMockVoiceTranscriptionAllowed(env: NodeJS.ProcessEnv = process.env): void {
  const gate = evaluateStage4B4VoiceTranscriptionProviderGate(env);
  if (!gate.mockVoiceTranscriptionAllowed) {
    throw new Error(gate.blockingReasons[0] ?? "mock_voice_transcription_gate_disabled");
  }
}
