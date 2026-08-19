"use client";

import { useMemo, useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  buildMenuPlanExportPreviewText,
  deriveMenuPlanExportFromSummarySource,
} from "@/lib/phase-77j-menu-plan-export";
import { isMenuExportEligible } from "@/lib/menu-workflow-panel-helpers";
import type { ClientMenuPlanV1State } from "@/lib/phase-77f-client-menu-plan";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";

export function MenuWorkflowExportSection({
  clientId,
  clientName,
  plan,
  activePlanId,
  uiLanguage,
}: {
  clientId: string;
  clientName: string;
  plan: ClientMenuPlanV1State | null;
  activePlanId: string | null;
  uiLanguage: SupportedLanguageCode;
}) {
  const [includeRecipes, setIncludeRecipes] = useState(true);
  const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(null);
  const eligible = isMenuExportEligible(plan, activePlanId);

  const exportPreview = useMemo(() => {
    if (!plan || !eligible) return "";
    return buildMenuPlanExportPreviewText(
      deriveMenuPlanExportFromSummarySource({ fullName: clientName }, plan, { includeRecipes }),
    );
  }, [clientName, eligible, includeRecipes, plan]);

  const downloadMenuExport = async (format: "docx" | "pdf") => {
    if (!plan || !eligible || isDownloading) return;
    setIsDownloading(format);
    try {
      const params = new URLSearchParams({
        format,
        includeRecipes: includeRecipes ? "true" : "false",
        planId: plan.id,
      });
      const response = await fetch(`/api/clients/${clientId}/menu-plans/export?${params.toString()}`);
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

  return (
    <div className="rounded-card border border-line bg-surface p-4" data-testid="menu-workflow-export">
      <h5 className="text-sm font-semibold text-ink">{t(uiLanguage, "exportMenuTitle")}</h5>
      {!eligible ? (
        <p className="mt-2 text-sm text-ink-subtle">
          {!activePlanId
            ? t(uiLanguage, "noActiveMenu")
            : !plan?.exportVisible
              ? t(uiLanguage, "exportMenuNotVisible")
              : "Disa aktarim icin plan aktif olmali."}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={includeRecipes}
              onChange={(event) => setIncludeRecipes(event.target.checked)}
              data-testid="menu-workflow-export-include-recipes"
            />
            {t(uiLanguage, "exportIncludeRecipes")}
          </label>
          <div>
            <p className="text-xs font-semibold uppercase text-ink-subtle">{t(uiLanguage, "exportPreviewTitle")}</p>
            <pre
              className="mt-2 max-h-48 overflow-auto rounded-md border border-line bg-surface-muted p-3 text-xs whitespace-pre-wrap text-ink"
              data-testid="menu-workflow-export-preview"
            >
              {exportPreview}
            </pre>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadMenuExport("docx")}
              disabled={isDownloading !== null}
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="menu-workflow-export-docx"
            >
              <Download size={16} />
              {t(uiLanguage, "exportDownloadDocx")}
            </button>
            <button
              type="button"
              onClick={() => downloadMenuExport("pdf")}
              disabled={isDownloading !== null}
              className="inline-flex min-h-11 items-center gap-2 rounded-card border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="menu-workflow-export-pdf"
            >
              <FileText size={16} />
              {t(uiLanguage, "exportDownloadPdf")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
