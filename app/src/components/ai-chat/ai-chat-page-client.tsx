"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AiChatWorkspace } from "@/components/ai-chat/ai-chat-workspace";
import { EmptyState } from "@/components/dashboard/state-primitives";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import { AI_CHAT_ROOT_PATH } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { DashboardSection } from "@/lib/phase-85-stage-4b-dashboard-routing";
import type { SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

/**
 * Route-level wrapper for `/dashboard/ai-chat` and `/dashboard/ai-chat/[chatId]`.
 * Independent from `useManuState`/internal-copilot state; only the display
 * language and role come from the server-resolved auth (see
 * `resolveDashboardAuth`). The active chat URL is the single source of truth.
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
  const focusMode = searchParams.get("focus") === "1";

  const withFocusQuery = useCallback(
    (path: string) => (focusMode ? `${path}?focus=1` : path),
    [focusMode],
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
    const base = activeChatId ? `${AI_CHAT_ROOT_PATH}/${activeChatId}` : AI_CHAT_ROOT_PATH;
    router.push(focusMode ? base : `${base}?focus=1`);
  }, [activeChatId, focusMode, router]);

  const navigateSection = useCallback(
    (section: DashboardSection) => router.push(`/dashboard?section=${section}`),
    [router],
  );

  return (
    <DashboardShell
      activeNavKey="ai_chat"
      uiLanguage={uiLanguage}
      aiChatEnabled
      onNavigateSection={navigateSection}
      focusMode={focusMode}
    >
      <div id={DASHBOARD_MAIN_ID} tabIndex={-1} className="flex min-h-screen min-w-0 flex-1 flex-col outline-none">
        {canAccessAiChat ? (
          <AiChatWorkspace
            uiLanguage={uiLanguage}
            activeChatId={activeChatId}
            focusMode={focusMode}
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
    </DashboardShell>
  );
}
