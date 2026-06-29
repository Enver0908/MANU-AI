import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getWhatsAppWebhook, POST as postWhatsAppWebhook } from "@/app/api/whatsapp/webhook/route";
import { resetFallbackState } from "@/lib/app-state-store";
import { createInitialState } from "@/lib/seed-data";
import { resetRateLimits } from "@/lib/rate-limit";
import {
  isMockWhatsAppWebhookEnabled,
  processWhatsAppMockWebhookInState,
} from "@/lib/whatsapp-mock-webhook";

type GoldenPayloadCase = {
  id: string;
  payload: unknown;
  secretMarker?: string;
};

const goldenCasesPath = join(dirname(fileURLToPath(import.meta.url)), "whatsapp-cloud-payload-golden-cases.jsonl");

function loadGoldenPayload(id: string) {
  const cases = readFileSync(goldenCasesPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldenPayloadCase);
  const match = cases.find((item) => item.id === id);
  if (!match) {
    throw new Error(`missing golden payload: ${id}`);
  }
  return match;
}

function buildWebhookRequest(payload: unknown, secretMarker?: string) {
  return new Request("http://localhost/api/whatsapp/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      secretMarker
        ? {
            ...(payload as Record<string, unknown>),
            webhook_secret: secretMarker,
          }
        : payload,
    ),
  }) as never;
}

describe("phase 77ac whatsapp mock webhook boundary", () => {
  const previousFlag = process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK;
  const previousFallback = process.env.MANU_DEV_FALLBACK_STORE;

  beforeEach(() => {
    resetRateLimits();
    resetFallbackState();
    process.env.MANU_DEV_FALLBACK_STORE = "true";
    delete process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK;
  });

  afterEach(() => {
    if (previousFlag === undefined) {
      delete process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK;
    } else {
      process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = previousFlag;
    }

    if (previousFallback === undefined) {
      delete process.env.MANU_DEV_FALLBACK_STORE;
    } else {
      process.env.MANU_DEV_FALLBACK_STORE = previousFallback;
    }
  });

  it("keeps the mock webhook disabled by default", () => {
    expect(isMockWhatsAppWebhookEnabled()).toBe(false);
  });

  it("returns 403 disabled for GET and POST when the mock flag is off", async () => {
    const getResponse = await getWhatsAppWebhook();
    const postResponse = await postWhatsAppWebhook(buildWebhookRequest(loadGoldenPayload("wa-direct-text").payload));

    expect(getResponse.status).toBe(403);
    expect(postResponse.status).toBe(403);
    expect(await getResponse.json()).toEqual({ error: "disabled" });
    expect(await postResponse.json()).toEqual({ error: "disabled" });
  });

  it("processes direct-text payloads for known identities without echoing webhook secrets", async () => {
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    const golden = loadGoldenPayload("wa-direct-text");
    const response = await postWhatsAppWebhook(buildWebhookRequest(golden.payload, golden.secretMarker));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("processed");
    expect(body.action).toBe("sent");
    expect(JSON.stringify(body)).not.toContain(golden.secretMarker || "");
  });

  it("quarantines unknown identities without creating messages or AI decisions", async () => {
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    const state = createInitialState();
    const golden = loadGoldenPayload("wa-direct-text");
    const payload = structuredClone(golden.payload) as {
      entry: Array<{ changes: Array<{ value: { messages: Array<{ from: string }> } }> }>;
    };
    payload.entry[0].changes[0].value.messages[0].from = "900000000000";

    const { state: next, result } = await processWhatsAppMockWebhookInState(state, payload);

    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("identity_quarantine_unknown_channel_identity");
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
    expect(next.auditEvents.some((event) => event.eventType === "channel_identity_quarantined")).toBe(true);
  });

  it("quarantines ambiguous identities without creating messages or AI decisions", async () => {
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    const state = createInitialState();
    const duplicateClient = {
      ...state.clients[0],
      id: "client-duplicate-mert",
      fullName: "Duplicate Mert",
    };
    const ambiguousState = {
      ...state,
      clients: [...state.clients, duplicateClient],
    };
    const golden = loadGoldenPayload("wa-direct-text");

    const { state: next, result } = await processWhatsAppMockWebhookInState(ambiguousState, golden.payload);

    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("identity_quarantine_ambiguous_channel_identity");
    expect(next.messages).toHaveLength(ambiguousState.messages.length);
    expect(next.aiDecisions).toHaveLength(ambiguousState.aiDecisions.length);
  });

  it("ignores duplicate inbound provider events without duplicate sends", async () => {
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    const golden = loadGoldenPayload("wa-direct-text");
    const first = await processWhatsAppMockWebhookInState(createInitialState(), golden.payload);
    const second = await processWhatsAppMockWebhookInState(first.state, golden.payload);

    expect(second.result.status).toBe("duplicate_ignored");
    expect(second.state.messages).toHaveLength(first.state.messages.length);
    expect(second.state.aiDecisions).toHaveLength(first.state.aiDecisions.length);
  });

  it("quarantines group context with minimized metadata and no raw body storage", async () => {
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    const state = createInitialState();
    const golden = loadGoldenPayload("wa-group-context");
    const { state: next, result } = await processWhatsAppMockWebhookInState(state, golden.payload);

    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("whatsapp_group_unsupported");
    expect(next.inboundQuarantines).toHaveLength(state.inboundQuarantines.length + 1);
    expect(next.messages).toHaveLength(state.messages.length);
    expect(next.aiDecisions).toHaveLength(state.aiDecisions.length);
    expect(JSON.stringify(next.inboundQuarantines[0])).not.toContain("Grup mesaji");
    expect(
      next.auditEvents.some(
        (event) =>
          event.eventType === "inbound_group_message_quarantined" &&
          event.metadata.rawBodyStored === false,
      ),
    ).toBe(true);
  });

  it("matches WhatsApp identities when Cloud payload omits the leading plus sign", async () => {
    process.env.MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK = "true";
    const golden = loadGoldenPayload("wa-direct-text");
    const { state: next, result } = await processWhatsAppMockWebhookInState(createInitialState(), golden.payload);

    expect(result.status).toBe("processed");
    expect(next.lastSimulation?.action).toBe("sent");
  });
});
