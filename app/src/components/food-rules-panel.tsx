"use client";

import { AlertTriangle, Check, Plus, Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useShellDirtyRegistration } from "@/lib/use-shell-dirty-registration";
import type { ShellDirtyEntryState } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import {
  hasHardFoodRuleConflicts,
  summarizeCatalogSelections,
} from "@/lib/active-nutrition-plan-helpers";
import { FOOD_RULE_DASHBOARD_WARNINGS } from "@/lib/phase-76j-food-rule-dashboard";
import {
  getPhase77DFoodById,
} from "@/lib/phase-77d-master-food-catalog";
import {
  detectClientFoodRuleProfileConflicts,
  PHASE_77E_DIET_TYPE_OPTIONS,
  PHASE_77E_FLEXIBILITY_LEVELS,
  PHASE_77E_FOOD_GROUP_OPTIONS,
  PHASE_77E_GOAL_KEYS,
  PHASE_77E_MEAL_KEYS,
  searchPhase77DCatalogFoods,
  type ClientFoodRuleProfileV2State,
} from "@/lib/phase-77e-client-food-rule-profile";
import type { Phase77EFlexibilityLevel } from "@/lib/types";
import { CatalogTreeBrowser } from "@/components/dashboard/catalog-tree-browser";

type FoodRulesPanelProps = {
  clientId?: string;
  clientName: string;
  contextRevision: number;
  initialProfile: ClientFoodRuleProfileV2State;
  disabled?: boolean;
  onSave: (profile: Omit<ClientFoodRuleProfileV2State, "conflicts">) => Promise<void>;
};

const FLEXIBILITY_LABELS: Record<Phase77EFlexibilityLevel, string> = {
  restricted: "Kisitli",
  moderate: "Orta esnek",
  flexible: "Esnek",
};

const MEAL_LABELS: Record<(typeof PHASE_77E_MEAL_KEYS)[number], string> = {
  kahvalti: "Kahvalti",
  ogle: "Ogle yemegi",
  aksam: "Aksam yemegi",
  ara_ogun: "Ara ogun",
};

const GOAL_LABELS: Record<(typeof PHASE_77E_GOAL_KEYS)[number], string> = {
  kilo_verme: "Kilo verme",
  kilo_alma: "Kilo alma",
  koruma: "Koruma",
  klinik: "Klinik",
  performans: "Performans",
};

export function FoodRulesPanel({
  clientId,
  clientName,
  contextRevision,
  initialProfile,
  disabled = false,
  onSave,
}: FoodRulesPanelProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [draftItem, setDraftItem] = useState({ allowed: "", forbidden: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const catalogMatches = useMemo(() => searchPhase77DCatalogFoods(catalogQuery, 12), [catalogQuery]);
  const conflicts = useMemo(() => detectClientFoodRuleProfileConflicts(profile), [profile]);
  const catalogSummary = useMemo(() => summarizeCatalogSelections(profile), [profile]);
  const saveBlocked = hasHardFoodRuleConflicts(conflicts);
  const isDirty = JSON.stringify(profile) !== JSON.stringify(initialProfile);
  const dirtyState: ShellDirtyEntryState = isSaving ? "saving" : saveError ? "error" : isDirty ? "dirty" : "clean";

  useShellDirtyRegistration({
    id: `client-nutrition:${clientId || clientName}`,
    label: "Aktif beslenme planı",
    state: dirtyState,
    canSave: isDirty && !disabled && !saveBlocked,
    onSave: async () => {
      if (disabled || isSaving || saveBlocked) return false;
      setIsSaving(true);
      setSaveError(null);
      try {
        const { conflicts: _conflicts, ...payload } = profile;
        void _conflicts;
        await onSave(payload);
        return true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "nutrition_save_failed");
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    onDiscard: () => {
      setProfile(initialProfile);
      setSaveError(null);
    },
    onFocusField: () => saveButtonRef.current?.focus(),
  });

  const update = (patch: Partial<ClientFoodRuleProfileV2State>) => {
    setProfile((current) => ({ ...current, ...patch }));
  };

  const addCatalogFood = (foodId: string, mode: "allowed" | "forbidden") => {
    const field = mode === "allowed" ? "allowedCatalogFoodIds" : "forbiddenCatalogFoodIds";
    const opposite = mode === "allowed" ? "forbiddenCatalogFoodIds" : "allowedCatalogFoodIds";
    update({
      [field]: [...new Set([...profile[field], foodId])],
      [opposite]: profile[opposite].filter((item) => item !== foodId),
    } as Partial<ClientFoodRuleProfileV2State>);
  };

  const removeCatalogFood = (foodId: string, mode: "allowed" | "forbidden") => {
    const field = mode === "allowed" ? "allowedCatalogFoodIds" : "forbiddenCatalogFoodIds";
    update({ [field]: profile[field].filter((item) => item !== foodId) });
  };

  const addToken = (field: "freeTextAllowedFoods" | "freeTextForbiddenFoods", draftKey: keyof typeof draftItem) => {
    const value = draftItem[draftKey].trim();
    if (!value) return;
    const tokens = value
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    update({ [field]: [...new Set([...profile[field], ...tokens])] });
    setDraftItem((current) => ({ ...current, [draftKey]: "" }));
  };

  const removeToken = (field: "freeTextAllowedFoods" | "freeTextForbiddenFoods", token: string) => {
    update({ [field]: profile[field].filter((item) => item !== token) });
  };

  const toggleGroup = (field: "allowedFoodGroups" | "forbiddenFoodGroups", option: string) => {
    const current = profile[field];
    update({
      [field]: current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    });
  };

  const toggleDietType = (option: string) => {
    update({
      dietTypeRestrictions: profile.dietTypeRestrictions.includes(option)
        ? profile.dietTypeRestrictions.filter((item) => item !== option)
        : [...profile.dietTypeRestrictions, option],
    });
  };

  const save = async () => {
    if (disabled || isSaving || saveBlocked) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const { conflicts: _conflicts, ...payload } = profile;
      void _conflicts;
      await onSave(payload);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "nutrition_save_failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-4" data-testid="active-nutrition-plan-panel">
      <div className="rounded-card border border-line bg-surface-muted p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-ink">Aktif Beslenme Plani</h4>
            <p className="mt-1 text-sm text-ink-muted">
              {clientName} · revizyon {profile.revision} · baglam {contextRevision}
            </p>
          </div>
          <button
            ref={saveButtonRef}
            type="button"
            onClick={save}
            disabled={disabled || isSaving || saveBlocked}
            className="inline-flex min-h-11 items-center gap-2 rounded-control bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink-alt disabled:cursor-not-allowed disabled:opacity-60"
            data-testid="active-nutrition-plan-save"
          >
            <Check size={16} />
            {isSaving ? "Kaydediliyor..." : "Plani kaydet"}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <SummaryBadge label={`Izinli besin ${catalogSummary.allowedFoods}`} tone="allowed" />
          <SummaryBadge label={`Yasak besin ${catalogSummary.forbiddenFoods}`} tone="forbidden" />
          <SummaryBadge label={`Izinli alt kat. ${catalogSummary.allowedSubs}`} tone="allowed" />
          <SummaryBadge label={`Yasak alt kat. ${catalogSummary.forbiddenSubs}`} tone="forbidden" />
          <SummaryBadge label={`Katalog ${catalogSummary.totalFoods} besin`} tone="neutral" />
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Ana kategori, alt kategori ve besin duzeyinde izinli/yasak secimleri yapin. Hizli erisim icin arama kullanin.
        </p>
        {saveError ? (
          <p role="alert" aria-live="assertive" className="mt-3 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Kayıt başarısız: {saveError}
          </p>
        ) : null}
      </div>

      <div className="rounded-card border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="inline-flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {FOOD_RULE_DASHBOARD_WARNINGS.clinicalReview}
        </p>
      </div>

      {conflicts.length > 0 ? (
        <div className="space-y-2 rounded-card border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">
          {conflicts.map((conflict) => (
            <p key={`${conflict.code}-${conflict.message}`} className="inline-flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {conflict.message}
            </p>
          ))}
          {saveBlocked ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-900">
              Sert celiski cozulmeden kayit yapilamaz.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-card border border-line bg-surface p-4">
        <label className="block text-sm font-semibold text-ink">Katalog arama</label>
        <div className="mt-2 flex min-h-11 items-center gap-2 rounded-card border border-line px-3 py-2">
          <Search size={16} className="text-ink-subtle" />
          <input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="518 besin icinde ara"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            data-testid="catalog-search-input"
          />
        </div>
        {catalogQuery.trim() && catalogMatches.length > 0 ? (
          <div className="mt-3 space-y-2 rounded-card border border-line bg-surface-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Hizli sonuclar</p>
            {catalogMatches.map((match) => (
              <div key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-surface px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{match.name}</p>
                  <p className="text-xs text-ink-subtle">{match.path}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addCatalogFood(match.id, "allowed")}
                    className="min-h-11 rounded-card border border-primary/30 px-2 py-1 text-xs font-semibold text-primary"
                  >
                    Izinli
                  </button>
                  <button
                    type="button"
                    onClick={() => addCatalogFood(match.id, "forbidden")}
                    className="min-h-11 rounded-card border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-900"
                  >
                    Yasak
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 max-h-[560px] overflow-auto">
          <CatalogTreeBrowser
            profile={profile}
            query={catalogQuery}
            disabled={disabled}
            onChange={(patch) => update(patch)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <CatalogSelectionList
          title="Allowed catalog foods"
          foodIds={profile.allowedCatalogFoodIds}
          onRemove={(foodId) => removeCatalogFood(foodId, "allowed")}
        />
        <CatalogSelectionList
          title="Forbidden catalog foods"
          foodIds={profile.forbiddenCatalogFoodIds}
          onRemove={(foodId) => removeCatalogFood(foodId, "forbidden")}
        />
        <TokenListSection
          title="Allowed free-text foods"
          tokens={profile.freeTextAllowedFoods}
          draftValue={draftItem.allowed}
          onDraftChange={(value) => setDraftItem((current) => ({ ...current, allowed: value }))}
          onAdd={() => addToken("freeTextAllowedFoods", "allowed")}
          onRemove={(token) => removeToken("freeTextAllowedFoods", token)}
        />
        <TokenListSection
          title="Forbidden free-text foods"
          tokens={profile.freeTextForbiddenFoods}
          draftValue={draftItem.forbidden}
          onDraftChange={(value) => setDraftItem((current) => ({ ...current, forbidden: value }))}
          onAdd={() => addToken("freeTextForbiddenFoods", "forbidden")}
          onRemove={(token) => removeToken("freeTextForbiddenFoods", token)}
        />
        <CheckboxGroupSection
          title="Allowed food groups"
          options={PHASE_77E_FOOD_GROUP_OPTIONS}
          selected={profile.allowedFoodGroups}
          onToggle={(option) => toggleGroup("allowedFoodGroups", option)}
        />
        <CheckboxGroupSection
          title="Forbidden food groups"
          options={PHASE_77E_FOOD_GROUP_OPTIONS}
          selected={profile.forbiddenFoodGroups}
          onToggle={(option) => toggleGroup("forbiddenFoodGroups", option)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Global flexibility"
          value={profile.flexibilityGlobal}
          options={PHASE_77E_FLEXIBILITY_LEVELS}
          optionLabels={FLEXIBILITY_LABELS}
          onChange={(value) => update({ flexibilityGlobal: value })}
        />
        <CheckboxGroupSection
          title="Diet type restrictions"
          options={PHASE_77E_DIET_TYPE_OPTIONS}
          selected={profile.dietTypeRestrictions}
          onToggle={toggleDietType}
        />
      </div>

      <FlexibilityGrid
        title="Flexibility by meal"
        keys={PHASE_77E_MEAL_KEYS}
        labels={MEAL_LABELS}
        values={profile.flexibilityByMeal}
        fallback={profile.flexibilityGlobal}
        onChange={(key, value) =>
          update({
            flexibilityByMeal: { ...profile.flexibilityByMeal, [key]: value },
          })
        }
      />

      <FlexibilityGrid
        title="Hedef bazli esneklik"
        keys={PHASE_77E_GOAL_KEYS}
        labels={GOAL_LABELS}
        values={profile.flexibilityByGoal}
        fallback={profile.flexibilityGlobal}
        onChange={(key, value) =>
          update({
            flexibilityByGoal: { ...profile.flexibilityByGoal, [key]: value },
          })
        }
      />

      <TextareaField
        label="Diyetisyen notlari"
        value={profile.notes}
        onChange={(value) => update({ notes: value })}
        rows={3}
      />
    </section>
  );
}

function SummaryBadge({
  label,
  tone,
}: {
  label: string;
  tone: "allowed" | "forbidden" | "neutral";
}) {
  const classes =
    tone === "allowed"
      ? "border-primary/30 bg-primary/10 text-ink"
      : tone === "forbidden"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-line bg-surface text-ink";
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function CatalogSelectionList({
  title,
  foodIds,
  onRemove,
}: {
  title: string;
  foodIds: string[];
  onRemove: (foodId: string) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {foodIds.map((foodId) => {
          const located = getPhase77DFoodById(foodId);
          return (
            <span
              key={foodId}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-ink"
            >
              <span className="truncate">{located?.food.name || foodId}</span>
              <button type="button" onClick={() => onRemove(foodId)} className="text-ink-subtle hover:text-ink">
                <X size={12} />
              </button>
            </span>
          );
        })}
        {foodIds.length === 0 ? <p className="text-xs text-ink-subtle">No selections yet.</p> : null}
      </div>
    </div>
  );
}

function FlexibilityGrid({
  title,
  keys,
  labels,
  values,
  fallback,
  onChange,
  className = "",
}: {
  title: string;
  keys: readonly string[];
  labels: Record<string, string>;
  values: Record<string, Phase77EFlexibilityLevel>;
  fallback: Phase77EFlexibilityLevel;
  onChange: (key: string, value: Phase77EFlexibilityLevel) => void;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-line bg-surface p-3 ${className}`}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {keys.map((key) => (
          <SelectField
            key={key}
            label={labels[key] || key}
            value={values[key] || fallback}
            options={PHASE_77E_FLEXIBILITY_LEVELS}
            optionLabels={FLEXIBILITY_LABELS}
            onChange={(value) => onChange(key, value)}
          />
        ))}
      </div>
    </div>
  );
}

function TokenListSection({
  title,
  tokens,
  draftValue,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  title: string;
  tokens: string[];
  draftValue: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (token: string) => void;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-3">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tokens.map((token) => (
          <span
            key={token}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-muted px-2 py-1 text-xs font-medium text-ink"
          >
            <span className="truncate">{token}</span>
            <button type="button" onClick={() => onRemove(token)} className="text-ink-subtle hover:text-ink">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={draftValue}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add item"
          className="min-w-0 flex-1 rounded-card border border-line px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-card border border-line px-3 py-2 text-sm font-semibold text-ink"
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}

function CheckboxGroupSection({
  title,
  options,
  selected,
  onToggle,
  className = "",
}: {
  title: string;
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-line bg-surface p-3 ${className}`}>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-card border border-line px-2 py-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-line-strong text-primary"
            />
            <span className="min-w-0 break-words">{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: Phase77EFlexibilityLevel;
  options: readonly Phase77EFlexibilityLevel[];
  optionLabels: Record<Phase77EFlexibilityLevel, string>;
  onChange: (value: Phase77EFlexibilityLevel) => void;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as Phase77EFlexibilityLevel)}
        className="mt-1 w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 3,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-ink ${className}`}>
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1 w-full resize-y rounded-card border border-line bg-surface px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
