import { describe, expect, it, vi } from "vitest";
import {
  parseClientWorkspaceTask,
  parseDashboardSearchParams,
  resolveClientWorkspaceStage,
  resolveClientWorkspaceTask,
  serializeDashboardSearchParams,
} from "./phase-85-stage-4b-dashboard-routing";
import {
  buildStage6ClientWorkspaceHref,
  formatStage6ClientReferenceShort,
  runStage6ClientActivation,
  shouldRestoreClientRosterFocus,
} from "./phase-85-stage-6-client-selection";

describe("phase-85-stage-6 client workspace URL", () => {
  it("parses typed clientTask values and legacy tab aliases", () => {
    expect(parseClientWorkspaceTask("forms")).toBe("forms");
    expect(parseClientWorkspaceTask("tab_food_rules")).toBe("nutrition");
    expect(parseClientWorkspaceTask("tab_ai_assistant")).toBe("ai");
    expect(parseClientWorkspaceTask("unknown")).toBeNull();

    const parsed = parseDashboardSearchParams(
      new URLSearchParams("section=clients&clientId=client-mert&clientTask=menu"),
    );
    expect(parsed.clientId).toBe("client-mert");
    expect(parsed.clientTask).toBe("menu");
    expect(resolveClientWorkspaceTask(parsed)).toBe("menu");
    expect(resolveClientWorkspaceStage(parsed)).toBe("task");
    expect(serializeDashboardSearchParams(parsed).get("clientTask")).toBe("menu");
  });

  it("defaults an open workspace without clientTask to the summary hub", () => {
    const parsed = parseDashboardSearchParams(
      new URLSearchParams("section=clients&clientId=client-mert"),
    );
    expect(parsed.clientTask).toBeNull();
    expect(resolveClientWorkspaceTask(parsed)).toBe("summary");
    expect(resolveClientWorkspaceStage(parsed)).toBe("hub");
    expect(serializeDashboardSearchParams(parsed).get("clientTask")).toBeNull();
  });

  it("treats clients without a clientId as the roster list", () => {
    const parsed = parseDashboardSearchParams(new URLSearchParams("section=clients"));
    expect(resolveClientWorkspaceStage(parsed)).toBe("list");
    expect(buildStage6ClientWorkspaceHref(parsed, { clientId: "client-elif" })).toContain("clientId=client-elif");
    expect(buildStage6ClientWorkspaceHref(parsed, { clientId: "client-elif" })).not.toContain("clientTask=");
  });
});

describe("phase-85-stage-6 client activation order", () => {
  it("blocks switching while an editor is saving and keeps the previous href", async () => {
    const persist = vi.fn(async () => true);
    const outcome = await runStage6ClientActivation(
      { requestedClientId: "client-b", previousHref: "/dashboard?section=clients&clientId=client-a", isSaving: true },
      persist,
      () => "/dashboard?section=clients&clientId=client-b",
    );
    expect(outcome).toEqual({
      kind: "blocked_saving",
      href: "/dashboard?section=clients&clientId=client-a",
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("rolls back to the previous href when active-client persistence fails", async () => {
    const outcome = await runStage6ClientActivation(
      { requestedClientId: "client-b", previousHref: "/dashboard?section=clients&clientId=client-a", isSaving: false },
      async () => false,
      () => "/dashboard?section=clients&clientId=client-b",
    );
    expect(outcome).toEqual({
      kind: "rolled_back",
      href: "/dashboard?section=clients&clientId=client-a",
    });
  });

  it("rolls back when active-client persistence throws", async () => {
    const outcome = await runStage6ClientActivation(
      { requestedClientId: "client-b", previousHref: "/dashboard?section=clients", isSaving: false },
      async () => {
        throw new Error("invalid_client_uuid");
      },
      () => "/dashboard?section=clients&clientId=client-b",
    );
    expect(outcome).toEqual({
      kind: "rolled_back",
      href: "/dashboard?section=clients",
    });
  });

  it("formats a display reference for both UUID and local fallback client ids", () => {
    expect(formatStage6ClientReferenceShort("client-mert")).toBe("CLIENT-M");
    expect(formatStage6ClientReferenceShort("550e8400-e29b-41d4-a716-446655440000")).toHaveLength(8);
  });

  it("activates only after persistence succeeds", async () => {
    const persist = vi.fn(async () => true);
    const outcome = await runStage6ClientActivation(
      { requestedClientId: "client-b", previousHref: "/dashboard?section=clients", isSaving: false },
      persist,
      () => "/dashboard?section=clients&clientId=client-b",
    );
    expect(persist).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({
      kind: "activated",
      clientId: "client-b",
      href: "/dashboard?section=clients&clientId=client-b",
    });
  });

  it("restores roster focus only when returning from hub or task to the list", () => {
    expect(shouldRestoreClientRosterFocus("list", "hub")).toBe(true);
    expect(shouldRestoreClientRosterFocus("list", "task")).toBe(true);
    expect(shouldRestoreClientRosterFocus("hub", "list")).toBe(false);
    expect(shouldRestoreClientRosterFocus("list", "list")).toBe(false);
  });
});
