"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { t } from "@/lib/i18n";
import type { SupportedLanguageCode } from "@/lib/languages";
import { useAiChatClientSearch } from "@/lib/use-ai-chat";
import type { AiChatClientSearchItem, AiChatScopeType } from "@/lib/phase-85-stage-4c-contracts";
import { AI_CHAT_TITLE_MAX_LENGTH } from "@/lib/phase-85-stage-4c-contracts";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Minimal Tab-cycle focus trap scoped to this modal only. */
function useModalFocusTrap(active: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [active, containerRef]);
}

export function AiChatClientPicker({
  open,
  uiLanguage,
  onClose,
  onCreate,
  isCreating,
  error,
}: {
  open: boolean;
  uiLanguage: SupportedLanguageCode;
  onClose: () => void;
  onCreate: (input: { scopeType: AiChatScopeType; clientId: string | null; title: string }) => void;
  isCreating: boolean;
  error: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scopeType, setScopeType] = useState<AiChatScopeType>("general");
  const [query, setQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<AiChatClientSearchItem | null>(null);
  const [title, setTitle] = useState("");
  const clientSearch = useAiChatClientSearch(query);

  useModalFocusTrap(open, containerRef);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setScopeType("general");
      setQuery("");
      setSelectedClient(null);
      setTitle("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const canCreate = title.trim().length > 0 && (scopeType === "general" || Boolean(selectedClient));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 py-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(uiLanguage, "aiChatNewChat")}
        data-testid="ai-chat-client-picker"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-900">{t(uiLanguage, "aiChatNewChat")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(uiLanguage, "aiChatCancel")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-600 transition hover:bg-stone-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="inline-flex rounded-lg border border-stone-200 p-1" role="tablist" aria-label={t(uiLanguage, "aiChatNewChat")}>
            <button
              type="button"
              role="tab"
              aria-selected={scopeType === "general"}
              onClick={() => {
                setScopeType("general");
                setSelectedClient(null);
              }}
              className={`inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold transition ${
                scopeType === "general" ? "bg-emerald-950 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {t(uiLanguage, "aiChatScopeGeneral")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scopeType === "client"}
              onClick={() => setScopeType("client")}
              className={`inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-semibold transition ${
                scopeType === "client" ? "bg-emerald-950 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {t(uiLanguage, "aiChatScopeClient")}
            </button>
          </div>

          {scopeType === "client" && (
            <div className="space-y-2">
              {selectedClient ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-emerald-950">{selectedClient.fullName}</p>
                    <p className="text-xs font-medium text-emerald-700">{selectedClient.shortDisplay}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedClient(null)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {t(uiLanguage, "aiChatCancel")}
                  </button>
                </div>
              ) : (
                <>
                  <label className="block text-xs font-semibold uppercase text-stone-600">
                    {t(uiLanguage, "aiChatScopeClient")}
                    <div className="relative mt-1">
                      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t(uiLanguage, "aiChatSearchClientPlaceholder")}
                        className="min-h-11 w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-700"
                      />
                    </div>
                  </label>
                  {query.trim().length > 0 && query.trim().length < 2 ? (
                    <p className="text-xs text-stone-600">{t(uiLanguage, "aiChatSearchClientMinChars")}</p>
                  ) : null}
                  {query.trim().length >= 2 && (
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-2" role="listbox">
                      {clientSearch.isLoading ? (
                        <p className="px-2 py-1 text-sm text-stone-600">…</p>
                      ) : clientSearch.results.length === 0 ? (
                        <p className="px-2 py-1 text-sm text-stone-600">{t(uiLanguage, "aiChatNoClientResults")}</p>
                      ) : (
                        clientSearch.results.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => setSelectedClient(item)}
                            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-white"
                          >
                            <span className="truncate font-medium text-stone-800">{item.fullName}</span>
                            <span className="shrink-0 rounded bg-stone-200 px-1.5 py-0.5 text-[11px] font-semibold text-stone-600">
                              {item.shortDisplay}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <label className="block text-xs font-semibold uppercase text-stone-600">
            {t(uiLanguage, "aiChatTitleLabel")}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, AI_CHAT_TITLE_MAX_LENGTH))}
              placeholder={t(uiLanguage, "aiChatTitlePlaceholder")}
              className="mt-1 min-h-11 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-700"
            />
          </label>

          {error ? (
            <p role="alert" className="text-sm font-medium text-red-700">
              {t(uiLanguage, "aiChatActionFailed")}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            {t(uiLanguage, "aiChatCancel")}
          </button>
          <button
            type="button"
            disabled={!canCreate || isCreating}
            onClick={() =>
              onCreate({
                scopeType,
                clientId: scopeType === "client" ? selectedClient?.id ?? null : null,
                title: title.trim(),
              })
            }
            className="inline-flex min-h-11 items-center rounded-lg bg-emerald-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t(uiLanguage, "aiChatCreate")}
          </button>
        </div>
      </div>
    </div>
  );
}
