"use client";

import { FileAudio, FileText, ImageIcon, Loader2, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { AiChatAttachmentDto } from "@/lib/phase-85-stage-4c-contracts";

function iconForKind(kind: AiChatAttachmentDto["kind"]) {
  if (kind === "image") return ImageIcon;
  if (kind === "audio") return FileAudio;
  return FileText;
}

export function AiChatAttachmentStrip({
  uiLanguage,
  attachments,
  onRemove,
  onReview,
}: {
  uiLanguage: SupportedLanguageCode;
  attachments: AiChatAttachmentDto[];
  onRemove: (attachmentId: string) => void;
  onReview: (attachment: AiChatAttachmentDto) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-stone-100 px-3 py-2" data-testid="ai-chat-attachment-strip">
      {attachments.map((attachment) => {
        const Icon = iconForKind(attachment.kind);
        const busy = ["upload_pending", "scanning", "processing"].includes(attachment.status);
        return (
          <div
            key={attachment.id}
            className="flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin text-stone-500" aria-hidden /> : <Icon className="h-4 w-4 text-stone-600" aria-hidden />}
            <button
              type="button"
              className="truncate text-left font-medium text-stone-800"
              onClick={() => onReview(attachment)}
            >
              {attachment.fileName}
            </button>
            <span className="text-stone-500">{t(uiLanguage, `aiChatAttachmentStatus_${attachment.status}` as never)}</span>
            <button
              type="button"
              aria-label={t(uiLanguage, "aiChatAttachmentRemove")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-stone-600 hover:bg-stone-200"
              onClick={() => onRemove(attachment.id)}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
