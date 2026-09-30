"use client";

import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import type { ConversationInboxItem } from "@/lib/phase-85-stage-4b2-contracts";
import type { DashboardUrlState } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { ClientRecord, ManuAppState } from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";
import { AppRequestError } from "@/lib/app-errors";
import { useStage4B2Messaging } from "@/lib/use-stage-4b2-messaging";
import { Phase55MessagingPanel } from "@/components/dashboard/phase-55-messaging-panel-target";
import { ConversationPanel } from "@/components/dashboard/conversation-panel";

type MessagingOptions = Parameters<typeof useStage4B2Messaging>[0];

export function MessagesRoute({
  uiLanguage,
  filters,
  enabled,
  conversationId,
  anchorMessageId,
  listFilters,
  mergeDetailIntoState,
  mergeMutationIntoState,
  selectedConversationId,
  detailUnavailable,
  restoreListScrollTop,
  state,
  selectedClient,
  canManageAiControls,
  isActivatingAi,
  onActivateAi,
  onSetAiPassive,
  onSendManualReplyRequest,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
  onReviewSendManualFromDraft,
  onOpenConversation,
  onBackToList,
  onOpenClientWorkspace,
  onFiltersChange,
  onSetListScrollTop,
  onSaveListViewState,
}: {
  uiLanguage: SupportedLanguageCode;
  filters: DashboardUrlState;
  enabled: boolean;
  conversationId: string | null;
  anchorMessageId: string | null;
  listFilters: MessagingOptions["filters"];
  mergeDetailIntoState: MessagingOptions["mergeDetailIntoState"];
  mergeMutationIntoState: MessagingOptions["mergeMutationIntoState"];
  selectedConversationId: string | null;
  detailUnavailable: boolean;
  restoreListScrollTop: number | null;
  state: ManuAppState;
  selectedClient: ClientRecord | null;
  canManageAiControls: boolean;
  isActivatingAi: boolean;
  onActivateAi: (clientId: string, requestedAiMode?: "copilot" | "autopilot") => Promise<unknown>;
  onSetAiPassive: (clientId: string) => Promise<ManuAppState>;
  onSendManualReplyRequest: (input: {
    clientId: string;
    body: string;
    aiChatDraftTransferId?: string;
  }) => Promise<ManuAppState>;
  onApproveDraft: (messageId: string) => Promise<ManuAppState>;
  onEditAndSendDraft: (messageId: string, body: string) => Promise<ManuAppState>;
  onDismissDraft: (messageId: string) => Promise<ManuAppState>;
  onReviewSendManualFromDraft: (messageId: string, body: string) => Promise<ManuAppState>;
  onOpenConversation: (item: ConversationInboxItem) => void;
  onBackToList: () => void;
  onOpenClientWorkspace: () => void;
  onFiltersChange: (patch: Partial<DashboardUrlState>) => void;
  onSetListScrollTop: (scrollTop: number) => void;
  onSaveListViewState: (scrollTop: number) => void;
}) {
  const [manualReply, setManualReply] = useState("");
  const [isSendingManualReply, setIsSendingManualReply] = useState(false);
  const messaging = useStage4B2Messaging({
    enabled,
    conversationId,
    anchorMessageId,
    filters: listFilters,
    mergeDetailIntoState,
    mergeMutationIntoState,
  });
  const refreshAfterMutation = messaging.refreshAfterMutation;

  const refresh = useCallback(
    (anchorMessageId?: string | null) => {
      void refreshAfterMutation({ anchorMessageId });
    },
    [refreshAfterMutation],
  );

  const sendManualReply = useCallback(async () => {
    if (!selectedClient || !manualReply.trim() || isSendingManualReply) return;
    const body = manualReply;
    const aiChatDraftTransferId = messaging.detail?.pendingAiChatDraftTransfer?.transferId;
    setIsSendingManualReply(true);
    try {
      await onSendManualReplyRequest({ clientId: selectedClient.id, body, aiChatDraftTransferId });
      setManualReply("");
      refresh(filters.messageId);
    } catch (error) {
      if (error instanceof AppRequestError && error.status === 409) {
        refresh(filters.messageId);
        return;
      }
      throw error;
    } finally {
      setIsSendingManualReply(false);
    }
  }, [filters.messageId, isSendingManualReply, manualReply, messaging.detail, onSendManualReplyRequest, refresh, selectedClient]);

  const runConversationMutation = useCallback(
    async (operation: () => Promise<ManuAppState>) => {
      try {
        const result = await operation();
        refresh(filters.messageId);
        return result;
      } catch (error) {
        if (error instanceof AppRequestError && error.status === 409) refresh(filters.messageId);
        throw error;
      }
    },
    [filters.messageId, refresh],
  );

  const activateAiForConversation = useCallback(
    async (clientId: string) => {
      const result = await onActivateAi(clientId);
      await refreshAfterMutation({ anchorMessageId: filters.messageId });
      return (result as ManuAppState) ?? state;
    },
    [filters.messageId, onActivateAi, refreshAfterMutation, state],
  );

  let detail: ReactNode = null;
  if (messaging.detail?.conversation) {
    detail = (
      <ConversationPanel
        client={selectedClient}
        conversation={messaging.detail.conversation}
        messages={messaging.detailMessages}
        pagination={messaging.detail.pagination}
        permissions={messaging.permissions}
        anchorMessageId={filters.messageId}
        state={state}
        uiLanguage={uiLanguage}
        canManageAiControls={canManageAiControls}
        manualReply={manualReply}
        onManualReply={setManualReply}
        onSendManualReply={sendManualReply}
        isSendingManualReply={isSendingManualReply}
        pendingAiChatDraftTransfer={messaging.detail.pendingAiChatDraftTransfer ?? null}
        onActivateAi={activateAiForConversation}
        onSetAiPassive={onSetAiPassive}
        isActivatingAi={isActivatingAi}
        onApproveDraft={(messageId) => runConversationMutation(() => onApproveDraft(messageId))}
        onEditAndSendDraft={(messageId, body) => runConversationMutation(() => onEditAndSendDraft(messageId, body))}
        onDismissDraft={(messageId) => runConversationMutation(() => onDismissDraft(messageId))}
        onReviewSendManualFromDraft={(messageId, body) =>
          runConversationMutation(() => onReviewSendManualFromDraft(messageId, body))
        }
        onOpenClientWorkspace={onOpenClientWorkspace}
        onLoadOlder={() => void messaging.loadOlderMessages()}
        onLoadNewer={() => void messaging.loadNewerMessages()}
        onRetryDetail={() => void messaging.refreshDetail({ resetBackoff: true })}
        isLoadingOlder={messaging.isLoadingOlderMessages}
        isLoadingNewer={messaging.isLoadingNewerMessages}
        isDetailRefreshing={messaging.isDetailRefreshing}
        detailError={messaging.detailError}
        onSubmitVisualCorrection={(input) => messaging.submitVisualCorrection(conversationId!, input)}
        onSubmitTranscriptCorrection={(input) => messaging.submitTranscriptCorrection(conversationId!, input)}
      />
    );
  } else if (messaging.isDetailRefreshing) {
    detail = (
      <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600" aria-busy="true">
        Mesaj ayrıntısı yenileniyor
      </div>
    );
  }

  return (
    <Phase55MessagingPanel
      uiLanguage={uiLanguage}
      filters={filters}
      items={messaging.listItems}
      filteredTotal={messaging.list?.filteredTotal ?? 0}
      unreadConversationCount={messaging.unreadConversationCount}
      unreadMessageCount={messaging.unreadMessageCount}
      nextCursor={messaging.listNextCursor}
      listError={messaging.listError}
      detailError={messaging.detailError}
      isListRefreshing={messaging.isListRefreshing}
      isDetailRefreshing={messaging.isDetailRefreshing}
      isLoadingMore={messaging.isLoadingMoreList}
      lastSuccessAt={messaging.lastSuccessAt}
      selectedConversationId={selectedConversationId}
      onFiltersChange={onFiltersChange}
      onRefreshList={() => void messaging.refreshList({ resetBackoff: true })}
      onLoadMore={() => void messaging.loadMoreList()}
      onSelectConversation={(item) => {
        const list = document.querySelector("[data-testid='messaging-list-scroll']");
        if (list instanceof HTMLElement) {
          onSetListScrollTop(list.scrollTop);
          onSaveListViewState(list.scrollTop);
        }
        onOpenConversation(item);
      }}
      onBackToList={onBackToList}
      restoreListScrollTop={restoreListScrollTop}
      detailUnavailable={detailUnavailable}
      detail={detail}
    />
  );
}
