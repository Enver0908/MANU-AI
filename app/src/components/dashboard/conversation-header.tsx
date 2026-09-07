"use client";

import { UserRound } from "lucide-react";
import type { ConversationSummaryDto } from "@/lib/phase-85-stage-4b2-contracts";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

export function ConversationHeader({
  conversation,
  uiLanguage,
  onOpenClientWorkspace,
}: {
  conversation: ConversationSummaryDto;
  uiLanguage: SupportedLanguageCode;
  onOpenClientWorkspace?: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-stone-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="truncate text-lg font-semibold text-stone-950">{conversation.clientFullName}</h3>
        <p className="mt-0.5 text-sm text-stone-600">{t(uiLanguage, "conversationDetailSubtitle")}</p>
      </div>
      {onOpenClientWorkspace ? (
        <div className="flex flex-nowrap gap-2">
          <button
            onClick={onOpenClientWorkspace}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
            type="button"
            data-testid="conversation-open-workspace"
          >
            <UserRound size={16} aria-hidden="true" />
            {t(uiLanguage, "conversationOpenClientWorkspace")}
          </button>
        </div>
      ) : null}
    </header>
  );
}
