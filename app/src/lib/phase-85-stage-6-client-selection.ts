import { encodeClientReferenceCode, formatClientReferenceShort, isUuid } from "./client-reference-code";
import {
  buildDashboardHref,
  DASHBOARD_ROOT_PATH,
  mergeDashboardUrlState,
  type ClientWorkspaceTask,
  type DashboardUrlState,
} from "./phase-85-stage-4b-dashboard-routing";

export type Stage6ClientActivationInput = {
  requestedClientId: string;
  previousHref: string;
  isSaving: boolean;
};

export type Stage6ClientActivationOutcome =
  | { kind: "blocked_saving"; href: string }
  | { kind: "rolled_back"; href: string }
  | { kind: "activated"; clientId: string; href: string };

export function formatStage6ClientReferenceShort(clientId: string) {
  const trimmed = clientId.trim();
  if (!trimmed) return "";
  if (isUuid(trimmed)) {
    return formatClientReferenceShort(encodeClientReferenceCode(trimmed));
  }
  return formatClientReferenceShort(trimmed);
}

export async function runStage6ClientActivation(
  input: Stage6ClientActivationInput,
  persistActiveClient: () => Promise<boolean>,
  buildActivatedHref: () => string,
): Promise<Stage6ClientActivationOutcome> {
  if (input.isSaving) {
    return { kind: "blocked_saving", href: input.previousHref };
  }
  let persisted = false;
  try {
    persisted = await persistActiveClient();
  } catch {
    persisted = false;
  }
  if (!persisted) {
    return { kind: "rolled_back", href: input.previousHref };
  }
  return {
    kind: "activated",
    clientId: input.requestedClientId,
    href: buildActivatedHref(),
  };
}

export function buildStage6ClientWorkspaceHref(
  current: DashboardUrlState,
  input: { clientId: string | null; clientTask?: ClientWorkspaceTask | null },
) {
  return buildDashboardHref(
    DASHBOARD_ROOT_PATH,
    mergeDashboardUrlState(current, {
      section: "clients",
      clientId: input.clientId,
      clientTask: input.clientId ? (input.clientTask ?? "summary") : null,
    }),
  );
}

export function shouldRestoreClientRosterFocus(stage: "list" | "hub" | "task", previousStage: "list" | "hub" | "task") {
  return previousStage !== "list" && stage === "list";
}
