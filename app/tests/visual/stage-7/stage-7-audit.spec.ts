import { test } from "@playwright/test";
import { buildStage7Scenarios, scenariosForProject } from "./stage-7-catalog";
import { runStage7Scenario } from "./stage-7-runner";

const requestedProject = process.env.STAGE7_PROJECT_NAME ?? "";
const catalog = requestedProject ? scenariosForProject(requestedProject) : buildStage7Scenarios();

for (const scenario of catalog) {
  test(`stage7 ${scenario.id}`, async ({ page }, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("stage-7-"),
      "Stage 7 scenarios run only on dedicated stage-7 projects",
    );
    const assigned = scenariosForProject(testInfo.project.name).some((item) => item.id === scenario.id);
    test.skip(!assigned, `Scenario ${scenario.id} is not assigned to ${testInfo.project.name}`);
    test.setTimeout(60_000);
    await runStage7Scenario(page, scenario, testInfo);
  });
}
