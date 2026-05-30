"use client";

import Link from "next/link";

import {
  Activity,
  AlertTriangle,
  Bell,
  BellRing,
  Bot,
  Check,
  CheckCheck,
  CirclePause,
  ClipboardList,
  Clock3,
  Database,
  LogOut,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UserRound,
  UsersRound,
} from "lucide-react";
import { personas } from "dietitian-ai-assistant-architecture";
import { useMemo, useState } from "react";
import {
  isSafetyChecklistComplete,
  normalizeSafetyChecklist,
  safetyChecklistLabels,
} from "@/lib/safety-checklist";
import { getSupabaseStatus } from "@/lib/supabase";
import type {
  AiMode,
  AiStatus,
  Channel,
  ClientFormFieldDefinition,
  ClientRecord,
  ManuAppState,
  MessageRecord,
  SafetyChecklist,
} from "@/lib/types";
import { useManuState } from "@/lib/use-manu-state";

type ViewKey = "overview" | "clients" | "conversation" | "simulator" | "handoffs" | "copilot" | "voice" | "forms";

const viewItems: Array<{ key: ViewKey; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "Overview", icon: Activity },
  { key: "clients", label: "Clients", icon: UsersRound },
  { key: "conversation", label: "Conversation", icon: MessageSquareText },
  { key: "simulator", label: "Simulator", icon: Bot },
  { key: "handoffs", label: "Handoffs", icon: BellRing },
  { key: "copilot", label: "Copilot", icon: Database },
  { key: "voice", label: "Voice", icon: ClipboardList },
  { key: "forms", label: "Forms", icon: SlidersHorizontal },
];

const scenarioMessages = [
  {
    label: "Routine",
    body: "Bugun kahvaltida yumurta yerine ne yiyebilirim?",
  },
  {
    label: "Yellow",
    body: "D vitamini takviyesi kullanayim mi?",
  },
  {
    label: "Red",
    body: "Alerjiden nefes alamiyorum, bogazim sisti.",
  },
  {
    label: "Plan",
    body: "Diyetimi degistirip ogunumu tamamen atlayabilir miyim?",
  },
];

export function DashboardApp({ authInfo }: { authInfo?: { displayName: string; role: string } }) {
  const {
    state,
    hydrated,
    authError,
    createClient,
    updateClient,
    releaseHumanTakeover,
    runSimulation: runSimulationRequest,
    sendManualReply: sendManualReplyRequest,
    approveDraft,
    editAndSendDraft,
    dismissDraft,
    resolveHandoff,
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
    sendInternalCopilotMessage,
  } = useManuState();
  const [view, setView] = useState<ViewKey>("overview");
  const [selectedClientId, setSelectedClientId] = useState("client-mert");
  const [search, setSearch] = useState("");
  const [manualReply, setManualReply] = useState("");
  const [simBody, setSimBody] = useState(scenarioMessages[0].body);
  const [simKey, setSimKey] = useState("local-1");
  const [isSimulating, setIsSimulating] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientChannel, setNewClientChannel] = useState<Channel>("whatsapp");
  const [newClientHandle, setNewClientHandle] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [voiceRawInput, setVoiceRawInput] = useState("");
  const [schemaTitle, setSchemaTitle] = useState("Client intake");
  const [schemaFieldsRaw, setSchemaFieldsRaw] = useState("daily_routine | Daily routine | textarea | prompt_allowed");
  const [formAnswersRaw, setFormAnswersRaw] = useState("");
  const [copilotInput, setCopilotInput] = useState("");
  const [isCopilotSending, setIsCopilotSending] = useState(false);

  const selectedClient = useMemo(
    () => state.clients.find((client) => client.id === selectedClientId) || state.clients[0],
    [selectedClientId, state.clients],
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
    if (!needle) return state.clients;
    return state.clients.filter((client) =>
      [client.fullName, client.channelUserId, client.aiMode, client.aiStatus]
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(needle),
    );
  }, [search, state.clients]);

  const metrics = useMemo(() => {
    const pendingDrafts = state.messages.filter((message) => message.status === "draft").length;
    const urgentHandoffs = state.handoffCases.filter((handoff) => handoff.status === "open").length;
    const aiSent = state.messages.filter((message) => message.origin === "ai_generated" && message.status === "sent").length;
    const passive = state.clients.filter((client) => client.aiStatus === "passive").length;
    const unreadNotifications = state.notifications.filter((n) => !n.read).length;
    return { pendingDrafts, urgentHandoffs, aiSent, passive, unreadNotifications };
  }, [state]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-stone-700">
        <div className="rounded-lg border border-stone-200 bg-white px-5 py-4 shadow-sm">Loading MANU-AI workspace...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5ef] px-4 py-6 text-stone-950">
        <div className="mx-auto w-full max-w-md">
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Session error</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              Your session could not be verified. Please sign in again.
            </p>
            <p className="mt-1 text-xs text-stone-400">Error: {authError}</p>
            <Link
              href="/"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
            >
              Return to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const updateSelectedClient = async (patch: Partial<ClientRecord>) => {
    if (!selectedClient) return;
    await updateClient(selectedClient.id, patch);
  };

  const addClient = async () => {
    const fullName = newClientName.trim();
    if (!fullName) return;
    const nextState = await createClient({
      fullName,
      channel: newClientChannel,
      channelUserId: newClientHandle.trim(),
    });
    const createdClient = nextState.clients[nextState.clients.length - 1];
    setSelectedClientId(createdClient.id);
    setNewClientName("");
    setNewClientHandle("");
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

  const addVoiceSamplesFromInput = async () => {
    if (!voiceRawInput.trim()) return;
    await addVoiceSamples(voiceRawInput);
    setVoiceRawInput("");
  };

  const createSchemaFromInput = async () => {
    const fields = parseSchemaFields(schemaFieldsRaw);
    if (!schemaTitle.trim() || fields.length === 0) return;
    await createFormSchema({ title: schemaTitle, fields });
  };

  const saveSelectedFormResponse = async () => {
    if (!selectedClient) return;
    const activeSchema = [...state.clientFormSchemas]
      .filter((schema) => schema.status === "published")
      .sort((a, b) => b.version - a.version)[0];
    if (!activeSchema) return;
    await saveFormResponse({
      clientId: selectedClient.id,
      schemaId: activeSchema.id,
      answers: parseAnswerLines(formAnswersRaw),
    });
    setFormAnswersRaw("");
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

  return (
    <div className="min-h-screen bg-[#f7f5ef] text-stone-950">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-stone-200 bg-white lg:w-72 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">MANU-AI</p>
              <h1 className="mt-1 text-xl font-semibold">Dietitian console</h1>
            </div>
            <form action="/api/demo-logout" method="post">
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-100"
                title="End demo session"
                aria-label="End demo session"
              >
                <LogOut size={18} />
              </button>
            </form>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-visible">
            {viewItems.map((item) => {
              const Icon = item.icon;
              const active = item.key === view;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={`inline-flex min-w-fit items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition lg:w-full ${
                    active
                      ? "bg-emerald-950 text-white"
                      : "text-stone-700 hover:bg-stone-100 hover:text-stone-950"
                  }`}
                  type="button"
                >
                  <Icon size={18} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="hidden px-5 py-5 lg:block">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={18} className="text-emerald-700" />
                Local safe mode
              </div>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Simulator only. No WhatsApp, Telegram, or live health-data provider is connected.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm text-stone-500">{state.tenant.name}</p>
                <h2 className="text-2xl font-semibold">Operations dashboard</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {authInfo && (
                  <span className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">
                    <UserRound size={16} className="text-emerald-800" />
                    {authInfo.displayName}
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-semibold uppercase text-stone-500">
                      {authInfo.role}
                    </span>
                  </span>
                )}
                <StatusPill icon={Smartphone} label="PWA ready" tone="emerald" />
                <StatusPill
                  icon={ShieldCheck}
                  label={getSupabaseStatus() === "configured" ? "Supabase configured" : "Local data"}
                  tone="amber"
                />
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-700 transition hover:bg-stone-100"
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
                        <h3 className="font-semibold">Notifications</h3>
                        {metrics.unreadNotifications > 0 && (
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">
                            {metrics.unreadNotifications} new
                          </span>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto p-2">
                        {state.notifications.length === 0 ? (
                          <div className="p-4 text-center text-sm text-stone-500">No notifications yet.</div>
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
                                        className="inline-flex h-7 items-center justify-center rounded bg-white px-2 border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50"
                                        title="Mark read"
                                        type="button"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                    {!notif.acknowledgedAt && (
                                      <button
                                        onClick={() => acknowledgeNotification(notif.id)}
                                        className="inline-flex h-7 items-center justify-center rounded bg-white px-2 border border-stone-200 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                                        title="Acknowledge"
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
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                  type="button"
                >
                  <RefreshCcw size={16} />
                  Reset demo
                </button>
              </div>
            </div>
          </header>

          <div className="min-w-0 flex-1 px-4 py-5 sm:px-6">
            {view === "overview" && (
              <OverviewPanel
                metrics={metrics}
                selectedClient={selectedClient}
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
                onSearch={setSearch}
                onSelect={setSelectedClientId}
                onAddClient={addClient}
                onNewClientName={setNewClientName}
                onNewClientChannel={setNewClientChannel}
                onNewClientHandle={setNewClientHandle}
                onUpdateClient={updateSelectedClient}
              />
            )}

            {view === "conversation" && selectedClient && (
              <ConversationPanel
                client={selectedClient}
                messages={selectedMessages}
                manualReply={manualReply}
                onManualReply={setManualReply}
                onSendManualReply={sendManualReply}
                onReleaseHumanTakeover={releaseHumanTakeover}
                onApproveDraft={approveDraft}
                onEditAndSendDraft={editAndSendDraft}
                onDismissDraft={dismissDraft}
                onOpenSimulator={() => setView("simulator")}
              />
            )}

            {view === "simulator" && selectedClient && (
              <SimulatorPanel
                state={state}
                selectedClient={selectedClient}
                clients={state.clients}
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
                onDismissHandoff={dismissHandoff}
              />
            )}

            {view === "copilot" && selectedClient && (
              <CopilotPanel
                state={state}
                selectedClient={selectedClient}
                input={copilotInput}
                isSending={isCopilotSending}
                onInput={setCopilotInput}
                onAsk={askInternalCopilot}
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
                schemaFieldsRaw={schemaFieldsRaw}
                formAnswersRaw={formAnswersRaw}
                onSchemaTitle={setSchemaTitle}
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
    </div>
  );
}

function OverviewPanel({
  metrics,
  selectedClient,
  onOpenSimulator,
  onOpenClients,
}: {
  metrics: { pendingDrafts: number; urgentHandoffs: number; aiSent: number; passive: number };
  selectedClient?: ClientRecord;
  onOpenSimulator: () => void;
  onOpenClients: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Bot} label="AI sent" value={String(metrics.aiSent)} tone="emerald" />
        <MetricCard icon={ClipboardList} label="Pending drafts" value={String(metrics.pendingDrafts)} tone="amber" />
        <MetricCard icon={AlertTriangle} label="Open handoffs" value={String(metrics.urgentHandoffs)} tone="red" />
        <MetricCard icon={CirclePause} label="Passive clients" value={String(metrics.passive)} tone="stone" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Sprint surface</h3>
              <p className="mt-1 text-sm text-stone-600">Dashboard shell, client controls, simulator, provenance labels.</p>
            </div>
            <button
              onClick={onOpenSimulator}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              type="button"
            >
              <Bot size={17} />
              Run simulator
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <WorkflowItem icon={ShieldCheck} title="Activation gate" body="Active, passive, schedule, takeover, and safety profile blocks." />
            <WorkflowItem icon={SlidersHorizontal} title="Mode controls" body="Autopilot, copilot, manual, paused, persona, and time window." />
            <WorkflowItem icon={MessageSquareText} title="Timeline labels" body="Client, AI, dietitian, and system origins stay visible." />
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold">Selected client</h3>
          {selectedClient ? (
            <div className="mt-4 space-y-3">
              <ClientSummary client={selectedClient} compact />
              <button
                onClick={onOpenClients}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                type="button"
              >
                <UserRound size={16} />
                Manage client
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">No client selected.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function ClientsPanel({
  clients,
  selectedClient,
  search,
  newClientName,
  newClientChannel,
  newClientHandle,
  onSearch,
  onSelect,
  onAddClient,
  onNewClientName,
  onNewClientChannel,
  onNewClientHandle,
  onUpdateClient,
}: {
  clients: ClientRecord[];
  selectedClient: ClientRecord;
  search: string;
  newClientName: string;
  newClientChannel: Channel;
  newClientHandle: string;
  onSearch: (value: string) => void;
  onSelect: (clientId: string) => void;
  onAddClient: () => void;
  onNewClientName: (value: string) => void;
  onNewClientChannel: (value: Channel) => void;
  onNewClientHandle: (value: string) => void;
  onUpdateClient: (patch: Partial<ClientRecord>) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-3">
        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <label className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-stone-900 outline-none placeholder:text-stone-400"
              placeholder="Search clients"
            />
          </label>
        </div>

        <div className="space-y-2">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              className={`w-full rounded-lg border p-3 text-left shadow-sm transition ${
                client.id === selectedClient.id
                  ? "border-emerald-900 bg-emerald-50"
                  : "border-stone-200 bg-white hover:border-stone-300"
              }`}
              type="button"
            >
              <ClientSummary client={client} />
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold">Create client</h3>
          <div className="mt-3 space-y-2">
            <TextInput label="Full name" value={newClientName} onChange={onNewClientName} />
            <SelectInput
              label="Channel"
              value={newClientChannel}
              onChange={(value) => onNewClientChannel(value as Channel)}
              options={[
                ["whatsapp", "WhatsApp"],
                ["telegram", "Telegram"],
              ]}
            />
            <TextInput label="Channel ID" value={newClientHandle} onChange={onNewClientHandle} />
            <button
              onClick={onAddClient}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
              type="button"
            >
              <Plus size={16} />
              Add client
            </button>
          </div>
        </div>
      </section>

      <ClientDetailForm client={selectedClient} onUpdateClient={onUpdateClient} />
    </div>
  );
}

function ClientDetailForm({
  client,
  onUpdateClient,
}: {
  client: ClientRecord;
  onUpdateClient: (patch: Partial<ClientRecord>) => void;
}) {
  const updateHealth = (patch: Partial<ClientRecord["healthProfile"]>) => {
    onUpdateClient({ healthProfile: { ...client.healthProfile, ...patch } });
  };
  const updateDietPlan = (patch: Partial<ClientRecord["dietPlan"]>) => {
    onUpdateClient({ dietPlan: { ...client.dietPlan, ...patch } });
  };
  const updateSafetyChecklist = (key: keyof SafetyChecklist, checked: boolean) => {
    const safetyChecklist = {
      ...normalizeSafetyChecklist(client.safetyChecklist),
      [key]: checked,
    };
    onUpdateClient({
      safetyChecklist,
      mandatorySafetyComplete: isSafetyChecklistComplete({ ...client, safetyChecklist }),
    });
  };
  const safetyChecklist = normalizeSafetyChecklist(client.safetyChecklist);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold">{client.fullName}</h3>
          <p className="mt-1 text-sm text-stone-600">
            {client.channel} · {client.channelUserId || "No channel ID"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={client.aiStatus} tone={client.aiStatus === "active" ? "emerald" : "stone"} />
          <Badge label={client.aiMode} tone={client.aiMode === "autopilot" ? "emerald" : "amber"} />
          <Badge label={client.channelPermission} tone={client.channelPermission === "ready" ? "emerald" : "amber"} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1 text-sm font-semibold">AI control</legend>
          <div className="mt-3 space-y-4">
            <SegmentedControl
              label="AI status"
              value={client.aiStatus}
              options={[
                ["active", "Active"],
                ["passive", "Passive"],
              ]}
              onChange={(value) => onUpdateClient({ aiStatus: value as AiStatus })}
            />
            <SegmentedControl
              label="AI mode"
              value={client.aiMode}
              options={[
                ["autopilot", "Autopilot"],
                ["copilot", "Copilot"],
                ["manual", "Manual"],
                ["paused", "Paused"],
              ]}
              onChange={(value) => onUpdateClient({ aiMode: value as AiMode })}
            />
            <SelectInput
              label="Persona"
              value={client.selectedPersonaId}
              onChange={(value) => onUpdateClient({ selectedPersonaId: value })}
              options={personas.map((persona) => [persona.id, persona.label])}
            />
            <div className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-stone-800">Safety checklist</p>
                <Badge
                  label={client.mandatorySafetyComplete ? "complete" : "incomplete"}
                  tone={client.mandatorySafetyComplete ? "emerald" : "amber"}
                />
              </div>
              <div className="mt-3 grid gap-2">
                {(Object.keys(safetyChecklistLabels) as Array<keyof SafetyChecklist>).map((key) => (
                  <ToggleRow
                    key={key}
                    label={safetyChecklistLabels[key]}
                    checked={safetyChecklist[key]}
                    onChange={(checked) => updateSafetyChecklist(key, checked)}
                  />
                ))}
              </div>
            </div>
            <ToggleRow
              label="Dietitian takeover lock"
              checked={client.humanTakeoverLocked}
              onChange={(checked) => onUpdateClient({ humanTakeoverLocked: checked })}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <DateTimeInput
                label="Active from"
                value={toDateTimeLocal(client.aiActiveFrom)}
                onChange={(value) => onUpdateClient({ aiActiveFrom: fromDateTimeLocal(value) })}
              />
              <DateTimeInput
                label="Active until"
                value={toDateTimeLocal(client.aiActiveUntil)}
                onChange={(value) => onUpdateClient({ aiActiveUntil: fromDateTimeLocal(value) })}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-stone-200 p-4">
          <legend className="px-1 text-sm font-semibold">Profile and channel</legend>
          <div className="mt-3 grid gap-3">
            <TextInput label="Full name" value={client.fullName} onChange={(value) => onUpdateClient({ fullName: value })} />
            <SelectInput
              label="Channel permission"
              value={client.channelPermission}
              onChange={(value) => onUpdateClient({ channelPermission: value as ClientRecord["channelPermission"] })}
              options={[
                ["ready", "Ready"],
                ["pending", "Pending"],
                ["blocked", "Blocked"],
                ["opted_out", "Opted out"],
              ]}
            />
            <TextInput label="Goal" value={client.healthProfile.goal} onChange={(value) => updateHealth({ goal: value })} />
            <TextareaInput
              label="Diet plan summary"
              value={client.dietPlan.summary}
              onChange={(value) => updateDietPlan({ summary: value })}
              rows={3}
            />
          </div>
        </fieldset>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ArrayInput
          label="Allergies"
          value={client.allergies}
          onChange={(value) => onUpdateClient({ allergies: splitLines(value) })}
        />
        <ArrayInput
          label="Restricted foods"
          value={client.restrictedFoods}
          onChange={(value) => onUpdateClient({ restrictedFoods: splitLines(value) })}
        />
        <ArrayInput
          label="Pinned notes"
          value={client.pinnedNotes}
          onChange={(value) => onUpdateClient({ pinnedNotes: splitLines(value) })}
        />
      </div>
    </section>
  );
}

function ConversationPanel({
  client,
  messages,
  manualReply,
  onManualReply,
  onSendManualReply,
  onReleaseHumanTakeover,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
  onOpenSimulator,
}: {
  client: ClientRecord;
  messages: MessageRecord[];
  manualReply: string;
  onManualReply: (value: string) => void;
  onSendManualReply: () => void;
  onReleaseHumanTakeover: (clientId: string) => Promise<ManuAppState>;
  onApproveDraft: (messageId: string) => Promise<ManuAppState>;
  onEditAndSendDraft: (messageId: string, body: string) => Promise<ManuAppState>;
  onDismissDraft: (messageId: string) => Promise<ManuAppState>;
  onOpenSimulator: () => void;
}) {
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">{client.fullName}</h3>
            <p className="mt-1 text-sm text-stone-600">Conversation timeline with origin labels</p>
          </div>
          <button
            onClick={onOpenSimulator}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
            type="button"
          >
            <Bot size={16} />
            Simulate inbound
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {messages.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
              No messages yet. Run the simulator or send a manual reply.
            </p>
          ) : (
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                draftEdit={draftEdits[message.id] ?? message.body}
                onDraftEdit={(value) => setDraftEdits((current) => ({ ...current, [message.id]: value }))}
                onApproveDraft={async () => {
                  await onApproveDraft(message.id);
                  setDraftEdits((current) => removeKey(current, message.id));
                }}
                onEditAndSendDraft={async () => {
                  await onEditAndSendDraft(message.id, draftEdits[message.id] ?? message.body);
                  setDraftEdits((current) => removeKey(current, message.id));
                }}
                onDismissDraft={async () => {
                  await onDismissDraft(message.id);
                  setDraftEdits((current) => removeKey(current, message.id));
                }}
              />
            ))
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Manual reply</h3>
          <TextareaInput label="Reply body" value={manualReply} onChange={onManualReply} rows={5} />
          <button
            onClick={onSendManualReply}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
            type="button"
          >
            <Send size={16} />
            Save manual reply
          </button>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Current controls</h3>
          <div className="mt-3 space-y-2 text-sm">
            <InfoLine label="AI" value={`${client.aiStatus} / ${client.aiMode}`} />
            <InfoLine label="Persona" value={client.selectedPersonaId} />
            <InfoLine label="Takeover" value={client.humanTakeoverLocked ? "locked" : "open"} />
            <InfoLine label="Permission" value={client.channelPermission} />
          </div>
          {client.humanTakeoverLocked && (
            <button
              onClick={() => onReleaseHumanTakeover(client.id)}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
              type="button"
            >
              <ShieldCheck size={16} />
              Release takeover
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}

function SimulatorPanel({
  state,
  selectedClient,
  clients,
  simBody,
  simKey,
  isSimulating,
  onSelectClient,
  onSimBody,
  onSimKey,
  onRun,
  onOpenConversation,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  clients: ClientRecord[];
  simBody: string;
  simKey: string;
  isSimulating: boolean;
  onSelectClient: (clientId: string) => void;
  onSimBody: (value: string) => void;
  onSimKey: (value: string) => void;
  onRun: () => void;
  onOpenConversation: () => void;
}) {
  const last = state.lastSimulation;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-900">
            <Bot size={22} />
          </div>
          <div>
            <h3 className="text-xl font-semibold">Inbound simulator</h3>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              Runs the existing core orchestrator with local demo data. Real channels stay disconnected.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <SelectInput
            label="Client"
            value={selectedClient.id}
            onChange={onSelectClient}
            options={clients.map((client) => [client.id, client.fullName])}
          />
          <TextInput label="Idempotency key" value={simKey} onChange={onSimKey} />
          <TextareaInput label="Inbound message" value={simBody} onChange={onSimBody} rows={6} />
          <div className="flex flex-wrap gap-2">
            {scenarioMessages.map((scenario) => (
              <button
                key={scenario.label}
                onClick={() => onSimBody(scenario.body)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
                type="button"
              >
                {scenario.label}
              </button>
            ))}
          </div>
          <button
            onClick={onRun}
            disabled={isSimulating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-400"
            type="button"
          >
            <Activity size={17} />
            {isSimulating ? "Running..." : "Run inbound flow"}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Last result</h3>
          {last ? (
            <div className="mt-3 space-y-3">
              <Badge label={last.action} tone={last.action === "handoff" ? "red" : last.action === "sent" ? "emerald" : "amber"} />
              <div className="space-y-2 text-sm">
                <InfoLine label="Risk" value={last.risk || "-"} />
                <InfoLine label="Model" value={last.model || "no LLM call"} />
                <InfoLine label="Blocked" value={last.blockedReason || "-"} />
              </div>
              {last.reasons.length > 0 && (
                <div className="rounded-lg bg-stone-50 p-3 text-sm text-stone-700">{last.reasons.join(", ")}</div>
              )}
              {last.draft && <div className="rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">{last.draft}</div>}
              <button
                onClick={onOpenConversation}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                type="button"
              >
                <MessageSquareText size={16} />
                Open timeline
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">No local simulation has run in this browser state.</p>
          )}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold">Selected client gates</h3>
          <div className="mt-3 space-y-2 text-sm">
            <InfoLine label="AI" value={`${selectedClient.aiStatus} / ${selectedClient.aiMode}`} />
            <InfoLine label="Safety" value={selectedClient.mandatorySafetyComplete ? "complete" : "incomplete"} />
            <InfoLine label="Window" value={selectedClient.aiActiveFrom || selectedClient.aiActiveUntil ? "scheduled" : "always"} />
            <InfoLine label="Takeover" value={selectedClient.humanTakeoverLocked ? "locked" : "open"} />
          </div>
        </section>
      </aside>
    </div>
  );
}

function VoicePanel({
  state,
  rawInput,
  onRawInput,
  onAddSamples,
  onUpdateSampleStatus,
  onGenerateProfile,
}: {
  state: ManuAppState;
  rawInput: string;
  onRawInput: (value: string) => void;
  onAddSamples: () => void;
  onUpdateSampleStatus: (sampleId: string, status: "draft" | "approved" | "rejected") => Promise<ManuAppState>;
  onGenerateProfile: () => Promise<ManuAppState>;
}) {
  const profile = state.voiceProfiles.find((item) => item.status === "generated");
  const approvedCount = state.voiceSamples.filter((sample) => sample.status === "approved").length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold">Dietitian voice samples</h3>
        <TextareaInput
          label="Paste samples"
          value={rawInput}
          onChange={onRawInput}
          rows={8}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onAddSamples}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
            type="button"
          >
            <Plus size={16} />
            Add samples
          </button>
          <button
            onClick={onGenerateProfile}
            className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700"
            type="button"
          >
            <SlidersHorizontal size={16} />
            Generate profile
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {state.voiceSamples.map((sample) => (
            <div key={sample.id} className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-stone-700">{sample.body}</p>
                <Badge label={sample.status} tone={sample.status === "approved" ? "emerald" : "stone"} />
              </div>
              <div className="mt-2 flex gap-2">
                {(["approved", "rejected"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => onUpdateSampleStatus(sample.id, status)}
                    className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700"
                    type="button"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold">Voice profile</h4>
        <p className="mt-2 text-sm text-stone-600">Approved samples: {approvedCount}/10 minimum</p>
        {profile ? (
          <div className="mt-3 space-y-2 text-sm text-stone-700">
            <p>Version: {profile.profileVersion}</p>
            <p>Formality: {profile.formality}</p>
            <p>Emoji: {profile.emojiPolicy}</p>
            <p>{profile.styleNotes}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-stone-500">No generated voice profile yet.</p>
        )}
      </aside>
    </div>
  );
}

function FormsPanel({
  state,
  selectedClient,
  schemaTitle,
  schemaFieldsRaw,
  formAnswersRaw,
  onSchemaTitle,
  onSchemaFieldsRaw,
  onFormAnswersRaw,
  onCreateSchema,
  onPublishSchema,
  onSaveResponse,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  schemaTitle: string;
  schemaFieldsRaw: string;
  formAnswersRaw: string;
  onSchemaTitle: (value: string) => void;
  onSchemaFieldsRaw: (value: string) => void;
  onFormAnswersRaw: (value: string) => void;
  onCreateSchema: () => void;
  onPublishSchema: (schemaId: string) => Promise<ManuAppState>;
  onSaveResponse: () => void;
}) {
  const activeSchema = [...state.clientFormSchemas]
    .filter((schema) => schema.status === "published")
    .sort((a, b) => b.version - a.version)[0];
  const response = activeSchema
    ? state.clientFormResponses.find((item) => item.clientId === selectedClient.id && item.schemaId === activeSchema.id)
    : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold">Dynamic form schemas</h3>
        <div className="mt-3 space-y-3">
          <TextInput label="Schema title" value={schemaTitle} onChange={onSchemaTitle} />
          <TextareaInput label="Fields" value={schemaFieldsRaw} onChange={onSchemaFieldsRaw} rows={6} />
          <button
            onClick={onCreateSchema}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white"
            type="button"
          >
            <Plus size={16} />
            Create schema
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {state.clientFormSchemas.map((schema) => (
            <div key={schema.id} className="rounded-lg border border-stone-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{schema.title}</p>
                  <p className="text-xs text-stone-500">v{schema.version} · {schema.fields.length} fields</p>
                </div>
                <Badge label={schema.status} tone={schema.status === "published" ? "emerald" : "stone"} />
              </div>
              {schema.status === "draft" && (
                <button
                  onClick={() => onPublishSchema(schema.id)}
                  className="mt-2 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700"
                  type="button"
                >
                  Publish
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold">{selectedClient.fullName} form response</h3>
        {activeSchema ? (
          <>
            <p className="mt-1 text-sm text-stone-600">{activeSchema.title} v{activeSchema.version}</p>
            <TextareaInput label="Answers" value={formAnswersRaw} onChange={onFormAnswersRaw} rows={8} />
            <button
              onClick={onSaveResponse}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white"
              type="button"
            >
              <Check size={16} />
              Save response
            </button>
            {response && (
              <pre className="mt-4 overflow-auto rounded-lg bg-stone-100 p-3 text-xs text-stone-700">
                {JSON.stringify(response.answers, null, 2)}
              </pre>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Publish a form schema before saving responses.</p>
        )}
      </section>
    </div>
  );
}

function CopilotPanel({
  state,
  selectedClient,
  input,
  isSending,
  onInput,
  onAsk,
}: {
  state: ManuAppState;
  selectedClient: ClientRecord;
  input: string;
  isSending: boolean;
  onInput: (value: string) => void;
  onAsk: (body?: string) => void;
}) {
  const messages = state.internalCopilotMessages.slice(-40);
  const quickPrompts = [
    `${selectedClient.fullName} son durumu`,
    `${selectedClient.fullName} diyet plan ozeti`,
    `${selectedClient.fullName} son mesajlari`,
    `${selectedClient.fullName} acik handoff var mi?`,
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-semibold">Internal read-only copilot</h3>
            <p className="mt-1 text-sm text-stone-600">
              Tenant-scoped database tools only. No client message sending or record mutation.
            </p>
          </div>
          <Badge label="mock/local" tone="amber" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => onAsk(prompt)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-[360px] space-y-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
          {messages.length === 0 ? (
            <p className="p-4 text-sm text-stone-500">
              Ask about visible client status, diet plan, recent messages, form responses, handoffs, or AI decisions.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`max-w-3xl rounded-lg border p-3 ${
                  message.role === "user"
                    ? "ml-auto border-emerald-200 bg-emerald-50"
                    : "border-stone-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">{message.role}</p>
                  <Badge
                    label={message.safetyStatus}
                    tone={message.safetyStatus === "ok" ? "emerald" : message.safetyStatus === "unsupported" ? "stone" : "amber"}
                  />
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-800">{message.body}</p>
                {message.sourceRefs.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.sourceRefs.map((ref) => (
                      <span
                        key={`${ref.entityType}-${ref.entityId}`}
                        className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs font-medium text-stone-600"
                      >
                        {ref.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={input}
            onChange={(event) => onInput(event.target.value)}
            className="min-h-11 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
            placeholder={`${selectedClient.fullName} son durumu`}
          />
          <button
            onClick={() => onAsk()}
            disabled={isSending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            <Send size={16} />
            Ask
          </button>
        </div>
      </section>

      <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h4 className="text-sm font-semibold">Read-only guarantees</h4>
        <div className="mt-3 space-y-3 text-sm text-stone-600">
          <p>Tools read only from visible scoped app state.</p>
          <p>Assistant and auditor roles are blocked from copilot chat in v1.</p>
          <p>Client messages and form answers are treated as untrusted data, not instructions.</p>
          <p>Every assistant answer is stored with tool calls and source references.</p>
        </div>
      </aside>
    </div>
  );
}

function HandoffsPanel({
  state,
  onSelectClient,
  onResolveHandoff,
  onDismissHandoff,
}: {
  state: ManuAppState;
  onSelectClient: (clientId: string) => void;
  onResolveHandoff: (handoffId: string) => Promise<ManuAppState>;
  onDismissHandoff: (handoffId: string) => Promise<ManuAppState>;
}) {
  const handoffs = state.handoffCases.filter((handoff) => handoff.status === "open");

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Handoff queue</h3>
          <p className="mt-1 text-sm text-stone-600">Red and guard-blocked flows land here for dietitian review.</p>
        </div>
        <Badge label={`${handoffs.length} open`} tone={handoffs.length > 0 ? "red" : "emerald"} />
      </div>

      <div className="mt-5 space-y-3">
        {handoffs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
            No open handoff cases.
          </p>
        ) : (
          handoffs.map((handoff) => {
            const client = state.clients.find((item) => item.id === handoff.clientId);
            return (
              <div
                key={handoff.id}
                className="w-full rounded-lg border border-stone-200 p-4 text-left"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge label={handoff.urgency} tone={handoff.urgency === "urgent" ? "red" : "amber"} />
                      <span className="font-semibold">{client?.fullName || handoff.clientId}</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-700">{handoff.reasons.join(", ") || handoff.risk}</p>
                    <p className="mt-2 text-sm text-stone-600">{handoff.recommendedAction}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => onSelectClient(handoff.clientId)}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100"
                        type="button"
                      >
                        Open client
                      </button>
                      <button
                        onClick={() => onResolveHandoff(handoff.id)}
                        className="rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                        type="button"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={() => onDismissHandoff(handoff.id)}
                        className="rounded-lg bg-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-300"
                        type="button"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <Clock3 size={18} className="text-stone-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  tone: "emerald" | "amber" | "red" | "stone";
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">{label}</p>
        <span className={toneClass(tone, "icon")}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function WorkflowItem({ icon: Icon, title, body }: { icon: typeof Activity; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div className="flex items-center gap-2 font-semibold">
        <Icon size={17} className="text-emerald-800" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
    </div>
  );
}

function ClientSummary({ client, compact = false }: { client: ClientRecord; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate font-semibold">{client.fullName}</p>
        <Badge label={client.aiStatus} tone={client.aiStatus === "active" ? "emerald" : "stone"} />
      </div>
      <div className={`mt-2 flex flex-wrap gap-1.5 ${compact ? "text-xs" : "text-sm"}`}>
        <Badge label={client.aiMode} tone={client.aiMode === "autopilot" ? "emerald" : "amber"} />
        <Badge label={client.selectedPersonaId} tone="stone" />
        {client.humanTakeoverLocked && <Badge label="takeover" tone="red" />}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  draftEdit,
  onDraftEdit,
  onApproveDraft,
  onEditAndSendDraft,
  onDismissDraft,
}: {
  message: MessageRecord;
  draftEdit: string;
  onDraftEdit: (value: string) => void;
  onApproveDraft: () => void;
  onEditAndSendDraft: () => void;
  onDismissDraft: () => void;
}) {
  const isClient = message.sender === "client";
  const isAssistant = message.sender === "assistant";
  const isDraft = message.origin === "ai_generated" && message.status === "draft";
  return (
    <div className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[min(720px,100%)] rounded-lg border p-3 shadow-sm ${
          isAssistant
            ? "border-emerald-200 bg-emerald-50"
            : isClient
              ? "border-stone-200 bg-white"
              : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={originLabel(message.origin)} tone={originTone(message.origin)} />
          {message.risk && <Badge label={message.risk} tone={message.risk === "red" ? "red" : message.risk === "yellow" ? "amber" : "emerald"} />}
          {message.status && <Badge label={message.status} tone="stone" />}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-stone-900">{message.body}</p>
        {isDraft && (
          <div className="mt-3 border-t border-emerald-200 pt-3">
            <TextareaInput label="Draft edit" value={draftEdit} onChange={onDraftEdit} rows={3} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onApproveDraft}
                className="rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900"
                type="button"
              >
                Approve
              </button>
              <button
                onClick={onEditAndSendDraft}
                className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                type="button"
              >
                Edit & send
              </button>
              <button
                onClick={onDismissDraft}
                className="rounded-lg bg-stone-200 px-3 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-300"
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-stone-500">{formatTime(message.createdAt)}</p>
      </div>
    </div>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  tone: "emerald" | "amber" | "stone";
}) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${toneClass(tone, "soft")}`}>
      <Icon size={16} />
      {label}
    </span>
  );
}

function Badge({ label, tone }: { label: string; tone: "emerald" | "amber" | "red" | "stone" }) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-md px-2 py-1 text-xs font-semibold ${toneClass(tone, "soft")}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function DateTimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function TextareaInput({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function ArrayInput({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string) => void }) {
  return <TextareaInput label={label} value={value.join("\n")} onChange={onChange} rows={5} />;
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none transition focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <div className="mt-1 grid gap-1 rounded-lg bg-stone-100 p-1 sm:grid-cols-2 xl:grid-cols-4">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            onClick={() => onChange(optionValue)}
            className={`rounded-md px-2 py-2 text-sm font-semibold transition ${
              value === optionValue ? "bg-white text-emerald-950 shadow-sm" : "text-stone-600 hover:bg-stone-200"
            }`}
            type="button"
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 rounded border-stone-300 text-emerald-900"
      />
    </label>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
      <span className="text-stone-500">{label}</span>
      <span className="max-w-[65%] truncate font-medium text-stone-900">{value}</span>
    </div>
  );
}

function splitLines(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSchemaFields(raw: string): ClientFormFieldDefinition[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, label, type = "text", visibility = "never", required = "false", options = ""] = line
        .split("|")
        .map((part) => part.trim());
      return {
        id,
        label: label || id,
        type: type as ClientFormFieldDefinition["type"],
        required: required === "true",
        llmVisibility: visibility === "prompt_allowed" ? ("prompt_allowed" as const) : ("never" as const),
        options: options ? splitLines(options) : undefined,
      };
    })
    .filter((field) => field.id && field.label);
}

function parseAnswerLines(raw: string) {
  return Object.fromEntries(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [key, ...valueParts] = line.split(":");
        return [key.trim(), valueParts.join(":").trim()];
      })
      .filter(([key]) => key),
  );
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function removeKey<T>(record: Record<string, T>, key: string) {
  const next = { ...record };
  delete next[key];
  return next;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function originLabel(origin: MessageRecord["origin"]) {
  const labels: Record<MessageRecord["origin"], string> = {
    client_inbound: "Client",
    ai_generated: "AI",
    dietitian_manual: "Dietitian",
    system_event: "System",
    imported_unknown: "Imported",
  };
  return labels[origin];
}

function originTone(origin: MessageRecord["origin"]) {
  if (origin === "ai_generated") return "emerald";
  if (origin === "dietitian_manual") return "amber";
  if (origin === "system_event") return "stone";
  return "stone";
}

function toneClass(tone: "emerald" | "amber" | "red" | "stone", mode: "soft" | "icon") {
  const classes = {
    soft: {
      emerald: "bg-emerald-100 text-emerald-950",
      amber: "bg-amber-100 text-amber-950",
      red: "bg-red-100 text-red-950",
      stone: "bg-stone-100 text-stone-700",
    },
    icon: {
      emerald: "text-emerald-700",
      amber: "text-amber-700",
      red: "text-red-700",
      stone: "text-stone-500",
    },
  };
  return classes[mode][tone];
}
