"use client";

import type { ConversationMessageDto } from "@/lib/phase-85-stage-4b2-contracts";
import { resolveConversationMessageBody } from "@/lib/conversation-detail-helpers";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { ConfirmButton, TextareaInput } from "./shared";

export function ConversationDraftReviewPanel({
  draft,
  uiLanguage,
  body,
  onBodyChange,
  onReviewSendManual,
  disabled,
}: {
  draft: ConversationMessageDto;
  uiLanguage: SupportedLanguageCode;
  body: string;
  onBodyChange: (value: string) => void;
  onReviewSendManual: () => Promise<void>;
  disabled?: boolean;
}) {
  return (
    <section
      className="border-t border-amber-200 bg-amber-50 p-3"
      data-testid="conversation-yellow-draft-review"
      aria-labelledby="conversation-yellow-draft-title"
    >
      <h4 id="conversation-yellow-draft-title" className="text-sm font-semibold text-amber-950">
        {t(uiLanguage, "conversationYellowDraftTitle")}
      </h4>
      <p className="mt-1 text-sm text-amber-900">{t(uiLanguage, "conversationYellowDraftHint")}</p>
      <div className="mt-3">
        <TextareaInput
          label={t(uiLanguage, "conversationDraftEditLabel")}
          value={body}
          onChange={onBodyChange}
          rows={4}
        />
        <ConfirmButton
          label={t(uiLanguage, "conversationYellowDraftSend")}
          confirmLabel={t(uiLanguage, "conversationYellowDraftSendConfirm")}
          onConfirm={onReviewSendManual}
          disabled={disabled || !body.trim()}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          confirmClassName="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
        />
      </div>
      <p className="sr-only" data-draft-id={draft.id}>
        {resolveConversationMessageBody(draft)}
      </p>
    </section>
  );
}
