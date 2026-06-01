import { beforeEach, describe, expect, it } from "vitest";
import { POST as postAnonymizeClient } from "./clients/[id]/anonymize/route";
import { GET as getClientExport } from "./clients/[id]/export/route";
import { POST as postRemoveClient } from "./clients/[id]/remove/route";
import { POST as postInternalCopilotMessage } from "./internal-copilot/messages/route";
import { POST as postDraftAction } from "./messages/drafts/[id]/route";
import { POST as postAcknowledgeNotification } from "./notifications/[id]/acknowledge/route";
import { POST as postReadNotification } from "./notifications/[id]/read/route";
import { POST as postSimulator } from "./simulator/route";
import { resetFallbackState } from "@/lib/app-state-store";

describe("API controlled domain errors", () => {
  beforeEach(() => {
    process.env.MANU_DEV_FALLBACK_STORE = "true";
    resetFallbackState();
  });

  it("returns a controlled error for unknown simulator clients", async () => {
    const response = await postSimulator(
      new Request("http://localhost/api/simulator", {
        method: "POST",
        body: JSON.stringify({
          clientId: "missing-client",
          body: "Bugun kahvaltida ne yiyebilirim?",
          idempotencyKey: "missing-client",
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("client_not_found");
  });

  it("quarantines group simulator messages without a client id in fallback mode", async () => {
    const response = await postSimulator(
      new Request("http://localhost/api/simulator", {
        method: "POST",
        body: JSON.stringify({
          body: "Group message",
          idempotencyKey: "api-group-quarantine",
          channel: "whatsapp",
          sourceConversationType: "group",
          sourceConversationId: "wa-group-api",
        }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.lastSimulation.blockedReason).toBe("whatsapp_group_unsupported");
    expect(payload.inboundQuarantines).toHaveLength(1);
    expect(payload.messages.every((message: { body: string }) => message.body !== "Group message")).toBe(true);
  });

  it("returns a controlled error for non-draft draft actions", async () => {
    const response = await postDraftAction(
      new Request("http://localhost/api/messages/drafts/message-seed-1", {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      }) as never,
      { params: Promise.resolve({ id: "message-seed-1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("message_not_ai_draft");
  });

  it("returns a client-scoped export in fallback mode", async () => {
    const response = await getClientExport(new Request("http://localhost/api/clients/client-mert/export") as never, {
      params: Promise.resolve({ id: "client-mert" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clientId).toBe("client-mert");
    expect(payload.messages.every((message: { conversationId: string }) => message.conversationId === "conversation-client-mert")).toBe(true);
  });

  it("anonymizes client data in fallback mode", async () => {
    const response = await postAnonymizeClient(
      new Request("http://localhost/api/clients/client-mert/anonymize", { method: "POST" }) as never,
      { params: Promise.resolve({ id: "client-mert" }) },
    );
    const payload = await response.json();
    const client = payload.clients.find((item: { id: string }) => item.id === "client-mert");

    expect(response.status).toBe(200);
    expect(client.fullName).toBe("Anonymized Client");
    expect(client.channelPermission).toBe("blocked");
  });

  it("removes client data through fallback soft-delete anonymization", async () => {
    const response = await postRemoveClient(
      new Request("http://localhost/api/clients/client-mert/remove", { method: "POST" }) as never,
      { params: Promise.resolve({ id: "client-mert" }) },
    );
    const payload = await response.json();
    const client = payload.clients.find((item: { id: string }) => item.id === "client-mert");

    expect(response.status).toBe(200);
    expect(client.lifecycleStatus).toBe("removed_anonymized");
    expect(client.primaryPhoneE164).toBeNull();
    expect(client.channelUserId).toBe("");
    expect(payload.dataRequests.at(-1).requestType).toBe("deletion");
  });

  it("marks and acknowledges notifications in fallback mode", async () => {
    const simulationResponse = await postSimulator(
      new Request("http://localhost/api/simulator", {
        method: "POST",
        body: JSON.stringify({
          clientId: "client-mert",
          body: "Alerjiden nefes alamiyorum, bogazim sisti.",
          idempotencyKey: "notification-api-red",
        }),
      }) as never,
    );
    const simulationPayload = await simulationResponse.json();
    const notificationId = simulationPayload.notifications[0].id;

    const readResponse = await postReadNotification(new Request("http://localhost/api/notifications/read") as never, {
      params: Promise.resolve({ id: notificationId }),
    });
    const readPayload = await readResponse.json();
    expect(readResponse.status).toBe(200);
    expect(readPayload.notifications[0].read).toBe(true);

    const acknowledgeResponse = await postAcknowledgeNotification(
      new Request("http://localhost/api/notifications/acknowledge") as never,
      {
        params: Promise.resolve({ id: notificationId }),
      },
    );
    const acknowledgePayload = await acknowledgeResponse.json();
    expect(acknowledgeResponse.status).toBe(200);
    expect(acknowledgePayload.notifications[0].acknowledgedAt).not.toBeNull();
  });

  it("returns a controlled error for unknown notification actions", async () => {
    const response = await postReadNotification(new Request("http://localhost/api/notifications/missing/read") as never, {
      params: Promise.resolve({ id: "missing-notification" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("notification_not_found");
  });

  it("persists internal copilot messages and tool calls in fallback mode", async () => {
    const response = await postInternalCopilotMessage(
      new Request("http://localhost/api/internal-copilot/messages", {
        method: "POST",
        body: JSON.stringify({ body: "Mert diyet plan ozeti" }),
      }) as never,
    );
    const payload = await response.json();
    const assistant = payload.internalCopilotMessages.at(-1);

    expect(response.status).toBe(200);
    expect(payload.internalCopilotMessages).toHaveLength(2);
    expect(payload.internalCopilotToolCalls.some((call: { toolName: string }) => call.toolName === "getClientDietPlan")).toBe(true);
    expect(assistant.sourceRefs.some((ref: { entityType: string }) => ref.entityType === "client")).toBe(true);
  });

  it("requires a body for internal copilot messages", async () => {
    const response = await postInternalCopilotMessage(
      new Request("http://localhost/api/internal-copilot/messages", {
        method: "POST",
        body: JSON.stringify({ body: "" }),
      }) as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("internal_copilot_body_required");
  });
});
