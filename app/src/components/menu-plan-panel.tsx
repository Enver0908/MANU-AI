"use client";

import { AlertTriangle, Check, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { searchPhase77DCatalogFoods } from "@/lib/phase-77e-client-food-rule-profile";
import {
  deriveDietPlanSummaryFromMenuPlan,
  PHASE_77F_MENU_PLAN_TEMPLATE_LABELS,
  PHASE_77F_MENU_PLAN_TEMPLATE_TYPES,
  type ClientMenuPlanV1State,
} from "@/lib/phase-77f-client-menu-plan";
import type { Phase77FMenuPlanTemplateType } from "@/lib/types";

type MenuPlanPanelProps = {
  clientName: string;
  plans: ClientMenuPlanV1State[];
  activePlanId: string | null;
  disabled?: boolean;
  onCreate: (templateType: Phase77FMenuPlanTemplateType) => Promise<void>;
  onSave: (plan: Omit<ClientMenuPlanV1State, "conflicts">) => Promise<void>;
  onActivate: (planId: string) => Promise<void>;
};

export function MenuPlanPanel({
  clientName,
  plans,
  activePlanId,
  disabled = false,
  onCreate,
  onSave,
  onActivate,
}: MenuPlanPanelProps) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id || "");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[0] || null;
  const [draft, setDraft] = useState<ClientMenuPlanV1State | null>(selectedPlan);

  const catalogMatches = useMemo(() => searchPhase77DCatalogFoods(catalogQuery, 8), [catalogQuery]);
  const exportPreview = useMemo(() => {
    if (!draft) return "";
    const { conflicts, ...record } = draft;
    void conflicts;
    return deriveDietPlanSummaryFromMenuPlan(record);
  }, [draft]);

  if (!selectedPlan || !draft) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4" data-testid="menu-plan-panel">
        <p className="text-sm text-stone-600">No menu plans yet for {clientName}.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PHASE_77F_MENU_PLAN_TEMPLATE_TYPES.map((templateType) => (
            <button
              key={templateType}
              type="button"
              disabled={disabled}
              onClick={() => onCreate(templateType)}
              className="rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800"
            >
              Create {PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[templateType]}
            </button>
          ))}
        </div>
      </section>
    );
  }

  const updateDraft = (patch: Partial<ClientMenuPlanV1State>) => {
    setDraft((current) => (current ? { ...current, ...patch, conflicts: current.conflicts } : current));
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
    if (!draft || disabled || isSaving) return;
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
    if (!draft || disabled || isActivating) return;
    setIsActivating(true);
    try {
      await onActivate(draft.id);
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50/40 p-4" data-testid="menu-plan-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-stone-950">Menu plan</h4>
          <p className="mt-1 text-sm text-stone-600">
            {clientName} · {PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[draft.templateType]} · revision {draft.revision}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={save}
            disabled={disabled || isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-950 px-3 py-2 text-sm font-semibold text-white"
          >
            <Check size={16} />
            {isSaving ? "Saving..." : "Save plan"}
          </button>
          <button
            type="button"
            onClick={activate}
            disabled={disabled || isActivating || draft.status === "active"}
            className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm font-semibold text-sky-950"
          >
            {isActivating ? "Activating..." : "Activate plan"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {plans.map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => {
              setSelectedPlanId(plan.id);
              setDraft(plan);
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              plan.id === draft.id ? "bg-sky-900 text-white" : "bg-white text-stone-700"
            }`}
          >
            {plan.title} {plan.status === "active" || plan.id === activePlanId ? "· active" : ""}
          </button>
        ))}
        {PHASE_77F_MENU_PLAN_TEMPLATE_TYPES.map((templateType) => (
          <button
            key={templateType}
            type="button"
            disabled={disabled}
            onClick={() => onCreate(templateType)}
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700"
          >
            <Plus size={12} />
            {PHASE_77F_MENU_PLAN_TEMPLATE_LABELS[templateType]}
          </button>
        ))}
      </div>

      {draft.conflicts.length > 0 ? (
        <div className="mt-4 space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          {draft.conflicts.map((conflict) => (
            <p key={`${conflict.code}-${conflict.message}`} className="inline-flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {conflict.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          Plan title
          <input
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Effective date
          <input
            type="date"
            value={draft.effectiveDate || ""}
            onChange={(event) => updateDraft({ effectiveDate: event.target.value || null })}
            className="mt-1 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-3">
        <label className="block text-sm font-semibold text-stone-900">Catalog search</label>
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2">
          <Search size={16} className="text-stone-400" />
          <input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="Add catalog food to a meal slot"
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
                className="rounded-lg border border-stone-200 px-2 py-1 text-xs font-semibold text-stone-700"
              >
                {match.name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
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
                placeholder="Add meal item"
                className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
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
                <p className="text-xs font-semibold text-stone-600">Alternatives</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {slot.alternatives.map((item) => (
                    <span key={item.id} className="rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-900">
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
                placeholder="Weekly target note"
                className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            ) : null}
          </div>
        ))}
      </div>

      {draft.templateType === "simple_guidance" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <TokenArea
            label="Preferred foods"
            values={draft.preferredFoods}
            onChange={(values) => updateDraft({ preferredFoods: values })}
          />
          <TokenArea
            label="Avoid foods"
            values={draft.avoidFoods}
            onChange={(values) => updateDraft({ avoidFoods: values })}
          />
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <textarea
          value={draft.dietitianNotes}
          onChange={(event) => updateDraft({ dietitianNotes: event.target.value })}
          rows={3}
          placeholder="Dietitian notes"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
        <textarea
          value={draft.clientFacingNotes}
          onChange={(event) => updateDraft({ clientFacingNotes: event.target.value })}
          rows={3}
          placeholder="Client-facing notes"
          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={draft.exportVisible}
          onChange={(event) => updateDraft({ exportVisible: event.target.checked })}
          className="h-4 w-4 rounded border-stone-300"
        />
        Include in export preview
      </label>

      <div className="mt-3 rounded-lg border border-stone-200 bg-white p-3 text-sm text-stone-700">
        <p className="font-semibold text-stone-900">Derived legacy summary preview</p>
        <p className="mt-1">{exportPreview || "Save or activate to generate summary."}</p>
      </div>
    </section>
  );
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
        placeholder={`Add ${label.toLowerCase()}`}
        className="mt-2 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
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
