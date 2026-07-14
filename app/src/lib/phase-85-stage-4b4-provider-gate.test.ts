import { describe, expect, it } from "vitest";
import {
  STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG,
  evaluateStage4B4VoiceTranscriptionProviderGate,
  isStage4B4MockVoiceTranscriptionAllowed,
} from "./phase-85-stage-4b4-provider-gate";

describe("phase 85 stage 4b-4 provider gate", () => {
  it("requires the mock voice transcription flag outside production", () => {
    const env = {
      NODE_ENV: "test",
      [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
    } as NodeJS.ProcessEnv;

    expect(isStage4B4MockVoiceTranscriptionAllowed(env)).toBe(true);
    expect(evaluateStage4B4VoiceTranscriptionProviderGate(env).blockingReasons).toEqual([]);
  });

  it("refuses production, hosted sandbox, and disabled mock transcription", () => {
    expect(
      evaluateStage4B4VoiceTranscriptionProviderGate({
        NODE_ENV: "production",
        [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
      } as NodeJS.ProcessEnv).mockVoiceTranscriptionAllowed,
    ).toBe(false);
    expect(
      evaluateStage4B4VoiceTranscriptionProviderGate({
        NODE_ENV: "production",
        [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
      } as NodeJS.ProcessEnv).blockingReasons,
    ).toContain("production_execution_refused");

    expect(
      evaluateStage4B4VoiceTranscriptionProviderGate({
        NODE_ENV: "test",
        MANU_HOSTED_SANDBOX_ACTIVE: "true",
        [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
      } as NodeJS.ProcessEnv).blockingReasons,
    ).toContain("hosted_sandbox_refused");

    expect(
      evaluateStage4B4VoiceTranscriptionProviderGate({
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv).blockingReasons,
    ).toContain("mock_voice_transcription_gate_disabled");
  });
});
