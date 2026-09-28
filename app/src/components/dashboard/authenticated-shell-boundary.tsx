"use client";

import { Profiler, Suspense, useEffect, type ReactNode } from "react";
import { PwaSubscriberShell } from "@/components/pwa-subscriber-shell";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ShellProvider } from "@/components/dashboard/shell-provider";
import type { ShellProviderMode } from "@/lib/phase-85-stage-5-shell-provider-state";
import { AiyaStateProvider } from "@/lib/use-aiya-state";
import { recordPhase52ClientEvent } from "@/lib/phase-52-diagnostic";
import type { DashboardAuthTiming } from "@/lib/dashboard-server-auth";

export type AuthenticatedShellBoundaryProps = {
  registerServiceWorker: boolean;
  mode?: ShellProviderMode;
  fallbackDisplayName?: string;
  fallbackUiLanguage?: string;
  fallbackAiChatEnabled?: boolean;
  dashboardAuthTiming?: DashboardAuthTiming;
  children: ReactNode;
};

export function DashboardRscAuthDiagnosticMarker({
  scope,
  timing,
}: {
  scope: "layout" | "page";
  timing?: DashboardAuthTiming;
}) {
  useEffect(() => {
    if (!timing) return;
    recordPhase52ClientEvent("rsc_auth_server_marker_observed", {
      scope,
      authGetUserMs: timing.getUserMs ?? null,
      authMembershipMs: timing.membershipMs ?? null,
      authCustomerSessionFactsMs: timing.customerSessionFactsMs ?? null,
      authDietitianMs: timing.dietitianMs ?? null,
      authEntitlementMs: timing.entitlementMs ?? null,
      authTotalMs: timing.totalMs ?? null,
    });
  }, [scope, timing]);

  if (!timing) return null;

  return (
    <span
      hidden
      data-aiya-rsc-auth-marker={scope}
      data-aiya-rsc-auth-total-ms={timing.totalMs == null ? undefined : String(timing.totalMs)}
    />
  );
}

function recordShellProfilerCommit(
  id: string,
  phase: "mount" | "update" | "nested-update",
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
) {
  recordPhase52ClientEvent("react_commit", {
    profilerId: id,
    phase,
    actualDurationMs: Number(actualDuration.toFixed(3)),
    baseDurationMs: Number(baseDuration.toFixed(3)),
    startTimeMs: Number(startTime.toFixed(3)),
    commitTimeMs: Number(commitTime.toFixed(3)),
  });
}

/**
 * Client boundary that owns PWA registration, offline lock, session heartbeat,
 * update messaging, shell provider bootstrap, and canonical dashboard chrome.
 * Route pages keep independent server auth gates; this boundary never replaces those checks.
 */
export function AuthenticatedShellBoundary({
  registerServiceWorker,
  mode = "live",
  fallbackDisplayName,
  fallbackUiLanguage,
  fallbackAiChatEnabled,
  dashboardAuthTiming,
  children,
}: AuthenticatedShellBoundaryProps) {
  return (
    <PwaSubscriberShell registerServiceWorker={registerServiceWorker}>
      <Suspense fallback={null}>
        <DashboardRscAuthDiagnosticMarker scope="layout" timing={dashboardAuthTiming} />
        <Profiler id="authenticated-shell" onRender={recordShellProfilerCommit}>
          <Profiler id="shell-provider" onRender={recordShellProfilerCommit}>
            <ShellProvider
              mode={mode}
              fallbackDisplayName={fallbackDisplayName}
              fallbackUiLanguage={fallbackUiLanguage}
              fallbackAiChatEnabled={fallbackAiChatEnabled}
              registerServiceWorker={registerServiceWorker}
            >
              <Profiler id="aiya-state-provider" onRender={recordShellProfilerCommit}>
                <AiyaStateProvider>
                  <Profiler id="dashboard-shell" onRender={recordShellProfilerCommit}>
                    <DashboardShell>
                      <Profiler id="dashboard-content" onRender={recordShellProfilerCommit}>
                        {children}
                      </Profiler>
                    </DashboardShell>
                  </Profiler>
                </AiyaStateProvider>
              </Profiler>
            </ShellProvider>
          </Profiler>
        </Profiler>
      </Suspense>
    </PwaSubscriberShell>
  );
}
