import { describe, expect, it } from "vitest";
import {
  classifyAudioAdmissionFailureTerminalClass,
  STAGE_4B4_ADMISSION_SECURITY_FAILURE_CODES,
} from "./phase-85-stage-4b4-durable-pipeline-saga";
import { buildTranscriptBridgeIdempotencyKey } from "./phase-85-stage-4b4-transcript-bridge";
import { STAGE_4B4_DURABLE_ADMISSION_WORKER_VERSION } from "./phase-85-stage-4b4-durable-admission-worker";
import { STAGE_4B4_DURABLE_AUDIO_WORKER_VERSION } from "./phase-85-stage-4b4-durable-audio-worker";

describe("phase-85-stage-4b4-durable-pipeline", () => {
  it("classifies canonical security failures as terminal security admission errors", () => {
    expect(classifyAudioAdmissionFailureTerminalClass("mime_spoof")).toBe("security");
    expect(classifyAudioAdmissionFailureTerminalClass("stereo_not_allowed")).toBe("security");
    expect(classifyAudioAdmissionFailureTerminalClass("decode_failed")).toBe("security");
    expect(classifyAudioAdmissionFailureTerminalClass("transport_unavailable")).toBe("transient");
    expect(classifyAudioAdmissionFailureTerminalClass("storage_upload_failed")).toBe("transient");
  });

  it("keeps security failure codes disjoint from transient transport/storage codes", () => {
    expect(STAGE_4B4_ADMISSION_SECURITY_FAILURE_CODES.has("transport_unavailable")).toBe(false);
    expect(STAGE_4B4_ADMISSION_SECURITY_FAILURE_CODES.has("storage_upload_failed")).toBe(false);
  });

  it("builds deterministic bridge idempotency keys for accepted transcription commits", () => {
    const key = buildTranscriptBridgeIdempotencyKey({
      conversationId: "conversation-1",
      bundleId: "bundle-1",
      mediaAssetId: "asset-1",
      transcriptionId: "transcription-1",
    });
    expect(key).toBe("voice-bridge:conversation-1:bundle-1:asset-1:transcription-1");
  });

  it("bumps durable worker versions for remediation R3", () => {
    expect(STAGE_4B4_DURABLE_ADMISSION_WORKER_VERSION).toContain("admission-worker");
    expect(STAGE_4B4_DURABLE_AUDIO_WORKER_VERSION).toContain("v3");
  });
});
