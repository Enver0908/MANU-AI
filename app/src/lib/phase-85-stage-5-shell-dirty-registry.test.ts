import { describe, expect, it, beforeEach } from "vitest";
import {
  ShellDirtyRegistry,
  buildShellDirtyConfirmMessage,
} from "./phase-85-stage-5-shell-dirty-registry";

describe("phase-85-stage-5-shell-dirty-registry", () => {
  let registry: ShellDirtyRegistry;

  beforeEach(() => {
    registry = new ShellDirtyRegistry();
  });

  it("tracks multi-entry dirty labels and saving lock", () => {
    registry.register({
      id: "profile",
      label: "Profil",
      state: "dirty",
      canSave: true,
      save: async () => true,
    });
    registry.register({
      id: "composer",
      label: "Mesaj taslağı",
      state: "dirty",
      canSave: false,
    });

    const snap = registry.snapshot();
    expect(snap.isDirty).toBe(true);
    expect(snap.labels).toEqual(["Profil", "Mesaj taslağı"]);
    expect(buildShellDirtyConfirmMessage(snap.labels)).toContain("Profil");
    expect(buildShellDirtyConfirmMessage(snap.labels)).toContain("Mesaj taslağı");
  });

  it("saveAll stops on failure and focuses the failed entry", async () => {
    let focused = false;
    registry.register({
      id: "profile",
      label: "Profil",
      state: "dirty",
      canSave: true,
      save: async () => false,
      focus: () => {
        focused = true;
      },
    });

    const result = await registry.saveAll();
    expect(result.ok).toBe(false);
    expect(result.failedId).toBe("profile");
    expect(focused).toBe(true);
    expect(registry.get("profile")?.state).toBe("error");
  });

  it("discardAll resets dirty entries and unregister clears on unmount semantics", () => {
    let discarded = false;
    registry.register({
      id: "security",
      label: "Güvenlik",
      state: "dirty",
      canSave: false,
      discard: () => {
        discarded = true;
      },
    });
    registry.discardAll();
    expect(discarded).toBe(true);
    expect(registry.snapshot().isDirty).toBe(false);

    registry.register({
      id: "temp",
      label: "Geçici",
      state: "dirty",
      canSave: false,
    });
    registry.unregister("temp");
    expect(registry.get("temp")).toBeNull();
  });

  it("blocks navigation while saving", async () => {
    let resolveSave: ((value: boolean) => void) | null = null;
    registry.register({
      id: "profile",
      label: "Profil",
      state: "dirty",
      canSave: true,
      save: () =>
        new Promise<boolean>((resolve) => {
          resolveSave = resolve;
        }),
    });

    const pending = registry.saveAll();
    expect(registry.snapshot().isSaving).toBe(true);
    resolveSave?.(true);
    await pending;
    expect(registry.snapshot().isSaving).toBe(false);
    expect(registry.snapshot().isDirty).toBe(false);
  });

  it("refuses saveAll when a non-saveable dirty entry remains", async () => {
    registry.register({
      id: "profile",
      label: "Profil",
      state: "dirty",
      canSave: true,
      save: async () => true,
    });
    registry.register({
      id: "composer",
      label: "Mesaj taslağı",
      state: "dirty",
      canSave: false,
    });

    const result = await registry.saveAll();
    expect(result.ok).toBe(false);
    expect(result.failedId).toBe("remaining_unsaved");
    expect(registry.get("composer")?.state).toBe("dirty");
  });
});
