"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ClientRecord,
} from "@/lib/types";
import { useDashboardUrl } from "@/lib/use-dashboard-url";
import { createAiChatConversation, generateAiChatRequestId } from "@/lib/use-ai-chat";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "@/lib/phase-85-stage-4b-contracts";
import {
  useAiyaStateActionsContext,
  useAiyaStateReadContext,
} from "@/lib/use-aiya-state";
import { t } from "@/lib/i18n";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import {
  buildDashboardHref,
  currentDashboardHref,
  dashboardSectionToShellDestination,
  mergeDashboardUrlState,
  resolveRetiredDashboardSectionRedirect,
  resolveMessagingRouteSelection,
  resolveStage6CommunicationDestination,
  type ClientWorkspaceTask,
  type DashboardSection,
  type Stage6CommunicationDestinationInput,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import {
  buildStage6ClientWorkspaceHref,
  formatStage6ClientReferenceShort,
  runStage6ClientActivation,
  runStage6CommunicationOpen,
} from "@/lib/phase-85-stage-6-client-selection";
import {
  resolveMessagingTargetValidity,
} from "@/lib/phase-85-stage-4b2-messaging-integration";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import {
  OverviewPanel,
  type OverviewAiChatAvailability,
  type OverviewClientWorkAreaAvailability,
} from "@/components/dashboard/overview-panel";
import { ShellHomeLauncher } from "@/components/dashboard/shell-home-launcher";
import { ClientWorkspaceRoute } from "@/components/dashboard/client-workspace-route";
import { VoiceRoute } from "@/components/dashboard/voice-route";
import { FormsRoute } from "@/components/dashboard/forms-route";
import { MessagesRoute } from "@/components/dashboard/messages-route";
import { InboxRoute } from "@/components/dashboard/inbox-route";
import { useMobileKeyboardScroll } from "@/components/dashboard/mobile-ergonomics";
import { DashboardLoadingSkeleton, EmptyState, ErrorState } from "@/components/dashboard/state-primitives";
import { resolveEffectiveShellActiveClientId } from "@/lib/phase-85-stage-5-shell-contracts";
import {
  recordPhase52ClientEvent,
  resolvePhase52SharedReadStartPolicy,
} from "@/lib/phase-52-diagnostic";

export function DashboardApp({
  authInfo,
  aiChatEnabled = false,
}: {
  authInfo?: { displayName: string; role: string };
  commercialInfo?: { subscriptionStatus: CommercialEntitlementStatus | null; installReady: boolean };
  aiChatEnabled?: boolean;
}) {
  const {
    state,
    hydrated,
    authError,
    hydrateError,
    hydrateRequestId,
  } = useAiyaStateReadContext();
  const {
    hydrate,
    retryHydrate,
    createClient,
    updateClient,
    removeClient,
    releaseHumanTakeover,
    activateClientAi,
    sendManualReply: sendManualReplyRequest,
    approveDraft,
    editAndSendDraft,
    dismissDraft,
    reviewSendManualFromDraft,
    addVoiceSamples,
    updateVoiceSampleStatus,
    generateVoiceProfile,
    createFormSchema,
    publishFormSchema,
    saveFormResponse,
    saveClientFoodRuleProfile,
    createMenuPlan,
    saveMenuPlan,
    activateMenuPlan,
    addClientContextUpdate,
    mergeConversationDetailIntoState,
    mergeConversationMutationIntoState,
  } = useAiyaStateActionsContext();
  const router = useRouter();
  const {
    setHeaderSlots,
    bootstrap,
    effectiveActiveClientId,
    saveDestinationViewState,
    restoreDestinationViewState,
    selectActiveClient,
    canNavigateAway,
    requestHrefNavigation,
    navigateToDestination,
    dirtySnapshot,
  } = useShellProvider();
  const { urlState, section, navigateDashboard } = useDashboardUrl();
  const phase52SharedReadStartPolicy = resolvePhase52SharedReadStartPolicy();
  useEffect(() => {
    if (hydrated) return;
    if (phase52SharedReadStartPolicy === "bootstrap_gate" && !bootstrap) return;
    recordPhase52ClientEvent("dashboard_hydration_triggered", {
      policy: phase52SharedReadStartPolicy,
    });
    void hydrate();
  }, [bootstrap, hydrate, hydrated, phase52SharedReadStartPolicy]);
  const [messagingListScrollTop, setMessagingListScrollTop] = useState<number | null>(null);
  const [isActivatingAi, setIsActivatingAi] = useState(false);
  const [isReleasingHumanTakeover, setIsReleasingHumanTakeover] = useState(false);
  const [isEvaluatingWithAi, setIsEvaluatingWithAi] = useState(false);
  const [evaluateWithAiError, setEvaluateWithAiError] = useState<string | null>(null);

  const activeClients = useMemo(
    () => state.clients.filter((client) => client.lifecycleStatus !== "removed_anonymized"),
    [state.clients],
  );

  const activeClientIds = useMemo(
    () => new Set(activeClients.map((client) => client.id)),
    [activeClients],
  );

  const messagingRoute = useMemo(
    () => resolveMessagingRouteSelection(urlState, state.conversations, activeClientIds),
    [activeClientIds, state.conversations, urlState],
  );

  const messagingTargetValidity = useMemo(() => {
    if (section !== "messages" || !messagingRoute.conversationId) {
      return { valid: true, reason: "ok" as const };
    }
    if (!messagingRoute.clientId) {
      return { valid: true, reason: "ok" as const };
    }
    return resolveMessagingTargetValidity(state, {
      clientId: messagingRoute.clientId,
      conversationId: messagingRoute.conversationId,
      messageId: urlState.messageId,
      activeClientIds,
      allowRemoteTarget: true,
    });
  }, [
    activeClientIds,
    messagingRoute.clientId,
    messagingRoute.conversationId,
    section,
    state,
    urlState.messageId,
  ]);

  const messagingListFilters = useMemo(
    () => ({
      conversationStatus: urlState.conversationStatus,
      conversationQuery: urlState.conversationQuery,
    }),
    [urlState.conversationQuery, urlState.conversationStatus],
  );


  useEffect(() => {
    const retiredRedirect = resolveRetiredDashboardSectionRedirect(section);
    if (retiredRedirect) router.replace(retiredRedirect);
  }, [router, section]);

  useEffect(() => {
    if (section !== "messages" || !messagingRoute.needsCanonicalization) return;
    if (!messagingRoute.canonicalConversationId || !messagingRoute.canonicalClientId) return;
    navigateDashboard(
      {
        conversationId: messagingRoute.canonicalConversationId,
        clientId: messagingRoute.canonicalClientId,
      },
      { replace: true },
    );
  }, [messagingRoute, navigateDashboard, section]);

  const notificationActorContext = useMemo(
    () => ({
      role: (authInfo?.role ?? "dietitian") as "owner" | "admin" | "dietitian" | "assistant" | "auditor",
      dietitianId: state.dietitian.id,
    }),
    [authInfo?.role, state.dietitian.id],
  );

  const resolvedClientId = useMemo(() => {
    if (section === "messages" && messagingRoute.clientId) {
      return messagingRoute.clientId;
    }
    const candidate = resolveEffectiveShellActiveClientId({
      urlClientId: urlState.clientId,
      preferenceClientId: bootstrap?.preferences.activeClientId ?? effectiveActiveClientId,
    });
    if (candidate && activeClients.some((client) => client.id === candidate)) {
      return candidate;
    }
    // Never auto-select the first listed client when context is missing/invalid.
    return null;
  }, [
    activeClients,
    bootstrap?.preferences.activeClientId,
    effectiveActiveClientId,
    messagingRoute.clientId,
    section,
    urlState.clientId,
  ]);

  const selectedClient = useMemo(() => {
    if (!resolvedClientId) return undefined;
    return activeClients.find((client) => client.id === resolvedClientId);
  }, [activeClients, resolvedClientId]);


  const workspaceUrlState = urlState;

  const workspaceClient = useMemo(() => {
    if (section !== "clients" || !workspaceUrlState.clientId) return null;
    return activeClients.find((client) => client.id === workspaceUrlState.clientId) ?? null;
  }, [activeClients, section, workspaceUrlState.clientId]);

  const mainContentRef = useRef<HTMLDivElement>(null);
  useMobileKeyboardScroll(mainContentRef);
  const previousSectionRef = useRef(section);

  useEffect(() => {
    const previous = previousSectionRef.current;
    if (previous !== section) {
      const previousDestination = dashboardSectionToShellDestination(previous);
      if (previous === "messages") {
        const list = document.querySelector("[data-testid='messaging-list-scroll']");
        saveDestinationViewState(previousDestination, {
          search: urlState.conversationQuery,
          filter: urlState.conversationStatus,
          scrollTop: list instanceof HTMLElement ? list.scrollTop : messagingListScrollTop ?? undefined,
        });
      }
      const nextDestination = dashboardSectionToShellDestination(section);
      const snapshot = restoreDestinationViewState(nextDestination);
      if (section === "messages" && snapshot && typeof snapshot.scrollTop === "number") {
        setMessagingListScrollTop(snapshot.scrollTop);
      }
      previousSectionRef.current = section;
    }
  }, [
    restoreDestinationViewState,
    saveDestinationViewState,
    section,
    urlState.conversationQuery,
    urlState.conversationStatus,
    messagingListScrollTop,
  ]);
  useEffect(() => {
    return () => {
      if (section === "messages") {
        const list = document.querySelector("[data-testid='messaging-list-scroll']");
        saveDestinationViewState("messages", {
          search: urlState.conversationQuery,
          filter: urlState.conversationStatus,
          scrollTop: list instanceof HTMLElement ? list.scrollTop : messagingListScrollTop ?? undefined,
        });
      }
    };
  }, [saveDestinationViewState, section, urlState.conversationQuery, urlState.conversationStatus, messagingListScrollTop]);

  const uiLanguage = state.dietitian.uiLanguage || "tr";
  const canManageAiControls =
    !authInfo || (authInfo.role !== "assistant" && authInfo.role !== "auditor");

  const overviewClientWorkAreaAvailability: OverviewClientWorkAreaAvailability = selectedClient
    ? { state: "enabled", clientName: selectedClient.fullName }
    : { state: "disabled", reason: "client_required" };

  const aiChatNavigation = bootstrap?.navigation.find((item) => item.id === "ai_chat");
  const overviewAiChatAvailability: OverviewAiChatAvailability = !aiChatEnabled
    ? { state: "disabled", reason: "feature_disabled" }
    : !aiChatNavigation
      ? { state: "disabled", reason: "access_unverified" }
      : aiChatNavigation.enabled
        ? { state: "enabled" }
        : {
            state: "disabled",
            reason:
              aiChatNavigation.disabledReason === "feature_disabled"
                ? "feature_disabled"
                : aiChatNavigation.disabledReason?.startsWith("rbac_forbidden_")
                  ? "role_forbidden"
                  : "access_unverified",
          };

  useEffect(() => {
    setHeaderSlots({
      actions: !canManageAiControls ? (
        <span
          className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700"
          data-testid="dashboard-read-only-role-label"
          role="status"
        >
          {t(uiLanguage, "shellReadOnlyAssistantAuditor")}
        </span>
      ) : undefined,
    });
    return () => setHeaderSlots({});
  }, [canManageAiControls, setHeaderSlots, uiLanguage]);

  if (!hydrated) {
    return <DashboardLoadingSkeleton />;
  }

  if (hydrateError) {
    return (
      <ErrorState
        title="Panel verisi yüklenemedi"
        message="Sunucudan uygulama durumu alınamadı. Demo veriye geçilmedi; oturumu yenileyin veya tekrar deneyin."
        detail={`Hata: ${hydrateError}${hydrateRequestId ? ` (requestId: ${hydrateRequestId})` : ""}`}
        onAction={() => void retryHydrate()}
        actionLabel="Tekrar dene"
      />
    );
  }

  if (authError) {
    return (
      <ErrorState
        title="Oturum hatası"
        message="Oturumunuz doğrulanamadı. Korumalı ekranlara erişim kapatıldı."
        detail={`Hata: ${authError}`}
      />
    );
  }

  const selectClient = async (
    clientId: string,
    patch: { section?: DashboardSection; clientTask?: ClientWorkspaceTask } = {},
  ) => {
    const client = activeClients.find((item) => item.id === clientId);
    if (!client) return;
    const previousHref = `${window.location.pathname}${window.location.search}`;
    const nextTask = patch.clientTask ?? "summary";
    const targetSection = patch.section ?? "clients";
    const targetHref =
      targetSection === "clients"
        ? buildStage6ClientWorkspaceHref(urlState, { clientId, clientTask: nextTask })
        : buildDashboardHref(
            "/dashboard",
            mergeDashboardUrlState(urlState, {
              section: targetSection,
              clientId,
              clientTask: null,
            }),
          );
    const outcome = await runStage6ClientActivation(
      {
        requestedClientId: clientId,
        previousHref,
        isSaving: dirtySnapshot.isSaving,
      },
      () =>
        selectActiveClient(
          {
            id: client.id,
            fullName: client.fullName,
            referenceShort: formatStage6ClientReferenceShort(client.id),
          },
          { afterHref: targetHref },
        ),
      () => targetHref,
    );
    if (outcome.kind !== "activated") return;
  };

  const openCommunicationDestination = async (input: Stage6CommunicationDestinationInput) => {
    const knownClientIds = new Set(activeClients.map((item) => item.id));
    const destination = resolveStage6CommunicationDestination(urlState, input, { knownClientIds });
    const previousHref = currentDashboardHref();
    const persistClient =
      destination.requiresActiveClient && destination.linkedClientId
        ? activeClients.find((item) => item.id === destination.linkedClientId)
        : undefined;
    const outcome = await runStage6CommunicationOpen(
      {
        destination,
        previousHref,
        isSaving: dirtySnapshot.isSaving,
        currentActiveClientId: effectiveActiveClientId,
      },
      async () => {
        if (!persistClient) return false;
        return selectActiveClient(
          {
            id: persistClient.id,
            fullName: persistClient.fullName,
            referenceShort: formatStage6ClientReferenceShort(persistClient.id),
          },
          { afterHref: destination.href },
        );
      },
    );
    if (outcome.kind === "inaccessible") {
      return "inaccessible" as const;
    }
    if (outcome.kind !== "opened") {
      return outcome.kind;
    }
    if (!outcome.persistClientId) {
      if (!canNavigateAway()) {
        requestHrefNavigation(outcome.href);
        return "opened" as const;
      }
      if (destination.kind === "settings" || destination.kind === "aiChat") {
        requestHrefNavigation(destination.href);
        return "opened" as const;
      }
      navigateDashboard(destination.urlPatch);
    }
    return "opened" as const;
  };

  const openClientTask = (task: ClientWorkspaceTask) => {
    if (dirtySnapshot.isSaving) return;
    const clientId = workspaceUrlState.clientId;
    const href = `/dashboard?section=clients&clientId=${encodeURIComponent(clientId ?? "")}${
      task !== "summary" ? `&clientTask=${task}` : ""
    }`;
    requestHrefNavigation(href);
  };

  const setSelectedClientAiPassive = async (clientId: string) => {
    return updateClient(clientId, { aiStatus: "passive" });
  };

  const removeSelectedClient = async () => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    await removeClient(client.id);
    // Keep unbound after removal — never silently select the next list item.
    navigateDashboard({ section: "clients", clientId: null });
  };

  // Fail-closed: a failed create must surface an explicit error, never a
  // silent no-op navigation (see CLAUDE.md fail-closed principle).
  const evaluateClientWithAi = async (client: ClientRecord) => {
    setIsEvaluatingWithAi(true);
    setEvaluateWithAiError(null);
    try {
      const summary = await createAiChatConversation({
        requestId: generateAiChatRequestId(),
        scopeType: "client",
        clientId: client.id,
        title: client.fullName,
      });
      router.push(`/dashboard/ai-chat/${summary.id}`);
    } catch {
      setEvaluateWithAiError(t(uiLanguage, "aiChatActionFailed"));
    } finally {
      setIsEvaluatingWithAi(false);
    }
  };

  const activateSelectedClientAi = async (clientId: string, requestedAiMode?: "copilot" | "autopilot") => {
    const client = state.clients.find((item) => item.id === clientId);
    const conversation = state.conversations.find((item) => item.clientId === clientId);
    if (!client || !conversation) {
      throw new Error("activation_context_not_found");
    }
    setIsActivatingAi(true);
    try {
      const nextState = await activateClientAi(clientId, {
        requestedAiMode,
        expectedConversationRevision: conversation.revision,
        expectedClientContextRevision: client.contextRevision,
      });
      return nextState;
    } finally {
      setIsActivatingAi(false);
    }
  };

  const releaseSelectedHumanTakeover = async (clientId: string) => {
    if (isReleasingHumanTakeover) return state;
    setIsReleasingHumanTakeover(true);
    try {
      return await releaseHumanTakeover(clientId);
    } finally {
      setIsReleasingHumanTakeover(false);
    }
  };

  const openAlertTarget = (alert: ClinicalAlertListItem) => {
    void openCommunicationDestination({
      section: "messages",
      clientId: alert.clientId,
      conversationId: alert.conversationId,
      messageId: alert.sourceMessageId,
      source: "alert",
      sourceId: alert.id,
    });
  };

  const openNotificationTarget = (notification: SystemNotificationListItem) => {
    void openCommunicationDestination({
      section: notification.target.section,
      clientId: notification.clientId ?? notification.target.clientId,
      conversationId: notification.target.conversationId ?? notification.conversationId,
      messageId: notification.target.messageId ?? notification.messageId,
      source: "notification",
      sourceId: notification.id,
      clientTask: notification.target.section === "ai-control" ? "ai" : "summary",
    });
  };

  const viewsWithMobileStickyActions: DashboardSection[] = ["messages"];
  const mainMobilePadding = viewsWithMobileStickyActions.includes(section)
    ? "lg:pb-5"
    : "pb-mobile-nav lg:pb-5";

  return (
    <>
          <div
            ref={mainContentRef}
            id={DASHBOARD_MAIN_ID}
            tabIndex={-1}
            className={`min-w-0 flex-1 px-safe py-5 sm:px-6 ${mainMobilePadding}`}
          >
            {section === "overview" && (
              <div className="space-y-4">
                {bootstrap?.homeActions ? (
                  <div className="min-[1200px]:order-none" data-testid="shell-home-launcher-wrap">
                    <ShellHomeLauncher
                      actions={bootstrap.homeActions}
                      clientId={resolvedClientId}
                      layout="stack"
                    />
                  </div>
                ) : null}
                <OverviewPanel
                  selectedClient={selectedClient}
                  pendingMessageCount={
                    bootstrap?.homeActions.find((action) => action.id === "messages")?.count ?? 0
                  }
                  pendingAlertCount={
                    bootstrap?.homeActions.find((action) => action.id === "alerts")?.count ?? 0
                  }
                  pendingNotificationCount={
                    bootstrap?.homeActions.find((action) => action.id === "notifications")?.count ?? 0
                  }
                  clientWorkAreaAvailability={overviewClientWorkAreaAvailability}
                  aiChatAvailability={overviewAiChatAvailability}
                  onOpenClients={() => {
                    if (resolvedClientId) {
                      void selectClient(resolvedClientId, { section: "clients", clientTask: "summary" });
                      return;
                    }
                    navigateToDestination("clients");
                  }}
                  onOpenMessages={() => navigateToDestination("messages")}
                  onOpenAlerts={() => navigateToDestination("alerts")}
                  onOpenNotifications={() => navigateToDestination("notifications")}
                  onOpenClientTask={(task) => {
                    if (!selectedClient) return;
                    requestHrefNavigation(
                      buildStage6ClientWorkspaceHref(urlState, {
                        clientId: selectedClient.id,
                        clientTask: task,
                      }),
                    );
                  }}
                  onOpenAiChat={() => navigateToDestination("ai_chat")}
                />
              </div>
            )}

            {section === "clients" && (
              <ClientWorkspaceRoute
                urlState={workspaceUrlState}
                clients={activeClients}
                selectedClient={workspaceClient}
                state={state}
                uiLanguage={uiLanguage}
                canManageAiControls={canManageAiControls}
                onSelect={(id) => void selectClient(id, { section: "clients", clientTask: "summary" })}
                onCloseWorkspace={() => {
                  requestHrefNavigation("/dashboard?section=clients");
                }}
                onClientTask={openClientTask}
                onCreateClient={createClient}
                onUpdateClient={updateClient}
                onActivateAi={activateSelectedClientAi}
                onReleaseHumanTakeover={releaseSelectedHumanTakeover}
                isActivatingAi={isActivatingAi}
                isReleasingHumanTakeover={isReleasingHumanTakeover}
                onRemoveClient={removeSelectedClient}
                onSaveClientFoodRuleProfile={saveClientFoodRuleProfile}
                onCreateMenuPlan={createMenuPlan}
                onSaveMenuPlan={saveMenuPlan}
                onActivateMenuPlan={activateMenuPlan}
                onSaveFormResponse={saveFormResponse}
                onAddClientContextUpdate={addClientContextUpdate}
                aiChatEnabled={aiChatEnabled}
                onEvaluateWithAi={evaluateClientWithAi}
                isEvaluatingWithAi={isEvaluatingWithAi}
                evaluateWithAiError={evaluateWithAiError}
                onOpenMessages={(clientId) =>
                  void openCommunicationDestination({
                    section: "messages",
                    clientId,
                    conversationId: state.conversations.find((item) => item.clientId === clientId)?.id ?? null,
                  })
                }
                saveDestinationViewState={saveDestinationViewState}
                restoreDestinationViewState={restoreDestinationViewState}
              />
            )}

            {section === "messages" && (
              <MessagesRoute
                uiLanguage={uiLanguage}
                filters={urlState}
                enabled={hydrated && section === "messages"}
                conversationId={messagingRoute.conversationId}
                anchorMessageId={urlState.messageId}
                listFilters={messagingListFilters}
                mergeDetailIntoState={mergeConversationDetailIntoState}
                mergeMutationIntoState={mergeConversationMutationIntoState}
                selectedConversationId={messagingRoute.conversationId}
                detailUnavailable={Boolean(messagingRoute.conversationId && !messagingTargetValidity.valid)}
                restoreListScrollTop={messagingListScrollTop}
                state={state}
                selectedClient={selectedClient ?? null}
                canManageAiControls={canManageAiControls}
                isActivatingAi={isActivatingAi}
                onActivateAi={activateSelectedClientAi}
                onSetAiPassive={setSelectedClientAiPassive}
                onSendManualReplyRequest={sendManualReplyRequest}
                onApproveDraft={approveDraft}
                onEditAndSendDraft={editAndSendDraft}
                onDismissDraft={dismissDraft}
                onReviewSendManualFromDraft={reviewSendManualFromDraft}
                onOpenConversation={(item) => {
                  void openCommunicationDestination({
                    section: "messages",
                    conversationId: item.id,
                    clientId: item.clientId,
                  });
                }}
                onBackToList={() =>
                  navigateDashboard({
                    conversationId: null,
                    messageId: null,
                  })
                }
                onOpenClientWorkspace={() =>
                  void openCommunicationDestination({
                    section: "clients",
                    clientId: selectedClient?.id ?? messagingRoute.clientId,
                    clientTask: "summary",
                  })
                }
                onFiltersChange={(patch) => navigateDashboard(patch)}
                onSetListScrollTop={setMessagingListScrollTop}
                onSaveListViewState={(scrollTop) =>
                  saveDestinationViewState("messages", {
                    search: urlState.conversationQuery,
                    filter: urlState.conversationStatus,
                    scrollTop,
                  })
                }
              />
            )}

            {section === "alerts" && (
              <InboxRoute
                section="alerts"
                uiLanguage={uiLanguage}
                urlState={urlState}
                dietitianId={notificationActorContext.dietitianId}
                role={notificationActorContext.role}
                activeClientIds={activeClientIds}
                onFiltersChange={(patch) => navigateDashboard(patch)}
                onOpenAlertTarget={openAlertTarget}
                onOpenNotificationTarget={openNotificationTarget}
              />
            )}

            {section === "notifications" && (
              <InboxRoute
                section="notifications"
                uiLanguage={uiLanguage}
                urlState={urlState}
                dietitianId={notificationActorContext.dietitianId}
                role={notificationActorContext.role}
                activeClientIds={activeClientIds}
                onFiltersChange={(patch) => navigateDashboard(patch)}
                onOpenNotificationTarget={openNotificationTarget}
                onOpenAlertTarget={openAlertTarget}
              />
            )}

            {section === "voice" && (
              <VoiceRoute
                state={state}
                onAddVoiceSamples={addVoiceSamples}
                onUpdateVoiceSampleStatus={updateVoiceSampleStatus}
                onGenerateVoiceProfile={generateVoiceProfile}
              />
            )}

            {section === "forms" && !selectedClient ? (
              <EmptyState
                title="Danışan seçilmedi"
                message="Formlar için önce aktif danışanı seçin. Otomatik seçim yapılmaz."
              />
            ) : null}

            {section === "forms" && selectedClient && (
              <FormsRoute
                state={state}
                selectedClient={selectedClient}
                uiLanguage={uiLanguage}
                onCreateFormSchema={createFormSchema}
                onPublishFormSchema={publishFormSchema}
                onSaveFormResponse={saveFormResponse}
              />
            )}
          </div>
    </>
  );
}
