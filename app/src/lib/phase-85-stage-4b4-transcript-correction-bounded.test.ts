import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import {
  assertTranscriptCorrectionAllowed,
  parseTranscriptCorrectionMutationBody,
} from "./phase-85-stage-4b4-transcript-correction-bounded";

describe("phase-85-stage-4b4-transcript-correction-bounded", () => {
  it("parses valid correction requests", () => {
    const parsed = parseTranscriptCorrectionMutationBody({
      transcriptionId: "transcription-1",
      targetMessageId: "message-1",
      requestId: "request-1",
      expectedConversationRevision: 1,
      expectedTranscriptionRevision: 1,
      reasonCode: "wrong_word",
      explanation: "Kelime yanlis",
      correctedTranscript: "Bugun salata yedim.",
    });
    expect(parsed.correctedTranscript).toBe("Bugun salata yedim.");
  });

  it("rejects unauthorized correction roles", () => {
    expect(() =>
      assertTranscriptCorrectionAllowed(
        { canRead: true, canMutateConversation: true, canViewTranscript: true },
        "auditor",
      ),
    ).toThrow(AppDomainError);
  });
});
