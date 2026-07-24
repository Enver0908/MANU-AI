"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { getSupabaseStatus } from "@/lib/supabase";
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
import {
  describeInstallState,
  describeSubscriptionStatus,
} from "@/lib/phase-83e3-app-shell";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import {
  SelectInput,
  StatusPill,
  fromDateTimeLocal,
  languageOptions,
  parseAnswerLines,
  parseSchemaFields,
  scenarioMessages,
  type ClientDetailTab,
} from "@/components/dashboard/shared";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";
import type { DashboardSection } from "@/lib/phase-85-stage-4b-dashboard-routing";
import {
  resolveLegacyCopilotSectionRedirect,
  resolveMessagingRouteSelection,
} from "@/lib/phase-85-stage-4b-dashboard-routing";
import {
  buildClinicalAlertMessagingNavigationPatch,
  buildSystemNotificationNavigationAction,
  refreshStage4B2OperationalSurfaces,
  resolveMessagingTargetValidity,
} from "@/lib/phase-85-stage-4b2-messaging-integration";
import { DashboardHeaderBell } from "@/components/dashboard/dashboard-navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { NotificationsPanel } from "@/components/dashboard/notifications-panel";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { ClientsPanel } from "@/components/dashboard/clients-panel";
import { ConversationPanel } from "@/components/dashboard/conversation-panel";
import { MessagingPanel } from "@/components/dashboard/messaging-panel";
import { SimulatorPanel } from "@/components/dashboard/simulator-panel";
import { VoicePanel } from "@/components/dashboard/voice-panel";
import { FormsPanel } from "@/components/dashboard/forms-panel";
import { useMobileKeyboardScroll } from "@/components/dashboard/mobile-ergonomics";
import { DashboardLoadingSkeleton, ErrorState } from "@/components/dashboard/state-primitives";

export function DashboardApp({
  authInfo,
  commercialInfo,
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
  const { urlState, section, navigateDashboard, openSection } = useDashboardUrl();
  const stage4bInbox = useStage4BInbox(urlState);
  const [operationalFoundation, setOperationalFoundation] =
    useState<OperationalFoundationInspectionDto | null>(null);
  const [clientDetailTab, setClientDetailTab] = useState<ClientDetailTab>("tab_overview");
  const [search, setSearch] = useState("");
  const [manualReply, setManualReply] = useState("");
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
    if (urlState.clientId && activeClients.some((client) => client.id === urlState.clientId)) {
      return urlState.clientId;
    }
    if (section === "clients" || section === "simulator" || section === "forms") {
      return activeClients[0]?.id ?? null;
    }
    return null;
  }, [activeClients, messagingRoute.clientId, section, urlState.clientId]);

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

  const selectedContextUpdates = useMemo(() => {
    if (!selectedClient) return [];
    return state.clientContextUpdates
      .filter((update) => update.clientId === selectedClient.id)
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }, [selectedClient, state.clientContextUpdates]);

  const metrics = useMemo(() => {
    const pendingDrafts = state.messages.filter((message) => message.status === "draft").length;
    const urgentHandoffs = state.handoffCases.filter((handoff) => handoff.status === "open").length;
    const aiSent = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent").length;
    const passive = activeClients.filter((client) => client.aiStatus === "passive").length;
    return { pendingDrafts, urgentHandoffs, aiSent, passive };
  }, [activeClients, state]);

  const mainContentRef = useRef<HTMLDivElement>(null);
  useMobileKeyboardScroll(mainContentRef);

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
    if (!selectedClient) return;
    await updateClient(selectedClient.id, patch);
  };

  const selectClient = (clientId: string, patch: { section?: DashboardSection; clientDetailTab?: ClientDetailTab } = {}) => {
    navigateDashboard({
      section: patch.section ?? section,
      clientId,
    });
    if (patch.clientDetailTab) {
      setClientDetailTab(patch.clientDetailTab);
    } else if ((patch.section ?? section) === "clients") {
      setClientDetailTab("tab_overview");
    }
  };

  const navigateToSection = (nextSection: DashboardSection) => {
    openSection(nextSection, resolvedClientId ? { clientId: resolvedClientId } : {});
  };

  const setSelectedClientAiPassive = async (clientId: string) => {
    return updateClient(clientId, { aiStatus: "passive" });
  };

  const removeSelectedClient = async () => {
    if (!selectedClient) return;
    const nextState = await removeClient(selectedClient.id);
    const nextActiveClient = nextState.clients.find((client) => client.lifecycleStatus !== "removed_anonymized");
    if (nextActiveClient) {
      selectClient(nextActiveClient.id, { section: "clients" });
    }
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
    if (!selectedClient || !manualReply.trim()) return;
    const body = manualReply;
    const aiChatDraftTransferId = stage4bMessaging.detail?.pendingAiChatDraftTransfer?.transferId;
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
    const patch = buildClinicalAlertMessagingNavigationPatch(alert);
    if (!patch) return;
    navigateDashboard(patch);
  };

  const openNotificationTarget = (notification: SystemNotificationListItem) => {
    const action = buildSystemNotificationNavigationAction(notification);
    if (!action) return;
    if (action.type === "dashboard") {
      navigateDashboard(action.patch);
      return;
    }
    selectClient(action.clientId, {
      section: "clients",
      clientDetailTab: action.clientDetailTab,
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
    if (!selectedClient) return;
    const { revision, ...profileBody } = profile;
    await saveClientFoodRuleProfile(selectedClient.id, {
      revision,
      profile: profileBody,
    });
  };

  const menuPlansForSelectedClient = selectedClient
    ? listClientMenuPlanV1Records(state, selectedClient.id).map((plan) =>
        menuPlanV1RecordToState(plan, getClientFoodRuleProfileV2Record(state, selectedClient.id)),
      )
    : [];
  const activeMenuPlanId = selectedClient ? getActiveClientMenuPlanV1Record(state, selectedClient.id)?.id || null : null;

  const createSelectedMenuPlan = async (templateType: Phase77FMenuPlanTemplateType) => {
    if (!selectedClient) return;
    await createMenuPlan(selectedClient.id, { templateType });
  };

  const saveSelectedMenuPlan = async (plan: Omit<ClientMenuPlanV1State, "conflicts">) => {
    if (!selectedClient) return;
    const { revision, id, ...planBody } = plan;
    await saveMenuPlan(selectedClient.id, id, { revision, plan: planBody });
  };

  const activateSelectedMenuPlan = async (planId: string) => {
    if (!selectedClient) return;
    await activateMenuPlan(selectedClient.id, planId);
  };

  const addSelectedContextUpdate = async () => {
    if (!selectedClient) return;
    await addClientContextUpdate(selectedClient.id, {
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
    <DashboardShell
      activeNavKey={section}
      uiLanguage={uiLanguage}
      badges={{
        alerts: stage4bInbox.alertsBadgeCount,
        notifications: stage4bInbox.notificationsBadgeCount,
        messages: stage4bMessaging.messagingBadgeCount,
      }}
      aiChatEnabled={aiChatEnabled}
      onNavigateSection={navigateToSection}
    >
      <header className="border-b border-stone-200 bg-white px-safe py-4 pt-safe sm:px-6 lg:pt-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm text-stone-500">{state.tenant.name}</p>
                <h1 className="text-2xl font-semibold">Operasyon paneli</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="w-44">
                  <SelectInput
                    label={t(uiLanguage, "dashboardLanguage")}
                    value={uiLanguage}
                    onChange={(value) => updateDietitianPreferences({ uiLanguage: value as SupportedLanguageCode })}
                    options={languageOptions}
                  />
                </div>
                {authInfo && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">
                    <UserRound size={16} className="text-emerald-800" />
                    {authInfo.displayName}
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-stone-500">
                      {authInfo.role}
                    </span>
                  </span>
                )}
                {commercialInfo ? (
                  <>
                    <StatusPill
                      icon={CreditCard}
                      label={describeSubscriptionStatus(commercialInfo.subscriptionStatus).label}
                      tone={describeSubscriptionStatus(commercialInfo.subscriptionStatus).tone}
                    />
                    <StatusPill
                      icon={Smartphone}
                      label={describeInstallState(commercialInfo.installReady).label}
                      tone={describeInstallState(commercialInfo.installReady).tone}
                    />
                  </>
                ) : (
                  <StatusPill icon={Smartphone} label="PWA hazır" tone="emerald" />
                )}
                <StatusPill
                  icon={ShieldCheck}
                  label={getSupabaseStatus() === "configured" ? "Supabase yapılandırıldı" : "Yerel veri"}
                  tone="amber"
                />
                <DashboardHeaderBell
                  unreadCount={stage4bInbox.notificationsBadgeCount}
                  onOpenNotifications={() => navigateToSection("notifications")}
                />

                <button
                  onClick={resetState}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                  type="button"
                >
                  <RefreshCcw size={16} />
                  Demoyu sıfırla
                </button>

                {commercialInfo ? (
                  <form action="/api/demo-logout" method="post">
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                    >
                      <LogOut size={16} />
                      Oturumu kapat
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </header>

          <div
            ref={mainContentRef}
            id={DASHBOARD_MAIN_ID}
            tabIndex={-1}
            className={`min-w-0 flex-1 px-safe py-5 sm:px-6 ${mainMobilePadding}`}
          >
            {section === "overview" && (
              <OverviewPanel
                metrics={metrics}
                selectedClient={selectedClient}
                state={state}
                uiLanguage={uiLanguage}
                showInspectionDetails={showOperationalInspection}
                operationalFoundation={showOperationalInspection ? operationalFoundation : null}
                onOpenSimulator={() => navigateToSection("simulator")}
                onOpenClients={() => navigateToSection("clients")}
              />
            )}

            {section === "clients" && selectedClient && (
              <ClientsPanel
                clients={filteredClients}
                selectedClient={selectedClient}
                search={search}
                newClientName={newClientName}
                newClientChannel={newClientChannel}
                newClientHandle={newClientHandle}
                newClientPhone={newClientPhone}
                newClientLanguage={newClientLanguage}
                uiLanguage={uiLanguage}
                canManageAiControls={canManageAiControls}
                onSearch={setSearch}
                onSelect={(id) => selectClient(id, { section: "clients", clientDetailTab: "tab_overview" })}
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
                clientDetailTab={clientDetailTab}
                onClientDetailTab={setClientDetailTab}
                state={state}
                foodRuleProfile={getClientFoodRuleProfileV2State(state, selectedClient.id)}
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
                onSelectConversation={(item) =>
                  navigateDashboard({
                    section: "messages",
                    conversationId: item.id,
                    clientId: item.clientId,
                    messageId: null,
                  })
                }
                onBackToList={() =>
                  navigateDashboard({
                    conversationId: null,
                    messageId: null,
                  })
                }
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
                onMutationComplete={() => refreshStage4B2Surfaces({ anchorMessageId: urlState.messageId })}
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
    </DashboardShell>
  );
}
