import { describe, expect, it } from "vitest";
import { AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES } from "./phase-85-stage-4c-attachments";
import { evaluateProductionFileUploadAdmission } from "./production-file-security-contracts";

describe("production file security contracts", () => {
  it("admits only supported file kinds with valid declared and actual sizes", () => {
    expect(
      evaluateProductionFileUploadAdmission({
        declaredMimeType: "application/pdf",
        declaredByteSize: 1024,
        actualByteSize: 1024,
        contentSha256: "a".repeat(64),
      }),
    ).toMatchObject({ ok: true, kind: "document" });
  });

  it("rejects unsupported MIME, invalid hash, and declared/actual size mismatch", () => {
    expect(
      evaluateProductionFileUploadAdmission({
        declaredMimeType: "text/html",
        declaredByteSize: 1024,
        actualByteSize: 1024,
        contentSha256: "a".repeat(64),
      }),
    ).toMatchObject({ ok: false, code: "unsupported_mime" });
    expect(
      evaluateProductionFileUploadAdmission({
        declaredMimeType: "image/png",
        declaredByteSize: 1024,
        actualByteSize: 1024,
        contentSha256: "not-a-hash",
      }),
    ).toMatchObject({ ok: false, code: "content_sha256_invalid" });
    expect(
      evaluateProductionFileUploadAdmission({
        declaredMimeType: "audio/wav",
        declaredByteSize: 1024,
        actualByteSize: 1025,
        contentSha256: "a".repeat(64),
      }),
    ).toMatchObject({ ok: false, code: "declared_actual_size_mismatch" });
  });

  it("rejects empty or oversized upload bodies before persistence", () => {
    expect(
      evaluateProductionFileUploadAdmission({
        declaredMimeType: "image/jpeg",
        declaredByteSize: 0,
        actualByteSize: 0,
        contentSha256: "a".repeat(64),
      }),
    ).toMatchObject({ ok: false, code: "declared_size_invalid" });
    expect(
      evaluateProductionFileUploadAdmission({
        declaredMimeType: "image/jpeg",
        declaredByteSize: AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES + 1,
        actualByteSize: AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES + 1,
        contentSha256: "a".repeat(64),
      }),
    ).toMatchObject({ ok: false, code: "actual_size_invalid" });
  });
});
