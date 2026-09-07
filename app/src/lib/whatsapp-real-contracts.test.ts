import { describe, expect, it } from "vitest";
import {
  buildWhatsAppRealEventAdmission,
  buildWhatsAppWebhookSignature,
  decideWhatsAppSendRetry,
  evaluateWhatsAppWebhookChallenge,
  shouldApplyWhatsAppDeliveryTransition,
  verifyWhatsAppWebhookSignature,
} from "./whatsapp-real-contracts";

const rawBody = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "phone-1", display_phone_number: "+905551112233" },
            messages: [{ id: "wamid.inbound-1", from: "905551110000", type: "text", text: { body: "Merhaba" } }],
          },
        },
      ],
    },
  ],
});

describe("real WhatsApp contracts", () => {
  it("accepts only the configured Meta webhook challenge token", () => {
    expect(
      evaluateWhatsAppWebhookChallenge(
        { mode: "subscribe", verifyToken: "verify-token", challenge: "challenge-value" },
        "verify-token",
      ),
    ).toEqual({ ok: true, challenge: "challenge-value" });

    expect(
      evaluateWhatsAppWebhookChallenge(
        { mode: "subscribe", verifyToken: "wrong", challenge: "challenge-value" },
        "verify-token",
      ),
    ).toEqual({ ok: false, status: 403, code: "invalid_challenge_token" });
  });

  it("verifies X-Hub-Signature-256 against the raw request body before JSON parsing", () => {
    const signature = buildWhatsAppWebhookSignature(rawBody, "app-secret");

    expect(verifyWhatsAppWebhookSignature({ rawBody, signatureHeader: signature, appSecret: "app-secret" })).toEqual({
      ok: true,
    });
    expect(
      verifyWhatsAppWebhookSignature({
        rawBody: `${rawBody} `,
        signatureHeader: signature,
        appSecret: "app-secret",
      }),
    ).toEqual({ ok: false, code: "invalid_signature" });
  });

  it("normalizes real webhook events without enabling any AI side effect", () => {
    const admission = buildWhatsAppRealEventAdmission(JSON.parse(rawBody));

    expect(admission.ok).toBe(true);
    if (!admission.ok) return;
    expect(admission.candidates).toHaveLength(1);
    expect(admission.candidates[0]).toMatchObject({
      eventKind: "client_message_text",
      wabaId: "waba-1",
      businessPhoneNumberId: "phone-1",
      providerEventId: "wamid.inbound-1",
    });
  });

  it("does not regress delivered/read delivery states and treats ambiguous transport as unknown", () => {
    expect(shouldApplyWhatsAppDeliveryTransition({ current: "delivered", next: "sent" })).toBe(false);
    expect(shouldApplyWhatsAppDeliveryTransition({ current: "sent", next: "delivered" })).toBe(true);
    expect(shouldApplyWhatsAppDeliveryTransition({ current: "sent", next: "unknown" })).toBe(true);
    expect(decideWhatsAppSendRetry({ failureClass: "ambiguous_network", retryCount: 0, now: "2026-08-30T12:00:00.000Z" })).toEqual({
      retry: false,
      reason: "ambiguous_transport_unknown",
    });
  });

  it("limits definite temporary provider retries to three attempts", () => {
    expect(
      decideWhatsAppSendRetry({
        failureClass: "definite_temporary",
        retryCount: 2,
        retryAfterSeconds: 30,
        now: "2026-08-30T12:00:00.000Z",
      }),
    ).toEqual({
      retry: true,
      nextAttemptAt: "2026-08-30T12:00:30.000Z",
      reason: "temporary_provider_failure",
    });
    expect(
      decideWhatsAppSendRetry({
        failureClass: "definite_temporary",
        retryCount: 3,
        now: "2026-08-30T12:00:00.000Z",
      }),
    ).toEqual({ retry: false, reason: "retry_budget_exhausted" });
  });
});
