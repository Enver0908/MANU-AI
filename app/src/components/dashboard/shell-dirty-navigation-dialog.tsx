"use client";

import type { ShellDirtySnapshot } from "@/lib/phase-85-stage-5-shell-dirty-registry";
import { buildShellDirtyConfirmMessage } from "@/lib/phase-85-stage-5-shell-dirty-registry";

export type ShellNavigationConfirmRequest = {
  title?: string;
  snapshot: ShellDirtySnapshot;
  canSaveAndContinue: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndContinue?: () => void;
  onFocusError?: () => void;
};

/**
 * Central dirty navigation confirmation: Stay / Discard / Save & continue.
 */
export function ShellDirtyNavigationDialog({
  request,
  busy = false,
}: {
  request: ShellNavigationConfirmRequest;
  busy?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 px-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="shell-dirty-title"
        className="w-full max-w-md rounded-card border border-line bg-surface p-4"
        data-testid="shell-dirty-navigation-dialog"
      >
        <h2 id="shell-dirty-title" className="text-sm font-semibold text-ink">
          {request.title ?? "Kaydedilmemiş değişiklikler"}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">
          {buildShellDirtyConfirmMessage(request.snapshot.labels)}
        </p>
        {request.snapshot.hasError ? (
          <p className="mt-2 text-sm text-ink-muted" role="status">
            Kayıt hatası var. İlgili alana odaklanıp düzeltebilirsiniz.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-line px-3 text-sm"
            onClick={request.onStay}
            disabled={busy}
            data-testid="shell-dirty-stay"
          >
            Burada kal
          </button>
          {request.snapshot.hasError && request.onFocusError ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-line px-3 text-sm"
              onClick={request.onFocusError}
              disabled={busy}
              data-testid="shell-dirty-focus-error"
            >
              Hataya git
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-control border border-line px-3 text-sm"
            onClick={request.onDiscard}
            disabled={busy || request.snapshot.isSaving}
            data-testid="shell-dirty-discard"
          >
            Değişiklikleri bırak
          </button>
          {request.canSaveAndContinue && request.onSaveAndContinue ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-3 text-sm font-medium text-white disabled:opacity-50"
              onClick={request.onSaveAndContinue}
              disabled={busy || request.snapshot.isSaving}
              data-testid="shell-dirty-save-continue"
            >
              {request.snapshot.isSaving ? "Kaydediliyor…" : "Kaydet ve devam et"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
