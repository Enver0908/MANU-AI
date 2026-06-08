"use client";

import { AlertTriangle, Check, Plus, X } from "lucide-react";
import { useState } from "react";
import {
  FOOD_RULE_DASHBOARD_WARNINGS,
  type FoodRuleDashboardState,
  FOOD_RULE_DASHBOARD_DIET_TYPE_OPTIONS,
  FOOD_RULE_DASHBOARD_GROUP_OPTIONS,
  FOOD_RULE_DASHBOARD_INGREDIENT_KEYWORD_OPTIONS,
  FOOD_RULE_DASHBOARD_PRODUCT_LABEL_REVIEW_OPTIONS,
  FOOD_RULE_DASHBOARD_SKIP_TOLERANCE_OPTIONS,
  FOOD_RULE_DASHBOARD_UNCERTAINTY_POLICY_OPTIONS,
} from "@/lib/phase-76j-food-rule-dashboard";

type FoodRulesPanelProps = {
  clientName: string;
  contextRevision: number;
  initialState: FoodRuleDashboardState;
  disabled?: boolean;
  onSave: (state: FoodRuleDashboardState) => Promise<void>;
};

export function FoodRulesPanel({
  clientName,
  contextRevision,
  initialState,
  disabled = false,
  onSave,
}: FoodRulesPanelProps) {
  const [foodRules, setFoodRules] = useState<FoodRuleDashboardState>(initialState);
  const [draftItem, setDraftItem] = useState({
    forbidden: "",
    allowed: "",
    mandatory: "",
    optional: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (patch: Partial<FoodRuleDashboardState>) => {
    setFoodRules((current) => ({ ...current, ...patch }));
  };

  const addToken = (field: "forbiddenFoodItems" | "allowedFoodItems" | "mandatoryFoodsOrMeals" | "optionalFoodsOrMeals", draftKey: keyof typeof draftItem) => {
    const value = draftItem[draftKey].trim();
    if (!value) return;
    const tokens = value
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    update({
      [field]: [...new Set([...foodRules[field], ...tokens])],
    } as Partial<FoodRuleDashboardState>);
    setDraftItem((current) => ({ ...current, [draftKey]: "" }));
  };

  const removeToken = (field: keyof FoodRuleDashboardState, token: string) => {
    const current = foodRules[field];
    if (!Array.isArray(current)) return;
    update({ [field]: current.filter((item) => item !== token) } as Partial<FoodRuleDashboardState>);
  };

  const toggleOption = (field: "forbiddenFoodGroups" | "allowedFoodGroups" | "ingredientAllergenKeywords", option: string) => {
    const current = foodRules[field];
    update({
      [field]: current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    });
  };

  const save = async () => {
    if (disabled || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(foodRules);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4" data-testid="food-rules-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-lg font-semibold text-stone-950">Structured food rules</h4>
          <p className="mt-1 text-sm text-stone-600">
            {clientName} · context revision {contextRevision}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={disabled || isSaving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check size={16} />
          {isSaving ? "Saving..." : "Save food rules"}
        </button>
      </div>

      <div className="mt-4 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="inline-flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {FOOD_RULE_DASHBOARD_WARNINGS.clinicalReview}
        </p>
        <p className="inline-flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          {FOOD_RULE_DASHBOARD_WARNINGS.productionActivation}
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TokenListSection
          title="Forbidden foods"
          description="Add or remove explicitly forbidden items."
          tokens={foodRules.forbiddenFoodItems}
          draftValue={draftItem.forbidden}
          onDraftChange={(value) => setDraftItem((current) => ({ ...current, forbidden: value }))}
          onAdd={() => addToken("forbiddenFoodItems", "forbidden")}
          onRemove={(token) => removeToken("forbiddenFoodItems", token)}
        />
        <CheckboxGroupSection
          title="Forbidden food groups"
          options={FOOD_RULE_DASHBOARD_GROUP_OPTIONS}
          selected={foodRules.forbiddenFoodGroups}
          onToggle={(option) => toggleOption("forbiddenFoodGroups", option)}
        />
        <TokenListSection
          title="Allowed foods"
          description="Explicitly allowed single foods."
          tokens={foodRules.allowedFoodItems}
          draftValue={draftItem.allowed}
          onDraftChange={(value) => setDraftItem((current) => ({ ...current, allowed: value }))}
          onAdd={() => addToken("allowedFoodItems", "allowed")}
          onRemove={(token) => removeToken("allowedFoodItems", token)}
        />
        <CheckboxGroupSection
          title="Allowed food groups"
          options={FOOD_RULE_DASHBOARD_GROUP_OPTIONS}
          selected={foodRules.allowedFoodGroups}
          onToggle={(option) => toggleOption("allowedFoodGroups", option)}
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <SelectField
          label="Diet type rules"
          value={foodRules.dietTypeRules}
          options={FOOD_RULE_DASHBOARD_DIET_TYPE_OPTIONS}
          onChange={(value) => update({ dietTypeRules: value })}
        />
        <SelectField
          label="Skip tolerance"
          value={foodRules.skipToleranceRules}
          options={FOOD_RULE_DASHBOARD_SKIP_TOLERANCE_OPTIONS}
          onChange={(value) => update({ skipToleranceRules: value })}
        />
        <SelectField
          label="Product label review policy"
          value={foodRules.productLabelReviewPolicy}
          options={FOOD_RULE_DASHBOARD_PRODUCT_LABEL_REVIEW_OPTIONS}
          onChange={(value) => update({ productLabelReviewPolicy: value })}
        />
        <SelectField
          label="Uncertainty policy"
          value={foodRules.uncertaintyPolicy}
          options={FOOD_RULE_DASHBOARD_UNCERTAINTY_POLICY_OPTIONS}
          onChange={(value) => update({ uncertaintyPolicy: value })}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TokenListSection
          title="Mandatory foods or meals"
          description="Items that should not be skipped without review."
          tokens={foodRules.mandatoryFoodsOrMeals}
          draftValue={draftItem.mandatory}
          onDraftChange={(value) => setDraftItem((current) => ({ ...current, mandatory: value }))}
          onAdd={() => addToken("mandatoryFoodsOrMeals", "mandatory")}
          onRemove={(token) => removeToken("mandatoryFoodsOrMeals", token)}
        />
        <TokenListSection
          title="Optional foods or meals"
          description="Flexible items or meals with explicit skip tolerance."
          tokens={foodRules.optionalFoodsOrMeals}
          draftValue={draftItem.optional}
          onDraftChange={(value) => setDraftItem((current) => ({ ...current, optional: value }))}
          onAdd={() => addToken("optionalFoodsOrMeals", "optional")}
          onRemove={(token) => removeToken("optionalFoodsOrMeals", token)}
        />
      </div>

      <div className="mt-4 grid gap-4">
        <TextareaField
          label="Equivalent exchange groups"
          hint="Format: groupId: itemA|itemB; groupId2: itemC|itemD"
          value={foodRules.equivalentExchangeGroups}
          onChange={(value) => update({ equivalentExchangeGroups: value })}
          rows={3}
        />
        <TextareaField
          label="Portion boundaries"
          hint="Reminder-only portion limits; no automatic increases."
          value={foodRules.portionBoundaries}
          onChange={(value) => update({ portionBoundaries: value })}
          rows={2}
        />
      </div>

      <CheckboxGroupSection
        title="Ingredient / allergen keywords"
        options={FOOD_RULE_DASHBOARD_INGREDIENT_KEYWORD_OPTIONS}
        selected={foodRules.ingredientAllergenKeywords}
        onToggle={(option) => toggleOption("ingredientAllergenKeywords", option)}
        className="mt-4"
      />
    </section>
  );
}

function TokenListSection({
  title,
  description,
  tokens,
  draftValue,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  tokens: string[];
  draftValue: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (token: string) => void;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <p className="mt-1 text-xs text-stone-500">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tokens.map((token) => (
          <span
            key={token}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-xs font-medium text-stone-800"
          >
            <span className="truncate">{token}</span>
            <button type="button" onClick={() => onRemove(token)} className="text-stone-500 hover:text-stone-900" aria-label={`Remove ${token}`}>
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
          className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-800"
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
    <div className={`rounded-lg border border-stone-200 bg-white p-3 ${className}`}>
      <p className="text-sm font-semibold text-stone-900">{title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 rounded-lg border border-stone-100 px-2 py-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={selected.includes(option)}
              onChange={() => onToggle(option)}
              className="h-4 w-4 rounded border-stone-300 text-emerald-900"
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
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  hint,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-sm font-medium text-stone-700">
      <span>{label}</span>
      {hint ? <span className="mt-1 block text-xs font-normal text-stone-500">{hint}</span> : null}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1 w-full resize-y rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-950 outline-none focus:border-emerald-800 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
