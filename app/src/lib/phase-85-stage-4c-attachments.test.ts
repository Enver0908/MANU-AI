import { describe, expect, it } from "vitest";
import {
  AI_CHAT_ATTACHMENT_MAX_IMAGE_BYTES,
  buildAiChatAttachmentObjectKey,
  detectGeneralChatAttachmentPii,
  extractUtf8Text,
  formatAttachmentCitationLocator,
  hashAttachmentBytes,
  isRejectedAttachmentFileName,
  resolveAttachmentKindFromMime,
  resolveAttachmentScanner,
  runDeterministicAttachmentScan,
  validateAttachmentLimits,
} from "./phase-85-stage-4c-attachments";
import {
  completeAttachmentUploadInMemory,
  createAttachmentUploadSessionInMemory,
  createEmptyAttachmentState,
  putAttachmentObjectBytesInMemory,
  transferAttachmentToClientRecordInMemory,
} from "./phase-85-stage-4c-attachment-store";
import type { AppTenantContext } from "./auth-context";

const tenantContext: AppTenantContext = {
  tenantId: "tenant-a",
  userId: "user-a",
  dietitianId: "dietitian-a",
  role: "dietitian",
  capabilities: ["dietitian_ai_chat"],
};

describe("phase-85 stage 4c attachments", () => {
  it("rejects spoofed extensions and unsupported mime types", () => {
    expect(isRejectedAttachmentFileName("report.docm")).toBe(true);
    expect(resolveAttachmentKindFromMime("application/x-msdownload")).toBeNull();
    expect(resolveAttachmentKindFromMime("image/webp")).toBe("image");
  });

  it("enforces per-message attachment limits", () => {
    const result = validateAttachmentLimits({
      kind: "image",
      byteSize: AI_CHAT_ATTACHMENT_MAX_IMAGE_BYTES + 1,
      existing: [],
    });
    expect(result.ok).toBe(false);
  });

  it("creates object keys without original filenames", () => {
    expect(
      buildAiChatAttachmentObjectKey("tenant", "user", "chat", "attachment"),
    ).toBe("tenant/user/chat/attachment");
  });

  it("flags general-chat PII and client names", () => {
    expect(detectGeneralChatAttachmentPii("client uuid 11111111-1111-4111-8111-111111111111").flagged).toBe(true);
    expect(detectGeneralChatAttachmentPii("Client Context Fixture", ["Client Context Fixture"]).flagged).toBe(true);
  });

  it("rejects invalid utf8 text documents", () => {
    const invalid = Buffer.from([0xff, 0xfe, 0xfd]);
    expect(extractUtf8Text(invalid).ok).toBe(false);
  });

  it("formats citation locators for pdf/csv/audio", () => {
    expect(formatAttachmentCitationLocator({ page: 2 })).toBe("page 2");
    expect(formatAttachmentCitationLocator({ rowStart: 1, rowEnd: 10 })).toBe("rows 1-10");
    expect(formatAttachmentCitationLocator({ audioStartSec: 0, audioEndSec: 12.5 })).toBe("0.0s-12.5s");
  });

  it("runs deterministic malware fixture scan", () => {
    process.env.AI_CHAT_DETERMINISTIC_MODE = "true";
    const eicar = Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(runDeterministicAttachmentScan(eicar).ok).toBe(false);
    expect(resolveAttachmentScanner().status).toBe("fixture");
  });

  it("uploads and completes attachments with hash verification", () => {
    const state = createEmptyAttachmentState();
    const bytes = Buffer.from("hello", "utf8");
    const contentSha256 = hashAttachmentBytes(bytes);
    const created = createAttachmentUploadSessionInMemory(state, tenantContext, {
      conversationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      scopeType: "general",
      clientId: null,
      fileName: "notes.txt",
      mimeType: "text/plain",
      byteSize: bytes.byteLength,
      contentSha256,
      existing: [],
    });
    putAttachmentObjectBytesInMemory(state, created.attachment.id, created.uploadToken, bytes);
    const completed = completeAttachmentUploadInMemory(state, tenantContext, created.attachment.id, {
      contentSha256,
      uploadToken: created.uploadToken,
    });
    expect(completed.status).toBe("scanning");
  });

  it("requires preview acceptance for client-record transfer", () => {
    const state = createEmptyAttachmentState();
    const bytes = Buffer.from("%PDF");
    const hash = hashAttachmentBytes(bytes);
    const created = createAttachmentUploadSessionInMemory(state, tenantContext, {
      conversationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      scopeType: "client",
      clientId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      fileName: "lab.pdf",
      mimeType: "application/pdf",
      byteSize: bytes.byteLength,
      contentSha256: hash,
      existing: [],
    });
    putAttachmentObjectBytesInMemory(state, created.attachment.id, created.uploadToken, bytes);
    completeAttachmentUploadInMemory(state, tenantContext, created.attachment.id, {
      contentSha256: hash,
      uploadToken: created.uploadToken,
    });
    expect(() =>
      transferAttachmentToClientRecordInMemory(state, tenantContext, created.attachment.id, {
        clientId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        category: "laboratory_result",
        title: "Lab",
        previewAccepted: false,
      }),
    ).toThrow();
  });
});
