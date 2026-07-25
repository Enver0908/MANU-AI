import { afterEach, describe, expect, it, vi } from "vitest";
import { groupAiChatHistoryByDate, resolveAiChatDateGroup, subscribeToAiChatRun } from "./use-ai-chat";
import type { AiChatConversationListItem } from "./phase-85-stage-4c-contracts";

const NOW = new Date("2026-07-22T12:00:00.000Z");

function buildItem(overrides: Partial<AiChatConversationListItem>): AiChatConversationListItem {
  return {
    id: "chat-1",
    tenantId: "tenant-a",
    createdByUserId: "user-a",
    createdByDietitianId: "dietitian-a",
    scopeType: "general",
    clientId: null,
    title: "Untitled",
    titleSource: "user",
    status: "active",
    activeBranchId: "branch-1",
    revision: 1,
    lastMessageAt: null,
    createdAt: "2026-07-22T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
    preview: null,
    clientFullName: null,
    clientReferenceCode: null,
    clientReferenceShort: null,
    ...overrides,
  };
}

describe("resolveAiChatDateGroup", () => {
  it("buckets today, last 7 days, last 30 days, and older", () => {
    expect(resolveAiChatDateGroup("2026-07-22T09:00:00.000Z", NOW)).toBe("today");
    expect(resolveAiChatDateGroup("2026-07-18T09:00:00.000Z", NOW)).toBe("last7Days");
    expect(resolveAiChatDateGroup("2026-07-01T09:00:00.000Z", NOW)).toBe("last30Days");
    expect(resolveAiChatDateGroup("2026-05-01T09:00:00.000Z", NOW)).toBe("older");
  });

  it("treats an unparsable date as older", () => {
    expect(resolveAiChatDateGroup("not-a-date", NOW)).toBe("older");
  });
});

describe("groupAiChatHistoryByDate", () => {
  it("groups by lastMessageAt falling back to createdAt, in fixed group order", () => {
    const items = [
      buildItem({ id: "older-1", createdAt: "2026-05-01T09:00:00.000Z" }),
      buildItem({ id: "today-1", createdAt: "2026-07-22T08:00:00.000Z" }),
      buildItem({
        id: "last7-1",
        createdAt: "2026-07-01T08:00:00.000Z",
        lastMessageAt: "2026-07-19T08:00:00.000Z",
      }),
    ];

    const grouped = groupAiChatHistoryByDate(items, NOW);

    expect(grouped.map((bucket) => bucket.group)).toEqual(["today", "last7Days", "older"]);
    expect(grouped[0].items.map((item) => item.id)).toEqual(["today-1"]);
    expect(grouped[1].items.map((item) => item.id)).toEqual(["last7-1"]);
    expect(grouped[2].items.map((item) => item.id)).toEqual(["older-1"]);
  });

  it("omits empty groups entirely", () => {
    const grouped = groupAiChatHistoryByDate(
      [buildItem({ id: "today-only", createdAt: "2026-07-22T08:00:00.000Z" })],
      NOW,
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0].group).toBe("today");
  });
});

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

describe("subscribeToAiChatRun", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reconnects after normal EOF when no terminal event was received", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        sseResponse([
          'id: 1\nevent: response.delta\ndata: {"sequenceNumber":1,"eventType":"response.delta","text":"hel"}\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        sseResponse([
          'id: 2\nevent: response.completed\ndata: {"sequenceNumber":2,"eventType":"response.completed","completionState":"complete"}\n\n',
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const received: Array<{ sequenceNumber: number; eventType: string }> = [];

    const result = await subscribeToAiChatRun({
      runId: "run-a",
      maxReconnects: 1,
      onEvent: (event) => received.push({ sequenceNumber: event.sequenceNumber, eventType: event.eventType }),
    });

    expect(result.terminalSeen).toBe(true);
    expect(result.lastSequence).toBe(2);
    expect(received).toEqual([
      { sequenceNumber: 1, eventType: "response.delta" },
      { sequenceNumber: 2, eventType: "response.completed" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("after=1");
  });
});
