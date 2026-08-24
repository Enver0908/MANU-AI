import { headers } from "next/headers";

export async function readStage7ScenarioState(): Promise<string | null> {
  const headerStore = await headers();
  const scenarioId = headerStore.get("x-manu-stage7-scenario")?.trim() ?? "";
  if (!scenarioId) {
    return null;
  }
  const [, state] = scenarioId.split(".");
  return state || null;
}
