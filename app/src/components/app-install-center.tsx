"use client";

import { Download, Share, Smartphone, SquarePlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildPwaRuntimeEnvironment,
  type MobileInstallAuditEventType,
} from "@/lib/phase-83d-pwa-install-gate";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type AppInstallCenterProps = {
  displayName: string;
};

async function recordInstallAudit(eventType: MobileInstallAuditEventType) {
  await fetch("/api/commercial/mobile-install-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType,
      userAgentSummary: navigator.userAgent.slice(0, 240),
    }),
  }).catch(() => undefined);
}

export function AppInstallCenter({ displayName }: AppInstallCenterProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installOutcome, setInstallOutcome] = useState<"idle" | "accepted" | "dismissed">("idle");

  const runtime = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    return buildPwaRuntimeEnvironment({
      userAgent: window.navigator.userAgent,
      displayMode: window.matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser",
      navigatorStandalone: navigatorWithStandalone.standalone === true,
      isOnline: window.navigator.onLine,
      supportsBeforeInstallPrompt: false,
    });
  }, []);

  useEffect(() => {
    if (!runtime || runtime.isIosSafari) {
      void recordInstallAudit("ios_instructions_viewed");
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      void recordInstallAudit("install_prompt_shown");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [runtime]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setInstallOutcome(choice.outcome);
    setDeferredPrompt(null);
    await recordInstallAudit(
      choice.outcome === "accepted" ? "install_accepted" : "install_dismissed",
    );
  }, [deferredPrompt]);

  if (!runtime) {
    return (
      <div
        className="rounded-lg border border-line bg-surface p-5 shadow-sm"
        aria-busy="true"
        aria-label="Kurulum durumu yükleniyor"
        data-testid="install-center-loading"
      >
        <p className="text-sm text-ink-muted">Kurulum durumu kontrol ediliyor…</p>
      </div>
    );
  }

  if (runtime.isInstalled) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5" role="status">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white p-2 text-emerald-800">
            <Smartphone size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-950">Mobil uygulama kurulu</h2>
            <p className="mt-1 text-sm text-stone-600">
              MANU-AI zaten ana ekran uygulaması olarak çalışıyor, {displayName}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (runtime.isIosSafari) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm" role="region" aria-label="iOS kurulum rehberi">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
            <Share size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Mobil uygulamayı indir</h2>
            <p className="mt-1 text-sm text-stone-600">Safari ile ana ekrana ekleyin.</p>
          </div>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-stone-700">
          <li>Safari alt çubuktaki Paylaş simgesine dokunun.</li>
          <li>Ana Ekrana Ekle veya Web Uygulaması Olarak Aç seçeneğini seçin.</li>
          <li>MANU-AI kısayolunu onaylayın; uygulama /dashboard ile açılır.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm" role="region" aria-label="PWA kurulum">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
          <SquarePlus size={22} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Mobil uygulamayı indir</h2>
          <p className="mt-1 text-sm text-stone-600">
            Güvenli MANU-AI PWA kurulumu. Klinik veriler önbelleğe alınmaz.
          </p>
        </div>
      </div>

      {deferredPrompt ? (
        <button
          type="button"
          onClick={() => void handleInstallClick()}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900"
        >
          <Download size={17} />
          Mobil uygulamayı indir
        </button>
      ) : (
        <p className="mt-4 rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Kurulum istemi bu tarayıcıda henüz hazır değil. Chrome veya Edge kullanın ya da daha sonra
          tekrar deneyin.
        </p>
      )}

      {installOutcome === "accepted" ? (
        <p className="mt-3 text-sm font-medium text-emerald-800" role="status">
          Kurulum kabul edildi.
        </p>
      ) : null}
      {installOutcome === "dismissed" ? (
        <p className="mt-3 text-sm text-stone-600" role="status">
          Kurulum istemi kapatıldı. İstediğiniz zaman tekrar deneyebilirsiniz.
        </p>
      ) : null}
    </div>
  );
}
