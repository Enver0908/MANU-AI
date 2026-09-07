import { encodeClientReferenceCode, formatClientReferenceShort, isUuid } from "./client-reference-code";
import {
  buildDashboardHref,
  DASHBOARD_ROOT_PATH,
  mergeDashboardUrlState,
  type ClientWorkspaceTask,
  type DashboardUrlState,
  type Stage6ResolvedCommunicationDestination,
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

export type Stage6CommunicationOpenInput = {
  destination: Stage6ResolvedCommunicationDestination;
  previousHref: string;
  isSaving: boolean;
  currentActiveClientId: string | null;
};

export type Stage6CommunicationOpenOutcome =
  | { kind: "blocked_saving"; href: string }
  | { kind: "inaccessible"; href: string }
  | { kind: "rolled_back"; href: string }
  | { kind: "opened"; href: string; persistClientId: string | null };

export async function runStage6CommunicationOpen(
  input: Stage6CommunicationOpenInput,
  persistActiveClient: () => Promise<boolean>,
): Promise<Stage6CommunicationOpenOutcome> {
  if (input.destination.inaccessible) {
    return { kind: "inaccessible", href: input.previousHref };
  }
  if (input.isSaving) {
    return { kind: "blocked_saving", href: input.previousHref };
  }

  const persistClientId =
    input.destination.requiresActiveClient &&
    input.destination.linkedClientId &&
    input.destination.linkedClientId !== input.currentActiveClientId
      ? input.destination.linkedClientId
      : null;

  if (!persistClientId) {
    return { kind: "opened", href: input.destination.href, persistClientId: null };
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
  return { kind: "opened", href: input.destination.href, persistClientId };
}
