"use client";

import { Suspense, type ReactNode } from "react";
import { PwaSubscriberShell } from "@/components/pwa-subscriber-shell";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ShellProvider } from "@/components/dashboard/shell-provider";
import type { ShellProviderMode } from "@/lib/phase-85-stage-5-shell-provider-state";

export type AuthenticatedShellBoundaryProps = {
  registerServiceWorker: boolean;
  mode?: ShellProviderMode;
  fallbackDisplayName?: string;
  fallbackUiLanguage?: string;
  children: ReactNode;
};

/**
 * Client boundary that owns PWA registration, shell provider bootstrap, and
 * canonical dashboard chrome. Route pages keep independent server auth gates;
 * this boundary never replaces those checks.
 */
export function AuthenticatedShellBoundary({
  registerServiceWorker,
  mode = "live",
  fallbackDisplayName,
  fallbackUiLanguage,
  children,
}: AuthenticatedShellBoundaryProps) {
  return (
    <PwaSubscriberShell registerServiceWorker={registerServiceWorker}>
      <Suspense fallback={null}>
        <ShellProvider
          mode={mode}
          fallbackDisplayName={fallbackDisplayName}
          fallbackUiLanguage={fallbackUiLanguage}
        >
          <DashboardShell>{children}</DashboardShell>
        </ShellProvider>
      </Suspense>
    </PwaSubscriberShell>
  );
}
