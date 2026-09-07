import { describe, expect, it } from "vitest";
import { ShellDirtyRegistry } from "./phase-85-stage-5-shell-dirty-registry";

describe("phase-85-stage-6 dirty registry editor contracts", () => {
  it("registers save, discard, and focus callbacks for each client editor", async () => {
    const registry = new ShellDirtyRegistry();
    const focusOrder: string[] = [];
    const discarded: string[] = [];
    const saved: string[] = [];

    for (const id of [
      "client-form:c1:s1",
      "client-nutrition:c1",
      "client-menu:c1",
      "client-context:c1",
      "client-ai:c1",
      "client-roster-create",
    ]) {
      registry.register({
        id,
        label: id,
        state: "dirty",
        canSave: true,
        save: async () => {
          saved.push(id);
          return true;
        },
        discard: () => {
          discarded.push(id);
        },
        focus: () => {
          focusOrder.push(id);
        },
      });
    }

    expect(registry.snapshot().isDirty).toBe(true);
    registry.get("client-form:c1:s1")?.focus?.();
    expect(focusOrder).toEqual(["client-form:c1:s1"]);

    const saveOk = await registry.saveAll();
    expect(saveOk.ok).toBe(true);
    expect(saved).toHaveLength(6);

    registry.update("client-form:c1:s1", {
      state: "dirty",
      canSave: true,
      discard: () => discarded.push("again"),
    });
    registry.discardAll();
    expect(discarded).toContain("again");
  });

  it("blocks navigation while any editor is saving", () => {
    const registry = new ShellDirtyRegistry();
    registry.register({
      id: "client-nutrition:c1",
      label: "Beslenme",
      state: "saving",
      canSave: false,
    });
    expect(registry.snapshot().isSaving).toBe(true);
    expect(registry.snapshot().isDirty).toBe(false);
  });
});
