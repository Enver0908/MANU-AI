"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import type {
  Channel,
  ClientContextUpdateImportance,
  ClientContextUpdateSource,
  ClientRecord,
  ManuAppState,
  Phase77FMenuPlanTemplateType,
} from "@/lib/types";
import { useDashboardUrl } from "@/lib/use-dashboard-url";
import { useStage4BInbox } from "@/lib/use-stage-4b-inbox";
import { useStage4B2Messaging } from "@/lib/use-stage-4b2-messaging";
import { AppRequestError } from "@/lib/app-errors";
import { createAiChatConversation, generateAiChatRequestId } from "@/lib/use-ai-chat";
import type { ClinicalAlertListItem, SystemNotificationListItem } from "@/lib/phase-85-stage-4b-contracts";
import type { OperationalFoundationInspectionDto } from "@/lib/phase-85-if-h-operational-visibility";
import {
  getClientFoodRuleProfileV2Record,
  getClientFoodRuleProfileV2State,
  type ClientFoodRuleProfileV2State,
} from "@/lib/phase-77e-client-food-rule-profile";
import {
  getActiveClientMenuPlanV1Record,
  listClientMenuPlanV1Records,
  menuPlanV1RecordToState,
  type ClientMenuPlanV1State,
} from "@/lib/phase-77f-client-menu-plan";
import { getActiveFormSchema } from "@/lib/client-forms";
import { useManuState } from "@/lib/use-manu-state";
import { type SupportedLanguageCode } from "@/lib/languages";
import { t } from "@/lib/i18n";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import {
  SelectInput,
  fromDateTimeLocal,
  languageOptions,
  parseAnswerLines,
  parseSchemaFields,
  scenarioMessages,
} from "@/components/dashboard/shared";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import {
  commitDashboardHref,
  currentDashboardHref,
  dashboardSectionToShellDestination,
  parseClientWorkspaceTask,
  resolveLegacyCopilotSectionRedirect,
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
  refreshStage4B2OperationalSurfaces,
  resolveMessagingTargetValidity,
} from "@/lib/phase-85-stage-4b2-messaging-integration";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { ShellHomeLauncher } from "@/components/dashboard/shell-home-launcher";
import { ClientWorkspace } from "@/components/dashboard/client-workspace";
import { ConversationPanel } from "@/components/dashboard/conversation-panel";
import { MessagingPanel } from "@/components/dashboard/messaging-panel";
import { SimulatorPanel } from "@/components/dashboard/simulator-panel";
import { VoicePanel } from "@/components/dashboard/voice-panel";
import { FormsPanel } from "@/components/dashboard/forms-panel";
import { useMobileKeyboardScroll } from "@/components/dashboard/mobile-ergonomics";
import { DashboardLoadingSkeleton, EmptyState, ErrorState } from "@/components/dashboard/state-primitives";
import { resolveEffectiveShellActiveClientId } from "@/lib/phase-85-stage-5-shell-contracts";

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
    createClient,
    updateClient,
    removeClient,
    releaseHumanTakeover,
    activateClientAi,
    runSimulation: runSimulationRequest,
    runVisualSimulation: runVisualSimulationRequest,
    runVoiceSimulation: runVoiceSimulationRequest,
    sendManualReply: sendManualReplyRequest,
    approveDraft,
    editAndSendDraft,
    dismissDraft,
    reviewSendManualFromDraft,
    resetState,
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
    updateDietitianPreferences,
    addClientContextUpdate,
    mergeConversationDetailIntoState,
    mergeConversationMutationIntoState,
  } = useManuState();
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
  const { urlState, section, navigateDashboard, openSection } = useDashboardUrl();
  const stage4bInbox = useStage4BInbox(urlState);
  const [operationalFoundation, setOperationalFoundation] =
    useState<OperationalFoundationInspectionDto | null>(null);
  const [search, setSearch] = useState("");
  const [manualReply, setManualReply] = useState("");
  const [isSendingManualReply, setIsSendingManualReply] = useState(false);
  const [messagingListScrollTop, setMessagingListScrollTop] = useState<number | null>(null);
  const [simBody, setSimBody] = useState(scenarioMessages[0].body);
  const [simKey, setSimKey] = useState("local-1");
  const [visualKey, setVisualKey] = useState("vis-local-1");
  const [visualCaption, setVisualCaption] = useState("");
  const [visualBurst, setVisualBurst] = useState("Bu öğünü yedim\nTeşekkürler");
  const [visualFixtureSceneId, setVisualFixtureSceneId] =
    useState<import("@/lib/phase-85-stage-4b3-vision-fixture-manifest").Stage4B3VisionFixtureSceneId>("meal_plate");
  const [visualImageFile, setVisualImageFile] = useState<File | null>(null);
  const [visualFlushSilence, setVisualFlushSilence] = useState(true);
  const [voiceKey, setVoiceKey] = useState("voice-local-1");
  const [voiceBurst, setVoiceBurst] = useState("Bu öğünü yedim\nTeşekkürler");
  const [voiceFixtureId, setVoiceFixtureId] =
    useState<import("@/lib/phase-85-stage-4b4-audio-fixture-resolver").Stage4B4VoiceFixtureId>("golden_voice_note");
  const [voiceTranscriptionSceneId, setVoiceTranscriptionSceneId] =
    useState<import("@/lib/phase-85-stage-4b4-transcription-fixture-manifest").Stage4B4TranscriptionFixtureSceneId>("meal_update_tr");
  const [voiceFlushSilence, setVoiceFlushSilence] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isVisualSimulating, setIsVisualSimulating] = useState(false);
  const [isVoiceSimulating, setIsVoiceSimulating] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientChannel, setNewClientChannel] = useState<Channel>("whatsapp");
  const [newClientHandle, setNewClientHandle] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientLanguage, setNewClientLanguage] = useState<SupportedLanguageCode>("tr");
  const [voiceRawInput, setVoiceRawInput] = useState("");
  const [schemaTitle, setSchemaTitle] = useState("Client intake");
  const [schemaLanguage, setSchemaLanguage] = useState<SupportedLanguageCode>("tr");
  const [schemaFieldsRaw, setSchemaFieldsRaw] = useState("daily_routine | Daily routine | textarea | prompt_allowed");
  const [formAnswersRaw, setFormAnswersRaw] = useState("");
  const [isActivatingAi, setIsActivatingAi] = useState(false);
  const [isReleasingHumanTakeover, setIsReleasingHumanTakeover] = useState(false);
  const [isEvaluatingWithAi, setIsEvaluatingWithAi] = useState(false);
  const [evaluateWithAiError, setEvaluateWithAiError] = useState<string | null>(null);
  const [workspaceOverride, setWorkspaceOverride] = useState<{
    clientId: string;
    clientTask: ClientWorkspaceTask;
  } | null>(null);
  const [contextUpdateSource, setContextUpdateSource] = useState<ClientContextUpdateSource>("phone");
  const [contextUpdateImportance, setContextUpdateImportance] =
    useState<ClientContextUpdateImportance>("important");
  const [contextUpdateOccurredAt, setContextUpdateOccurredAt] = useState("");
  const [contextUpdateTitle, setContextUpdateTitle] = useState("");
  const [contextUpdateSummary, setContextUpdateSummary] = useState("");
  const [contextUpdateDetails, setContextUpdateDetails] = useState("");

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

  const stage4bMessaging = useStage4B2Messaging({
    enabled: hydrated,
    conversationId: section === "messages" ? messagingRoute.conversationId : null,
    anchorMessageId: urlState.messageId,
    filters: messagingListFilters,
    mergeDetailIntoState: mergeConversationDetailIntoState,
    mergeMutationIntoState: mergeConversationMutationIntoState,
  });

  const refreshStage4B2Surfaces = (options?: { anchorMessageId?: string | null }) => {
    refreshStage4B2OperationalSurfaces(
      {
        refreshMessaging: (refreshOptions) => void stage4bMessaging.refreshAfterMutation(refreshOptions),
        refreshInbox: () => void stage4bInbox.refreshAfterMutation(),
      },
      options,
    );
  };

  useEffect(() => {
    const legacyRedirect = resolveLegacyCopilotSectionRedirect(section);
    if (legacyRedirect) router.replace(legacyRedirect);
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


  const filteredClients = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return activeClients;
    return activeClients.filter((client) =>
      [client.fullName, client.channelUserId, client.aiMode, client.aiStatus]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [activeClients, search]);

  const workspaceUrlState = useMemo(() => {
    if (section !== "clients") return urlState;
    return {
      ...urlState,
      clientId: urlState.clientId ?? workspaceOverride?.clientId ?? null,
      clientTask: urlState.clientTask ?? workspaceOverride?.clientTask ?? null,
    };
  }, [section, urlState, workspaceOverride]);

  const workspaceClient = useMemo(() => {
    if (section !== "clients" || !workspaceUrlState.clientId) return null;
    return activeClients.find((client) => client.id === workspaceUrlState.clientId) ?? null;
  }, [activeClients, section, workspaceUrlState.clientId]);

  const selectedContextUpdates = useMemo(() => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return [];
    return state.clientContextUpdates
      .filter((update) => update.clientId === client.id)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [selectedClient, state.clientContextUpdates, workspaceClient]);

  const mainContentRef = useRef<HTMLDivElement>(null);
  useMobileKeyboardScroll(mainContentRef);
  const previousSectionRef = useRef(section);

  useEffect(() => {
    const previous = previousSectionRef.current;
    if (previous !== section) {
      const previousDestination = dashboardSectionToShellDestination(previous);
      if (previous === "clients") {
        saveDestinationViewState(previousDestination, {
          search,
          tab: urlState.clientTask ?? "summary",
          windowScrollY: window.scrollY,
        });
      }
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
      if (section === "clients" && snapshot) {
        if (typeof snapshot.search === "string") setSearch(snapshot.search);
        const restoredTask = parseClientWorkspaceTask(typeof snapshot.tab === "string" ? snapshot.tab : null);
        if (restoredTask && !urlState.clientTask) {
          navigateDashboard({ clientTask: restoredTask }, { replace: true });
        }
        const windowScrollY =
          typeof snapshot.windowScrollY === "number" ? snapshot.windowScrollY : snapshot.scrollTop;
        if (typeof windowScrollY === "number") {
          requestAnimationFrame(() => {
            window.scrollTo({ top: windowScrollY, behavior: "auto" });
          });
        }
      }
      if (section === "messages" && snapshot && typeof snapshot.scrollTop === "number") {
        setMessagingListScrollTop(snapshot.scrollTop);
      }
      previousSectionRef.current = section;
    }
  }, [
    restoreDestinationViewState,
    saveDestinationViewState,
    search,
    section,
    urlState.clientTask,
    urlState.conversationQuery,
    urlState.conversationStatus,
    messagingListScrollTop,
    navigateDashboard,
  ]);
  useEffect(() => {
    return () => {
      if (section === "clients") {
        saveDestinationViewState("clients", {
          search,
          tab: urlState.clientTask ?? "summary",
          windowScrollY: window.scrollY,
        });
      }
      if (section === "messages") {
        const list = document.querySelector("[data-testid='messaging-list-scroll']");
        saveDestinationViewState("messages", {
          search: urlState.conversationQuery,
          filter: urlState.conversationStatus,
          scrollTop: list instanceof HTMLElement ? list.scrollTop : messagingListScrollTop ?? undefined,
        });
      }
    };
  }, [saveDestinationViewState, search, section, urlState.clientTask, urlState.conversationQuery, urlState.conversationStatus, messagingListScrollTop]);

  const uiLanguage = state.dietitian.uiLanguage || "tr";
  const canManageAiControls =
    !authInfo || (authInfo.role !== "assistant" && authInfo.role !== "auditor");
  const showOperationalInspection = authInfo?.role === "owner" || authInfo?.role === "admin";

  useEffect(() => {
    if (!showOperationalInspection) return;

    let cancelled = false;
    fetch("/api/operational-foundation")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: OperationalFoundationInspectionDto | null) => {
        if (!cancelled) setOperationalFoundation(payload);
      })
      .catch(() => {
        if (!cancelled) setOperationalFoundation(null);
      });

    return () => {
      cancelled = true;
    };
  }, [showOperationalInspection, state.channelDeliveries.length, state.handoffCases.length]);

  useEffect(() => {
    setHeaderSlots({
      title: (
        <div>
          <p className="text-sm text-stone-500">{state.tenant.name}</p>
          <h1 className="text-2xl font-semibold">Operasyon paneli</h1>
        </div>
      ),
      actions: (
        <>
          <div className="w-44">
            <SelectInput
              label={t(uiLanguage, "dashboardLanguage")}
              value={uiLanguage}
              onChange={(value) => updateDietitianPreferences({ uiLanguage: value as SupportedLanguageCode })}
              options={languageOptions}
            />
          </div>
          {!canManageAiControls ? (
            <span
              className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-700"
              data-testid="dashboard-read-only-role-label"
              role="status"
            >
              {t(uiLanguage, "shellReadOnlyAssistantAuditor")}
            </span>
          ) : null}
          <button
            onClick={resetState}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            type="button"
          >
            <RefreshCcw size={16} />
            Demoyu sıfırla
          </button>
        </>
      ),
    });
    return () => setHeaderSlots({});
  }, [
    canManageAiControls,
    resetState,
    setHeaderSlots,
    state.tenant.name,
    uiLanguage,
    updateDietitianPreferences,
  ]);

  if (!hydrated) {
    return <DashboardLoadingSkeleton />;
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

  const updateSelectedClient = async (patch: Partial<ClientRecord>) => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    await updateClient(client.id, patch);
  };

  const selectClient = async (
    clientId: string,
    patch: { section?: DashboardSection; clientTask?: ClientWorkspaceTask } = {},
  ) => {
    const client = activeClients.find((item) => item.id === clientId);
    if (!client) return;
    const previousHref = `${window.location.pathname}${window.location.search}`;
    const nextTask = patch.clientTask ?? "summary";
    const outcome = await runStage6ClientActivation(
      {
        requestedClientId: clientId,
        previousHref,
        isSaving: dirtySnapshot.isSaving,
      },
      () =>
        selectActiveClient({
          id: client.id,
          fullName: client.fullName,
          referenceShort: formatStage6ClientReferenceShort(client.id),
        }),
      () =>
        `/dashboard?section=clients&clientId=${encodeURIComponent(clientId)}${nextTask !== "summary" ? `&clientTask=${nextTask}` : ""}`,
    );
    if (outcome.kind !== "activated") return;
    setWorkspaceOverride({ clientId, clientTask: nextTask });
    const href = buildStage6ClientWorkspaceHref(urlState, { clientId, clientTask: nextTask });
    commitDashboardHref(href, "replace");
    navigateDashboard(
      {
        section: patch.section ?? "clients",
        clientId,
        clientTask: nextTask,
      },
      { replace: true },
    );
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
    if (destination.kind === "clientWorkspace" && destination.linkedClientId) {
      const nextTask = parseClientWorkspaceTask(destination.urlPatch.clientTask) ?? "summary";
      setWorkspaceOverride({ clientId: destination.linkedClientId, clientTask: nextTask });
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
      commitDashboardHref(destination.href, "push");
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
    if (!canNavigateAway()) {
      requestHrefNavigation(href);
      return;
    }
    if (clientId) setWorkspaceOverride({ clientId, clientTask: task });
    commitDashboardHref(href, "replace");
    navigateDashboard({ section: "clients", clientId, clientTask: task });
  };

  const navigateToSection = (nextSection: DashboardSection) => {
    openSection(nextSection, resolvedClientId ? { clientId: resolvedClientId } : {});
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

  const addClient = async () => {
    const fullName = newClientName.trim();
    if (!fullName) return;
    const nextState = await createClient({
      fullName,
      channel: newClientChannel,
      channelUserId: newClientHandle.trim(),
      primaryPhoneE164: newClientPhone.trim(),
      communicationLanguage: newClientLanguage,
    });
    const createdClient = nextState.clients[nextState.clients.length - 1];
    selectClient(createdClient.id, { section: "clients" });
  };

  const runSimulation = async () => {
    if (!selectedClient || isSimulating || isVisualSimulating || isVoiceSimulating) return;
    setIsSimulating(true);
    try {
      await runSimulationRequest({
        clientId: selectedClient.id,
        body: simBody,
        idempotencyKey: simKey,
      });
      navigateToSection("simulator");
    } finally {
      setIsSimulating(false);
    }
  };

  const runVisualSimulation = async () => {
    if (!selectedClient || isSimulating || isVisualSimulating || isVoiceSimulating) return;
    setIsVisualSimulating(true);
    try {
      await runVisualSimulationRequest({
        clientId: selectedClient.id,
        idempotencyKey: visualKey,
        fixtureSceneId: visualImageFile ? undefined : visualFixtureSceneId,
        caption: visualCaption.trim() || undefined,
        burstMessages: visualBurst
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        flushSilence: visualFlushSilence,
        imageFile: visualImageFile,
      });
      setVisualKey(`vis-sim-${Date.now()}`);
      navigateToSection("simulator");
    } finally {
      setIsVisualSimulating(false);
    }
  };

  const runVoiceSimulation = async () => {
    if (!selectedClient || isSimulating || isVisualSimulating || isVoiceSimulating) return;
    setIsVoiceSimulating(true);
    try {
      await runVoiceSimulationRequest({
        clientId: selectedClient.id,
        idempotencyKey: voiceKey,
        fixtureId: voiceFixtureId,
        transcriptionSceneId: voiceTranscriptionSceneId,
        burstMessages: voiceBurst
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
        flushSilence: voiceFlushSilence,
      });
      setVoiceKey(`voice-sim-${Date.now()}`);
      navigateToSection("simulator");
    } finally {
      setIsVoiceSimulating(false);
    }
  };

  const sendManualReply = async () => {
    if (!selectedClient || !manualReply.trim() || isSendingManualReply) return;
    const body = manualReply;
    const aiChatDraftTransferId = stage4bMessaging.detail?.pendingAiChatDraftTransfer?.transferId;
    setIsSendingManualReply(true);
    try {
      await sendManualReplyRequest({ clientId: selectedClient.id, body, aiChatDraftTransferId });
      setManualReply("");
      refreshStage4B2Surfaces({ anchorMessageId: urlState.messageId });
    } catch (error) {
      if (error instanceof AppRequestError && error.status === 409) {
        refreshStage4B2Surfaces({ anchorMessageId: urlState.messageId });
        return;
      }
      throw error;
    } finally {
      setIsSendingManualReply(false);
    }
  };

  const runConversationMutation = async (operation: () => Promise<ManuAppState>) => {
    try {
      const result = await operation();
      refreshStage4B2Surfaces({ anchorMessageId: urlState.messageId });
      return result;
    } catch (error) {
      if (error instanceof AppRequestError && error.status === 409) {
        refreshStage4B2Surfaces({ anchorMessageId: urlState.messageId });
      }
      throw error;
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
      refreshStage4B2Surfaces({ anchorMessageId: urlState.messageId });
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

  const addVoiceSamplesFromInput = async () => {
    if (!voiceRawInput.trim()) return;
    await addVoiceSamples(voiceRawInput);
    setVoiceRawInput("");
  };

  const createSchemaFromInput = async () => {
    const fields = parseSchemaFields(schemaFieldsRaw);
    if (!schemaTitle.trim() || fields.length === 0) return;
    await createFormSchema({ title: schemaTitle, fields, languageCode: schemaLanguage });
  };

  const saveSelectedFormResponse = async (input?: {
    clientId: string;
    schemaId: string;
    answers: Record<string, unknown>;
    submittedPhoneE164?: string;
  }) => {
    if (input) {
      await saveFormResponse(input);
      return;
    }
    if (!selectedClient) return;
    const activeSchema = getActiveFormSchema(state);
    if (!activeSchema) return;
    await saveFormResponse({
      clientId: selectedClient.id,
      schemaId: activeSchema.id,
      answers: parseAnswerLines(formAnswersRaw),
      submittedPhoneE164: selectedClient.primaryPhoneE164 || undefined,
    });
    setFormAnswersRaw("");
  };

  const saveSelectedFoodRules = async (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    const { revision, ...profileBody } = profile;
    await saveClientFoodRuleProfile(client.id, {
      revision,
      profile: profileBody,
    });
  };

  const menuPlansForSelectedClient = (workspaceClient ?? selectedClient)
    ? listClientMenuPlanV1Records(state, (workspaceClient ?? selectedClient)!.id).map((plan) =>
        menuPlanV1RecordToState(plan, getClientFoodRuleProfileV2Record(state, (workspaceClient ?? selectedClient)!.id)),
      )
    : [];
  const activeMenuPlanId = (workspaceClient ?? selectedClient)
    ? getActiveClientMenuPlanV1Record(state, (workspaceClient ?? selectedClient)!.id)?.id || null
    : null;

  const createSelectedMenuPlan = async (templateType: Phase77FMenuPlanTemplateType) => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    await createMenuPlan(client.id, { templateType });
  };

  const saveSelectedMenuPlan = async (plan: Omit<ClientMenuPlanV1State, "conflicts">) => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    const { revision, id, ...planBody } = plan;
    await saveMenuPlan(client.id, id, { revision, plan: planBody });
  };

  const activateSelectedMenuPlan = async (planId: string) => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    await activateMenuPlan(client.id, planId);
  };

  const addSelectedContextUpdate = async () => {
    const client = workspaceClient ?? selectedClient;
    if (!client) return;
    await addClientContextUpdate(client.id, {
      source: contextUpdateSource,
      occurredAt: contextUpdateOccurredAt ? fromDateTimeLocal(contextUpdateOccurredAt) : null,
      title: contextUpdateTitle,
      summary: contextUpdateSummary,
      details: contextUpdateDetails,
      importance: contextUpdateImportance,
    });
    setContextUpdateTitle("");
    setContextUpdateSummary("");
    setContextUpdateDetails("");
  };
  const viewsWithMobileStickyActions: DashboardSection[] = ["messages", "simulator"];
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
                  state={state}
                  uiLanguage={uiLanguage}
                  showInspectionDetails={showOperationalInspection}
                  operationalFoundation={showOperationalInspection ? operationalFoundation : null}
                  pendingMessageCount={
                    bootstrap?.homeActions.find((action) => action.id === "messages")?.count ??
                    stage4bMessaging.unreadMessageCount
                  }
                  pendingAlertCount={
                    bootstrap?.homeActions.find((action) => action.id === "alerts")?.count ??
                    stage4bInbox.alertsBadgeCount
                  }
                  pendingNotificationCount={
                    bootstrap?.homeActions.find((action) => action.id === "notifications")?.count ??
                    stage4bInbox.notificationsBadgeCount
                  }
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
                />
              </div>
            )}

            {section === "clients" && (
              <ClientWorkspace
                urlState={workspaceUrlState}
                clients={filteredClients}
                selectedClient={workspaceClient}
                search={search}
                newClientName={newClientName}
                newClientChannel={newClientChannel}
                newClientHandle={newClientHandle}
                newClientPhone={newClientPhone}
                newClientLanguage={newClientLanguage}
                uiLanguage={uiLanguage}
                canManageAiControls={canManageAiControls}
                onSearch={setSearch}
                onSelect={(id) => void selectClient(id, { section: "clients", clientTask: "summary" })}
                onCloseWorkspace={() => {
                  setWorkspaceOverride(null);
                  requestHrefNavigation("/dashboard?section=clients");
                }}
                onClientTask={openClientTask}
                onAddClient={addClient}
                onNewClientName={setNewClientName}
                onNewClientChannel={setNewClientChannel}
                onNewClientHandle={setNewClientHandle}
                onNewClientPhone={setNewClientPhone}
                onNewClientLanguage={setNewClientLanguage}
                onUpdateClient={updateSelectedClient}
                onActivateAi={activateSelectedClientAi}
                onReleaseHumanTakeover={releaseSelectedHumanTakeover}
                isActivatingAi={isActivatingAi}
                isReleasingHumanTakeover={isReleasingHumanTakeover}
                onRemoveClient={removeSelectedClient}
                contextUpdates={selectedContextUpdates}
                contextUpdateSource={contextUpdateSource}
                contextUpdateImportance={contextUpdateImportance}
                contextUpdateOccurredAt={contextUpdateOccurredAt}
                contextUpdateTitle={contextUpdateTitle}
                contextUpdateSummary={contextUpdateSummary}
                contextUpdateDetails={contextUpdateDetails}
                onContextUpdateSource={setContextUpdateSource}
                onContextUpdateImportance={setContextUpdateImportance}
                onContextUpdateOccurredAt={setContextUpdateOccurredAt}
                onContextUpdateTitle={setContextUpdateTitle}
                onContextUpdateSummary={setContextUpdateSummary}
                onContextUpdateDetails={setContextUpdateDetails}
                onAddContextUpdate={addSelectedContextUpdate}
                state={state}
                foodRuleProfile={
                  (workspaceClient ?? selectedClient)
                    ? getClientFoodRuleProfileV2State(state, (workspaceClient ?? selectedClient)!.id)
                    : null
                }
                menuPlans={menuPlansForSelectedClient}
                activeMenuPlanId={activeMenuPlanId}
                onSaveFoodRules={saveSelectedFoodRules}
                onCreateMenuPlan={createSelectedMenuPlan}
                onSaveMenuPlan={saveSelectedMenuPlan}
                onActivateMenuPlan={activateSelectedMenuPlan}
                onSaveFormResponse={saveSelectedFormResponse}
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
              />
            )}

            {section === "messages" && (
              <MessagingPanel
                uiLanguage={uiLanguage}
                filters={urlState}
                items={stage4bMessaging.listItems}
                filteredTotal={stage4bMessaging.list?.filteredTotal ?? 0}
                unreadConversationCount={stage4bMessaging.unreadConversationCount}
                unreadMessageCount={stage4bMessaging.unreadMessageCount}
                nextCursor={stage4bMessaging.listNextCursor}
                listError={stage4bMessaging.listError}
                detailError={stage4bMessaging.detailError}
                isListRefreshing={stage4bMessaging.isListRefreshing}
                isDetailRefreshing={stage4bMessaging.isDetailRefreshing}
                isLoadingMore={stage4bMessaging.isLoadingMoreList}
                lastSuccessAt={stage4bMessaging.lastSuccessAt}
                selectedConversationId={messagingRoute.conversationId}
                onFiltersChange={(patch) => navigateDashboard(patch)}
                onRefreshList={() => void stage4bMessaging.refreshList({ resetBackoff: true })}
                onLoadMore={() => void stage4bMessaging.loadMoreList()}
                onSelectConversation={(item) => {
                  const list = document.querySelector("[data-testid='messaging-list-scroll']");
                  if (list instanceof HTMLElement) {
                    setMessagingListScrollTop(list.scrollTop);
                    saveDestinationViewState("messages", {
                      search: urlState.conversationQuery,
                      filter: urlState.conversationStatus,
                      scrollTop: list.scrollTop,
                    });
                  }
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
                restoreListScrollTop={messagingListScrollTop}
                detailUnavailable={Boolean(
                  messagingRoute.conversationId && !messagingTargetValidity.valid,
                )}
                detail={
                  stage4bMessaging.detail?.conversation ? (
                    <ConversationPanel
                      client={selectedClient ?? null}
                      conversation={stage4bMessaging.detail.conversation}
                      messages={stage4bMessaging.detailMessages}
                      pagination={stage4bMessaging.detail.pagination}
                      permissions={stage4bMessaging.permissions}
                      anchorMessageId={urlState.messageId}
                      state={state}
                      uiLanguage={uiLanguage}
                      canManageAiControls={canManageAiControls}
                      manualReply={manualReply}
                      onManualReply={setManualReply}
                      onSendManualReply={sendManualReply}
                      isSendingManualReply={isSendingManualReply}
                      pendingAiChatDraftTransfer={stage4bMessaging.detail?.pendingAiChatDraftTransfer ?? null}
                      onActivateAi={activateSelectedClientAi}
                      onSetAiPassive={setSelectedClientAiPassive}
                      isActivatingAi={isActivatingAi}
                      onApproveDraft={(messageId) => runConversationMutation(() => approveDraft(messageId))}
                      onEditAndSendDraft={(messageId, body) =>
                        runConversationMutation(() => editAndSendDraft(messageId, body))
                      }
                      onDismissDraft={(messageId) => runConversationMutation(() => dismissDraft(messageId))}
                      onReviewSendManualFromDraft={(messageId, body) =>
                        runConversationMutation(() => reviewSendManualFromDraft(messageId, body))
                      }
                      onOpenSimulator={() => navigateToSection("simulator")}
                      onOpenClientWorkspace={() =>
                        void openCommunicationDestination({
                          section: "clients",
                          clientId: selectedClient?.id ?? messagingRoute.clientId,
                          clientTask: "summary",
                        })
                      }
                      onLoadOlder={() => void stage4bMessaging.loadOlderMessages()}
                      onLoadNewer={() => void stage4bMessaging.loadNewerMessages()}
                      onRetryDetail={() => void stage4bMessaging.refreshDetail({ resetBackoff: true })}
                      isLoadingOlder={stage4bMessaging.isLoadingOlderMessages}
                      isLoadingNewer={stage4bMessaging.isLoadingNewerMessages}
                      isDetailRefreshing={stage4bMessaging.isDetailRefreshing}
                      detailError={stage4bMessaging.detailError}
                      onSubmitVisualCorrection={(input) =>
                        stage4bMessaging.submitVisualCorrection(messagingRoute.conversationId!, input)
                      }
                      onSubmitTranscriptCorrection={(input) =>
                        stage4bMessaging.submitTranscriptCorrection(messagingRoute.conversationId!, input)
                      }
                    />
                  ) : stage4bMessaging.isDetailRefreshing ? (
                    <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600" aria-busy="true">
                      {t(uiLanguage, "refreshInbox")}
                    </div>
                  ) : null
                }
              />
            )}

            {section === "simulator" && !selectedClient ? (
              <EmptyState
                title="Danışan seçilmedi"
                message="Simülatör için önce aktif danışanı seçin. Otomatik seçim yapılmaz."
              />
            ) : null}

            {section === "simulator" && selectedClient && (
              <SimulatorPanel
                state={state}
                selectedClient={selectedClient}
                clients={activeClients}
                simBody={simBody}
                simKey={simKey}
                visualKey={visualKey}
                visualCaption={visualCaption}
                visualBurst={visualBurst}
                visualFixtureSceneId={visualFixtureSceneId}
                visualImageFile={visualImageFile}
                visualFlushSilence={visualFlushSilence}
                voiceKey={voiceKey}
                voiceBurst={voiceBurst}
                voiceFixtureId={voiceFixtureId}
                voiceTranscriptionSceneId={voiceTranscriptionSceneId}
                voiceFlushSilence={voiceFlushSilence}
                isSimulating={isSimulating}
                isVisualSimulating={isVisualSimulating}
                isVoiceSimulating={isVoiceSimulating}
                onSelectClient={(clientId) => selectClient(clientId, { section: "simulator" })}
                onSimBody={setSimBody}
                onSimKey={setSimKey}
                onVisualKey={setVisualKey}
                onVisualCaption={setVisualCaption}
                onVisualBurst={setVisualBurst}
                onVisualFixtureSceneId={setVisualFixtureSceneId}
                onVisualImageFile={setVisualImageFile}
                onVisualFlushSilence={setVisualFlushSilence}
                onVoiceKey={setVoiceKey}
                onVoiceBurst={setVoiceBurst}
                onVoiceFixtureId={setVoiceFixtureId}
                onVoiceTranscriptionSceneId={setVoiceTranscriptionSceneId}
                onVoiceFlushSilence={setVoiceFlushSilence}
                onRun={runSimulation}
                onRunVisual={runVisualSimulation}
                onRunVoice={runVoiceSimulation}
                onOpenConversation={() => navigateToSection("messages")}
              />
            )}

            {section === "alerts" && (
              <AlertsPanel
                uiLanguage={uiLanguage}
                filters={urlState}
                items={stage4bInbox.alertItems}
                counts={stage4bInbox.alerts?.counts ?? null}
                filteredTotal={stage4bInbox.alerts?.filteredTotal ?? 0}
                nextCursor={stage4bInbox.alertsNextCursor}
                error={stage4bInbox.alertsError}
                isRefreshing={stage4bInbox.isRefreshing}
                isLoadingMore={stage4bInbox.isLoadingMoreAlerts}
                lastSuccessAt={stage4bInbox.lastSuccessAt}
                onFiltersChange={(patch) => navigateDashboard(patch)}
                onRefresh={() => void stage4bInbox.refresh({ resetBackoff: true })}
                onLoadMore={() => void stage4bInbox.loadMoreAlerts()}
                onOpenAlertTarget={openAlertTarget}
              />
            )}

            {section === "notifications" && (
              <NotificationsPanel
                uiLanguage={uiLanguage}
                filters={urlState}
                items={stage4bInbox.notificationItems}
                counts={stage4bInbox.notifications?.counts ?? null}
                filteredTotal={stage4bInbox.notifications?.filteredTotal ?? 0}
                nextCursor={stage4bInbox.notificationsNextCursor}
                error={stage4bInbox.notificationsError}
                isRefreshing={stage4bInbox.isRefreshing}
                isLoadingMore={stage4bInbox.isLoadingMoreNotifications}
                lastSuccessAt={stage4bInbox.lastSuccessAt}
                actorContext={notificationActorContext}
                activeClientIds={activeClientIds}
                onFiltersChange={(patch) => navigateDashboard(patch)}
                onRefresh={() => void stage4bInbox.refresh({ resetBackoff: true })}
                onLoadMore={() => void stage4bInbox.loadMoreNotifications()}
                onOpenNotificationTarget={openNotificationTarget}
                onReceiptMutated={(payload) => stage4bInbox.applyNotificationMutation(payload)}
                onReadAllMutated={(payload) => stage4bInbox.applyNotificationReadAll(payload)}
              />
            )}

            {section === "voice" && (
              <VoicePanel
                state={state}
                rawInput={voiceRawInput}
                onRawInput={setVoiceRawInput}
                onAddSamples={addVoiceSamplesFromInput}
                onUpdateSampleStatus={updateVoiceSampleStatus}
                onGenerateProfile={generateVoiceProfile}
              />
            )}

            {section === "forms" && !selectedClient ? (
              <EmptyState
                title="Danışan seçilmedi"
                message="Formlar için önce aktif danışanı seçin. Otomatik seçim yapılmaz."
              />
            ) : null}

            {section === "forms" && selectedClient && (
              <FormsPanel
                state={state}
                selectedClient={selectedClient}
                schemaTitle={schemaTitle}
                schemaLanguage={schemaLanguage}
                schemaFieldsRaw={schemaFieldsRaw}
                formAnswersRaw={formAnswersRaw}
                uiLanguage={uiLanguage}
                onSchemaTitle={setSchemaTitle}
                onSchemaLanguage={setSchemaLanguage}
                onSchemaFieldsRaw={setSchemaFieldsRaw}
                onFormAnswersRaw={setFormAnswersRaw}
                onCreateSchema={createSchemaFromInput}
                onPublishSchema={publishFormSchema}
                onSaveResponse={saveSelectedFormResponse}
              />
            )}
          </div>
    </>
  );
}
