"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Info, Lock, Maximize2, Menu, Minimize2, Pencil, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import {
  createAiChatConversation,
  generateAiChatRequestId,
  groupAiChatHistoryByDate,
  useAiChatConversation,
  useAiChatHistory,
} from "@/lib/use-ai-chat";
import type { AiChatListScopeFilter, AiChatScopeType } from "@/lib/phase-85-stage-4c-contracts";
import { AiChatHistorySidebar } from "./ai-chat-history-sidebar";
import { AiChatClientPicker } from "./ai-chat-client-picker";
import { AiChatMessageList } from "./ai-chat-message-list";
import { AiChatComposer } from "./ai-chat-composer";
import { AiChatContextPanelContent } from "./ai-chat-context-drawer";

const COMPACT_BREAKPOINT_PX = 1024;

function useIsCompactViewport() {
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < COMPACT_BREAKPOINT_PX,
  );
  useEffect(() => {
    const onResize = () => setIsCompact(window.innerWidth < COMPACT_BREAKPOINT_PX);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isCompact;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * ChatGPT-like AI Chat workspace shell (Faz 4). Independent of
 * `useManuState`/internal-copilot state; the active chat URL is the source
 * of truth and drives every fetch below.
 */
export function AiChatWorkspace({
  uiLanguage,
  activeChatId,
  focusMode,
  onNavigateToChat,
  onNavigateToRoot,
  onToggleFocusMode,
}: {
  uiLanguage: SupportedLanguageCode;
  activeChatId: string | null;
  focusMode: boolean;
  onNavigateToChat: (chatId: string) => void;
  onNavigateToRoot: () => void;
  onToggleFocusMode: () => void;
}) {
  const isCompactViewport = useIsCompactViewport();
  const useOverlayChrome = focusMode || isCompactViewport;

  const [scope, setScope] = useState<AiChatListScopeFilter>("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const debouncedHistoryQuery = useDebouncedValue(historyQuery, 300);
  const history = useAiChatHistory({ scope, query: debouncedHistoryQuery });
  const conversation = useAiChatConversation(activeChatId);

  const [mobileDrawer, setMobileDrawer] = useState<"none" | "history" | "context">("none");
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState(false);

  const groups = useMemo(() => groupAiChatHistoryByDate(history.items), [history.items]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMobileDrawer("none");
      setIsRenaming(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeChatId]);

  const toggleHistoryDrawer = () => setMobileDrawer((current) => (current === "history" ? "none" : "history"));
  const toggleContextDrawer = () => setMobileDrawer((current) => (current === "context" ? "none" : "context"));

  const handleCreateChat = useCallback(
    async (input: { scopeType: AiChatScopeType; clientId: string | null; title: string }) => {
      setIsCreating(true);
      setCreateError(null);
      try {
        const summary = await createAiChatConversation({
          requestId: generateAiChatRequestId(),
          scopeType: input.scopeType,
          clientId: input.clientId,
          title: input.title,
        });
        setPickerOpen(false);
        onNavigateToChat(summary.id);
        void history.refresh();
      } catch {
        setCreateError("failed");
      } finally {
        setIsCreating(false);
      }
    },
    [history, onNavigateToChat],
  );

  const startRename = () => {
    if (!conversation.detail) return;
    setRenameValue(conversation.detail.title);
    setRenameError(false);
    setIsRenaming(true);
  };

  const submitRename = async () => {
    if (!conversation.detail) return;
    const title = renameValue.trim();
    if (!title) return;
    try {
      await conversation.rename({
        requestId: generateAiChatRequestId(),
        expectedRevision: conversation.detail.revision,
        title,
      });
      setIsRenaming(false);
      void history.refresh();
    } catch {
      setRenameError(true);
    }
  };

  const historySidebar = (
    <AiChatHistorySidebar
      uiLanguage={uiLanguage}
      scope={scope}
      query={historyQuery}
      onScopeChange={setScope}
      onQueryChange={setHistoryQuery}
      groups={groups}
      activeChatId={activeChatId}
      onSelectChat={onNavigateToChat}
      onNewChat={() => setPickerOpen(true)}
      isLoading={history.isLoading}
      isLoadingMore={history.isLoadingMore}
      error={history.error}
      hasNextPage={Boolean(history.nextCursor)}
      onLoadMore={() => void history.loadMore()}
      onRetry={() => void history.refresh()}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row" data-testid="ai-chat-workspace">
      {!useOverlayChrome && (
        <aside className="hidden w-80 shrink-0 border-r border-stone-200 bg-stone-50 lg:flex lg:flex-col">
          {historySidebar}
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {useOverlayChrome && (
              <button
                type="button"
                onClick={toggleHistoryDrawer}
                aria-label={t(uiLanguage, "aiChatHistoryDrawerOpen")}
                data-testid="ai-chat-history-drawer-toggle"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-stone-600 transition hover:bg-stone-100"
              >
                <Menu size={18} />
              </button>
            )}
            <div className="min-w-0">
              {conversation.detail ? (
                isRenaming ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submitRename();
                        if (event.key === "Escape") setIsRenaming(false);
                      }}
                      autoFocus
                      aria-label={t(uiLanguage, "aiChatTitleLabel")}
                      className="min-h-11 rounded-lg border border-stone-200 px-2 py-1 text-sm outline-none focus:border-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={() => void submitRename()}
                      aria-label={t(uiLanguage, "aiChatRenameSave")}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsRenaming(false)}
                      aria-label={t(uiLanguage, "aiChatCancel")}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startRename}
                    aria-label={t(uiLanguage, "aiChatRenameAction")}
                    className="flex min-w-0 items-center gap-1.5 text-left"
                    data-testid="ai-chat-title"
                  >
                    <span className="truncate text-sm font-semibold text-stone-900" style={{ overflowWrap: "anywhere" }}>
                      {conversation.detail.title}
                    </span>
                    <Pencil size={13} className="shrink-0 text-stone-400" />
                  </button>
                )
              ) : (
                <span className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChat")}</span>
              )}
              {conversation.detail?.scopeType === "client" && (
                <p
                  className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-emerald-700"
                  style={{ overflowWrap: "anywhere" }}
                >
                  <Lock size={11} aria-hidden="true" />
                  {conversation.detail.clientFullName} · {conversation.detail.clientReferenceShort}
                </p>
              )}
              {renameError && (
                <p role="alert" className="text-xs font-medium text-red-700">
                  {t(uiLanguage, "aiChatActionFailed")}
                </p>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleContextDrawer}
              aria-label={t(uiLanguage, mobileDrawer === "context" ? "aiChatSourceDrawerClose" : "aiChatSourceDrawerOpen")}
              data-testid="ai-chat-context-drawer-toggle"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 transition hover:bg-stone-100"
            >
              <Info size={18} />
            </button>
            <button
              type="button"
              onClick={onToggleFocusMode}
              aria-label={t(uiLanguage, focusMode ? "aiChatFocusExit" : "aiChatFocusEnter")}
              data-testid="ai-chat-focus-toggle"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 transition hover:bg-stone-100"
            >
              {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>

        {conversation.notFound ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChatNotFoundTitle")}</p>
              <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "aiChatNotFoundMessage")}</p>
              <button
                type="button"
                onClick={onNavigateToRoot}
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                {t(uiLanguage, "aiChat")}
              </button>
            </div>
          </div>
        ) : activeChatId && conversation.detail ? (
          <>
            <AiChatMessageList uiLanguage={uiLanguage} chatId={activeChatId} messages={conversation.detail.messages} />
            <AiChatComposer uiLanguage={uiLanguage} />
          </>
        ) : activeChatId && conversation.error ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center">
              <p role="alert" className="text-sm font-semibold text-stone-900">
                {t(uiLanguage, "aiChatHistoryError")}
              </p>
              <button
                type="button"
                onClick={() => void conversation.refresh()}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                {t(uiLanguage, "aiChatRetry")}
              </button>
            </div>
          </div>
        ) : !activeChatId ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="text-center">
              <p className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChatEmptyHistoryTitle")}</p>
              <p className="mt-1 text-sm text-stone-600">{t(uiLanguage, "aiChatEmptyHistoryMessage")}</p>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                data-testid="ai-chat-empty-new-chat-button"
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                {t(uiLanguage, "aiChatNewChat")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6" aria-busy="true">
            <span role="status" className="text-sm text-stone-600">
              …
            </span>
          </div>
        )}
      </div>

      {!useOverlayChrome && mobileDrawer === "context" && (
        <aside className="hidden w-80 shrink-0 border-l border-stone-200 bg-stone-50 lg:flex lg:flex-col">
          <AiChatContextPanelContent uiLanguage={uiLanguage} />
        </aside>
      )}

      {useOverlayChrome && mobileDrawer === "history" && (
        <div
          className="fixed inset-0 z-40 flex"
          role="presentation"
          data-testid="ai-chat-history-drawer"
          onClick={() => setMobileDrawer("none")}
        >
          <div
            className="flex h-full w-80 max-w-[85vw] flex-col border-r border-stone-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            {historySidebar}
          </div>
          <div className="flex-1 bg-stone-950/30" data-testid="ai-chat-drawer-backdrop" />
        </div>
      )}

      {useOverlayChrome && mobileDrawer === "context" && (
        <div
          className="fixed inset-0 z-40 flex justify-end"
          role="presentation"
          data-testid="ai-chat-context-drawer"
          onClick={() => setMobileDrawer("none")}
        >
          <div className="flex-1 bg-stone-950/30" data-testid="ai-chat-drawer-backdrop" />
          <div
            className="flex h-full w-80 max-w-[85vw] flex-col border-l border-stone-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <AiChatContextPanelContent uiLanguage={uiLanguage} />
          </div>
        </div>
      )}

      <AiChatClientPicker
        open={isPickerOpen}
        uiLanguage={uiLanguage}
        onClose={() => setPickerOpen(false)}
        onCreate={handleCreateChat}
        isCreating={isCreating}
        error={createError}
      />
    </div>
  );
}
