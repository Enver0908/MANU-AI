import { AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES, resolveAttachmentKindFromMime } from "./phase-85-stage-4c-attachments";

export const PRODUCTION_FILE_SECURITY_CONTRACT_VERSION =
  "production-readiness-stage-1-phase-4-file-security-v1";

export type ProductionFileUploadAdmissionInput = {
  declaredMimeType: string;
  declaredByteSize: number;
  actualByteSize: number;
  contentSha256: string;
};

export type ProductionFileUploadAdmissionDecision =
  | { ok: true; kind: "image" | "document" | "audio"; version: typeof PRODUCTION_FILE_SECURITY_CONTRACT_VERSION }
  | {
      ok: false;
      code:
        | "unsupported_mime"
        | "declared_size_invalid"
        | "actual_size_invalid"
        | "declared_actual_size_mismatch"
        | "content_sha256_invalid";
      version: typeof PRODUCTION_FILE_SECURITY_CONTRACT_VERSION;
    };

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export function evaluateProductionFileUploadAdmission(
  input: ProductionFileUploadAdmissionInput,
): ProductionFileUploadAdmissionDecision {
  const kind = resolveAttachmentKindFromMime(input.declaredMimeType);
  if (!kind) {
    return { ok: false, code: "unsupported_mime", version: PRODUCTION_FILE_SECURITY_CONTRACT_VERSION };
  }
  if (!Number.isFinite(input.declaredByteSize) || input.declaredByteSize <= 0) {
    return { ok: false, code: "declared_size_invalid", version: PRODUCTION_FILE_SECURITY_CONTRACT_VERSION };
  }
  if (!Number.isFinite(input.actualByteSize) || input.actualByteSize <= 0 || input.actualByteSize > AI_CHAT_ATTACHMENT_MAX_TOTAL_BYTES) {
    return { ok: false, code: "actual_size_invalid", version: PRODUCTION_FILE_SECURITY_CONTRACT_VERSION };
  }
  if (input.declaredByteSize !== input.actualByteSize) {
    return { ok: false, code: "declared_actual_size_mismatch", version: PRODUCTION_FILE_SECURITY_CONTRACT_VERSION };
  }
  if (!SHA256_PATTERN.test(input.contentSha256)) {
    return { ok: false, code: "content_sha256_invalid", version: PRODUCTION_FILE_SECURITY_CONTRACT_VERSION };
  }
  return { ok: true, kind, version: PRODUCTION_FILE_SECURITY_CONTRACT_VERSION };
}
