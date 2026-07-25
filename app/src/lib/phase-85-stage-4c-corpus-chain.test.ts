import { describe, expect, it } from "vitest";
import {
  buildStage4CGoldenCorpusCases,
  buildStage4CRedTeamCorpusCases,
  STAGE_4C_RED_TEAM_MIN_CASES,
} from "./phase-85-stage-4c-golden-corpus-catalog";
import { validateStage4CCorpusCatalog } from "./phase-85-stage-4c-corpus-chain";

describe("phase 85 stage 4c corpus chain", () => {
  it("validates golden and red-team corpus schemas", () => {
    const goldenFailures = validateStage4CCorpusCatalog(buildStage4CGoldenCorpusCases());
    const redTeamFailures = validateStage4CCorpusCatalog(buildStage4CRedTeamCorpusCases());
    expect(goldenFailures).toEqual([]);
    expect(redTeamFailures).toEqual([]);
  });

  it("keeps the adversarial corpus at exactly 100 cases", () => {
    expect(buildStage4CRedTeamCorpusCases()).toHaveLength(STAGE_4C_RED_TEAM_MIN_CASES);
  });
});
