"use client";

import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";

/**
 * Source/context panel content. Faz 4 ships the structural panel only —
 * retrieval + source citation wiring lands with the durable run flow.
 */
export function AiChatContextPanelContent({ uiLanguage }: { uiLanguage: SupportedLanguageCode }) {
  return (
    <div className="flex h-full flex-col gap-3 p-4" data-testid="ai-chat-context-panel">
      <h2 className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChatSourceDrawerOpen")}</h2>
      <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center" role="status">
        <p className="text-sm text-stone-600">{t(uiLanguage, "aiChatEmptyMessagesTitle")}</p>
      </div>
    </div>
  );
}
