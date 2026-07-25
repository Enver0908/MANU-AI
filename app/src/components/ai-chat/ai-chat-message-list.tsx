"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { copyAiChatText } from "@/lib/use-ai-chat";
import type { AiChatMessageDto, AiChatMessageVersionDto } from "@/lib/phase-85-stage-4c-contracts";

export const DEFAULT_MESSAGE_HEIGHT_PX = 96;
const MESSAGE_GAP_PX = 12;
const OVERSCAN = 6;
const BOTTOM_STICK_THRESHOLD_PX = 64;

export function resolveActiveMessageVersion(message: AiChatMessageDto): AiChatMessageVersionDto | null {
  if (message.versions.length === 0) return null;
  return message.versions.find((version) => version.contentStatus === "active") ?? message.versions[message.versions.length - 1];
}

export function buildMessageHeightOffsets(
  messageIds: readonly string[],
  heightsByMessageId: ReadonlyMap<string, number>,
  gapPx: number = MESSAGE_GAP_PX,
  fallbackHeight: number = DEFAULT_MESSAGE_HEIGHT_PX,
) {
  const offsets: number[] = [];
  let totalHeight = 0;
  for (let index = 0; index < messageIds.length; index += 1) {
    offsets.push(totalHeight);
    totalHeight += heightsByMessageId.get(messageIds[index]!) ?? fallbackHeight;
    if (index < messageIds.length - 1) totalHeight += gapPx;
  }
  return { offsets, totalHeight };
}

export function resolveScrollTopAfterPrepend(input: {
  previousScrollTop: number;
  prependedHeight: number;
}) {
  return input.previousScrollTop + input.prependedHeight;
}

export function measurePrependedBlockHeight(
  prependedIds: readonly string[],
  heightsByMessageId: ReadonlyMap<string, number>,
  gapPx: number = MESSAGE_GAP_PX,
  fallbackHeight: number = DEFAULT_MESSAGE_HEIGHT_PX,
) {
  if (prependedIds.length === 0) return 0;
  let total = 0;
  for (let index = 0; index < prependedIds.length; index += 1) {
    total += heightsByMessageId.get(prependedIds[index]!) ?? fallbackHeight;
    if (index < prependedIds.length - 1) total += gapPx;
  }
  return total;
}

export function computeMeasuredVirtualizedMessageRange(
  messageIds: readonly string[],
  heightsByMessageId: ReadonlyMap<string, number>,
  scrollTop: number,
  viewportHeight: number,
  overscan: number = OVERSCAN,
  fallbackHeight: number = DEFAULT_MESSAGE_HEIGHT_PX,
): { start: number; end: number; spacerBefore: number; spacerAfter: number } {
  if (messageIds.length === 0 || viewportHeight <= 0) {
    return { start: 0, end: 0, spacerBefore: 0, spacerAfter: 0 };
  }

  const { offsets, totalHeight } = buildMessageHeightOffsets(messageIds, heightsByMessageId, MESSAGE_GAP_PX, fallbackHeight);
  const scrollBottom = scrollTop + viewportHeight;

  let start = 0;
  while (start < messageIds.length && offsets[start]! + (heightsByMessageId.get(messageIds[start]!) ?? fallbackHeight) < scrollTop) {
    start += 1;
  }
  start = Math.max(0, start - overscan);

  let end = start;
  while (end < messageIds.length && offsets[end]! < scrollBottom) {
    end += 1;
  }
  end = Math.min(messageIds.length, end + overscan);

  const lastVisibleOffset = offsets[end] ?? totalHeight;
  return {
    start,
    end,
    spacerBefore: offsets[start] ?? 0,
    spacerAfter: Math.max(0, totalHeight - lastVisibleOffset),
  };
}

export function computeVirtualizedMessageRange(
  totalCount: number,
  scrollTop: number,
  viewportHeight: number,
  estimatedItemHeight: number = DEFAULT_MESSAGE_HEIGHT_PX,
  overscan: number = OVERSCAN,
): { start: number; end: number } {
  if (totalCount === 0 || viewportHeight <= 0) return { start: 0, end: totalCount };
  const start = Math.max(0, Math.floor(scrollTop / estimatedItemHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / estimatedItemHeight) + overscan * 2;
  const end = Math.min(totalCount, start + visibleCount);
  return { start, end };
}

function scrollStorageKey(chatId: string) {
  return `ai-chat-scroll:${chatId}`;
}

function MessageBubble({
  message,
  uiLanguage,
  isLatestUser,
  isLatestAssistant,
  onHeightChange,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  message: AiChatMessageDto;
  uiLanguage: SupportedLanguageCode;
  isLatestUser: boolean;
  isLatestAssistant: boolean;
  onHeightChange: (messageId: string, height: number) => void;
  onEdit?: (messageId: string, body: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeVersion = resolveActiveMessageVersion(message);
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const isDeleting =
    Boolean(message.deletedAt) ||
    message.versions.some((version) => version.contentStatus === "deleting") ||
    activeVersion?.contentStatus === "deleting";

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const reportHeight = () => {
      const height = Math.ceil(node.getBoundingClientRect().height);
      if (height > 0) onHeightChange(message.id, height);
    };
    reportHeight();
    const observer = new ResizeObserver(() => reportHeight());
    observer.observe(node);
    return () => observer.disconnect();
  }, [message.id, onHeightChange, activeVersion?.body, isDeleting]);

  const handleCopy = async () => {
    if (!activeVersion?.body) return;
    const ok = await copyAiChatText(activeVersion.body);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      ref={rootRef}
      data-message-id={message.id}
      data-testid={`ai-chat-message-${message.id}`}
      className={`group max-w-3xl rounded-lg border p-3 ${
        isUser ? "ml-auto border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-stone-600">{message.role}</p>
        <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={t(uiLanguage, "aiChatCopy")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
          >
            <Copy size={14} />
          </button>
          {isUser && isLatestUser && onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(message.id, activeVersion?.body ?? "")}
              aria-label={t(uiLanguage, "aiChatEdit")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
            >
              <Pencil size={14} />
            </button>
          ) : null}
          {isUser && isLatestUser && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label={t(uiLanguage, "aiChatDeleteMessage")}
              data-testid={`ai-chat-delete-message-${message.id}`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
          {!isUser && isLatestAssistant && onRegenerate ? (
            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              aria-label={t(uiLanguage, "aiChatRegenerate")}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 hover:bg-stone-100"
            >
              <RefreshCw size={14} />
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800" style={{ overflowWrap: "anywhere" }}>
        {isDeleting ? t(uiLanguage, "aiChatMessageDeleting") : activeVersion?.body ?? ""}
      </p>
      {copied ? (
        <p className="mt-1 text-xs font-medium text-emerald-700">{t(uiLanguage, "aiChatCopied")}</p>
      ) : null}
      {message.deletedAt ? (
        <p className="mt-2 text-xs font-medium text-stone-400">{t(uiLanguage, "aiChatConversationLocked")}</p>
      ) : null}
    </div>
  );
}

export function AiChatMessageList({
  uiLanguage,
  chatId,
  messages,
  streamingText,
  streamingIncomplete = false,
  onEdit,
  onRegenerate,
  onDelete,
}: {
  uiLanguage: SupportedLanguageCode;
  chatId: string;
  messages: AiChatMessageDto[];
  streamingText?: string;
  streamingIncomplete?: boolean;
  onEdit?: (messageId: string, body: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [heightsByMessageId, setHeightsByMessageId] = useState<Map<string, number>>(() => new Map());
  const [range, setRange] = useState({
    start: 0,
    end: messages.length,
    spacerBefore: 0,
    spacerAfter: 0,
  });
  const isAtBottomRef = useRef(true);
  const prevFirstMessageIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);

  const messageIds = useMemo(() => messages.map((message) => message.id), [messages]);

  const handleHeightChange = useCallback((messageId: string, height: number) => {
    setHeightsByMessageId((current) => {
      if (current.get(messageId) === height) return current;
      const next = new Map(current);
      next.set(messageId, height);
      return next;
    });
  }, []);

  const latestUserId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "user")?.id ?? null,
    [messages],
  );
  const latestAssistantId = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant")?.id ?? null,
    [messages],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const stored = window.sessionStorage.getItem(scrollStorageKey(chatId));
    if (stored) {
      container.scrollTop = Number(stored) || 0;
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [chatId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const firstMessageId = messages[0]?.id ?? null;
    const previousCount = prevMessageCountRef.current;
    const previousFirstId = prevFirstMessageIdRef.current;
    const prependedCount =
      previousCount > 0 && messages.length > previousCount && firstMessageId !== previousFirstId
        ? messages.length - previousCount
        : 0;

    if (prependedCount > 0) {
      const prependedIds = messages.slice(0, prependedCount).map((message) => message.id);
      const prependedHeight = measurePrependedBlockHeight(prependedIds, heightsByMessageId);
      container.scrollTop = resolveScrollTopAfterPrepend({
        previousScrollTop: container.scrollTop,
        prependedHeight,
      });
    } else if (isAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }

    prevFirstMessageIdRef.current = firstMessageId;
    prevMessageCountRef.current = messages.length;
  }, [messages, heightsByMessageId, streamingText]);

  const refreshRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const nextRange = computeMeasuredVirtualizedMessageRange(
      messageIds,
      heightsByMessageId,
      container.scrollTop,
      container.clientHeight,
    );
    setRange((current) =>
      current.start === nextRange.start &&
      current.end === nextRange.end &&
      current.spacerBefore === nextRange.spacerBefore &&
      current.spacerAfter === nextRange.spacerAfter
        ? current
        : nextRange,
    );
  }, [heightsByMessageId, messageIds]);

  const onScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom < BOTTOM_STICK_THRESHOLD_PX;
    window.sessionStorage.setItem(scrollStorageKey(chatId), String(container.scrollTop));
    refreshRange();
  };

  useEffect(() => {
    refreshRange();
  }, [messages.length, heightsByMessageId, refreshRange]);

  if (messages.length === 0 && !streamingText) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6" data-testid="ai-chat-message-list-empty">
        <p className="text-sm text-stone-600" role="status">
          {t(uiLanguage, "aiChatEmptyMessagesTitle")}
        </p>
      </div>
    );
  }

  const visible = messages.slice(range.start, range.end);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      style={{ minHeight: 0 }}
      data-testid="ai-chat-message-list"
      aria-live="polite"
    >
      {range.spacerBefore > 0 ? <div style={{ height: range.spacerBefore }} aria-hidden="true" /> : null}
      {visible.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          uiLanguage={uiLanguage}
          isLatestUser={message.id === latestUserId}
          isLatestAssistant={message.id === latestAssistantId}
          onHeightChange={handleHeightChange}
          onEdit={onEdit}
          onRegenerate={onRegenerate}
          onDelete={onDelete}
        />
      ))}
      {streamingText ? (
        <div
          data-testid="ai-chat-streaming-message"
          className="max-w-3xl rounded-lg border border-stone-200 bg-white p-3"
        >
          <p className="text-xs font-semibold uppercase text-stone-600">assistant</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800" style={{ overflowWrap: "anywhere" }}>
            {streamingText}
          </p>
          {streamingIncomplete ? (
            <p className="mt-2 text-xs font-medium text-stone-500">{t(uiLanguage, "aiChatIncomplete")}</p>
          ) : null}
        </div>
      ) : null}
      {range.spacerAfter > 0 ? <div style={{ height: range.spacerAfter }} aria-hidden="true" /> : null}
    </div>
  );
}
