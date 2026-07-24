import { describe, expect, it } from "vitest";
import {
  buildMessageHeightOffsets,
  computeMeasuredVirtualizedMessageRange,
  computeVirtualizedMessageRange,
  measurePrependedBlockHeight,
  resolveScrollTopAfterPrepend,
  resolveActiveMessageVersion,
} from "./ai-chat-message-list";
import type { AiChatMessageDto, AiChatMessageVersionDto } from "@/lib/phase-85-stage-4c-contracts";

function buildVersion(overrides: Partial<AiChatMessageVersionDto>): AiChatMessageVersionDto {
  return {
    id: "version-1",
    tenantId: "tenant-a",
    conversationId: "chat-1",
    messageId: "message-1",
    branchId: "branch-1",
    createdByUserId: "user-a",
    body: "hello",
    bodySha256: "hash",
    parentVersionId: null,
    supersedesVersionId: null,
    runId: null,
    contentStatus: "active",
    createdAt: "2026-07-22T09:00:00.000Z",
    ...overrides,
  } as AiChatMessageVersionDto;
}

function buildMessage(overrides: Partial<AiChatMessageDto>): AiChatMessageDto {
  return {
    id: "message-1",
    tenantId: "tenant-a",
    conversationId: "chat-1",
    createdByUserId: "user-a",
    role: "user",
    authorUserId: "user-a",
    deletedAt: null,
    createdAt: "2026-07-22T09:00:00.000Z",
    updatedAt: "2026-07-22T09:00:00.000Z",
    versions: [],
    ...overrides,
  };
}

describe("resolveActiveMessageVersion", () => {
  it("returns null when there are no versions", () => {
    expect(resolveActiveMessageVersion(buildMessage({ versions: [] }))).toBeNull();
  });

  it("prefers the version marked active over the latest superseded one", () => {
    const message = buildMessage({
      versions: [
        buildVersion({ id: "v1", contentStatus: "superseded", body: "old" }),
        buildVersion({ id: "v2", contentStatus: "active", body: "new" }),
      ],
    });
    expect(resolveActiveMessageVersion(message)?.body).toBe("new");
  });

  it("falls back to the last version when none is marked active", () => {
    const message = buildMessage({
      versions: [
        buildVersion({ id: "v1", contentStatus: "deleted", body: "first" }),
        buildVersion({ id: "v2", contentStatus: "deleted", body: "last" }),
      ],
    });
    expect(resolveActiveMessageVersion(message)?.body).toBe("last");
  });
});

describe("computeVirtualizedMessageRange", () => {
  it("returns the full range when the list is empty or the viewport is unknown", () => {
    expect(computeVirtualizedMessageRange(0, 0, 500)).toEqual({ start: 0, end: 0 });
    expect(computeVirtualizedMessageRange(10, 0, 0)).toEqual({ start: 0, end: 10 });
  });

  it("windows around the current scroll position with overscan", () => {
    const range = computeVirtualizedMessageRange(200, 1000, 800, 100, 3);
    expect(range.start).toBe(Math.max(0, 10 - 3));
    expect(range.end).toBeGreaterThan(range.start);
    expect(range.end).toBeLessThanOrEqual(200);
  });

  it("clamps the end of the range to the total count", () => {
    const range = computeVirtualizedMessageRange(5, 0, 2000, 100, 3);
    expect(range.end).toBe(5);
  });
});

describe("measured message virtualization", () => {
  it("builds cumulative offsets from measured heights with conservative fallback", () => {
    const heights = new Map<string, number>([
      ["m1", 120],
      ["m2", 80],
    ]);
    const { offsets, totalHeight } = buildMessageHeightOffsets(["m1", "m2", "m3"], heights);
    expect(offsets).toEqual([0, 132, 224]);
    expect(totalHeight).toBe(320);
  });

  it("preserves scroll position after prepending older messages", () => {
    const heights = new Map<string, number>([
      ["old-1", 100],
      ["old-2", 120],
      ["visible", 96],
    ]);
    const prependedHeight = measurePrependedBlockHeight(["old-1", "old-2"], heights);
    expect(resolveScrollTopAfterPrepend({ previousScrollTop: 240, prependedHeight })).toBe(472);
  });

  it("windows around measured offsets instead of a fixed estimate", () => {
    const heights = new Map<string, number>([
      ["m1", 200],
      ["m2", 40],
      ["m3", 300],
      ["m4", 60],
    ]);
    const range = computeMeasuredVirtualizedMessageRange(["m1", "m2", "m3", "m4"], heights, 180, 220);
    expect(range.start).toBe(0);
    expect(range.end).toBeGreaterThan(0);
    expect(range.spacerBefore).toBe(0);
    expect(range.spacerAfter).toBeGreaterThanOrEqual(0);
  });
});
