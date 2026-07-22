"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { AI_CHAT_MESSAGE_BODY_MAX_LENGTH } from "@/lib/phase-85-stage-4c-contracts";

const MAX_VISIBLE_LINES = 8;
const LINE_HEIGHT_PX = 24;
const VERTICAL_PADDING_PX = 20;

/**
 * Message send is implemented in a later phase (durable run flow); this is
 * the UI foundation only. `onSend` is optional so Enter is a safe no-op
 * until that capability lands.
 */
export function AiChatComposer({
  uiLanguage,
  disabled = false,
  onSend,
}: {
  uiLanguage: SupportedLanguageCode;
  disabled?: boolean;
  onSend?: (body: string) => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const maxHeight = MAX_VISIBLE_LINES * LINE_HEIGHT_PX + VERTICAL_PADDING_PX;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || !onSend) return;
    onSend(trimmed);
    setValue("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-stone-200 bg-white px-3 py-3 pb-safe" data-testid="ai-chat-composer">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value.slice(0, AI_CHAT_MESSAGE_BODY_MAX_LENGTH))}
        onKeyDown={onKeyDown}
        rows={1}
        disabled={disabled}
        placeholder={t(uiLanguage, "aiChatComposerPlaceholder")}
        aria-label={t(uiLanguage, "aiChatComposerPlaceholder")}
        className="max-h-[212px] min-h-11 flex-1 resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-700 disabled:bg-stone-50 disabled:text-stone-400"
        style={{ overflowWrap: "anywhere" }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !onSend || value.trim().length === 0}
        aria-label={t(uiLanguage, "aiChatComposerPlaceholder")}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-emerald-950 text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
