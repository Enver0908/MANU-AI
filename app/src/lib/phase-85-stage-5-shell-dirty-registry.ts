/**
 * Stage 5 Faz 8 central dirty-state registry.
 * In-memory only — never writes drafts to localStorage/sessionStorage.
 */

export type ShellDirtyEntryState = "clean" | "dirty" | "saving" | "error";

export type ShellDirtyEntry = {
  id: string;
  label: string;
  state: ShellDirtyEntryState;
  canSave: boolean;
  save?: () => Promise<boolean>;
  discard?: () => void;
  focus?: () => void;
};

export type ShellDirtySnapshot = {
  entries: ShellDirtyEntry[];
  isDirty: boolean;
  isSaving: boolean;
  hasError: boolean;
  labels: string[];
};

type Listener = () => void;

export class ShellDirtyRegistry {
  private readonly store = new Map<string, ShellDirtyEntry>();
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  register(entry: ShellDirtyEntry) {
    this.store.set(entry.id, { ...entry });
    this.emit();
  }

  update(id: string, patch: Partial<Omit<ShellDirtyEntry, "id">>) {
    const current = this.store.get(id);
    if (!current) return;
    this.store.set(id, { ...current, ...patch, id });
    this.emit();
  }

  unregister(id: string) {
    if (!this.store.delete(id)) return;
    this.emit();
  }

  get(id: string) {
    return this.store.get(id) ?? null;
  }

  snapshot(): ShellDirtySnapshot {
    const entries = [...this.store.values()];
    const blocking = entries.filter((entry) => entry.state === "dirty" || entry.state === "saving" || entry.state === "error");
    return {
      entries,
      isDirty: blocking.some((entry) => entry.state === "dirty" || entry.state === "error"),
      isSaving: blocking.some((entry) => entry.state === "saving"),
      hasError: blocking.some((entry) => entry.state === "error"),
      labels: blocking
        .filter((entry) => entry.state !== "clean")
        .map((entry) => entry.label)
        .filter(Boolean),
    };
  }

  listBlocking() {
    return this.snapshot().entries.filter(
      (entry) => entry.state === "dirty" || entry.state === "saving" || entry.state === "error",
    );
  }

  async saveAll(): Promise<{ ok: boolean; failedId?: string }> {
    const saveable = this.listBlocking().filter((entry) => entry.canSave && entry.save);
    for (const entry of saveable) {
      this.update(entry.id, { state: "saving" });
      try {
        const ok = await entry.save!();
        if (!ok) {
          this.update(entry.id, { state: "error" });
          entry.focus?.();
          return { ok: false, failedId: entry.id };
        }
        this.update(entry.id, { state: "clean", canSave: false });
      } catch {
        this.update(entry.id, { state: "error" });
        entry.focus?.();
        return { ok: false, failedId: entry.id };
      }
    }
    const remaining = this.snapshot();
    if (remaining.isDirty || remaining.isSaving || remaining.hasError) {
      return { ok: false, failedId: "remaining_unsaved" };
    }
    return { ok: true };
  }

  discardAll() {
    for (const entry of this.listBlocking()) {
      entry.discard?.();
      this.update(entry.id, { state: "clean", canSave: false });
    }
  }

  clear() {
    this.store.clear();
    this.emit();
  }
}

export const shellDirtyRegistry = new ShellDirtyRegistry();

export function buildShellDirtyConfirmMessage(labels: string[]) {
  if (labels.length === 0) {
    return "Kaydedilmemiş değişiklikler var.";
  }
  return `Kaydedilmemiş değişiklikler:\n- ${labels.join("\n- ")}`;
}
