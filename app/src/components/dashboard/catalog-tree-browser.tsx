"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import {
  applyCatalogSelection,
  filterCatalogTree,
  resolveCatalogFoodSide,
  resolveCatalogMainSide,
  resolveCatalogSubSide,
  type CatalogSelectionProfile,
  type CatalogSelectionSide,
  type CatalogSelectionTarget,
} from "@/lib/active-nutrition-plan-helpers";

export function CatalogTreeBrowser({
  profile,
  query,
  disabled = false,
  onChange,
}: {
  profile: CatalogSelectionProfile;
  query: string;
  disabled?: boolean;
  onChange: (patch: CatalogSelectionProfile) => void;
}) {
  const tree = useMemo(() => filterCatalogTree(query), [query]);
  const [expandedMains, setExpandedMains] = useState<Record<string, boolean>>({});
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>({});

  const setSide = (target: CatalogSelectionTarget, side: CatalogSelectionSide) => {
    if (disabled) return;
    onChange(applyCatalogSelection(profile, target, side));
  };

  const toggleMain = (mainId: string) => {
    setExpandedMains((current) => ({ ...current, [mainId]: !current[mainId] }));
  };

  const toggleSub = (subId: string) => {
    setExpandedSubs((current) => ({ ...current, [subId]: !current[subId] }));
  };

  if (tree.length === 0) {
    return <p className="text-sm text-stone-500">Katalog aramasina uygun sonuc yok.</p>;
  }

  return (
    <div className="space-y-2" data-testid="catalog-tree-browser">
      {tree.map(({ main, subcategories }) => {
        const mainExpanded = expandedMains[main.id] ?? Boolean(query.trim());
        const mainSide = resolveCatalogMainSide(profile, main.id);
        return (
          <div key={main.id} className="rounded-lg border border-stone-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => toggleMain(main.id)}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-stone-900"
              >
                {mainExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                {main.name}
              </button>
              <SelectionToggle side={mainSide} disabled={disabled} onSelect={(side) => setSide({ level: "main", id: main.id }, side)} />
            </div>

            {mainExpanded ? (
              <div className="space-y-2 border-t border-stone-100 px-3 py-2">
                {subcategories.map(({ subcategory, foods }) => {
                  const subExpanded = expandedSubs[subcategory.id] ?? Boolean(query.trim());
                  const subSide = resolveCatalogSubSide(profile, subcategory.id, main.id);
                  return (
                    <div key={subcategory.id} className="rounded-md border border-stone-100 bg-stone-50/70">
                      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                        <button
                          type="button"
                          onClick={() => toggleSub(subcategory.id)}
                          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-stone-800"
                        >
                          {subExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {subcategory.name}
                        </button>
                        <SelectionToggle
                          side={subSide}
                          disabled={disabled}
                          onSelect={(side) => setSide({ level: "sub", id: subcategory.id, mainId: main.id }, side)}
                          compact
                        />
                      </div>

                      {subExpanded ? (
                        <div className="space-y-1 border-t border-stone-100 px-3 py-2">
                          {foods.map((food) => {
                            const foodSide = resolveCatalogFoodSide(profile, food.id);
                            return (
                              <div
                                key={food.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-2 py-1.5"
                                data-testid={`catalog-food-row-${food.id}`}
                              >
                                <span className="min-w-0 text-sm text-stone-700">{food.name}</span>
                                <SelectionToggle
                                  side={foodSide}
                                  disabled={disabled}
                                  onSelect={(side) =>
                                    setSide(
                                      { level: "food", id: food.id, mainId: main.id, subId: subcategory.id },
                                      side,
                                    )
                                  }
                                  compact
                                />
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SelectionToggle({
  side,
  disabled,
  onSelect,
  compact = false,
}: {
  side: CatalogSelectionSide;
  disabled?: boolean;
  onSelect: (side: CatalogSelectionSide) => void;
  compact?: boolean;
}) {
  const buttonClass = compact ? "min-h-9 px-2 py-1 text-[11px]" : "min-h-11 px-2.5 py-1.5 text-xs";

  return (
    <div className="ml-auto flex flex-wrap gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(side === "allowed" ? "none" : "allowed")}
        className={`rounded-md border font-semibold transition ${buttonClass} ${
          side === "allowed"
            ? "border-emerald-300 bg-emerald-100 text-emerald-950"
            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
        }`}
      >
        Izinli
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(side === "forbidden" ? "none" : "forbidden")}
        className={`rounded-md border font-semibold transition ${buttonClass} ${
          side === "forbidden"
            ? "border-red-300 bg-red-100 text-red-950"
            : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
        }`}
      >
        Yasak
      </button>
    </div>
  );
}
