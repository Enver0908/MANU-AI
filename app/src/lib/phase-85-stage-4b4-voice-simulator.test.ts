import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG } from "./phase-85-stage-4b4-provider-gate";
import { runStage4B4VoiceSimulationInState } from "./phase-85-stage-4b4-voice-simulator";

const TEST_SECRET = "synthetic-stage4b4-voice-simulator-secret";

describe("phase 85 stage 4b-4 voice simulator", () => {
  it("admits a golden voice fixture and opens a bundle after silence flush", async () => {
    const { state, result } = await runStage4B4VoiceSimulationInState(
      createInitialState(),
      {
        clientId: "client-mert",
        idempotencyKey: "voice-sim-1",
        fixtureId: "golden_voice_note",
        transcriptionSceneId: "meal_update_tr",
        flushSilence: true,
        now: "2026-07-14T12:00:00.000Z",
      },
      {
        providedSecret: TEST_SECRET,
        env: {
          NODE_ENV: "test",
          MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK: "true",
          MANU_MOCK_WHATSAPP_WEBHOOK_SECRET: TEST_SECRET,
          [STAGE_4B4_MOCK_VOICE_TRANSCRIPTION_ENV_FLAG]: "true",
        },
      },
    );

    expect(result.voiceAssetCount).toBeGreaterThanOrEqual(1);
    expect(result.transcriptionCount).toBeGreaterThanOrEqual(1);
    expect(result.flushedSilence).toBe(true);
    expect(result.bundleOpened).toBe(true);
    expect(state.mediaAssets.some((asset) => asset.mediaKind === "audio" && asset.status !== "failed")).toBe(true);
    expect(state.lastSimulation).not.toBeNull();
  });
});
