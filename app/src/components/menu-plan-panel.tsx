"use client";

import { AlertTriangle, Check, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MenuWorkflowExportSection } from "@/components/dashboard/menu-workflow-export-section";
import {
  formatMenuPlanStatusLabel,
  getMenuTemplateLabel,
  hasHardMenuPlanConflicts,
  MENU_TEMPLATE_DESCRIPTIONS_TR,
  summarizeMenuWorkflow,
} from "@/lib/menu-workflow-panel-helpers";
import { searchPhase77DCatalogFoods } from "@/lib/phase-77e-client-food-rule-profile";
import {
  deriveDietPlanSummaryFromMenuPlan,
  PHASE_77F_MENU_PLAN_TEMPLATE_TYPES,
  type ClientMenuPlanV1State,
} from "@/lib/phase-77f-client-menu-plan";
import type { Phase77FMenuPlanTemplateType } from "@/lib/types";
import type { SupportedLanguageCode } from "@/lib/languages";

type MenuPlanPanelProps = {
  clientId: string;
  clientName: string;
  uiLanguage: SupportedLanguageCode;
  plans: ClientMenuPlanV1State[];
  activePlanId: string | null;
  disabled?: boolean;
  onCreate: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSave: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivate: (planId: string) => Promise<void>;
};

export function MenuPlanPanel({
  clientId,
  clientName,
  uiLanguage,
  plans,
  activePlanId,
  disabled = false,
  onCreate,
  onSave,
  onActivate,
}: MenuPlanPanelProps) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || activePlanId || "");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;
  const workflowSummary = useMemo(() => summarizeMenuWorkflow(plans, activePlanId), [plans, activePlanId]);

  if (!selectedPlan) {
    return (
      <section className="space-y-4" data-testid="menu-workflow-panel">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <h4 className="text-sm font-semibold text-stone-900">Menu</h4>
          <p className="mt-1 text-sm text-stone-600">{clientName} icin henuz menu plani yok.</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Dort sablon tipinden birini secerek yeni plan olusturun. Aktif plan legacy diyet ozetini kilitler.
          </p>
        </div>
        <TemplatePicker disabled={disabled} onCreate={onCreate} />
      </section>
    );
  }

  return (
    <MenuPlanPanelEditor
      key={`${clientId}-${selectedPlan.id}-${selectedPlan.revision}`}
      clientId={clientId}
      clientName={clientName}
      uiLanguage={uiLanguage}
      plans={plans}
      activePlanId={activePlanId}
      selectedPlan={selectedPlan}
      workflowSummary={workflowSummary}
      disabled={disabled}
      onSelectPlan={setSelectedPlanId}
      onCreate={onCreate}
      onSave={onSave}
      onActivate={onActivate}
    />
  );
}

function MenuPlanPanelEditor({
  clientId,
  clientName,
  uiLanguage,
  plans,
  activePlanId,
  selectedPlan,
  workflowSummary,
  disabled,
  onSelectPlan,
  onCreate,
  onSave,
  onActivate,
}: {
  clientId: string;
  clientName: string;
  uiLanguage: SupportedLanguageCode;
  plans: ClientMenuPlanV1State[];
  activePlanId: string | null;
  selectedPlan: ClientMenuPlanV1State;
  workflowSummary: ReturnType<typeof summarizeMenuWorkflow>;
  disabled?: boolean;
  onSelectPlan: (planId: string) => void;
  onCreate: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSave: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivate: (planId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(selectedPlan);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const catalogMatches = useMemo(() => searchPhase77DCatalogFoods(catalogQuery, 8), [catalogQuery]);
  const exportPreview = useMemo(() => {
    const { conflicts, ...record } = draft;
    void conflicts;
    return deriveDietPlanSummaryFromMenuPlan(record);
  }, [draft]);
  const activationBlocked = hasHardMenuPlanConflicts(draft.conflicts);
  const statusLabel = formatMenuPlanStatusLabel(draft, activePlanId, draft.id);

  const updateDraft = (patch: Partial<ClientMenuPlanV1State>) => {
    setDraft((current) => ({ ...current, ...patch, conflicts: current.conflicts }));
  };

  const updateSlot = (slotId: string, patch: Partial<ClientMenuPlanV1State["mealSlots"][number]>) => {
    updateDraft({
      mealSlots: draft.mealSlots.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot)),
    });
  };

  const addItemToSlot = (slotId: string, field: "items" | "alternatives", freeText: string, catalogFoodId?: string) => {
    const value = freeText.trim();
    if (!value) return;
    updateSlot(slotId, {
      [field]: [
        ...(draft.mealSlots.find((slot) => slot.id === slotId)?.[field] || []),
        {
          id: crypto.randomUUID(),
          label: "",
          freeText: value,
          catalogFoodIds: catalogFoodId ? [catalogFoodId] : [],
          catalogMatch: catalogFoodId
            ? { query: value, catalogFoodId, catalogFoodName: value, matchConfidence: "exact" as const }
            : null,
          portionNote: "",
          recipe: null,
        },
      ],
    });
  };

  const save = async () => {
    if (disabled || isSaving) return;
    setIsSaving(true);
    try {
      const { conflicts, ...payload } = draft;
      void conflicts;
      await onSave(payload);
    } finally {
      setIsSaving(false);
    }
  };

  const activate = async () => {
    if (disabled || isActivating || activationBlocked) return;
    setIsActivating(true);
    try {
      await onActivate(draft.id);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="menu-workflow-panel">
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-stone-900">Menu</h4>
            <p className="mt-1 text-sm text-stone-600">
              {clientName} · {getMenuTemplateLabel(draft.templateType)} · revizyon {draft.revision}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={disabled || isSaving}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="menu-workflow-save"
            >
              <Check size={16} />
              {isSaving ? "Kaydediliyor..." : "Plani kaydet"}
            </button>
            <button
              type="button"
              onClick={activate}
              disabled={disabled || isActivating || draft.status === "active" || activationBlocked}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="menu-workflow-activate"
            >
              {isActivating ? "Aktive ediliyor..." : "Plani aktive et"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SummaryBadge label={`Durum: ${statusLabel}`} tone={statusLabel === "Aktif" ? "active" : "neutral"} />
          <SummaryBadge label={`${workflowSummary.totalPlans} plan`} tone="neutral" />
          {workflowSummary.conflictCount > 0 && (
            <SummaryBadge label={`${workflowSummary.conflictCount} celiski`} tone="warning" />
          )}
          <SummaryBadge
            label={draft.exportVisible ? "Disa aktarim acik" : "Disa aktarim kapali"}
            tone={draft.exportVisible ? "active" : "neutral"}
          />
        </div>
        <p className="mt-3 text-sm leading-6 text-stone-600">{MENU_TEMPLATE_DESCRIPTIONS_TR[draft.templateType]}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelectPlan(plan.id)}
            className={`min-h-11 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              plan.id === draft.id ? "bg-stone-900 text-white" : "border border-stone-200 bg-white text-stone-700"
            }`}
          >
            {plan.title} · {formatMenuPlanStatusLabel(plan, activePlanId, plan.id)}
          </button>
        ))}
      </div>

      <TemplatePicker disabled={disabled} onCreate={onCreate} compact />

      {draft.conflicts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          {draft.conflicts.map((conflict) => (
            <p key={`${conflict.code}-${conflict.message}`} className="inline-flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {conflict.message}
            </p>
          ))}
          {activationBlocked ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-900">
              Yasakli besin/kategori celiskisi cozulmeden aktivasyon yapilamaz.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Plan basligi
          <input
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Gecerlilik tarihi
          <input
            type="date"
            value={draft.effectiveDate || ""}
            onChange={(event) => updateDraft({ effectiveDate: event.target.value || null })}
            className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-3">
        <label className="block text-sm font-semibold text-stone-900">Katalog arama</label>
        <div className="mt-2 flex min-h-11 items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
          <Search size={16} className="text-stone-400" />
          <input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="Ogun slotuna besin ekle"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {catalogMatches.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {catalogMatches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => {
                  const firstSlot = draft.mealSlots[0];
                  if (firstSlot) addItemToSlot(firstSlot.id, "items", match.name, match.id);
                }}
                className="min-h-11 rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700"
              >
                {match.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {draft.mealSlots.slice(0, draft.templateType === "day_by_day_detailed" ? 8 : draft.mealSlots.length).map((slot) => (
          <div key={slot.id} className="rounded-lg border border-stone-200 bg-white p-3">
            <p className="text-sm font-semibold text-stone-900">{slot.title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {slot.items.map((item) => (
                <span key={item.id} className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-800">
                  {item.freeText || item.catalogMatch?.catalogFoodName || item.label}
                </span>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                placeholder="Ogun ogesi ekle"
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    addItemToSlot(slot.id, "items", (event.target as HTMLInputElement).value);
                    (event.target as HTMLInputElement).value = "";
                  }
                }}
              />
            </div>
            {draft.templateType === "exchange_option_based" ? (
              <div className="mt-2">
                <p className="text-xs font-semibold text-stone-600">Alternatifler</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {slot.alternatives.map((item) => (
                    <span key={item.id} className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-800">
                      {item.freeText || item.catalogMatch?.catalogFoodName || item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {draft.templateType === "weekly_meal_framework" ? (
              <textarea
                value={slot.weeklyTargetNote}
                onChange={(event) => updateSlot(slot.id, { weeklyTargetNote: event.target.value })}
                rows={2}
                placeholder="Haftalik hedef notu"
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            ) : null}
          </div>
        ))}
      </div>

      {draft.templateType === "simple_guidance" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <TokenArea label="Tercih edilen besinler" values={draft.preferredFoods} onChange={(values) => updateDraft({ preferredFoods: values })} />
          <TokenArea label="Kacinilacak besinler" values={draft.avoidFoods} onChange={(values) => updateDraft({ avoidFoods: values })} />
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <textarea
          value={draft.dietitianNotes}
          onChange={(event) => updateDraft({ dietitianNotes: event.target.value })}
          rows={3}
          placeholder="Diyetisyen notlari"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <textarea
          value={draft.clientFacingNotes}
          onChange={(event) => updateDraft({ clientFacingNotes: event.target.value })}
          rows={3}
          placeholder="Danisana yonelik notlar"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={draft.exportVisible}
          onChange={(event) => updateDraft({ exportVisible: event.target.checked })}
          className="h-4 w-4 rounded border-stone-300"
          data-testid="menu-workflow-export-visible"
        />
        Disa aktarimda goster
      </label>

      <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-700">
        <p className="font-semibold text-stone-900">Turetilmis legacy ozet onizleme</p>
        <p className="mt-1 whitespace-pre-wrap">{exportPreview || "Kaydet veya aktive et."}</p>
      </div>

      <MenuWorkflowExportSection
        clientId={clientId}
        clientName={clientName}
        plan={draft}
        activePlanId={activePlanId}
        uiLanguage={uiLanguage}
      />
    </section>
  );
}

function TemplatePicker({
  disabled,
  onCreate,
  compact = false,
}: {
  disabled?: boolean;
  onCreate: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-3 ${compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2"}`} data-testid="menu-template-picker">
      {PHASE_77F_MENU_PLAN_TEMPLATE_TYPES.map((templateType) => (
        <button
          key={templateType}
          type="button"
          disabled={disabled}
          onClick={() => onCreate(templateType)}
          className={`rounded-lg border border-stone-200 bg-white text-left transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 ${
            compact ? "px-3 py-2" : "p-4"
          }`}
        >
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-stone-900">
            {!compact && <Plus size={14} />}
            {getMenuTemplateLabel(templateType)}
          </span>
          {!compact && (
            <p className="mt-2 text-sm leading-6 text-stone-600">{MENU_TEMPLATE_DESCRIPTIONS_TR[templateType]}</p>
          )}
        </button>
      ))}
    </div>
  );
}

function SummaryBadge({
  label,
  tone,
}: {
  label: string;
  tone: "active" | "warning" | "neutral";
}) {
  const classes =
    tone === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-stone-200 bg-white text-stone-700";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function TokenArea({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-sm font-semibold text-stone-900">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className="rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-800">
            {value}
          </span>
        ))}
      </div>
      <input
        placeholder={`${label} ekle`}
        className="mt-2 min-h-11 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          const value = (event.target as HTMLInputElement).value.trim();
          if (!value) return;
          onChange([...new Set([...values, value])]);
          (event.target as HTMLInputElement).value = "";
        }}
      />
    </div>
  );
}
