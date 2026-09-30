import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed-data";
import { mergeStage6MutationIntoAppState, projectStage6Workspace, shouldApplyStage6Response } from "./phase-85-stage-6-client-workspace";
import { scopedMutation } from "./phase-85-stage-6-dashboard-contracts";
import { isStage6EmptyNutritionResponse } from "./use-stage-6-client-workspace";

describe("phase-85-stage-6-client-workspace", () => {
  it("builds a workspace summary with revisions and capabilities", () => {
    const state = createInitialState();
    const client = state.clients[0]!;
    const summary = projectStage6Workspace(state, client.id, { role: "dietitian" });
    expect(summary.clientId).toBe(client.id);
    expect(summary.contextRevision).toBe(client.contextRevision);
    expect(summary.capabilities.canUpdateClient).toBe(true);
    expect(summary.aiControl.aiStatus).toBe(client.aiStatus);
  });

  it("does not apply a late previous-client mutation to the current client", () => {
    const state = createInitialState();
    const current = state.clients[0]!;
    const other = state.clients[1]!;
    const response = scopedMutation(
      "client_patch",
      other.id,
      {
        client: {
          ...other,
          fullName: "Stale Name",
        },
      },
      { clientContextRevision: other.contextRevision },
      null,
    );
    expect(shouldApplyStage6Response(response, current.id)).toBe(false);
    const merged = mergeStage6MutationIntoAppState(state, response);
    expect(merged.clients.find((item) => item.id === other.id)?.fullName).toBe("Stale Name");
    expect(merged.clients.find((item) => item.id === current.id)?.fullName).toBe(current.fullName);
  });

  it("treats an absent nutrition profile as an empty workspace domain", () => {
    expect(isStage6EmptyNutritionResponse("nutrition", 404, "client_food_rule_profile_not_found")).toBe(true);
    expect(isStage6EmptyNutritionResponse("forms", 404, "client_food_rule_profile_not_found")).toBe(false);
    expect(isStage6EmptyNutritionResponse("nutrition", 403, "client_food_rule_profile_not_found")).toBe(false);
    expect(isStage6EmptyNutritionResponse("nutrition", 404, "client_not_found")).toBe(false);
  });
});
