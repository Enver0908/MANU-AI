import { describe, expect, it } from "vitest";
import { AppDomainError } from "./app-errors";
import { mapStage6PersistenceError, STAGE_6_REVISION_CONFLICT, Stage6ContractError } from "./phase-85-stage-6-dashboard-contracts";
import { stage6ErrorResponse } from "./phase-85-stage-6-api";

describe("phase-85-stage-6-api errors", () => {
  it("maps stale persistence errors to revision_conflict with source metadata", async () => {
    const mapped = mapStage6PersistenceError(
      new AppDomainError(409, "profile_stale_recreate_required"),
      "food_rule_profile",
      4,
    );
    expect(mapped).toBeInstanceOf(Stage6ContractError);
    expect((mapped as Stage6ContractError).code).toBe(STAGE_6_REVISION_CONFLICT);
    const response = stage6ErrorResponse(mapped);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe("revision_conflict");
    expect(body.sourceType).toBe("food_rule_profile");
    expect(body.currentRevision).toBe(4);
    expect(body.state).toBeUndefined();
  });
});
