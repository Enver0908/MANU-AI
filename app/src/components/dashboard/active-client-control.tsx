"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search, UserRound } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { useShellProvider } from "@/components/dashboard/shell-provider";
import { ClientStatusStrip } from "@/components/dashboard/client-status-strip";
import {
  SHELL_CLIENT_SEARCH_DEBOUNCE_MS,
  SHELL_CLIENT_SEARCH_DEFAULT_LIMIT,
  SHELL_CLIENT_SEARCH_MIN_QUERY_LENGTH,
  formatShellClientIdentity,
  type ShellClientSearchItemDto,
} from "@/lib/phase-85-stage-5-shell-contracts";

type SelectorMode = "sheet" | "popover";

function useSelectorMode(): SelectorMode {
  const [mode, setMode] = useState<SelectorMode>("sheet");
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setMode(media.matches ? "popover" : "sheet");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return mode;
}

async function fetchShellClients(query: string | null, signal: AbortSignal) {
  const params = new URLSearchParams();
  params.set("limit", String(SHELL_CLIENT_SEARCH_DEFAULT_LIMIT));
  if (query) params.set("query", query);
  const response = await fetch(`/api/shell/clients?${params.toString()}`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
    headers: { Accept: "application/json", "Cache-Control": "no-store" },
  });
  const payload = (await response.json().catch(() => null)) as
    | { items?: ShellClientSearchItemDto[]; error?: string }
    | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "shell_client_search_unavailable");
  }
  return payload?.items ?? [];
}

export function ActiveClientControl({ disabled = false }: { disabled?: boolean }) {
  const { bootstrap, selectActiveClient, dirtySnapshot } = useShellProvider();
  const mode = useSelectorMode();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<ShellClientSearchItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const activeClient = bootstrap?.activeClient ?? null;
  const stale = Boolean(bootstrap?.warnings.includes("client_context_unavailable"));
  const locked = disabled || dirtySnapshot.isSaving;

  useEffect(() => {
    if (!open) return;
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    const trimmed = query.trim();
    if (trimmed.length === 1) {
      setLoading(false);
      return;
    }

    const handle = window.setTimeout(
      () => {
        void fetchShellClients(trimmed.length >= SHELL_CLIENT_SEARCH_MIN_QUERY_LENGTH ? trimmed : null, controller.signal)
          .then((next) => {
            if (requestSeq.current !== seq) return;
            setItems(next);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (controller.signal.aborted) return;
            if (requestSeq.current !== seq) return;
            setError(err instanceof Error ? err.message : "shell_client_search_unavailable");
            setLoading(false);
          });
      },
      trimmed.length >= SHELL_CLIENT_SEARCH_MIN_QUERY_LENGTH ? SHELL_CLIENT_SEARCH_DEBOUNCE_MS : 0,
    );

    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError(null);
    }
  }, [open]);

  const title = useMemo(() => {
    if (!activeClient) return "Danışan seç";
    return formatShellClientIdentity(activeClient);
  }, [activeClient]);

  const trySelect = async (item: ShellClientSearchItemDto) => {
    if (locked) return;
    const ok = await selectActiveClient({
      id: item.id,
      fullName: item.fullName,
      referenceShort: item.referenceShort,
    });
    if (ok) {
      setOpen(false);
    }
  };

  const list = (
    <div className="space-y-3">
      <label className="block">
        <span className="sr-only">Danışan ara</span>
        <span className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad veya referans"
            className="min-h-11 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-sm text-ink"
            autoComplete="off"
            data-testid="active-client-search"
          />
        </span>
      </label>
      {query.trim().length === 1 ? (
        <p className="text-sm text-ink-muted">Arama için en az 2 karakter girin.</p>
      ) : null}
      {error ? (
        <p className="text-sm text-ink-muted" role="status">
          Arama başarısız. Mevcut seçim korundu.
        </p>
      ) : null}
      {loading ? <p className="text-sm text-ink-muted">Yükleniyor…</p> : null}
      <ul id={listboxId} role="listbox" className="divide-y divide-line border-y border-line">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              role="option"
              className="flex min-h-11 w-full flex-col items-start justify-center gap-0.5 px-1 py-2 text-left text-sm hover:bg-surface-muted"
              onClick={() => void trySelect(item)}
              data-testid={`active-client-option-${item.id}`}
            >
              <span className="font-medium text-ink">{item.fullName}</span>
              <span className="text-xs text-ink-muted">{item.referenceShort}</span>
            </button>
          </li>
        ))}
      </ul>
      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-ink-muted">Danışan bulunamadı.</p>
      ) : null}
    </div>
  );

  return (
    <div className="min-w-0" data-testid="active-client-control">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-control border border-line bg-surface px-3 text-left text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={locked}
        onClick={() => setOpen(true)}
        data-testid="active-client-trigger"
      >
        <UserRound size={16} className="shrink-0 text-primary" />
        <span className="min-w-0 truncate">{title}</span>
        <ChevronsUpDown size={16} className="shrink-0 text-ink-muted" />
      </button>

      {activeClient || stale ? (
        <div className="mt-2">
          <ClientStatusStrip client={activeClient} stale={stale && !activeClient} />
        </div>
      ) : null}

      {mode === "sheet" ? (
        <Sheet open={open} onClose={() => setOpen(false)} side="bottom" title="Aktif danışan">
          {list}
        </Sheet>
      ) : open ? (
        <div className="relative z-40">
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Kapat"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="absolute left-0 top-2 z-50 w-[min(100vw-2rem,22rem)] rounded-card border border-line bg-surface p-3 shadow-xl"
            data-testid="active-client-popover"
          >
            <p className="mb-2 text-sm font-semibold text-ink">Aktif danışan</p>
            {list}
          </div>
        </div>
      ) : null}
    </div>
  );
}
