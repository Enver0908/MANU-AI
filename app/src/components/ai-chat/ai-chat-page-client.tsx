"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { AiChatWorkspace } from "@/components/ai-chat/ai-chat-workspace";
import { EmptyState } from "@/components/dashboard/state-primitives";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import { AI_CHAT_ROOT_PATH } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

/**
 * Route-level wrapper for `/dashboard/ai-chat` and `/dashboard/ai-chat/[chatId]`.
 * Shell chrome comes from AuthenticatedShellBoundary; this component owns only
 * the AI Chat workspace content and focus-mode URL toggles.
 */
export function AiChatPageClient({
  activeChatId,
  uiLanguage,
  canAccessAiChat,
}: {
  activeChatId: string | null;
  uiLanguage: SupportedLanguageCode;
  canAccessAiChat: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { focusMode, setHeaderSlots, setFocusMode } = useShellProvider();
  const urlFocus = searchParams.get("focus") === "1";

  useEffect(() => {
    setHeaderSlots({
      title: <h1 className="text-2xl font-semibold">AI Chat</h1>,
      description: (
        <p className="mt-1 text-sm text-stone-500">
          {focusMode || urlFocus ? "Odak modu açık" : "Genel sohbet — danışan bağlamı kullanılmıyor"}
        </p>
      ),
    });
    return () => setHeaderSlots({});
  }, [focusMode, setHeaderSlots, urlFocus]);

  const withFocusQuery = useCallback(
    (path: string) => (urlFocus ? `${path}?focus=1` : path),
    [urlFocus],
  );

  const navigateToChat = useCallback(
    (chatId: string) => router.push(withFocusQuery(`${AI_CHAT_ROOT_PATH}/${chatId}`)),
    [router, withFocusQuery],
  );

  const navigateToRoot = useCallback(
    () => router.push(withFocusQuery(AI_CHAT_ROOT_PATH)),
    [router, withFocusQuery],
  );

  const toggleFocusMode = useCallback(() => {
    setFocusMode(!urlFocus);
  }, [setFocusMode, urlFocus]);

  return (
    <div id={DASHBOARD_MAIN_ID} tabIndex={-1} className="flex min-h-screen min-w-0 flex-1 flex-col outline-none">
      {canAccessAiChat ? (
        <AiChatWorkspace
          uiLanguage={uiLanguage}
          activeChatId={activeChatId}
          focusMode={urlFocus}
          onNavigateToChat={navigateToChat}
          onNavigateToRoot={navigateToRoot}
          onToggleFocusMode={toggleFocusMode}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState title={t(uiLanguage, "aiChatUnavailableTitle")} message={t(uiLanguage, "aiChatUnavailableMessage")} />
        </div>
      )}
    </div>
  );
}
