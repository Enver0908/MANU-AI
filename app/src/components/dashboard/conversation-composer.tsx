"use client";

import { Send } from "lucide-react";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { TextareaInput } from "./shared";
import { MobileStickyActionBar } from "./mobile-ergonomics";

export function ConversationComposer({
  uiLanguage,
  value,
  onChange,
  onSend,
  disabled,
  hint,
}: {
  uiLanguage: SupportedLanguageCode;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <>
      <div className="hidden border-t border-stone-200 bg-white p-3 lg:block" data-testid="conversation-composer">
        {hint ? <p className="mb-2 text-xs font-medium text-emerald-800">{hint}</p> : null}
        <TextareaInput
          label={t(uiLanguage, "conversationManualReplyLabel")}
          value={value}
          onChange={onChange}
          rows={3}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
        >
          <Send size={16} aria-hidden="true" />
          {t(uiLanguage, "conversationSendManualReply")}
        </button>
      </div>

      <MobileStickyActionBar>
        <div className="w-full space-y-2 px-1 lg:hidden">
          {hint ? <p className="text-xs font-medium text-emerald-800">{hint}</p> : null}
          <TextareaInput
            label={t(uiLanguage, "conversationManualReplyLabel")}
            value={value}
            onChange={onChange}
            rows={2}
          />
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            <Send size={16} aria-hidden="true" />
            {t(uiLanguage, "conversationSendManualReply")}
          </button>
        </div>
      </MobileStickyActionBar>
    </>
  );
}
