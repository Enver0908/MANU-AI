import { describe, expect, it } from "vitest";
import {
  STAGE_4B4_TRANSCRIPTION_PROVIDER_TIMEOUT_MS,
  invokeStage4B4TranscriptionProviderWithDeadline,
  mapTranscriptionProviderFailureToQualityCode,
} from "./phase-85-stage-4b4-transcription-provider";
import type { Stage4B4TranscriptionProviderPort } from "./phase-85-stage-4b4-transcription-provider";

describe("phase-85-stage-4b4-transcription-provider", () => {
  it("maps provider failures to fixed quality rejection enums", () => {
    expect(mapTranscriptionProviderFailureToQualityCode("provider_gate_disabled")).toBe("provider_disabled");
    expect(mapTranscriptionProviderFailureToQualityCode("provider_timeout")).toBe("provider_timeout");
    expect(mapTranscriptionProviderFailureToQualityCode("retry_limit_exceeded")).toBe("retry_limit_exceeded");
    expect(mapTranscriptionProviderFailureToQualityCode("observation_validation_failed")).toBe(
      "malformed_observation",
    );
  });

  it("enforces a 30 second provider deadline", async () => {
    const hangingProvider: Stage4B4TranscriptionProviderPort = {
      async transcribe() {
        await new Promise((resolve) => {
          setTimeout(resolve, STAGE_4B4_TRANSCRIPTION_PROVIDER_TIMEOUT_MS + 50);
        });
        return { ok: true, observation: {} };
      },
    };

    const result = await invokeStage4B4TranscriptionProviderWithDeadline(
      hangingProvider,
      {
        requestId: "req-1",
        contentSha256: "abc",
        locale: "tr-TR",
        wavBytes: Buffer.from("wav"),
      },
      30,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failureCode).toBe("provider_timeout");
      expect(result.retryable).toBe(true);
    }
  });
});
