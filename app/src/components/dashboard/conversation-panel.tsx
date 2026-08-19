"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, RefreshCcw } from "lucide-react";
import type {
  ConversationMessageDto,
  ConversationPagination,
  ConversationPermissions,
  ConversationSummaryDto,
} from "@/lib/phase-85-stage-4b2-contracts";
import {
  buildConversationTimelineItems,
  isYellowDraftReviewMessage,
  resolveActiveYellowDraft,
  resolveConversationDetailMutationVisibility,
} from "@/lib/conversation-detail-helpers";
import { isRedRiskLockActive } from "@/lib/ai-assistant-control-panel-helpers";
import type { ClientRecord, ManuAppState } from "@/lib/types";
import type { ConversationMediaDto } from "@/lib/phase-85-stage-4b3-media-contracts";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { buildClientHumanControlBanner } from "@/lib/phase-85-if-h-operational-visibility";
import { EmptyState, removeKey } from "./shared";
import { HumanControlSessionBanner } from "./operational-visibility";
import { ConversationHeader } from "./conversation-header";
import { ConversationMessageBubble } from "./conversation-message-bubble";
import { ConversationMediaPreviewModal } from "./conversation-message-media";
import { ConversationVisualReviewPanel } from "./conversation-visual-review-panel";
import { ConversationVoiceTranscriptReviewPanel } from "./conversation-voice-transcript-review-panel";
import { ConversationComposer } from "./conversation-composer";
import { ConversationDraftReviewPanel } from "./conversation-draft-review-panel";
import { ConversationAiControlsStrip } from "./conversation-ai-controls-strip";
import { MOBILE_CHROME_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";

export function ConversationPanel({
  client,
  conversation,
  messages,
  pagination,
  permissions,
  anchorMessageId,
  uiLanguage,
  canManageAiControls = true,
  manualReply,
  onManualReply,
  onSendManualReply,
  pendingAiChatDraftTransfer,
  onActivateAi,
  onSetAiPassive,
  isActivatingAi,
  isSendingManualReply = false,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
  onReviewSendManualFromDraft,
  onOpenSimulator,
  onOpenClientWorkspace,
  onLoadOlder,
  onLoadNewer,
  onRetryDetail,
  isLoadingOlder,
  isLoadingNewer,
  isDetailRefreshing,
  detailError,
  state,
  onSubmitVisualCorrection,
  onSubmitTranscriptCorrection,
}: {
  client: ClientRecord | null;
  conversation: ConversationSummaryDto;
  messages: ConversationMessageDto[];
  pagination: ConversationPagination | null;
  permissions: ConversationPermissions | null;
  anchorMessageId?: string | null;
  uiLanguage: SupportedLanguageCode;
  canManageAiControls?: boolean;
  manualReply: string;
  onManualReply: (value: string) => void;
  onSendManualReply: () => void;
  pendingAiChatDraftTransfer?: {
    transferId: string;
    body: string;
    riskLevel: "green";
    reviewOrigin: "ai_chat";
  } | null;
  onActivateAi: (clientId: string) => Promise<ManuAppState>;
  onSetAiPassive: (clientId: string) => Promise<ManuAppState>;
  isActivatingAi?: boolean;
  isSendingManualReply?: boolean;
  onApproveDraft: (messageId: string) => Promise<ManuAppState>;
  onEditAndSendDraft: (messageId: string, body: string) => Promise<ManuAppState>;
  onDismissDraft: (messageId: string) => Promise<ManuAppState>;
  onReviewSendManualFromDraft: (messageId: string, body: string) => Promise<ManuAppState>;
  onOpenSimulator: () => void;
  onOpenClientWorkspace?: () => void;
  onLoadOlder: () => void;
  onLoadNewer: () => void;
  onRetryDetail: () => void;
  isLoadingOlder: boolean;
  isLoadingNewer: boolean;
  isDetailRefreshing: boolean;
  detailError: string | null;
  state: ManuAppState;
  onSubmitVisualCorrection?: (input: {
    analysisId: string;
    requestId: string;
    expectedConversationRevision: number;
    expectedAnalysisRevision: number;
    reasonCode: string;
    explanation: string;
  }) => Promise<void>;
  onSubmitTranscriptCorrection?: (input: {
    transcriptionId: string;
    targetMessageId: string;
    requestId: string;
    expectedConversationRevision: number;
    expectedTranscriptionRevision: number;
    reasonCode: string;
    explanation: string;
    correctedTranscript: string;
  }) => Promise<void>;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [yellowDraftEdits, setYellowDraftEdits] = useState<Record<string, string>>({});
  const [previewAsset, setPreviewAsset] = useState<ConversationMediaDto | null>(null);
  const redRiskLocked = client ? isRedRiskLockActive(client) : false;
  const visibility = resolveConversationDetailMutationVisibility(permissions, client, { canManageAiControls });
  const timelineItems = useMemo(() => buildConversationTimelineItems(messages), [messages]);
  const activeYellowDraft = useMemo(
    () => (visibility.showYellowDraftReview ? resolveActiveYellowDraft(messages, client) : null),
    [client, messages, visibility.showYellowDraftReview],
  );
  const yellowDraftBody = activeYellowDraft
    ? (yellowDraftEdits[activeYellowDraft.id] ?? activeYellowDraft.body ?? "")
    : "";
  const humanControlBanner = useMemo(
    () => (client ? buildClientHumanControlBanner(state, client.id) : null),
    [client, state],
  );

  const composerDirty = Boolean(manualReply.trim());
  const draftEditDirty = useMemo(() => {
    const timelineDirty = Object.entries(draftEdits).some(([messageId, body]) => {
      const message = messages.find((item) => item.id === messageId);
      return Boolean(message && body !== (message.body ?? ""));
    });
    const yellowDirty = Boolean(
      activeYellowDraft && yellowDraftBody !== (activeYellowDraft.body ?? ""),
    );
    return timelineDirty || yellowDirty;
  }, [activeYellowDraft, draftEdits, messages, yellowDraftBody]);

  useShellDirtyRegistration({
    id: "conversation-composer",
    label: "Mesaj taslağı",
    state: (composerDirty ? "dirty" : "clean") as ShellDirtyEntryState,
    canSave: false,
    onDiscard: () => onManualReply(""),
  });

  useShellDirtyRegistration({
    id: "conversation-draft-edit",
    label: "AI taslak düzenleme",
    state: (draftEditDirty ? "dirty" : "clean") as ShellDirtyEntryState,
    canSave: false,
    onDiscard: () => {
      setDraftEdits({});
      setYellowDraftEdits({});
    },
  });

  useEffect(() => {
    if (!anchorMessageId) return;
    const target = timelineRef.current?.querySelector(`[data-message-id="${anchorMessageId}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("ring-2", "ring-emerald-500");
      window.setTimeout(() => target.classList.remove("ring-2", "ring-emerald-500"), 1600);
    }
  }, [anchorMessageId, messages]);

  useEffect(() => {
    if (!pendingAiChatDraftTransfer?.body) return;
    onManualReply(pendingAiChatDraftTransfer.body);
  }, [pendingAiChatDraftTransfer?.transferId, pendingAiChatDraftTransfer?.body, onManualReply]);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden ${MOBILE_CHROME_CLASS.bottomNavWithStickyActions}`}
      data-testid="conversation-panel"
    >
      <ConversationHeader
        conversation={conversation}
        uiLanguage={uiLanguage}
        onOpenSimulator={onOpenSimulator}
        onOpenClientWorkspace={onOpenClientWorkspace}
      />

      {redRiskLocked ? (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-900"
          data-testid="conversation-red-banner"
          role="alert"
        >
          {t(uiLanguage, "conversationRedBannerBody")}
        </div>
      ) : null}

      {client && humanControlBanner ? (
        <div className="mt-3">
          <HumanControlSessionBanner
            banner={{ ...humanControlBanner, canActivateAi: humanControlBanner.canActivateAi && canManageAiControls }}
            uiLanguage={uiLanguage}
            isActivating={isActivatingAi}
            onActivateAi={() => {
              void onActivateAi(client.id);
            }}
          />
        </div>
      ) : null}

      {permissions?.isReadOnly || !canManageAiControls ? (
        <p
          className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
          role="status"
          data-testid="conversation-read-only-label"
        >
          {!canManageAiControls
            ? t(uiLanguage, "shellReadOnlyConversationAssistant")
            : t(uiLanguage, "conversationReadOnlyNotice")}
        </p>
      ) : null}

      {detailError ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" role="alert">
          {t(uiLanguage, "inboxRefreshError")} ({detailError})
          <button
            type="button"
            onClick={onRetryDetail}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700"
          >
            <RefreshCcw size={16} />
            {t(uiLanguage, "refreshInbox")}
          </button>
        </div>
      ) : null}

      <div ref={timelineRef} className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-1 py-2">
        {pagination?.hasOlder ? (
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={isLoadingOlder}
            className="min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingOlder ? t(uiLanguage, "refreshInbox") : t(uiLanguage, "conversationLoadOlder")}
          </button>
        ) : null}

        {isDetailRefreshing && messages.length === 0 ? (
          <p className="text-sm text-stone-600" aria-busy="true">
            {t(uiLanguage, "refreshInbox")}
          </p>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title={t(uiLanguage, "conversationEmptyTitle")}
            message={t(uiLanguage, "conversationEmptyHint")}
          />
        ) : (
          timelineItems.map((item) =>
            item.type === "date" ? (
              <div key={item.key} className="flex justify-center py-1">
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">{item.label}</span>
              </div>
            ) : (
              <ConversationMessageBubble
                key={item.key}
                message={item.message}
                client={client}
                uiLanguage={uiLanguage}
                draftEdit={draftEdits[item.message.id] ?? item.message.body ?? ""}
                onDraftEdit={(value) => setDraftEdits((current) => ({ ...current, [item.message.id]: value }))}
                showDraftControls={visibility.showDraftControls && !isYellowDraftReviewMessage(item.message, client)}
                onOpenMediaPreview={setPreviewAsset}
                onApproveDraft={async () => {
                  await onApproveDraft(item.message.id);
                  setDraftEdits((current) => removeKey(current, item.message.id));
                }}
                onEditAndSendDraft={async () => {
                  await onEditAndSendDraft(item.message.id, draftEdits[item.message.id] ?? item.message.body ?? "");
                  setDraftEdits((current) => removeKey(current, item.message.id));
                }}
                onDismissDraft={async () => {
                  await onDismissDraft(item.message.id);
                  setDraftEdits((current) => removeKey(current, item.message.id));
                }}
              />
            ),
          )
        )}

        {pagination?.hasNewer ? (
          <button
            type="button"
            onClick={onLoadNewer}
            disabled={isLoadingNewer}
            className="min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingNewer ? t(uiLanguage, "refreshInbox") : t(uiLanguage, "conversationLoadNewer")}
          </button>
        ) : null}
      </div>

      {messages
        .filter((message) => message.visualReview?.correctionAllowed)
        .slice(-1)
        .map((message) => (
          <ConversationVisualReviewPanel
            key={`visual-review-${message.id}`}
            message={message}
            conversationRevision={conversation.revision}
            uiLanguage={uiLanguage}
            disabled={!onSubmitVisualCorrection || permissions?.isReadOnly}
            onSubmit={async (input) => {
              if (!onSubmitVisualCorrection) return;
              await onSubmitVisualCorrection(input);
            }}
          />
        ))}

      {messages
        .filter((message) => message.voiceTranscript?.correctionAllowed)
        .slice(-1)
        .map((message) => (
          <ConversationVoiceTranscriptReviewPanel
            key={`voice-review-${message.id}-${message.voiceTranscript?.transcriptionRevision}-${message.voiceTranscript?.latestCorrectionId ?? "none"}-${message.voiceTranscript?.status}`}
            message={message}
            conversationRevision={conversation.revision}
            uiLanguage={uiLanguage}
            disabled={!onSubmitTranscriptCorrection || permissions?.isReadOnly}
            onSubmit={async (input) => {
              if (!onSubmitTranscriptCorrection) return;
              await onSubmitTranscriptCorrection(input);
            }}
          />
        ))}

      <ConversationMediaPreviewModal
        open={previewAsset !== null}
        conversationId={conversation.id}
        asset={previewAsset}
        uiLanguage={uiLanguage}
        onClose={() => setPreviewAsset(null)}
      />

      {activeYellowDraft ? (
        <ConversationDraftReviewPanel
          draft={activeYellowDraft}
          uiLanguage={uiLanguage}
          body={yellowDraftBody}
          onBodyChange={(value) => {
            if (!activeYellowDraft) return;
            setYellowDraftEdits((current) => ({ ...current, [activeYellowDraft.id]: value }));
          }}
          disabled={!visibility.showDraftControls}
          onReviewSendManual={async () => {
            if (!activeYellowDraft) return;
            await onReviewSendManualFromDraft(activeYellowDraft.id, yellowDraftBody);
            setYellowDraftEdits((current) => removeKey(current, activeYellowDraft.id));
          }}
        />
      ) : null}

      {visibility.showComposer ? (
        <ConversationComposer
          uiLanguage={uiLanguage}
          value={manualReply}
          onChange={onManualReply}
          onSend={onSendManualReply}
          sending={isSendingManualReply}
          hint={
            pendingAiChatDraftTransfer
              ? t(uiLanguage, "conversationAiChatDraftTransferHint")
              : undefined
          }
        />
      ) : null}

      {visibility.showAiControls && client ? (
        <ConversationAiControlsStrip
          client={client}
          uiLanguage={uiLanguage}
          canManageAiControls={canManageAiControls}
          isActivatingAi={isActivatingAi}
          onActivateAi={onActivateAi}
          onSetPassive={onSetAiPassive}
        />
      ) : null}
    </div>
  );
}
