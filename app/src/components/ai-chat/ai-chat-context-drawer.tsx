"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import type { AiChatRunSourcesResponse } from "@/lib/phase-85-stage-4c-sources";

async function fetchRunSources(runId: string): Promise<AiChatRunSourcesResponse> {
  const response = await fetch(`/api/ai-chat/runs/${encodeURIComponent(runId)}/sources`);
  if (!response.ok) {
    throw new Error("ai_chat_sources_fetch_failed");
  }
  return response.json() as Promise<AiChatRunSourcesResponse>;
}

function RunSourcesPanelContent({
  uiLanguage,
  runId,
}: {
  uiLanguage: SupportedLanguageCode;
  runId: string;
}) {
  const [data, setData] = useState<AiChatRunSourcesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchRunSources(runId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("failed");
          setData(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runId]);

  const loading = data === null && error === null;

  if (loading) {
    return (
      <p className="text-sm text-stone-600" role="status">
        …
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-stone-700" role="alert">
        {t(uiLanguage, "aiChatHistoryError")}
      </p>
    );
  }

  if (!data || data.sources.length === 0) {
    return <p className="text-sm text-stone-600">{t(uiLanguage, "aiChatSourceDrawerNoSources")}</p>;
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      {data.claims.length > 0 ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            {t(uiLanguage, "aiChatSourceClaimsHeading")}
          </h3>
          <ul className="space-y-2">
            {data.claims.map((claim) => (
              <li key={claim.claimId} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <p className="font-medium text-stone-900">{claim.text}</p>
                {claim.label ? <p className="mt-1 text-xs text-stone-500">{claim.label}</p> : null}
                {claim.uncertainty ? <p className="mt-1 text-xs text-stone-600">{claim.uncertainty}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          {t(uiLanguage, "aiChatSourceListHeading")}
        </h3>
        <ul className="space-y-2">
          {data.sources.map((source) => (
            <li key={source.sourceRefId} className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
              <p className="font-medium text-stone-900">{source.title}</p>
              <p className="mt-1 text-xs text-stone-500">
                {source.locator ?? t(uiLanguage, "aiChatSourceLocatorUnknown")}
                {" · "}
                {source.sourceDate ?? t(uiLanguage, "aiChatSourceDateUnknown")}
              </p>
              <p className="mt-2 text-stone-700">{source.excerpt}</p>
              {source.sourceUrl ? (
                <a
                  href={source.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-emerald-900"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t(uiLanguage, "aiChatSourceOpenUrl")}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AiChatContextPanelContent({
  uiLanguage,
  runId,
}: {
  uiLanguage: SupportedLanguageCode;
  runId: string | null;
}) {
  return (
    <div className="flex h-full flex-col gap-3 p-4" data-testid="ai-chat-context-panel">
      <h2 className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChatSourceDrawerTitle")}</h2>
      {!runId ? (
        <p className="text-sm text-stone-600">{t(uiLanguage, "aiChatSourceDrawerEmpty")}</p>
      ) : (
        <RunSourcesPanelContent key={runId} uiLanguage={uiLanguage} runId={runId} />
      )}
    </div>
  );
}
