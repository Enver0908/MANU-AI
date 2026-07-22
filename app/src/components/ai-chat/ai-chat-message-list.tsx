"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { AiChatMessageDto, AiChatMessageVersionDto } from "@/lib/phase-85-stage-4c-contracts";

const ESTIMATED_ITEM_HEIGHT_PX = 96;
const OVERSCAN = 6;
const BOTTOM_STICK_THRESHOLD_PX = 64;

export function resolveActiveMessageVersion(message: AiChatMessageDto): AiChatMessageVersionDto | null {
  if (message.versions.length === 0) return null;
  return message.versions.find((version) => version.contentStatus === "active") ?? message.versions[message.versions.length - 1];
}

/**
 * Lightweight windowing for long histories: renders only the rows likely to
 * be visible (plus overscan) instead of the full message array.
 */
export function computeVirtualizedMessageRange(
  totalCount: number,
  scrollTop: number,
  viewportHeight: number,
  estimatedItemHeight: number = ESTIMATED_ITEM_HEIGHT_PX,
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

function MessageBubble({ message, uiLanguage }: { message: AiChatMessageDto; uiLanguage: SupportedLanguageCode }) {
  const activeVersion = resolveActiveMessageVersion(message);
  const isUser = message.role === "user";
  return (
    <div
      data-testid={`ai-chat-message-${message.id}`}
      className={`max-w-3xl rounded-lg border p-3 ${
        isUser ? "ml-auto border-emerald-200 bg-emerald-50" : "border-stone-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase text-stone-600">{message.role}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800" style={{ overflowWrap: "anywhere" }}>
        {activeVersion?.body ?? ""}
      </p>
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
}: {
  uiLanguage: SupportedLanguageCode;
  chatId: string;
  messages: AiChatMessageDto[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: messages.length });
  const isAtBottomRef = useRef(true);

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
    if (isAtBottomRef.current) {
      const container = containerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  const onScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    isAtBottomRef.current = distanceFromBottom < BOTTOM_STICK_THRESHOLD_PX;
    window.sessionStorage.setItem(scrollStorageKey(chatId), String(container.scrollTop));
    setRange(computeVirtualizedMessageRange(messages.length, container.scrollTop, container.clientHeight));
  };

  useEffect(() => {
    setRange(computeVirtualizedMessageRange(messages.length, containerRef.current?.scrollTop ?? 0, containerRef.current?.clientHeight ?? 0));
  }, [messages.length]);

  if (messages.length === 0) {
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
      aria-live="off"
    >
      {range.start > 0 ? <div style={{ height: range.start * ESTIMATED_ITEM_HEIGHT_PX }} aria-hidden="true" /> : null}
      {visible.map((message) => (
        <MessageBubble key={message.id} message={message} uiLanguage={uiLanguage} />
      ))}
      {range.end < messages.length ? (
        <div style={{ height: (messages.length - range.end) * ESTIMATED_ITEM_HEIGHT_PX }} aria-hidden="true" />
      ) : null}
    </div>
  );
}
