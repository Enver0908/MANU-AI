import { SUPABASE_READ_CONTRACTS, type SupabaseReadContract } from "./supabase-read-contracts";

export const DIRECT_PILOT_SCALE_TARGET = {
  dietitianCount: 100,
  clientsPerDietitian: 50,
  totalClients: 5000,
  defaultPageSize: 50,
  maxPageSize: 100,
  timelineWindowSize: 25,
  defaultActiveClientPercentage: 20,
} as const;

export const REQUIRED_PHASE_69_CONTRACT_IDS = [
  "dashboard_state_snapshot",
  "internal_copilot_tools",
  "client_create_scaffold",
  "client_ai_control_patch",
] as const;

export type DirectPilotScaleDietitian = {
  id: string;
  clientIds: string[];
};

export type DirectPilotScaleClient = {
  id: string;
  dietitianId: string;
  aiStatus: "active" | "passive";
};

export type DirectPilotScaleFixture = {
  generatedAt: string;
  target: typeof DIRECT_PILOT_SCALE_TARGET;
  dietitians: DirectPilotScaleDietitian[];
  clients: DirectPilotScaleClient[];
};

export type PaginationResult<T> = {
  items: T[];
  nextCursor: string | null;
  pageSize: number;
  totalItems: number;
};

export type DirectPilotScaleReadiness = {
  ready: boolean;
  failures: string[];
  dietitianCount: number;
  totalClientCount: number;
  clientsPerDietitianMin: number;
  clientsPerDietitianMax: number;
  activeClientCount: number;
  requiredContractCount: number;
  phase69ContractCount: number;
  rehearsalEvidence: {
    synthetic100x50Fixture: boolean;
    paginationContracts: boolean;
    scopedReloadContracts: boolean;
    loadBackpressureIdempotency: boolean;
  };
};

export function createDirectPilotScaleFixture(
  options: {
    dietitianCount?: number;
    clientsPerDietitian?: number;
    activeClientPercentage?: number;
    generatedAt?: string;
  } = {},
): DirectPilotScaleFixture {
  const dietitianCount = options.dietitianCount ?? DIRECT_PILOT_SCALE_TARGET.dietitianCount;
  const clientsPerDietitian = options.clientsPerDietitian ?? DIRECT_PILOT_SCALE_TARGET.clientsPerDietitian;
  const activeClientPercentage =
    options.activeClientPercentage ?? DIRECT_PILOT_SCALE_TARGET.defaultActiveClientPercentage;

  if (dietitianCount <= 0) throw new Error("dietitianCount must be positive");
  if (clientsPerDietitian <= 0) throw new Error("clientsPerDietitian must be positive");
  if (activeClientPercentage < 0 || activeClientPercentage > 100) {
    throw new Error("activeClientPercentage must be between 0 and 100");
  }

  const dietitians: DirectPilotScaleDietitian[] = [];
  const clients: DirectPilotScaleClient[] = [];

  for (let dietitianIndex = 1; dietitianIndex <= dietitianCount; dietitianIndex += 1) {
    const dietitianId = `synthetic-dietitian-${pad(dietitianIndex, 3)}`;
    const clientIds: string[] = [];

    for (let clientIndex = 1; clientIndex <= clientsPerDietitian; clientIndex += 1) {
      const globalClientIndex = (dietitianIndex - 1) * clientsPerDietitian + clientIndex;
      const clientId = `synthetic-client-${pad(globalClientIndex, 5)}`;
      clientIds.push(clientId);
      clients.push({
        id: clientId,
        dietitianId,
        aiStatus: globalClientIndex % 100 < activeClientPercentage ? "active" : "passive",
      });
    }

    dietitians.push({ id: dietitianId, clientIds });
  }

  return {
    generatedAt: options.generatedAt ?? "2026-06-05T00:00:00.000Z",
    target: DIRECT_PILOT_SCALE_TARGET,
    dietitians,
    clients,
  };
}

export function paginateDirectPilotItems<T extends { id: string }>(
  items: T[],
  options: { cursor?: string | null; limit?: number; maxLimit?: number } = {},
): PaginationResult<T> {
  const maxLimit = options.maxLimit ?? DIRECT_PILOT_SCALE_TARGET.maxPageSize;
  const requestedLimit = options.limit ?? DIRECT_PILOT_SCALE_TARGET.defaultPageSize;
  if (requestedLimit <= 0) throw new Error("limit must be positive");

  const pageSize = Math.min(requestedLimit, maxLimit);
  const cursorIndex = options.cursor ? items.findIndex((item) => item.id === options.cursor) : -1;
  if (options.cursor && cursorIndex < 0) throw new Error("cursor not found");
  const startIndex = options.cursor ? cursorIndex + 1 : 0;

  const pageItems = items.slice(startIndex, startIndex + pageSize);
  const lastItem = pageItems.at(-1);
  const nextCursor = startIndex + pageItems.length < items.length && lastItem ? lastItem.id : null;

  return {
    items: pageItems,
    nextCursor,
    pageSize,
    totalItems: items.length,
  };
}

export function evaluateDirectPilotScaleReadiness(
  fixture: DirectPilotScaleFixture,
  options: {
    readContracts?: SupabaseReadContract[];
    loadBackpressureIdempotencyEvidence?: boolean;
  } = {},
): DirectPilotScaleReadiness {
  const readContracts = options.readContracts ?? SUPABASE_READ_CONTRACTS;
  const clientsPerDietitian = fixture.dietitians.map((dietitian) => dietitian.clientIds.length);
  const phase69ContractCount = readContracts.filter((contract) =>
    REQUIRED_PHASE_69_CONTRACT_IDS.includes(contract.id as (typeof REQUIRED_PHASE_69_CONTRACT_IDS)[number]) &&
    (contract.status === "phase69_paginated_contract" || contract.status === "scoped_mutation_read"),
  ).length;
  const failures: string[] = [];

  if (fixture.dietitians.length < DIRECT_PILOT_SCALE_TARGET.dietitianCount) {
    failures.push("dietitian_count_below_100");
  }
  if (fixture.clients.length < DIRECT_PILOT_SCALE_TARGET.totalClients) {
    failures.push("client_count_below_5000");
  }
  if (clientsPerDietitian.some((count) => count < DIRECT_PILOT_SCALE_TARGET.clientsPerDietitian)) {
    failures.push("clients_per_dietitian_below_50");
  }
  if (phase69ContractCount !== REQUIRED_PHASE_69_CONTRACT_IDS.length) {
    failures.push("phase69_required_read_contract_missing");
  }
  if (options.loadBackpressureIdempotencyEvidence !== true) {
    failures.push("load_backpressure_idempotency_evidence_missing");
  }

  return {
    ready: failures.length === 0,
    failures,
    dietitianCount: fixture.dietitians.length,
    totalClientCount: fixture.clients.length,
    clientsPerDietitianMin: Math.min(...clientsPerDietitian),
    clientsPerDietitianMax: Math.max(...clientsPerDietitian),
    activeClientCount: fixture.clients.filter((client) => client.aiStatus === "active").length,
    requiredContractCount: REQUIRED_PHASE_69_CONTRACT_IDS.length,
    phase69ContractCount,
    rehearsalEvidence: {
      synthetic100x50Fixture: fixture.dietitians.length >= 100 && fixture.clients.length >= 5000,
      paginationContracts: phase69ContractCount === REQUIRED_PHASE_69_CONTRACT_IDS.length,
      scopedReloadContracts: phase69ContractCount === REQUIRED_PHASE_69_CONTRACT_IDS.length,
      loadBackpressureIdempotency: options.loadBackpressureIdempotencyEvidence === true,
    },
  };
}

function pad(value: number, length: number) {
  return String(value).padStart(length, "0");
}
