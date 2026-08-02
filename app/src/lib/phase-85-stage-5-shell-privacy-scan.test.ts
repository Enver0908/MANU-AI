import { describe, expect, it } from "vitest";
import type { ShellActiveClientDto } from "./phase-85-stage-5-shell-contracts";

const SHELL_ACTIVE_CLIENT_DTO_KEYS = [
  "id",
  "fullName",
  "referenceShort",
  "riskLevel",
  "handoffState",
  "channelReadiness",
  "aiMode",
] as const;

const FORBIDDEN_SHELL_KEYS = [
  "clinicalNotes",
  "formResponses",
  "nutritionPlan",
  "rawMessage",
  "attachment",
  "transcript",
  "prompt",
  "stripe",
  "password",
  "phoneE164",
];

describe("phase-85-stage-5-shell-privacy-scan", () => {
  it("active client DTO allowlist excludes PHI-heavy fields", () => {
    for (const forbidden of FORBIDDEN_SHELL_KEYS) {
      expect(SHELL_ACTIVE_CLIENT_DTO_KEYS.some((key) => key.toLowerCase().includes(forbidden.toLowerCase()))).toBe(
        false,
      );
    }
  });

  it("sample active client only exposes allowlisted identity/status fields", () => {
    const client: ShellActiveClientDto = {
      id: "00000000-0000-4000-8000-000000000001",
      fullName: "Demo Client",
      referenceShort: "DC-1",
      riskLevel: "green",
      handoffState: "none",
      channelReadiness: "ready",
      aiMode: "active",
    };
    expect(Object.keys(client).sort()).toEqual([...SHELL_ACTIVE_CLIENT_DTO_KEYS].sort());
  });
});
