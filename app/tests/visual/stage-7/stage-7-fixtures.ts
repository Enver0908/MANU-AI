export const STAGE7_CLOCK = "2026-08-22T09:00:00+03:00";
export const STAGE7_TIMEZONE = "Europe/Istanbul";
export const STAGE7_DEFAULT_LOCALE = "tr-TR";

export const STAGE7_SYNTHETIC = {
  tenantId: "tenant-stage7-001",
  ownerEmail: "owner.stage7@example.com",
  adminEmail: "admin.stage7@example.com",
  dietitianEmail: "dietitian.stage7@example.com",
  assistantEmail: "assistant.stage7@example.com",
  auditorEmail: "auditor.stage7@example.com",
  inviteToken: "stage7-invite-token",
  checkoutSessionId: "cs_test_stage7_0001",
  phone: "+15555550100",
  longUnbrokenToken: "SupercalifragilisticexpialidociousStage7OverflowProbeToken",
  longDisplayName: "Stage7 Synthetic Client With An Exceptionally Long Display Name For Overflow",
  multilineNote: [
    "SYNTHETIC_NOTE: this is not a real clinical record.",
    "Placeholder meal timing and hydration reminder for layout stress only.",
    "Do not treat this text as health advice or production data.",
  ].join("\n"),
} as const;

export const STAGE7_CLIENTS = Array.from({ length: 24 }, (_, index) => ({
  id: `client-stage7-${String(index + 1).padStart(3, "0")}`,
  displayName:
    index === 1
      ? STAGE7_SYNTHETIC.longDisplayName
      : `Stage7 Client ${String(index + 1).padStart(2, "0")}`,
  reference: `S7-${String(index + 1).padStart(3, "0")}`,
}));

export const STAGE7_CONVERSATIONS = STAGE7_CLIENTS.slice(0, 12).map((client, index) => ({
  id: `conversation-stage7-${String(index + 1).padStart(3, "0")}`,
  clientId: client.id,
  preview: index % 5 === 0 ? STAGE7_SYNTHETIC.longUnbrokenToken : `Synthetic preview ${index + 1}`,
}));

export type Stage7FixtureProfile =
  | "public-default"
  | "public-error"
  | "auth-sent"
  | "auth-invalid"
  | "auth-rate-limited"
  | "auth-service-error"
  | "purchase-valid"
  | "purchase-invalid"
  | "purchase-expired"
  | "purchase-consumed"
  | "purchase-pending"
  | "onboarding-claimable"
  | "onboarding-incomplete"
  | "onboarding-duplicate"
  | "onboarding-already-claimed"
  | "onboarding-pending"
  | "onboarding-error"
  | "install-eligible"
  | "install-ineligible"
  | "install-installed"
  | "install-non-installable"
  | "install-revoked"
  | "admin-empty"
  | "admin-dense"
  | "admin-error"
  | "admin-unauthorized"
  | "admin-non-allowlisted"
  | "dashboard-empty"
  | "dashboard-dense"
  | "dashboard-error"
  | "dashboard-conflict"
  | "dashboard-forbidden"
  | "pwa-fallback";

export function fixtureById(fixtureId: string): Stage7FixtureProfile {
  return fixtureId as Stage7FixtureProfile;
}

export function redactedFixtureRecord() {
  return {
    clock: STAGE7_CLOCK,
    timezone: STAGE7_TIMEZONE,
    emails: [
      STAGE7_SYNTHETIC.ownerEmail,
      STAGE7_SYNTHETIC.adminEmail,
      STAGE7_SYNTHETIC.dietitianEmail,
      STAGE7_SYNTHETIC.assistantEmail,
      STAGE7_SYNTHETIC.auditorEmail,
    ],
    phone: STAGE7_SYNTHETIC.phone,
    tenantId: STAGE7_SYNTHETIC.tenantId,
    clients: STAGE7_CLIENTS.map((client) => ({ id: client.id, displayName: client.displayName })),
    conversations: STAGE7_CONVERSATIONS.map((item) => ({ id: item.id, clientId: item.clientId })),
  };
}
