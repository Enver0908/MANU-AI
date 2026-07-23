"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { AiChatAttachmentDto } from "@/lib/phase-85-stage-4c-contracts";
import { AI_CHAT_CLIENT_RECORD_CATEGORIES } from "@/lib/phase-85-stage-4c-contracts";

export function AiChatAttachmentReview({
  uiLanguage,
  attachment,
  clientId,
  onClose,
  onSaveCorrection,
  onTransfer,
}: {
  uiLanguage: SupportedLanguageCode;
  attachment: AiChatAttachmentDto | null;
  clientId: string | null;
  onClose: () => void;
  onSaveCorrection: (attachmentId: string, derivativeId: string, correctedText: string) => Promise<void>;
  onTransfer?: (input: {
    attachmentId: string;
    category: (typeof AI_CHAT_CLIENT_RECORD_CATEGORIES)[number];
    title: string;
    previewAccepted: boolean;
  }) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<(typeof AI_CHAT_CLIENT_RECORD_CATEGORIES)[number]>("clinical_document");
  const [previewAccepted, setPreviewAccepted] = useState(false);
  if (!attachment) return null;
  const latest = attachment.derivatives.find((item) => item.status !== "superseded");
  const excerpt = latest?.excerpt ?? "";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 md:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-stone-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChatAttachmentReviewTitle")}</h2>
          <button type="button" className="min-h-11 min-w-11 rounded-lg px-3 text-sm" onClick={onClose}>
            {t(uiLanguage, "aiChatSourceDrawerClose")}
          </button>
        </div>
        <p className="text-xs text-stone-500">{attachment.fileName}</p>
        <textarea
          className="mt-3 min-h-32 w-full rounded-lg border border-stone-200 p-3 text-sm"
          value={draft || excerpt}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={t(uiLanguage, "aiChatAttachmentReviewExcerpt")}
        />
        {attachment.status === "review_required" ? (
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 text-sm font-semibold text-white"
            onClick={() => {
              if (!latest?.id) return;
              void onSaveCorrection(attachment.id, latest.id, draft || excerpt);
            }}
          >
            {t(uiLanguage, "aiChatAttachmentSaveCorrection")}
          </button>
        ) : null}
        {clientId && onTransfer ? (
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {t(uiLanguage, "aiChatAttachmentTransferTitle")}
            </h3>
            <input
              className="min-h-11 w-full rounded-lg border border-stone-200 px-3 text-sm"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t(uiLanguage, "aiChatAttachmentTransferTitlePlaceholder")}
            />
            <select
              className="min-h-11 w-full rounded-lg border border-stone-200 px-3 text-sm"
              value={category}
              onChange={(event) => setCategory(event.target.value as (typeof AI_CHAT_CLIENT_RECORD_CATEGORIES)[number])}
            >
              {AI_CHAT_CLIENT_RECORD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={previewAccepted} onChange={(event) => setPreviewAccepted(event.target.checked)} />
              {t(uiLanguage, "aiChatAttachmentTransferPreviewConfirm")}
            </label>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-lg border border-stone-300 px-4 text-sm font-semibold text-stone-900"
              onClick={() =>
                void onTransfer({
                  attachmentId: attachment.id,
                  category,
                  title,
                  previewAccepted,
                })
              }
            >
              {t(uiLanguage, "aiChatAttachmentTransferAction")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
