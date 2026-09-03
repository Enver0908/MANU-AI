import { describe, expect, it } from "vitest";
import { digestManualEntitlementRequest } from "./commercial-admin-store";

describe("commercial admin request hash", () => {
  it("keeps identical reactivate payloads idempotent and rejects hash mismatches", async () => {
    const payload = {
      action: "reactivate" as const,
      inviteId: "invite-1",
      paymentReference: "ADMIN-REACTIVATE-1",
      paidThrough: "2026-10-01T00:00:00.000Z",
      requestId: "reactivate-req-1",
      expectedRevision: 4,
    };

    const first = await digestManualEntitlementRequest(payload);
    const second = await digestManualEntitlementRequest(payload);
    const mismatchedAction = await digestManualEntitlementRequest({ ...payload, action: "renew" });
    const mismatchedRevision = await digestManualEntitlementRequest({
      ...payload,
      expectedRevision: 5,
    });

    expect(first).toHaveLength(64);
    expect(second).toBe(first);
    expect(mismatchedAction).not.toBe(first);
    expect(mismatchedRevision).not.toBe(first);
  });
});
