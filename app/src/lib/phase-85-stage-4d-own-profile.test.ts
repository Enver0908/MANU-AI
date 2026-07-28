import { describe, expect, it } from "vitest";
import {
  OwnProfileValidationError,
  mapOwnProfileRpcResult,
  parseOwnProfilePatchBody,
  validateDisplayName,
  validateTimezone,
  validateUiLanguage,
} from "./phase-85-stage-4d-own-profile";
import { updateOwnProfileInState } from "./app-state-store";
import { createInitialState } from "./seed-data";

describe("phase-85-stage-4d own profile", () => {
  it("accepts displayName, uiLanguage, and timezone patches with strict validation", () => {
    expect(parseOwnProfilePatchBody({ displayName: "Ada Lovelace", uiLanguage: "en", timezone: "Europe/London" })).toEqual({
      displayName: "Ada Lovelace",
      uiLanguage: "en",
      timezone: "Europe/London",
    });
    expect(parseOwnProfilePatchBody({ uiLanguage: "de" })).toEqual({ uiLanguage: "de" });
    expect(validateDisplayName("  Ada  ")).toBe("Ada");
    expect(validateUiLanguage("fr")).toBe("fr");
    expect(validateTimezone(" Europe/Istanbul ")).toBe("Europe/Istanbul");
  });

  it("rejects unknown fields, empty patches, and invalid values", () => {
    expect(() => parseOwnProfilePatchBody({ tenantId: "x" })).toThrow(OwnProfileValidationError);
    expect(() => parseOwnProfilePatchBody({})).toThrow(OwnProfileValidationError);
    expect(() => validateDisplayName("a")).toThrow(OwnProfileValidationError);
    expect(() => validateDisplayName("a\u0000b")).toThrow(OwnProfileValidationError);
    expect(() => validateUiLanguage("xx")).toThrow(OwnProfileValidationError);
    expect(() => validateTimezone("../secret")).toThrow(OwnProfileValidationError);
  });

  it("maps RPC payloads and tracks changed fields in fallback state", () => {
    const mapped = mapOwnProfileRpcResult({
      profile: { displayName: "RLS Owner", uiLanguage: "en", timezone: "Europe/London" },
      changedFields: ["displayName", "timezone"],
    });
    expect(mapped.profile.displayName).toBe("RLS Owner");
    expect(mapped.profile.timezone).toBe("Europe/London");
    expect(mapped.changedFields).toEqual(["displayName", "timezone"]);

    const initial = createInitialState();
    const first = updateOwnProfileInState(initial, { displayName: "New Name" });
    expect(first.changedFields).toEqual(["displayName"]);
    expect(first.state.dietitian.displayName).toBe("New Name");

    const second = updateOwnProfileInState(first.state, { displayName: "New Name" });
    expect(second.changedFields).toEqual([]);
    expect(second.state).toBe(first.state);

    const third = updateOwnProfileInState(second.state, { timezone: "Europe/London" });
    expect(third.changedFields).toEqual(["timezone"]);
    expect(third.state.dietitian.timezone).toBe("Europe/London");
  });
});
