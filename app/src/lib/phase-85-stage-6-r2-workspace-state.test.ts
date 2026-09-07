import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AppRequestError } from "./app-errors";
import { ShellDirtyRegistry } from "./phase-85-stage-5-shell-dirty-registry";
import {
  buildStage6WorkspaceOwnerKey,
  classifyStage6EditorFailure,
  isStage6RevisionConflict,
  stage6EditorFailureMessage,
} from "./phase-85-stage-6-workspace-state";

describe("phase-85-stage-6 R2 workspace ownership", () => {
  it("isolates the same client and domain across tenants", () => {
    expect(buildStage6WorkspaceOwnerKey("tenant-a", "client-1", "forms")).not.toBe(
      buildStage6WorkspaceOwnerKey("tenant-b", "client-1", "forms"),
    );
    expect(buildStage6WorkspaceOwnerKey("tenant-a", "client-1", "forms")).toBe(
      "tenant-a:client-1:forms",
    );
  });

  it("keeps URL as the sole workspace target and wires bounded form data", () => {
    const dashboardSource = readFileSync(join(process.cwd(), "src/components/dashboard-app.tsx"), "utf8");
    const workspaceSource = readFileSync(join(process.cwd(), "src/components/dashboard/client-workspace.tsx"), "utf8");
    const hookSource = readFileSync(join(process.cwd(), "src/lib/use-stage-6-client-workspace.ts"), "utf8");

    expect(dashboardSource).not.toContain("workspaceOverride");
    expect(dashboardSource).toContain("{ afterHref: targetHref }");
    expect(workspaceSource).toContain("formRead={formRead}");
    expect(workspaceSource.match(/await reloadWorkspace\(\)/g)).toHaveLength(6);
    expect(hookSource).toContain("buildStage6WorkspaceOwnerKey(options.tenantId, options.clientId, options.domain)");
  });

  it("separates revision conflicts from unrelated 409 responses", () => {
    expect(isStage6RevisionConflict(new AppRequestError(409, "revision_conflict"))).toBe(true);
    expect(isStage6RevisionConflict(new AppRequestError(409, "profile_stale_recreate_required"))).toBe(true);
    expect(isStage6RevisionConflict(new AppRequestError(409, "concurrent_state_update"))).toBe(true);
    expect(isStage6RevisionConflict(new AppRequestError(409, "idempotency_request_in_progress"))).toBe(false);
    expect(isStage6RevisionConflict(new AppRequestError(403, "revision_conflict"))).toBe(false);
  });

  it("keeps a conflict actionable without exposing server payloads", () => {
    const failure = classifyStage6EditorFailure(
      new AppRequestError(409, "menu_plan_revision_conflict", "menu_plan", 8),
      "menu_save_failed",
    );
    expect(failure).toEqual({ kind: "conflict", code: "menu_plan_revision_conflict" });
    expect(stage6EditorFailureMessage(failure)).toContain("Taslağınız korundu");
    expect(stage6EditorFailureMessage(failure)).toContain("görevi yeniden açın");
    expect(stage6EditorFailureMessage(failure)).not.toContain("menu_plan_revision_conflict");
  });
});

describe("phase-85-stage-6 R2 async dirty saves", () => {
  it("does not report save success before the editor mutation resolves", async () => {
    const registry = new ShellDirtyRegistry();
    let resolveMutation: (() => void) | null = null;
    const mutation = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    registry.register({
      id: "client-context:c1",
      label: "Kritik bilgi",
      state: "dirty",
      canSave: true,
      save: async () => {
        await mutation;
        return true;
      },
      discard: () => undefined,
    });

    const saveResult = registry.saveAll();
    expect(registry.snapshot().isSaving).toBe(true);
    resolveMutation?.();
    await expect(saveResult).resolves.toEqual({ ok: true });
    expect(registry.snapshot().isDirty).toBe(false);
  });
});
