"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ALERT_BANNER_LIVE, STATUS_BANNER_LIVE } from "@/lib/phase-83e6-states-polish";
import type { CommercialEntitlementStatus } from "@/lib/phase-83b-commercial-entitlement-model";
import { shouldTreatAuthStateAsStaleForPwa } from "@/lib/phase-83g-pwa-session";

type PwaSubscriberShellProps = {
  children: ReactNode;
  registerServiceWorker: boolean;
};

export function PwaSubscriberShell({ children, registerServiceWorker }: PwaSubscriberShellProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [staleSession, setStaleSession] = useState(false);
  const offlineAuditSentRef = useRef(false);
  const staleAuditSentRef = useRef(false);

  useEffect(() => {
    if (!registerServiceWorker) {
      return;
    }

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, [registerServiceWorker]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(window.navigator.onLine);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline && !offlineAuditSentRef.current && registerServiceWorker) {
      offlineAuditSentRef.current = true;
      void fetch("/api/commercial/mobile-install-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "offline_banner_shown",
        }),
      }).catch(() => undefined);
    }
  }, [isOnline, registerServiceWorker]);

  useEffect(() => {
    if (!registerServiceWorker) {
      return;
    }

    let cancelled = false;

    const checkSession = async () => {
      const response = await fetch("/api/auth-state", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        status?: string;
        entitlementStatus?: CommercialEntitlementStatus | null;
      };
      const enforcementEnabled = payload.status !== "fallback_demo";
      if (
        !cancelled &&
        shouldTreatAuthStateAsStaleForPwa({
          status: payload.status ?? "unauthenticated",
          entitlementStatus: payload.entitlementStatus ?? null,
          enforcementEnabled,
        })
      ) {
        setStaleSession(true);
        if (!staleAuditSentRef.current) {
          staleAuditSentRef.current = true;
          void fetch("/api/commercial/mobile-install-audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "stale_session_detected",
            }),
          }).catch(() => undefined);
        }
      }
    };

    void checkSession();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkSession();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(() => void checkSession(), 5 * 60_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [registerServiceWorker]);

  return (
    <>
      {!isOnline ? (
        <div
          role="status"
          aria-live={STATUS_BANNER_LIVE}
          className="border-b border-amber-200 bg-amber-50 px-safe py-2 text-sm text-amber-900"
          data-testid="offline-banner"
        >
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <WifiOff size={16} aria-hidden="true" />
            Çevrimdışı moddasınız. Korumalı veriler yenilenmeyebilir.
          </div>
        </div>
      ) : null}
      {staleSession ? (
        <div
          role="alert"
          aria-live={ALERT_BANNER_LIVE}
          className="border-b border-red-200 bg-red-50 px-safe py-2 text-sm text-red-900"
          data-testid="stale-session-banner"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>Oturum süresi doldu veya geçersiz. Korumalı ekranlara erişim kapatıldı.</span>
            <Link href="/" className="inline-flex min-h-11 items-center font-semibold underline">
              Yeniden giriş yap
            </Link>
          </div>
        </div>
      ) : null}
      {children}
    </>
  );
}
