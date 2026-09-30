import { afterEach, describe, expect, it, vi } from "vitest";

const hookHarness = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  effects: [] as Array<{ deps: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<{ index: number; deps: unknown[]; effect: () => void | (() => void) }>,
  refIndex: 0,
  effectIndex: 0,
}));

vi.mock("react", () => ({
  useRef<T>(initialValue: T) {
    const index = hookHarness.refIndex++;
    hookHarness.refs[index] ??= { current: initialValue };
    return hookHarness.refs[index] as { current: T };
  },
  useEffect(effect: () => void | (() => void), deps: unknown[]) {
    const index = hookHarness.effectIndex++;
    const previous = hookHarness.effects[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      hookHarness.pending.push({ index, deps, effect });
    }
  },
}));

import { shellDirtyRegistry } from "./phase-85-stage-5-shell-dirty-registry";
import { useShellDirtyRegistration } from "./use-shell-dirty-registration";

function render(input: Parameters<typeof useShellDirtyRegistration>[0]) {
  hookHarness.refIndex = 0;
  hookHarness.effectIndex = 0;
  hookHarness.pending = [];
  // The test-only hook harness executes effects against the mocked React hook slots below.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useShellDirtyRegistration(input);
  for (const pending of hookHarness.pending) {
    hookHarness.effects[pending.index]?.cleanup?.();
    const cleanup = pending.effect();
    hookHarness.effects[pending.index] = {
      deps: [...pending.deps],
      cleanup: typeof cleanup === "function" ? cleanup : undefined,
    };
  }
}

function clearHarness() {
  for (const effect of hookHarness.effects) effect.cleanup?.();
  hookHarness.refs = [];
  hookHarness.effects = [];
  hookHarness.pending = [];
  hookHarness.refIndex = 0;
  hookHarness.effectIndex = 0;
  shellDirtyRegistry.clear();
  vi.unstubAllEnvs();
}

function registration(overrides: Partial<Parameters<typeof useShellDirtyRegistration>[0]> = {}) {
  return {
    id: "client-form:c1:s1",
    label: "Danışan formu",
    state: "dirty" as const,
    canSave: true,
    onSave: async () => true,
    onDiscard: () => undefined,
    onFocusField: () => undefined,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  clearHarness();
});

describe("useShellDirtyRegistration", () => {
  it("uses stable registration by default and does not re-register for fresh callbacks", () => {
    vi.stubEnv("NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY", "");
    const register = vi.spyOn(shellDirtyRegistry, "register");
    const unregister = vi.spyOn(shellDirtyRegistry, "unregister");
    const update = vi.spyOn(shellDirtyRegistry, "update");

    render(registration());
    for (let index = 0; index < 100; index += 1) {
      render(registration({
        onSave: async () => true,
        onDiscard: () => undefined,
        onFocusField: () => undefined,
      }));
    }

    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("calls the latest save, discard, and focus callbacks", async () => {
    let latestSaveCalls = 0;
    let latestDiscardCalls = 0;
    let latestFocusCalls = 0;
    render(registration());
    render(registration({
      onSave: async () => {
        latestSaveCalls += 1;
        return true;
      },
      onDiscard: () => { latestDiscardCalls += 1; },
      onFocusField: () => { latestFocusCalls += 1; },
    }));

    await expect(shellDirtyRegistry.get("client-form:c1:s1")?.save?.()).resolves.toBe(true);
    shellDirtyRegistry.get("client-form:c1:s1")?.discard?.();
    shellDirtyRegistry.get("client-form:c1:s1")?.focus?.();
    expect(latestSaveCalls).toBe(1);
    expect(latestDiscardCalls).toBe(1);
    expect(latestFocusCalls).toBe(1);
  });

  it("updates save capability when optional callbacks appear and disappear", () => {
    render(registration({ onSave: undefined, canSave: true }));
    expect(shellDirtyRegistry.get("client-form:c1:s1")?.canSave).toBe(false);

    render(registration({ onSave: async () => true, canSave: true }));
    expect(shellDirtyRegistry.get("client-form:c1:s1")?.canSave).toBe(true);

    render(registration({ onSave: undefined, canSave: true }));
    expect(shellDirtyRegistry.get("client-form:c1:s1")?.canSave).toBe(false);
  });

  it("preserves dirty state and applies state changes without callback-driven churn", () => {
    const register = vi.spyOn(shellDirtyRegistry, "register");
    const unregister = vi.spyOn(shellDirtyRegistry, "unregister");
    render(registration());
    render(registration({ state: "saving", onSave: async () => true }));

    expect(shellDirtyRegistry.snapshot().isSaving).toBe(true);
    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();
  });

  it("does not restore the callback-driven legacy registration policy", () => {
    vi.stubEnv("NEXT_PUBLIC_AIYA_PERF_SHELL_DIRTY_REGISTRATION_POLICY", "legacy");
    const register = vi.spyOn(shellDirtyRegistry, "register");
    const unregister = vi.spyOn(shellDirtyRegistry, "unregister");
    render(registration());
    render(registration({ onSave: async () => true }));

    expect(register).toHaveBeenCalledTimes(1);
    expect(unregister).not.toHaveBeenCalled();
  });
});
