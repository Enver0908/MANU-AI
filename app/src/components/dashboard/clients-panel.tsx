"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ClipboardList,
  Database,
  Download,
  FileText,
  PhoneCall,
  Plus,
  Search,
  Send,
  UserX,
  UtensilsCrossed,
} from "lucide-react";
import { personas } from "dietitian-ai-assistant-architecture";
import {
  isSafetyChecklistComplete,
  normalizeSafetyChecklist,
  safetyChecklistLabels,
} from "@/lib/safety-checklist";
import type {
  AiMode,
  AiStatus,
  Channel,
  ClientContextUpdateImportance,
  ClientContextUpdateRecord,
  ClientContextUpdateSource,
  ClientRecord,
  ManuAppState,
  Phase77FMenuPlanTemplateType,
  SafetyChecklist,
} from "@/lib/types";
import type { ClientFoodRuleProfileV2State } from "@/lib/phase-77e-client-food-rule-profile";
import type { ClientMenuPlanV1State } from "@/lib/phase-77f-client-menu-plan";
import {
  buildMenuPlanExportPreviewText,
  deriveMenuPlanExportFromSummarySource,
} from "@/lib/phase-77j-menu-plan-export";
import { FoodRulesPanel } from "@/components/food-rules-panel";
import { MenuPlanPanel } from "@/components/menu-plan-panel";
import { t, type DashboardMessageKey } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import {
  ArrayInput,
  Badge,
  ClientSummary,
  ConfirmButton,
  ConflictSummaryBox,
  DateTimeInput,
  EmptyState,
  SegmentedControl,
  SelectInput,
  TextInput,
  TextareaInput,
  ToggleRow,
  formatTime,
  fromDateTimeLocal,
  languageOptions,
  sourceLabel,
  splitLines,
  toDateTimeLocal,
  type ClientDetailTab,
} from "./shared";

export function ClientsPanel({
  clients,
  selectedClient,
  search,
  newClientName,
  newClientChannel,
  newClientHandle,
  newClientPhone,
  newClientLanguage,
  uiLanguage,
  onSearch,
  onSelect,
  onAddClient,
  onNewClientName,
  onNewClientChannel,
  onNewClientHandle,
  onNewClientPhone,
  onNewClientLanguage,
  onUpdateClient,
  onRemoveClient,
  contextUpdates,
  contextUpdateSource,
  contextUpdateImportance,
  contextUpdateOccurredAt,
  contextUpdateTitle,
  contextUpdateSummary,
  contextUpdateDetails,
  onContextUpdateSource,
  onContextUpdateImportance,
  onContextUpdateOccurredAt,
  onContextUpdateTitle,
  onContextUpdateSummary,
  onContextUpdateDetails,
  onAddContextUpdate,
  clientDetailTab,
  onClientDetailTab,
  state,
  foodRuleProfile,
  menuPlans,
  activeMenuPlanId,
  onSaveFoodRules,
  onCreateMenuPlan,
  onSaveMenuPlan,
  onActivateMenuPlan,
  copilotInput,
  isCopilotSending,
  onCopilotInput,
  onAskCopilot,
}: {
  clients: ClientRecord[];
  selectedClient: ClientRecord;
  search: string;
  newClientName: string;
  newClientChannel: Channel;
  newClientHandle: string;
  newClientPhone: string;
  newClientLanguage: SupportedLanguageCode;
  uiLanguage: SupportedLanguageCode;
  onSearch: (value: string) => void;
  onSelect: (clientId: string) => void;
  onAddClient: () => void;
  onNewClientName: (value: string) => void;
  onNewClientChannel: (value: Channel) => void;
  onNewClientHandle: (value: string) => void;
  onNewClientPhone: (value: string) => void;
  onNewClientLanguage: (value: SupportedLanguageCode) => void;
  onUpdateClient: (patch: Partial<ClientRecord>) => void;
  onRemoveClient: () => void;
  contextUpdates: ClientContextUpdateRecord[];
  contextUpdateSource: ClientContextUpdateSource;
  contextUpdateImportance: ClientContextUpdateImportance;
  contextUpdateOccurredAt: string;
  contextUpdateTitle: string;
  contextUpdateSummary: string;
  contextUpdateDetails: string;
  onContextUpdateSource: (value: ClientContextUpdateSource) => void;
  onContextUpdateImportance: (value: ClientContextUpdateImportance) => void;
  onContextUpdateOccurredAt: (value: string) => void;
  onContextUpdateTitle: (value: string) => void;
  onContextUpdateSummary: (value: string) => void;
  onContextUpdateDetails: (value: string) => void;
  onAddContextUpdate: () => void;
  clientDetailTab: ClientDetailTab;
  onClientDetailTab: (tab: ClientDetailTab) => void;
  state: ManuAppState;
  foodRuleProfile: ClientFoodRuleProfileV2State | null;
  menuPlans: ClientMenuPlanV1State[];
  activeMenuPlanId: string | null;
  onSaveFoodRules: (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => Promise<void>;
  onCreateMenuPlan: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSaveMenuPlan: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivateMenuPlan: (planId: string) => Promise<void>;
  copilotInput: string;
  isCopilotSending: boolean;
  onCopilotInput: (value: string) => void;
  onAskCopilot: (body?: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <section className="space-y-3">
        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-base text-stone-600 sm:text-sm">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              className="min-w-0 flex-1 bg-transparent text-stone-900 outline-none placeholder:text-stone-400"
              placeholder={t(uiLanguage, "searchClients")}
            />
          </label>
        </div>

        <div className="space-y-2">
          {clients.length === 0 ? (
            <EmptyState
              title="Sonuç yok"
              message={search.trim() ? "Aramanızla eşleşen danışan bulunamadı." : "Henüz danışan yok. Aşağıdan yeni kayıt ekleyin."}
            />
          ) : (
            clients.map((client) => (
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
          ))
          )}
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
          <h3 className="text-sm font-semibold">Create client</h3>
          <div className="mt-3 space-y-2">
            <TextInput label={t(uiLanguage, "fullName")} value={newClientName} onChange={onNewClientName} />
            <TextInput label={t(uiLanguage, "primaryPhone")} value={newClientPhone} onChange={onNewClientPhone} keyboard="tel" />
            <SelectInput
              label={t(uiLanguage, "clientLanguage")}
              value={newClientLanguage}
              onChange={(value) => onNewClientLanguage(value as SupportedLanguageCode)}
              options={languageOptions}
            />
            <SelectInput
              label={t(uiLanguage, "channel")}
              value={newClientChannel}
              onChange={(value) => onNewClientChannel(value as Channel)}
              options={[
                ["whatsapp", "WhatsApp"],
                ["telegram", "Telegram"],
              ]}
            />
            <TextInput label={t(uiLanguage, "channelId")} value={newClientHandle} onChange={onNewClientHandle} />
            <button
              onClick={onAddClient}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
              type="button"
            >
              <Plus size={16} />
              {t(uiLanguage, "addClient")}
            </button>
          </div>
        </div>
      </section>

      <ClientDetailForm
        client={selectedClient}
        uiLanguage={uiLanguage}
        onUpdateClient={onUpdateClient}
        onRemoveClient={onRemoveClient}
        contextUpdates={contextUpdates}
        contextUpdateSource={contextUpdateSource}
        contextUpdateImportance={contextUpdateImportance}
        contextUpdateOccurredAt={contextUpdateOccurredAt}
        contextUpdateTitle={contextUpdateTitle}
        contextUpdateSummary={contextUpdateSummary}
        contextUpdateDetails={contextUpdateDetails}
        onContextUpdateSource={onContextUpdateSource}
        onContextUpdateImportance={onContextUpdateImportance}
        onContextUpdateOccurredAt={onContextUpdateOccurredAt}
        onContextUpdateTitle={onContextUpdateTitle}
        onContextUpdateSummary={onContextUpdateSummary}
        onContextUpdateDetails={onContextUpdateDetails}
        onAddContextUpdate={onAddContextUpdate}
        activeTab={clientDetailTab}
        onTabChange={onClientDetailTab}
        state={state}
        foodRuleProfile={foodRuleProfile}
        menuPlans={menuPlans}
        activeMenuPlanId={activeMenuPlanId}
        onSaveFoodRules={onSaveFoodRules}
        onCreateMenuPlan={onCreateMenuPlan}
        onSaveMenuPlan={onSaveMenuPlan}
        onActivateMenuPlan={onActivateMenuPlan}
        copilotInput={copilotInput}
        isCopilotSending={isCopilotSending}
        onCopilotInput={onCopilotInput}
        onAskCopilot={onAskCopilot}
      />
    </div>
  );
}

function ClientDetailForm({
  client,
  uiLanguage,
  onUpdateClient,
  onRemoveClient,
  contextUpdates,
  contextUpdateSource,
  contextUpdateImportance,
  contextUpdateOccurredAt,
  contextUpdateTitle,
  contextUpdateSummary,
  contextUpdateDetails,
  onContextUpdateSource,
  onContextUpdateImportance,
  onContextUpdateOccurredAt,
  onContextUpdateTitle,
  onContextUpdateSummary,
  onContextUpdateDetails,
  onAddContextUpdate,
  activeTab,
  onTabChange,
  state,
  foodRuleProfile,
  menuPlans,
  activeMenuPlanId,
  onSaveFoodRules,
  onCreateMenuPlan,
  onSaveMenuPlan,
  onActivateMenuPlan,
  copilotInput,
  isCopilotSending,
  onCopilotInput,
  onAskCopilot,
}: {
  client: ClientRecord;
  uiLanguage: SupportedLanguageCode;
  onUpdateClient: (patch: Partial<ClientRecord>) => void;
  onRemoveClient: () => void;
  contextUpdates: ClientContextUpdateRecord[];
  contextUpdateSource: ClientContextUpdateSource;
  contextUpdateImportance: ClientContextUpdateImportance;
  contextUpdateOccurredAt: string;
  contextUpdateTitle: string;
  contextUpdateSummary: string;
  contextUpdateDetails: string;
  onContextUpdateSource: (value: ClientContextUpdateSource) => void;
  onContextUpdateImportance: (value: ClientContextUpdateImportance) => void;
  onContextUpdateOccurredAt: (value: string) => void;
  onContextUpdateTitle: (value: string) => void;
  onContextUpdateSummary: (value: string) => void;
  onContextUpdateDetails: (value: string) => void;
  onAddContextUpdate: () => void;
  activeTab: ClientDetailTab;
  onTabChange: (tab: ClientDetailTab) => void;
  state: ManuAppState;
  foodRuleProfile: ClientFoodRuleProfileV2State | null;
  menuPlans: ClientMenuPlanV1State[];
  activeMenuPlanId: string | null;
  onSaveFoodRules: (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => Promise<void>;
  onCreateMenuPlan: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSaveMenuPlan: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivateMenuPlan: (planId: string) => Promise<void>;
  copilotInput: string;
  isCopilotSending: boolean;
  onCopilotInput: (value: string) => void;
  onAskCopilot: (body?: string) => void;
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

  const foodRuleConflictCount = foodRuleProfile?.conflicts?.length || 0;
  const menuConflictCount = menuPlans.reduce((sum, plan) => sum + (plan.conflicts?.length || 0), 0);
  const activeContextCount = contextUpdates.filter((u) => u.status === "active").length;

  const tabItems: Array<{ key: ClientDetailTab; labelKey: DashboardMessageKey; icon: typeof Activity; badge?: string }> = [
    { key: "tab_overview", labelKey: "tabOverview", icon: Activity },
    { key: "tab_personal_form", labelKey: "tabPersonalForm", icon: FileText },
    { key: "tab_food_rules", labelKey: "tabFoodRules", icon: UtensilsCrossed, badge: foodRuleConflictCount > 0 ? String(foodRuleConflictCount) : undefined },
    { key: "tab_menu", labelKey: "tabMenu", icon: ClipboardList, badge: activeMenuPlanId ? undefined : "!" },
    { key: "tab_critical_context", labelKey: "tabCriticalContext", icon: PhoneCall, badge: activeContextCount > 0 ? String(activeContextCount) : undefined },
    { key: "tab_copilot", labelKey: "tabAiCopilot", icon: Database },
    { key: "tab_export", labelKey: "tabExport", icon: Download },
  ];

  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-sm" data-testid="client-detail">
      <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold">{client.fullName}</h3>
          <p className="mt-1 text-sm text-stone-600">
            {client.channel} · {client.channelUserId || "No channel ID"} · {client.communicationLanguage}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={client.aiStatus} tone={client.aiStatus === "active" ? "emerald" : "stone"} />
          <Badge label={client.aiMode} tone={client.aiMode === "autopilot" ? "emerald" : "amber"} />
          <Badge label={client.channelPermission} tone={client.channelPermission === "ready" ? "emerald" : "amber"} />
          <ConfirmButton
            label="Remove client"
            confirmLabel="Kaldırmayı onayla"
            onConfirm={onRemoveClient}
            icon={UserX}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            confirmClassName="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
          />
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-stone-200 px-4 pt-1" data-testid="client-detail-tabs">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-emerald-700 text-emerald-900"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-800"
              }`}
              type="button"
              data-testid={`tab-${tab.key}`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{t(uiLanguage, tab.labelKey)}</span>
              {tab.badge && (
                <span className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                  tab.badge === "!" ? "bg-amber-100 text-amber-800" : "bg-stone-200 text-stone-700"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4">
        {activeTab === "tab_overview" && (
          <div className="grid gap-4 xl:grid-cols-2">
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
            <div className="space-y-4">
              <div className="rounded-lg border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-stone-800">Güvenlik kontrol listesi</p>
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
              <ClientDetailStatusSummary
                uiLanguage={uiLanguage}
                foodRuleConflicts={foodRuleConflictCount}
                menuConflicts={menuConflictCount}
                hasActiveMenu={!!activeMenuPlanId}
                activeContextCount={activeContextCount}
                onNavigate={onTabChange}
              />
            </div>
          </div>
        )}

        {activeTab === "tab_personal_form" && (
          <div className="space-y-4">
            <fieldset className="rounded-lg border border-stone-200 p-4">
              <legend className="px-1 text-sm font-semibold">Profile and channel</legend>
              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <TextInput label={t(uiLanguage, "fullName")} value={client.fullName} onChange={(value) => onUpdateClient({ fullName: value })} />
                <TextInput
                  label={t(uiLanguage, "primaryPhone")}
                  value={client.primaryPhoneE164 || ""}
                  onChange={(value) => onUpdateClient({ primaryPhoneE164: value })}
                />
                <SelectInput
                  label={t(uiLanguage, "clientLanguage")}
                  value={client.communicationLanguage}
                  onChange={(value) => onUpdateClient({ communicationLanguage: value as SupportedLanguageCode })}
                  options={languageOptions}
                />
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
            <div className="grid gap-4 xl:grid-cols-3">
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
          </div>
        )}

        {activeTab === "tab_food_rules" && (
          <div className="space-y-4">
            {foodRuleProfile ? (
              <>
                {foodRuleProfile.conflicts.length > 0 && (
                  <ConflictSummaryBox conflicts={foodRuleProfile.conflicts.map((c) => c.message)} />
                )}
                <FoodRulesPanel
                  key={`${client.id}-${foodRuleProfile.revision}`}
                  clientName={client.fullName}
                  contextRevision={client.contextRevision}
                  initialProfile={foodRuleProfile}
                  disabled={client.lifecycleStatus === "removed_anonymized"}
                  onSave={onSaveFoodRules}
                />
              </>
            ) : (
              <EmptyState message={t(uiLanguage, "noFoodRulesYet")} />
            )}
          </div>
        )}

        {activeTab === "tab_menu" && (
          <div className="space-y-4">
            {menuPlans.length > 0 && menuConflictCount > 0 && (
              <ConflictSummaryBox
                conflicts={menuPlans.flatMap((p) => (p.conflicts || []).map((c) => c.message))}
              />
            )}
            <MenuPlanPanel
              key={`${client.id}-menu-${activeMenuPlanId || "none"}-${menuPlans[0]?.revision || 0}`}
              clientName={client.fullName}
              plans={menuPlans}
              activePlanId={activeMenuPlanId}
              disabled={client.lifecycleStatus === "removed_anonymized"}
              onCreate={onCreateMenuPlan}
              onSave={onSaveMenuPlan}
              onActivate={onActivateMenuPlan}
            />
          </div>
        )}

        {activeTab === "tab_critical_context" && (
          <ClientContextUpdatePanel
            updates={contextUpdates}
            source={contextUpdateSource}
            importance={contextUpdateImportance}
            occurredAt={contextUpdateOccurredAt}
            title={contextUpdateTitle}
            summary={contextUpdateSummary}
            details={contextUpdateDetails}
            onSource={onContextUpdateSource}
            onImportance={onContextUpdateImportance}
            onOccurredAt={onContextUpdateOccurredAt}
            onTitle={onContextUpdateTitle}
            onSummary={onContextUpdateSummary}
            onDetails={onContextUpdateDetails}
            onAdd={onAddContextUpdate}
          />
        )}

        {activeTab === "tab_copilot" && (
          <ClientScopedCopilotTab
            client={client}
            state={state}
            input={copilotInput}
            isSending={isCopilotSending}
            onInput={onCopilotInput}
            onAsk={onAskCopilot}
          />
        )}

        {activeTab === "tab_export" && (
          <ClientExportTab
            client={client}
            uiLanguage={uiLanguage}
            foodRuleProfile={foodRuleProfile}
            menuPlans={menuPlans}
            activeMenuPlanId={activeMenuPlanId}
            contextUpdates={contextUpdates}
          />
        )}
      </div>
    </section>
  );
}

function ClientDetailStatusSummary({
  uiLanguage,
  foodRuleConflicts,
  menuConflicts,
  hasActiveMenu,
  activeContextCount,
  onNavigate,
}: {
  uiLanguage: SupportedLanguageCode;
  foodRuleConflicts: number;
  menuConflicts: number;
  hasActiveMenu: boolean;
  activeContextCount: number;
  onNavigate: (tab: ClientDetailTab) => void;
}) {
  return (
    <div className="rounded-lg border border-stone-200 p-4" data-testid="status-summary">
      <p className="text-sm font-semibold text-stone-800">Status</p>
      <div className="mt-3 space-y-2">
        <button type="button" onClick={() => onNavigate("tab_food_rules")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-left text-sm transition hover:bg-stone-100">
          <span className="text-stone-600">{t(uiLanguage, "tabFoodRules")}</span>
          {foodRuleConflicts > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{foodRuleConflicts} {t(uiLanguage, "conflictsFound").toLowerCase()}</span>
          ) : (
            <span className="text-xs font-medium text-emerald-700">OK</span>
          )}
        </button>
        <button type="button" onClick={() => onNavigate("tab_menu")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-left text-sm transition hover:bg-stone-100">
          <span className="text-stone-600">{t(uiLanguage, "tabMenu")}</span>
          <span className="flex items-center gap-2">
            {menuConflicts > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{menuConflicts}</span>}
            <Badge label={hasActiveMenu ? t(uiLanguage, "activeMenu") : t(uiLanguage, "noActiveMenu")} tone={hasActiveMenu ? "emerald" : "amber"} />
          </span>
        </button>
        <button type="button" onClick={() => onNavigate("tab_critical_context")} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2 text-left text-sm transition hover:bg-stone-100">
          <span className="text-stone-600">{t(uiLanguage, "tabCriticalContext")}</span>
          <span className="text-xs font-medium text-stone-700">{activeContextCount} active</span>
        </button>
      </div>
    </div>
  );
}

function ClientScopedCopilotTab({
  client,
  state,
  input,
  isSending,
  onInput,
  onAsk,
}: {
  client: ClientRecord;
  state: ManuAppState;
  input: string;
  isSending: boolean;
  onInput: (value: string) => void;
  onAsk: (body?: string) => void;
}) {
  const messages = state.internalCopilotMessages.slice(-20);
  const quickPrompts = [
    `${client.fullName} son durumu`,
    `${client.fullName} diyet plan ozeti`,
    `${client.fullName} besin kurallari`,
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
      <div className="min-h-[240px] space-y-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
        {messages.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">
            Ask about this client&apos;s status, diet plan, food rules, recent messages, or AI decisions.
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
              <p className="text-xs font-semibold uppercase text-stone-500">{message.role}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800">{message.body}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); onAsk(); } }}
          enterKeyHint="send"
          className="min-h-11 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-base outline-none transition focus:border-emerald-700 sm:text-sm"
          placeholder={`${client.fullName} hakkinda soru sor...`}
        />
        <button
          onClick={() => onAsk()}
          disabled={isSending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
        >
          <Send size={16} />
          Ask
        </button>
      </div>
    </div>
  );
}

function ClientExportTab({
  client,
  uiLanguage,
  foodRuleProfile,
  menuPlans,
  activeMenuPlanId,
  contextUpdates,
}: {
  client: ClientRecord;
  uiLanguage: SupportedLanguageCode;
  foodRuleProfile: ClientFoodRuleProfileV2State | null;
  menuPlans: ClientMenuPlanV1State[];
  activeMenuPlanId: string | null;
  contextUpdates: ClientContextUpdateRecord[];
}) {
  const [includeRecipes, setIncludeRecipes] = useState(true);
  const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(null);
  const activeMenu = menuPlans.find((p) => p.id === activeMenuPlanId);
  const hasData = !!foodRuleProfile || menuPlans.length > 0 || contextUpdates.length > 0;

  const exportPreview = useMemo(() => {
    if (!activeMenu || !activeMenu.exportVisible) return "";
    return buildMenuPlanExportPreviewText(
      deriveMenuPlanExportFromSummarySource(client, activeMenu, { includeRecipes }),
    );
  }, [activeMenu, client, includeRecipes]);

  const downloadMenuExport = async (format: "docx" | "pdf") => {
    if (!activeMenu || isDownloading) return;
    setIsDownloading(format);
    try {
      const params = new URLSearchParams({
        format,
        includeRecipes: includeRecipes ? "true" : "false",
        planId: activeMenu.id,
      });
      const response = await fetch(`/api/clients/${client.id}/menu-plans/export?${params.toString()}`);
      if (!response.ok) throw new Error(`export_failed_${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        response.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        `menu-plan.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(null);
    }
  };

  if (!hasData) {
    return <EmptyState message={t(uiLanguage, "exportNotReady")} />;
  }

  return (
    <div className="space-y-4" data-testid="export-tab">
      <h4 className="text-sm font-semibold">{t(uiLanguage, "exportSummaryTitle")}</h4>
      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-lg border border-stone-200 p-3">
          <p className="text-xs font-semibold uppercase text-stone-500">Profile</p>
          <div className="mt-2 space-y-1 text-sm text-stone-700">
            <p>{client.fullName} · {client.communicationLanguage}</p>
            <p>Goal: {client.healthProfile.goal || "-"}</p>
            <p>Allergies: {client.allergies.length > 0 ? client.allergies.join(", ") : "-"}</p>
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <p className="text-xs font-semibold uppercase text-stone-500">Food rules</p>
          <div className="mt-2 space-y-1 text-sm text-stone-700">
            {foodRuleProfile ? (
              <>
                <p>Forbidden foods: {foodRuleProfile.forbiddenCatalogFoodIds.length}</p>
                <p>Allowed foods: {foodRuleProfile.allowedCatalogFoodIds.length}</p>
                <p>Flexibility: {foodRuleProfile.flexibilityGlobal}</p>
              </>
            ) : (
              <p className="text-stone-500">Not configured</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <p className="text-xs font-semibold uppercase text-stone-500">Menu plan</p>
          <div className="mt-2 space-y-1 text-sm text-stone-700">
            {activeMenu ? (
              <>
                <p>Template: {activeMenu.templateType}</p>
                <p>Meals: {activeMenu.mealSlots.length}</p>
                <p>Status: Active</p>
              </>
            ) : (
              <p className="text-stone-500">{t(uiLanguage, "noActiveMenu")}</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-stone-200 p-3">
          <p className="text-xs font-semibold uppercase text-stone-500">Critical context</p>
          <div className="mt-2 text-sm text-stone-700">
            <p>{contextUpdates.filter((u) => u.status === "active").length} active entries</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-stone-200 p-4" data-testid="menu-export-panel">
        <h5 className="text-sm font-semibold">{t(uiLanguage, "exportMenuTitle")}</h5>
        {!activeMenu ? (
          <p className="mt-2 text-sm text-stone-500">{t(uiLanguage, "noActiveMenu")}</p>
        ) : !activeMenu.exportVisible ? (
          <p className="mt-2 text-sm text-amber-700">{t(uiLanguage, "exportMenuNotVisible")}</p>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={includeRecipes}
                onChange={(event) => setIncludeRecipes(event.target.checked)}
                data-testid="export-include-recipes"
              />
              {t(uiLanguage, "exportIncludeRecipes")}
            </label>
            <div>
              <p className="text-xs font-semibold uppercase text-stone-500">{t(uiLanguage, "exportPreviewTitle")}</p>
              <pre
                className="mt-2 max-h-48 overflow-auto rounded-md border border-stone-200 bg-stone-50 p-3 text-xs text-stone-700 whitespace-pre-wrap"
                data-testid="export-preview"
              >
                {exportPreview}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => downloadMenuExport("docx")}
                disabled={isDownloading !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="export-download-docx"
              >
                <Download size={16} />
                {t(uiLanguage, "exportDownloadDocx")}
              </button>
              <button
                type="button"
                onClick={() => downloadMenuExport("pdf")}
                disabled={isDownloading !== null}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="export-download-pdf"
              >
                <FileText size={16} />
                {t(uiLanguage, "exportDownloadPdf")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ClientContextUpdatePanel({
  updates,
  source,
  importance,
  occurredAt,
  title,
  summary,
  details,
  onSource,
  onImportance,
  onOccurredAt,
  onTitle,
  onSummary,
  onDetails,
  onAdd,
}: {
  updates: ClientContextUpdateRecord[];
  source: ClientContextUpdateSource;
  importance: ClientContextUpdateImportance;
  occurredAt: string;
  title: string;
  summary: string;
  details: string;
  onSource: (value: ClientContextUpdateSource) => void;
  onImportance: (value: ClientContextUpdateImportance) => void;
  onOccurredAt: (value: string) => void;
  onTitle: (value: string) => void;
  onSummary: (value: string) => void;
  onDetails: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <PhoneCall size={18} className="text-emerald-800" />
            <h4 className="text-sm font-semibold">Critical context</h4>
          </div>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Add dietitian-confirmed information from phone, Zoom, or face-to-face conversations.
          </p>
        </div>
        <Badge label={`${updates.filter((update) => update.status === "active").length} active`} tone="emerald" />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <SelectInput
          label="Source"
          value={source}
          onChange={(value) => onSource(value as ClientContextUpdateSource)}
          options={[
            ["phone", "Phone"],
            ["zoom", "Zoom"],
            ["in_person", "In person"],
            ["other", "Other"],
          ]}
        />
        <SelectInput
          label="Importance"
          value={importance}
          onChange={(value) => onImportance(value as ClientContextUpdateImportance)}
          options={[
            ["routine", "Routine"],
            ["important", "Important"],
            ["critical", "Critical"],
          ]}
        />
        <DateTimeInput label="Occurred at" value={occurredAt} onChange={onOccurredAt} />
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <TextInput label="Title" value={title} onChange={onTitle} />
        <TextareaInput label="Summary" value={summary} onChange={onSummary} rows={3} />
      </div>
      <div className="mt-3">
        <TextareaInput label="Details" value={details} onChange={onDetails} rows={4} />
      </div>
      <button
        onClick={onAdd}
        disabled={!title.trim() || !summary.trim()}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-stone-300"
        type="button"
      >
        <Plus size={16} />
        Add context
      </button>

      <div className="mt-4 grid gap-3">
        {updates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 bg-white p-4 text-sm text-stone-600">
            No dietitian context updates yet.
          </p>
        ) : (
          updates.slice(0, 5).map((update) => (
            <article key={update.id} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge label={sourceLabel(update.source)} tone="stone" />
                <Badge label={update.importance} tone={update.importance === "critical" ? "red" : "amber"} />
                <span className="text-xs font-medium text-stone-500">{formatTime(update.occurredAt)}</span>
              </div>
              <h5 className="mt-2 text-sm font-semibold text-stone-900">{update.title}</h5>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-stone-700">{update.summary}</p>
              {update.details && (
                <p className="mt-2 whitespace-pre-wrap break-words border-t border-stone-100 pt-2 text-sm leading-6 text-stone-500">
                  {update.details}
                </p>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
