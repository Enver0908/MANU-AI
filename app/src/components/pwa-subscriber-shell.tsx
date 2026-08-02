"use client";

import type { ReactNode } from "react";

type PwaSubscriberShellProps = {
  children: ReactNode;
  /** @deprecated Stage 5 Faz 7: registration moved to AuthenticatedShellBoundary / ShellProvider. */
  registerServiceWorker?: boolean;
};

/**
 * Compatibility adapter. Offline lock, SW registration, session privacy, and
 * update lifecycle now live in the canonical authenticated shell boundary.
 */
export function PwaSubscriberShell({ children }: PwaSubscriberShellProps) {
  return <>{children}</>;
}
