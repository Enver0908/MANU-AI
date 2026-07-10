"use client";

import { useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  BellRing,
  Bot,
  Check,
  CheckCheck,
  ClipboardList,
  CreditCard,
  Database,
  LogOut,
  MessageSquareText,
  RefreshCcw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";
import { getSupabaseStatus } from "@/lib/supabase";
import type {
  Channel,
  ClientContextUpdateImportance,
  ClientContextUpdateSource,
  ClientRecord,
  Phase77FMenuPlanTemplateType,
} from "@/lib/types";
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
import { t, type DashboardMessageKey } from "@/lib/i18n";
import {
  describeInstallState,
  describeSubscriptionStatus,
} from "@/lib/phase-83e3-app-shell";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import {
  SelectInput,
  StatusPill,
  formatTime,
  fromDateTimeLocal,
  languageOptions,
  parseAnswerLines,
  parseSchemaFields,
  scenarioMessages,
  type ClientDetailTab,
  type ViewKey,
} from "@/components/dashboard/shared";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { ClientsPanel } from "@/components/dashboard/clients-panel";
import { ConversationPanel } from "@/components/dashboard/conversation-panel";
import { SimulatorPanel } from "@/components/dashboard/simulator-panel";
import { HandoffsPanel } from "@/components/dashboard/handoffs-panel";
import { CopilotPanel } from "@/components/dashboard/copilot-panel";
import { VoicePanel } from "@/components/dashboard/voice-panel";
import { FormsPanel } from "@/components/dashboard/forms-panel";
import { useMobileKeyboardScroll } from "@/components/dashboard/mobile-ergonomics";
import { DashboardLoadingSkeleton, ErrorState } from "@/components/dashboard/state-primitives";
import { DASHBOARD_MAIN_ID } from "@/lib/phase-83e6-states-polish";

const viewItems: Array<{ key: ViewKey; labelKey: DashboardMessageKey; icon: typeof Activity }> = [
  { key: "overview", labelKey: "overview", icon: Activity },
  { key: "clients", labelKey: "clients", icon: UsersRound },
  { key: "conversation", labelKey: "conversation", icon: MessageSquareText },
  { key: "simulator", labelKey: "simulator", icon: Bot },
  { key: "handoffs", labelKey: "handoffs", icon: BellRing },
  { key: "copilot", labelKey: "copilot", icon: Database },
  { key: "voice", labelKey: "voice", icon: ClipboardList },
  { key: "forms", labelKey: "forms", icon: SlidersHorizontal },
];

export function DashboardApp({
  authInfo,
  commercialInfo,
}: {
  authInfo?: { displayName: string; role: string };
  commercialInfo?: { subscriptionStatus: CommercialEntitlementStatus | null; installReady: boolean };
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
    sendManualReply: sendManualReplyRequest,
    approveDraft,
    editAndSendDraft,
    dismissDraft,
    resolveHandoff,
    resolveAndReactivateHandoff,
    dismissHandoff,
    markNotificationRead,
    acknowledgeNotification,
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
    sendInternalCopilotMessage,
    rejectClientUpdateProposal,
    createContextIntakeProposal,
    confirmContextIntakeProposal,
    recheckContextIntakeProposal,
    applyContextIntakeProposal,
    rejectContextIntakeProposal,
  } = useManuState();
  const [view, setView] = useState<ViewKey>("overview");
  const [selectedClientId, setSelectedClientId] = useState("client-mert");
  const [clientDetailTab, setClientDetailTab] = useState<ClientDetailTab>("tab_overview");
  const [search, setSearch] = useState("");
  const [manualReply, setManualReply] = useState("");
  const [simBody, setSimBody] = useState(scenarioMessages[0].body);
  const [simKey, setSimKey] = useState("local-1");
  const [isSimulating, setIsSimulating] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientChannel, setNewClientChannel] = useState<Channel>("whatsapp");
  const [newClientHandle, setNewClientHandle] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientLanguage, setNewClientLanguage] = useState<SupportedLanguageCode>("tr");
  const [showNotifications, setShowNotifications] = useState(false);
  const [voiceRawInput, setVoiceRawInput] = useState("");
  const [schemaTitle, setSchemaTitle] = useState("Client intake");
  const [schemaLanguage, setSchemaLanguage] = useState<SupportedLanguageCode>("tr");
  const [schemaFieldsRaw, setSchemaFieldsRaw] = useState("daily_routine | Daily routine | textarea | prompt_allowed");
  const [formAnswersRaw, setFormAnswersRaw] = useState("");
  const [copilotInput, setCopilotInput] = useState("");
  const [isCopilotSending, setIsCopilotSending] = useState(false);
  const [isProposalUpdating, setIsProposalUpdating] = useState(false);
  const [isActivatingAi, setIsActivatingAi] = useState(false);
  const [contextUpdateSource, setContextUpdateSource] = useState<ClientContextUpdateSource>("phone");
  const [contextUpdateImportance, setContextUpdateImportance] =
    useState<ClientContextUpdateImportance>("important");
  const [contextUpdateOccurredAt, setContextUpdateOccurredAt] = useState("");
  const [contextUpdateTitle, setContextUpdateTitle] = useState("");
  const [contextUpdateSummary, setContextUpdateSummary] = useState("");
  const [contextUpdateDetails, setContextUpdateDetails] = useState("");
  const [intakeSourceText, setIntakeSourceText] = useState("");
  const [intakeSource, setIntakeSource] = useState<ClientContextUpdateSource>("phone");

  const activeClients = useMemo(
    () => state.clients.filter((client) => client.lifecycleStatus !== "removed_anonymized"),
    [state.clients],
  );

  const selectedClient = useMemo(
    () => activeClients.find((client) => client.id === selectedClientId) || activeClients[0],
    [activeClients, selectedClientId],
  );

  const selectedConversation = useMemo(
    () => state.conversations.find((conversation) => conversation.clientId === selectedClient?.id),
    [selectedClient?.id, state.conversations],
  );

  const selectedMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return state.messages
      .filter((message) => message.conversationId === selectedConversation.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [selectedConversation, state.messages]);

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

  const selectedUpdateProposals = useMemo(() => {
    if (!selectedClient) return [];
    return state.clientUpdateProposals
      .filter((proposal) => proposal.clientId === selectedClient.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedClient, state.clientUpdateProposals]);

  const selectedContextIntakeProposals = useMemo(() => {
    if (!selectedClient) return [];
    return state.contextIntakeProposals
      .filter((proposal) => proposal.clientId === selectedClient.id)
      .filter((proposal) => !["applied", "rejected", "stale", "expired"].includes(proposal.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedClient, state.contextIntakeProposals]);

  const metrics = useMemo(() => {
    const pendingDrafts = state.messages.filter((message) => message.status === "draft").length;
    const urgentHandoffs = state.handoffCases.filter((handoff) => handoff.status === "open").length;
    const aiSent = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent").length;
    const passive = activeClients.filter((client) => client.aiStatus === "passive").length;
    const unreadNotifications = state.notifications.filter((n) => !n.read).length;
    return { pendingDrafts, urgentHandoffs, aiSent, passive, unreadNotifications };
  }, [activeClients, state]);

  const mainContentRef = useRef<HTMLDivElement>(null);
  useMobileKeyboardScroll(mainContentRef);

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

  const removeSelectedClient = async () => {
    if (!selectedClient) return;
    const nextState = await removeClient(selectedClient.id);
    const nextActiveClient = nextState.clients.find((client) => client.lifecycleStatus !== "removed_anonymized");
    if (nextActiveClient) {
      setSelectedClientId(nextActiveClient.id);
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
    setSelectedClientId(createdClient.id);
    setNewClientName("");
    setNewClientHandle("");
    setNewClientPhone("");
    setView("clients");
  };

  const runSimulation = async () => {
    if (!selectedClient || isSimulating) return;
    setIsSimulating(true);
    try {
      await runSimulationRequest({
        clientId: selectedClient.id,
        body: simBody,
        idempotencyKey: simKey,
      });
      setView("simulator");
    } finally {
      setIsSimulating(false);
    }
  };

  const sendManualReply = async () => {
    if (!selectedClient || !manualReply.trim()) return;
    await sendManualReplyRequest({ clientId: selectedClient.id, body: manualReply });
    setManualReply("");
  };

  const activateSelectedClientAi = async (clientId: string) => {
    const client = state.clients.find((item) => item.id === clientId);
    const conversation = state.conversations.find((item) => item.clientId === clientId);
    if (!client || !conversation) {
      throw new Error("activation_context_not_found");
    }
    setIsActivatingAi(true);
    try {
      return await activateClientAi(clientId, {
        expectedConversationRevision: conversation.revision,
        expectedClientContextRevision: client.contextRevision,
      });
    } finally {
      setIsActivatingAi(false);
    }
  };

  const openClientPanelFromConversation = (panelKey: string) => {
    setView("clients");
    setClientDetailTab(panelKey as ClientDetailTab);
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

  const askInternalCopilot = async (body = copilotInput) => {
    const trimmed = body.trim();
    if (!trimmed || isCopilotSending) return;
    setIsCopilotSending(true);
    try {
      await sendInternalCopilotMessage(trimmed);
      setCopilotInput("");
      setView("copilot");
    } finally {
      setIsCopilotSending(false);
    }
  };

  const rejectSelectedProposal = async (proposalId: string) => {
    if (!selectedClient || isProposalUpdating) return;
    setIsProposalUpdating(true);
    try {
      await rejectClientUpdateProposal(selectedClient.id, proposalId);
    } finally {
      setIsProposalUpdating(false);
    }
  };

  const createSelectedContextIntakeProposal = async () => {
    if (!selectedClient || isProposalUpdating || !intakeSourceText.trim()) return;
    setIsProposalUpdating(true);
    try {
      await createContextIntakeProposal(selectedClient.id, {
        sourceText: intakeSourceText,
        intakeSource,
        confirmFullName: selectedClient.fullName,
        confirmPhoneE164: selectedClient.primaryPhoneE164 || undefined,
      });
      setIntakeSourceText("");
    } finally {
      setIsProposalUpdating(false);
    }
  };

  const runContextIntakeAction = async (action: (clientId: string, proposalId: string) => Promise<unknown>, proposalId: string) => {
    if (!selectedClient || isProposalUpdating) return;
    setIsProposalUpdating(true);
    try {
      await action(selectedClient.id, proposalId);
    } finally {
      setIsProposalUpdating(false);
    }
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

  const uiLanguage = state.dietitian.uiLanguage || "tr";
  const showOperationalInspection = authInfo?.role === "owner" || authInfo?.role === "admin";
  const viewsWithMobileStickyActions: ViewKey[] = ["conversation", "simulator", "copilot"];
  const mainMobilePadding = viewsWithMobileStickyActions.includes(view)
    ? "lg:pb-5"
    : "pb-mobile-nav lg:pb-5";

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-stone-950">
      <a href={`#${DASHBOARD_MAIN_ID}`} className="skip-link">
        İçeriğe atla
      </a>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside
          className="border-b border-stone-200 bg-white px-safe lg:w-72 lg:border-b-0 lg:border-r lg:px-0"
          aria-label="Ana navigasyon"
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">MANU-AI</p>
              <h1 className="mt-1 text-xl font-semibold">Diyetisyen konsolu</h1>
            </div>
            <form action="/api/demo-logout" method="post">
              <button
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100"
                title="Demo oturumunu kapat"
                aria-label="Demo oturumunu kapat"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>

          <nav className="hidden gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible" aria-label="Panel görünümleri">
            {viewItems.map((item) => {
              const Icon = item.icon;
              const active = item.key === view;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`inline-flex min-h-11 min-w-fit items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
                    active
                      ? "bg-emerald-950 text-white"
                      : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                  }`}
                  type="button"
                >
                  <Icon size={18} />
                  {t(uiLanguage, item.labelKey)}
                </button>
              );
            })}
          </nav>

          <div className="hidden px-5 py-5 lg:block">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} className="text-emerald-700" />
                Yerel güvenli mod
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Yalnızca simülatör. WhatsApp, Telegram veya canlı sağlık verisi sağlayıcısı bağlı değil.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
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
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100"
                    type="button"
                  >
                    <Bell size={18} />
                    {metrics.unreadNotifications > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                        {metrics.unreadNotifications}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-lg border border-stone-200 bg-white shadow-xl">
                      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                        <h3 className="font-semibold">Bildirimler</h3>
                        {metrics.unreadNotifications > 0 && (
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                            {metrics.unreadNotifications} yeni
                          </span>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto p-2">
                        {state.notifications.length === 0 ? (
                          <div className="p-4 text-center text-sm text-stone-500">Henüz bildirim yok.</div>
                        ) : (
                          state.notifications
                            .slice()
                            .reverse()
                            .map((notif) => (
                              <div
                                key={notif.id}
                                className={`mb-2 rounded-lg p-3 text-left transition ${
                                  notif.read ? "bg-white opacity-70" : "bg-stone-50"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      {notif.type === "handoff_urgent" && <AlertTriangle size={14} className="text-red-600" />}
                                      <p className={`text-sm truncate ${notif.read ? "font-medium" : "font-semibold"}`}>
                                        {notif.title}
                                      </p>
                                    </div>
                                    <p className="mt-1 text-sm text-stone-600">{notif.body}</p>
                                    <p className="mt-1.5 text-xs text-stone-400">{formatTime(notif.createdAt)}</p>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    {!notif.read && (
                                      <button
                                        onClick={() => markNotificationRead(notif.id)}
                                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded bg-white px-2 border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                        title="Okundu işaretle"
                                        type="button"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                    {!notif.acknowledgedAt && (
                                      <button
                                        onClick={() => acknowledgeNotification(notif.id)}
                                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded bg-white px-2 border border-stone-200 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                        title="Onayla"
                                        type="button"
                                      >
                                        <CheckCheck size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

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
            {view === "overview" && (
              <OverviewPanel
                metrics={metrics}
                selectedClient={selectedClient}
                state={state}
                uiLanguage={uiLanguage}
                showInspectionDetails={showOperationalInspection}
                onOpenSimulator={() => setView("simulator")}
                onOpenClients={() => setView("clients")}
              />
            )}

            {view === "clients" && selectedClient && (
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
                onSearch={setSearch}
                onSelect={(id) => { setSelectedClientId(id); setClientDetailTab("tab_overview"); }}
                onAddClient={addClient}
                onNewClientName={setNewClientName}
                onNewClientChannel={setNewClientChannel}
                onNewClientHandle={setNewClientHandle}
                onNewClientPhone={setNewClientPhone}
                onNewClientLanguage={setNewClientLanguage}
                onUpdateClient={updateSelectedClient}
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
                copilotInput={copilotInput}
                isCopilotSending={isCopilotSending}
                onCopilotInput={setCopilotInput}
                onAskCopilot={askInternalCopilot}
                onSaveFormResponse={saveSelectedFormResponse}
              />
            )}

            {view === "conversation" && selectedClient && (
              <ConversationPanel
                client={selectedClient}
                messages={selectedMessages}
                aiDecisions={state.aiDecisions.filter((decision) => decision.clientId === selectedClient.id)}
                state={state}
                uiLanguage={uiLanguage}
                manualReply={manualReply}
                onManualReply={setManualReply}
                onSendManualReply={sendManualReply}
                onReleaseHumanTakeover={releaseHumanTakeover}
                onActivateAi={activateSelectedClientAi}
                isActivatingAi={isActivatingAi}
                onApproveDraft={approveDraft}
                onEditAndSendDraft={editAndSendDraft}
                onDismissDraft={dismissDraft}
                onOpenSimulator={() => setView("simulator")}
                onOpenClientPanel={openClientPanelFromConversation}
              />
            )}

            {view === "simulator" && selectedClient && (
              <SimulatorPanel
                state={state}
                selectedClient={selectedClient}
                clients={activeClients}
                simBody={simBody}
                simKey={simKey}
                isSimulating={isSimulating}
                onSelectClient={setSelectedClientId}
                onSimBody={setSimBody}
                onSimKey={setSimKey}
                onRun={runSimulation}
                onOpenConversation={() => setView("conversation")}
              />
            )}

            {view === "handoffs" && (
              <HandoffsPanel
                state={state}
                onSelectClient={setSelectedClientId}
                onResolveHandoff={resolveHandoff}
                onResolveAndReactivateHandoff={resolveAndReactivateHandoff}
                onDismissHandoff={dismissHandoff}
              />
            )}

            {view === "copilot" && selectedClient && (
              <CopilotPanel
                state={state}
                selectedClient={selectedClient}
                input={copilotInput}
                isSending={isCopilotSending}
                isProposalUpdating={isProposalUpdating}
                updateProposals={selectedUpdateProposals}
                contextIntakeProposals={selectedContextIntakeProposals}
                intakeSource={intakeSource}
                intakeSourceText={intakeSourceText}
                onIntakeSource={setIntakeSource}
                onIntakeSourceText={setIntakeSourceText}
                onCreateContextIntakeProposal={createSelectedContextIntakeProposal}
                onConfirmContextIntakeProposal={(proposalId) => runContextIntakeAction(confirmContextIntakeProposal, proposalId)}
                onRecheckContextIntakeProposal={(proposalId) => runContextIntakeAction(recheckContextIntakeProposal, proposalId)}
                onApplyContextIntakeProposal={(proposalId) => runContextIntakeAction(applyContextIntakeProposal, proposalId)}
                onRejectContextIntakeProposal={(proposalId) => runContextIntakeAction(rejectContextIntakeProposal, proposalId)}
                onInput={setCopilotInput}
                onAsk={askInternalCopilot}
                onRejectProposal={rejectSelectedProposal}
              />
            )}

            {view === "voice" && (
              <VoicePanel
                state={state}
                rawInput={voiceRawInput}
                onRawInput={setVoiceRawInput}
                onAddSamples={addVoiceSamplesFromInput}
                onUpdateSampleStatus={updateVoiceSampleStatus}
                onGenerateProfile={generateVoiceProfile}
              />
            )}

            {view === "forms" && selectedClient && (
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
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-stone-200 bg-white pb-safe lg:hidden"
        aria-label="Mobil navigasyon"
      >
        {viewItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === view;
          const label = t(uiLanguage, item.labelKey);
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className={`relative flex min-h-14 w-20 shrink-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition sm:flex-1 ${
                active ? "text-emerald-900" : "text-stone-500"
              }`}
              type="button"
            >
              <Icon size={20} aria-hidden="true" />
              <span className="truncate px-1">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
