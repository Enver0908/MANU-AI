import { describe, expect, it } from "vitest";
import {
  getRunEventMultiplexerCountForTests,
  getRunEventSubscriberCountForTests,
  resetRunEventMultiplexersForTests,
  subscribeRunEventChannel,
  type RunEventMultiplexerDeps,
} from "./phase-85-stage-4c-run-event-multiplexer";
import type { AiChatRunEventDto } from "./phase-85-stage-4c-contracts";

function buildEvent(sequenceNumber: number): AiChatRunEventDto {
  return {
    id: `event-${sequenceNumber}`,
    tenantId: "tenant-a",
    runId: "run-a",
    conversationId: "chat-a",
    sequenceNumber,
    eventType: "response.delta",
    payload: { text: `chunk-${sequenceNumber}` },
    createdAt: "2026-07-22T09:00:00.000Z",
  };
}

describe("phase 85 stage 4c run event multiplexer", () => {
  it("shares one upstream channel across subscribers for the same run", async () => {
    resetRunEventMultiplexersForTests();
    const events = [buildEvent(1), buildEvent(2), buildEvent(3)];
    let listCalls = 0;
    const deps: RunEventMultiplexerDeps = {
      async listRunEvents(afterSequence) {
        listCalls += 1;
        return events.filter((event) => event.sequenceNumber > afterSequence);
      },
    };

    const receivedA: number[] = [];
    const receivedB: number[] = [];
    const subA = subscribeRunEventChannel({
      tenantId: "tenant-a",
      runId: "run-a",
      deps,
      subscriber: {
        id: "a",
        afterSequence: 0,
        onEvent: (event) => receivedA.push(event.sequenceNumber),
      },
    });
    const subB = subscribeRunEventChannel({
      tenantId: "tenant-a",
      runId: "run-a",
      deps,
      subscriber: {
        id: "b",
        afterSequence: 0,
        onEvent: (event) => receivedB.push(event.sequenceNumber),
      },
    });

    await subA.catchUp();
    await subB.catchUp();

    expect(getRunEventMultiplexerCountForTests()).toBe(1);
    expect(getRunEventSubscriberCountForTests("tenant-a", "run-a")).toBe(2);
    expect(receivedA).toEqual([1, 2, 3]);
    expect(receivedB).toEqual([1, 2, 3]);
    expect(listCalls).toBeGreaterThan(0);

    subA.unsubscribe();
    expect(getRunEventSubscriberCountForTests("tenant-a", "run-a")).toBe(1);
    subB.unsubscribe();
    expect(getRunEventMultiplexerCountForTests()).toBe(0);
  });

  it("deduplicates duplicate sequence deliveries", async () => {
    resetRunEventMultiplexersForTests();
    const deps: RunEventMultiplexerDeps = {
      async listRunEvents() {
        return [buildEvent(1), buildEvent(1), buildEvent(2)];
      },
    };
    const received: number[] = [];
    const sub = subscribeRunEventChannel({
      tenantId: "tenant-a",
      runId: "run-a",
      deps,
      subscriber: {
        id: "a",
        afterSequence: 0,
        onEvent: (event) => received.push(event.sequenceNumber),
      },
    });
    await sub.catchUp();
    expect(received).toEqual([1, 2]);
    sub.unsubscribe();
  });

  it("cleans up on abort signal", async () => {
    resetRunEventMultiplexersForTests();
    const controller = new AbortController();
    const deps: RunEventMultiplexerDeps = {
      async listRunEvents() {
        return [];
      },
    };
    const sub = subscribeRunEventChannel({
      tenantId: "tenant-a",
      runId: "run-a",
      deps,
      subscriber: {
        id: "a",
        afterSequence: 0,
        onEvent: () => {},
        signal: controller.signal,
      },
    });
    await sub.catchUp();
    controller.abort();
    expect(getRunEventMultiplexerCountForTests()).toBe(0);
  });

  it("fans out to twenty subscribers on the same run with one upstream channel", async () => {
    resetRunEventMultiplexersForTests();
    const events = Array.from({ length: 5 }, (_, index) => buildEvent(index + 1));
    const deps: RunEventMultiplexerDeps = {
      async listRunEvents(afterSequence) {
        return events.filter((event) => event.sequenceNumber > afterSequence);
      },
    };
    const received = Array.from({ length: 20 }, () => [] as number[]);
    const subscriptions = received.map((bucket, index) =>
      subscribeRunEventChannel({
        tenantId: "tenant-a",
        runId: "run-a",
        deps,
        subscriber: {
          id: `sub-${index}`,
          afterSequence: 0,
          onEvent: (event) => bucket.push(event.sequenceNumber),
        },
      }),
    );

    await Promise.all(subscriptions.map((subscription) => subscription.catchUp()));

    expect(getRunEventMultiplexerCountForTests()).toBe(1);
    expect(getRunEventSubscriberCountForTests("tenant-a", "run-a")).toBe(20);
    for (const bucket of received) {
      expect(bucket).toEqual([1, 2, 3, 4, 5]);
    }

    for (const subscription of subscriptions) subscription.unsubscribe();
    expect(getRunEventMultiplexerCountForTests()).toBe(0);
  });
});
