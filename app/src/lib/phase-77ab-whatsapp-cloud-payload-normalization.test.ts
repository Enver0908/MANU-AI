import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { processMockChannelInbound } from "./channel-adapters";
import { resetRateLimits } from "./rate-limit";
import {
  normalizeWhatsAppCloudPayload,
  toInboundSimulationRequestFromNormalizedEvent,
  type WhatsAppCloudNormalizationCode,
} from "./whatsapp-cloud-payload-normalizer";

type WhatsAppCloudGoldenCase = {
  id: string;
  category: string;
  secretMarker: string;
  payload: unknown;
  expectOk: boolean;
  expectCode: WhatsAppCloudNormalizationCode | null;
  expectBody?: string;
  expectConversationType?: "direct" | "group";
  expectProviderEventId?: string;
  expectChannelUserId?: string;
  expectSourceConversationId?: string;
  expectReceivedAt?: string;
};

const goldenCasesPath = join(dirname(fileURLToPath(import.meta.url)), "whatsapp-cloud-payload-golden-cases.jsonl");

function loadWhatsAppCloudGoldenCases(): WhatsAppCloudGoldenCase[] {
  return readFileSync(goldenCasesPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as WhatsAppCloudGoldenCase);
}

describe("phase 77ab whatsapp cloud payload normalization", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("loads six parser golden categories from jsonl", () => {
    const cases = loadWhatsAppCloudGoldenCases();
    expect(cases).toHaveLength(6);
    expect(cases.map((item) => item.category)).toEqual([
      "direct_text",
      "missing_event_id",
      "empty_body",
      "unsupported_media",
      "group_context",
      "malformed_payload",
    ]);
  });

  it("evaluates parser golden cases", () => {
    for (const goldenCase of loadWhatsAppCloudGoldenCases()) {
      const result = normalizeWhatsAppCloudPayload(goldenCase.payload);
      const serialized = JSON.stringify(result);

      expect(serialized, goldenCase.id).not.toContain(goldenCase.secretMarker);
      expect(serialized, goldenCase.id).not.toContain("SYNTHETIC_WEBHOOK_SECRET");

      if (!goldenCase.expectOk) {
        expect(result.ok, goldenCase.id).toBe(false);
        if (!result.ok) {
          expect(result.code, goldenCase.id).toBe(goldenCase.expectCode);
        }
        continue;
      }

      expect(result.ok, goldenCase.id).toBe(true);
      if (!result.ok) {
        continue;
      }

      expect(result.event.body, goldenCase.id).toBe(goldenCase.expectBody);
      expect(result.event.sourceConversationType, goldenCase.id).toBe(goldenCase.expectConversationType);
      expect(result.event.providerEventId, goldenCase.id).toBe(goldenCase.expectProviderEventId);
      expect(result.event.channelUserId, goldenCase.id).toBe(goldenCase.expectChannelUserId);
      expect(result.event.receivedAt, goldenCase.id).toBe(goldenCase.expectReceivedAt);
      if (goldenCase.expectSourceConversationId) {
        expect(result.event.sourceConversationId, goldenCase.id).toBe(goldenCase.expectSourceConversationId);
      }
      expect(result.simulationRequest.idempotencyKey, goldenCase.id).toBe(goldenCase.expectProviderEventId);
      expect(result.simulationRequest.sourceConversationType, goldenCase.id).toBe(goldenCase.expectConversationType);
    }
  });

  it("fails closed on out-of-range numeric timestamps without throwing", () => {
    const payload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    id: "wamid.timestamp-overflow",
                    from: "905551110001",
                    timestamp: "999999999999999",
                    type: "text",
                    text: { body: "Timestamp guard smoke test" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(() => normalizeWhatsAppCloudPayload(payload)).not.toThrow();
    const result = normalizeWhatsAppCloudPayload(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.receivedAt).toBeUndefined();
    }
  });

  it("maps a normalized direct-text event into an inbound simulation request", () => {
    const goldenCase = loadWhatsAppCloudGoldenCases().find((item) => item.id === "wa-direct-text");
    expect(goldenCase).toBeDefined();

    const normalized = normalizeWhatsAppCloudPayload(goldenCase!.payload);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) {
      return;
    }

    const simulationRequest = toInboundSimulationRequestFromNormalizedEvent(normalized.event, "client-mert");
    expect(simulationRequest).toEqual({
      clientId: "client-mert",
      body: "Bugun kahvaltida ne yiyebilirim?",
      idempotencyKey: "wamid.SYNTH_DIRECT_1",
      channel: "whatsapp",
      sourceConversationType: "direct",
      sourceConversationId: undefined,
      sourceMessageId: "wamid.SYNTH_DIRECT_1",
      senderChannelUserId: "905551110001",
      now: "2024-05-25T10:40:00.000Z",
    });
  });

  it("routes a normalized direct-text event through the existing mock channel adapter", async () => {
    const goldenCase = loadWhatsAppCloudGoldenCases().find((item) => item.id === "wa-direct-text");
    expect(goldenCase).toBeDefined();

    const normalized = normalizeWhatsAppCloudPayload(goldenCase!.payload);
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) {
      return;
    }

    const next = await processMockChannelInbound(createInitialState(), {
      ...normalized.event,
      channelUserId: "+905551110001",
    });

    expect(next.lastSimulation?.action).toBe("sent");
    expect(next.processedSimulationKeys).toContain("wamid.SYNTH_DIRECT_1");
  });

  it("fail-closes malformed payloads without echoing webhook secrets", () => {
    const result = normalizeWhatsAppCloudPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  phone_number_id: "SYNTHETIC_PHONE_NUMBER_ID",
                },
                messages: [
                  {
                    from: "905551110001",
                    id: "wamid.SYNTH_BAD_STRUCTURE",
                    timestamp: "1716633600",
                    type: "text",
                    text: { body: "valid body" },
                  },
                  {
                    from: "905551110002",
                    id: "wamid.SYNTH_BAD_STRUCTURE_2",
                    timestamp: "1716633601",
                    type: "text",
                    text: { body: "second message should fail" },
                  },
                ],
              },
            },
          ],
        },
      ],
      webhook_secret: "SYNTHETIC_WEBHOOK_SECRET_DO_NOT_STORE",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.code).toBe("malformed_payload");
    expect(JSON.stringify(result)).not.toContain("SYNTHETIC_WEBHOOK_SECRET_DO_NOT_STORE");
  });
});
