import { headers } from "next/headers";

export type Stage7ScenarioHeader = {
  id: string;
  surface: string;
  state: string;
};

export async function readStage7ScenarioHeader(): Promise<Stage7ScenarioHeader | null> {
  const headerStore = await headers();
  const scenarioId = headerStore.get("x-manu-stage7-scenario")?.trim() ?? "";
  if (!scenarioId) {
    return null;
  }
  const [surface, state] = scenarioId.split(".");
  if (!surface || !state) {
    return null;
  }
  return { id: scenarioId, surface, state };
}

export async function readStage7ScenarioState(): Promise<string | null> {
  return (await readStage7ScenarioHeader())?.state ?? null;
}
