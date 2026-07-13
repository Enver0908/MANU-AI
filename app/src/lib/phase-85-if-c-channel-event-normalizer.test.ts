import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeChannelEventBatch, type RawChannelEventCandidate } from "./phase-85-if-c-channel-event-normalizer";
import type { ChannelEventKind } from "./types";

type GoldenCandidateExpectation = {
  eventKind: ChannelEventKind;
  providerEventId?: string;
  providerMessageId?: string;
  fromIdentity?: string;
  toIdentity?: string;
  counterpartyIdentity?: string;
  body?: string;
  providerMediaId?: string;
  declaredMimeType?: string;
};

type ChannelEventGoldenCase = {
  id: string;
  category: string;
  secretMarker: string;
  payload: unknown;
  expectOk: boolean;
  expectCandidates?: GoldenCandidateExpectation[];
};

const goldenCasesPath = join(dirname(fileURLToPath(import.meta.url)), "phase-85-if-c-channel-event-golden-cases.jsonl");

function loadChannelEventGoldenCases(): ChannelEventGoldenCase[] {
  return readFileSync(goldenCasesPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChannelEventGoldenCase);
}

function matchesExpectation(candidate: RawChannelEventCandidate, expectation: GoldenCandidateExpectation) {
  if (candidate.eventKind !== expectation.eventKind) return false;
  if (expectation.providerEventId !== undefined && candidate.providerEventId !== expectation.providerEventId) return false;
  if (expectation.providerMessageId !== undefined && candidate.providerMessageId !== expectation.providerMessageId) return false;
  if (expectation.fromIdentity !== undefined && candidate.fromIdentity !== expectation.fromIdentity) return false;
  if (expectation.toIdentity !== undefined && candidate.toIdentity !== expectation.toIdentity) return false;
  if (expectation.counterpartyIdentity !== undefined && candidate.counterpartyIdentity !== expectation.counterpartyIdentity) return false;
  if (expectation.body !== undefined && candidate.body !== expectation.body) return false;
  if (expectation.providerMediaId !== undefined && candidate.providerMediaId !== expectation.providerMediaId) return false;
  if (expectation.declaredMimeType !== undefined && candidate.declaredMimeType !== expectation.declaredMimeType) return false;
  return true;
}

describe("phase 85 if-c channel event normalizer", () => {
  it("loads thirteen golden categories from jsonl", () => {
    const cases = loadChannelEventGoldenCases();
    expect(cases).toHaveLength(13);
    expect(new Set(cases.map((item) => item.category)).size).toBe(13);
  });

  it("evaluates every golden case without leaking secrets", () => {
    for (const goldenCase of loadChannelEventGoldenCases()) {
      const result = normalizeChannelEventBatch(goldenCase.payload);
      const serialized = JSON.stringify(result);

      expect(serialized, goldenCase.id).not.toContain(goldenCase.secretMarker);
      expect(serialized, goldenCase.id).not.toContain("SYNTHETIC_IFC_SECRET");

      expect(result.ok, goldenCase.id).toBe(goldenCase.expectOk);
      if (!result.ok) {
        continue;
      }

      const expectedCandidates = goldenCase.expectCandidates || [];
      expect(result.candidates.length, goldenCase.id).toBe(expectedCandidates.length);

      for (const expectation of expectedCandidates) {
        const found = result.candidates.some((candidate) => matchesExpectation(candidate, expectation));
        expect(found, `${goldenCase.id} expected ${JSON.stringify(expectation)} in ${JSON.stringify(result.candidates)}`).toBe(true);
      }
    }
  });

  it("processes every entry/change/item in a batch independently", () => {
    const goldenCase = loadChannelEventGoldenCases().find((item) => item.id === "ifc-batch-multi-item");
    expect(goldenCase).toBeDefined();

    const result = normalizeChannelEventBatch(goldenCase!.payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.candidates).toHaveLength(3);
    expect(result.candidates.map((candidate) => candidate.eventKind)).toEqual([
      "client_message_text",
      "client_message_text",
      "outbound_status",
    ]);
  });

  it("never infers event kind from message body text", () => {
    const result = normalizeChannelEventBatch({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "SYNTHETIC_WABA_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
                messages: [
                  {
                    from: "905551110001",
                    id: "wamid.IFC_TEXT_LOOKS_LIKE_STATUS",
                    timestamp: "1720000080",
                    type: "text",
                    text: { body: "delivered" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0].eventKind).toBe("client_message_text");
    expect(result.candidates[0].body).toBe("delivered");
  });

  it("uses observed time and flags an invalid provider timestamp without changing event kind", () => {
    const result = normalizeChannelEventBatch({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "SYNTHETIC_WABA_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "SYNTHETIC_PHONE_1" },
                messages: [
                  {
                    from: "905551110001",
                    id: "wamid.IFC_INVALID_TIME",
                    timestamp: "not-a-provider-time",
                    type: "text",
                    text: { body: "Merhaba" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0]).toMatchObject({
      eventKind: "client_message_text",
      providerTime: null,
      providerTimeInvalid: true,
    });
  });

  it("does not throw on unparseable circular-safe malformed items", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [{ id: "SYNTHETIC_WABA_1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages: [null] } }] }],
    };

    expect(() => normalizeChannelEventBatch(payload)).not.toThrow();
    const result = normalizeChannelEventBatch(payload);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.candidates[0].eventKind).toBe("malformed_event");
  });
});
