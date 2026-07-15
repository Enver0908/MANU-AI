"use client";

import type { ConversationMessageDto } from "@/lib/phase-85-stage-4b2-contracts";
import {
  formatConversationMessageTime,
  isConversationContentUnavailable,
  isGreenDraftMessage,
  resolveConversationBubbleAlignment,
  resolveConversationMessageBody,
  resolveConversationMessageProvenance,
} from "@/lib/conversation-detail-helpers";
import type { ConversationMediaDto } from "@/lib/phase-85-stage-4b3-media-contracts";
import type { ClientRecord } from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { Badge, ConfirmButton, TextareaInput } from "./shared";
import { ConversationMessageMedia } from "./conversation-message-media";
import { ConversationMessageAudio } from "./conversation-message-audio";
import { ConversationMessageVoiceTranscript } from "./conversation-message-voice-transcript";

export function ConversationMessageBubble({
  message,
  client,
  uiLanguage,
  draftEdit,
  onDraftEdit,
  showDraftControls,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
  onOpenMediaPreview,
}: {
  message: ConversationMessageDto;
  client: ClientRecord | null;
  uiLanguage: SupportedLanguageCode;
  draftEdit: string;
  onDraftEdit: (value: string) => void;
  showDraftControls: boolean;
  onApproveDraft: () => Promise<void>;
  onEditAndSendDraft: () => Promise<void>;
  onDismissDraft: () => Promise<void>;
  onOpenMediaPreview?: (asset: ConversationMediaDto) => void;
}) {
  const provenance = resolveConversationMessageProvenance(message);
  const body = resolveConversationMessageBody(message);
  const unavailable = isConversationContentUnavailable(message.contentStatus);
  const alignment = resolveConversationBubbleAlignment(message.sender);
  const isAssistant = message.sender === "assistant";
  const isClient = message.sender === "client";
  const isGreenDraft = isGreenDraftMessage(message, client);
  const timeLabel = formatConversationMessageTime(message.createdAt);

  return (
    <div className={`flex ${alignment === "start" ? "justify-start" : "justify-end"}`} data-message-id={message.id}>
      <div
        className={`max-w-[min(720px,100%)] rounded-lg border px-3 py-2 shadow-sm ${
          isAssistant
            ? "border-emerald-200 bg-emerald-50"
            : isClient
              ? "border-stone-200 bg-white"
              : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={t(uiLanguage, provenance.i18nKey)} tone={provenance.tone} />
          {message.status ? <Badge label={message.status} tone="stone" /> : null}
          {message.isDraft ? <Badge label="draft" tone="amber" /> : null}
        </div>
        <p
          className={`mt-2 whitespace-pre-wrap break-words text-sm leading-6 ${
            unavailable ? "italic text-stone-500" : "text-stone-900"
          }`}
        >
          {body}
        </p>
        <ConversationMessageMedia
          conversationId={message.conversationId}
          media={message.media}
          uiLanguage={uiLanguage}
          onOpenPreview={onOpenMediaPreview}
        />
        {message.audio ? <ConversationMessageAudio audio={message.audio} uiLanguage={uiLanguage} /> : null}
        {message.voiceTranscript ? (
          <ConversationMessageVoiceTranscript voiceTranscript={message.voiceTranscript} uiLanguage={uiLanguage} />
        ) : null}
        {isGreenDraft && showDraftControls ? (
          <div className="mt-3 border-t border-emerald-200 pt-3">
            <TextareaInput
              label={t(uiLanguage, "conversationDraftEditLabel")}
              value={draftEdit}
              onChange={onDraftEdit}
              rows={3}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <ConfirmButton
                label={t(uiLanguage, "conversationDraftApprove")}
                confirmLabel={t(uiLanguage, "conversationDraftApproveConfirm")}
                onConfirm={onApproveDraft}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              />
              <ConfirmButton
                label={t(uiLanguage, "conversationDraftEditSend")}
                confirmLabel={t(uiLanguage, "conversationDraftEditSendConfirm")}
                onConfirm={onEditAndSendDraft}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                confirmClassName="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              />
              <button
                onClick={() => void onDismissDraft()}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-300"
                type="button"
              >
                {t(uiLanguage, "conversationDraftDismiss")}
              </button>
            </div>
          </div>
        ) : null}
        {timeLabel ? <p className="mt-2 text-xs text-stone-500">{timeLabel}</p> : null}
      </div>
    </div>
  );
}
