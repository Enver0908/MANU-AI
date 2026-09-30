import { describe, expect, it } from "vitest";
import { ShellPreferenceCoordinator } from "./phase-85-stage-5-shell-preference-coordinator";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("phase-85-stage-5-shell-preference-coordinator", () => {
  it("coalesces queued preference intents while one patch is in flight", async () => {
    let releaseFirst: (() => void) | null = null;
    const bodies: Array<Record<string, unknown>> = [];
    const coordinator = new ShellPreferenceCoordinator({
      getRevision: () => 1,
      createRequestId: () => `req-${bodies.length + 1}`,
      getClientBuildVersion: () => "1.0.0",
      refreshBootstrap: () => undefined,
      fetchImpl: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
        if (bodies.length === 1) {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
        return jsonResponse(200, {
          contractVersion: "p85-stage-5-shell-v1",
          revision: bodies.length + 1,
          activeClientId: null,
          lastDestinationId: null,
          destinationState: {},
          requestId: `req-${bodies.length}`,
        });
      },
    });

    const first = coordinator.update({ activeClientId: "00000000-0000-4000-8000-000000000001" });
    const second = coordinator.update({ lastDestinationId: "messages" });
    const third = coordinator.update({ lastDestinationId: "alerts" });
    releaseFirst?.();
    await Promise.all([first, second, third]);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ activeClientId: "00000000-0000-4000-8000-000000000001" });
    expect(bodies[1]).toMatchObject({ lastDestinationId: "alerts" });
  });

  it("refreshes bootstrap and retries once on revision conflict", async () => {
    let calls = 0;
    let refreshes = 0;
    let releaseRefresh: (() => void) | null = null;
    const coordinator = new ShellPreferenceCoordinator({
      getRevision: () => 3,
      createRequestId: () => `req-conflict-${calls + 1}`,
      getClientBuildVersion: () => "1.0.0",
      refreshBootstrap: () => new Promise<void>((resolve) => {
        refreshes += 1;
        releaseRefresh = resolve;
      }),
      fetchImpl: async () => {
        calls += 1;
        return calls === 1
          ? jsonResponse(409, { error: "preferences_revision_conflict" })
          : jsonResponse(200, {
              contractVersion: "p85-stage-5-shell-v1",
              revision: 4,
              activeClientId: null,
              lastDestinationId: "clients",
              destinationState: {},
              requestId: "req-conflict-2",
            });
      },
    });

    const pending = coordinator.update({ lastDestinationId: "clients" });
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(calls).toBe(1);
    expect(refreshes).toBe(1);
    expect(releaseRefresh).not.toBeNull();
    releaseRefresh?.();

    await expect(pending).resolves.toMatchObject({
      revision: 4,
      lastDestinationId: "clients",
    });
    expect(calls).toBe(2);
    expect(refreshes).toBe(1);
  });

  it("releases the queue after a rejected request", async () => {
    let calls = 0;
    const coordinator = new ShellPreferenceCoordinator({
      getRevision: () => 1,
      createRequestId: () => `req-${++calls}`,
      getClientBuildVersion: () => "1.0.0",
      refreshBootstrap: () => undefined,
      fetchImpl: async () => {
        if (calls === 1) throw new TypeError("network down");
        return jsonResponse(200, {
          contractVersion: "p85-stage-5-shell-v1",
          revision: 2,
          activeClientId: null,
          lastDestinationId: "home",
          destinationState: {},
          requestId: "req-2",
        });
      },
    });

    await expect(coordinator.update({ lastDestinationId: "clients" })).resolves.toBeNull();
    await expect(coordinator.update({ lastDestinationId: "home" })).resolves.toMatchObject({
      lastDestinationId: "home",
    });
    expect(calls).toBe(2);
  });
});
