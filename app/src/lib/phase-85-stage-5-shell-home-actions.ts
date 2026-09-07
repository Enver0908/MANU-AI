import {
  buildShellHref,
  getDefaultDashboardUrlState,
  type DashboardUrlState,
} from "./phase-85-stage-4b-dashboard-routing";
import type { ShellHomeActionDto } from "./phase-85-stage-5-shell-contracts";

export function buildShellHomeActionHref(
  action: ShellHomeActionDto,
  options?: { clientId?: string | null; current?: DashboardUrlState | null },
) {
  if (action.id === "handoffs") {
    const current: DashboardUrlState = options?.current
      ? { ...options.current, section: "alerts", alertSeverity: "red" }
      : {
          ...getDefaultDashboardUrlState(),
          section: "alerts",
          alertSeverity: "red",
          clientId: options?.clientId ?? null,
        };
    return buildShellHref("alerts", {
      clientId: options?.clientId,
      current,
      preserveFilters: true,
    });
  }

  return buildShellHref(action.destinationId, {
    clientId: options?.clientId,
    current: options?.current,
    preserveFilters: action.id === "resume_last_work",
  });
}
