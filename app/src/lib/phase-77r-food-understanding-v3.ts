import {
  FOOD_UNDERSTANDING_V3_VERSION,
  buildFoodAliasDictionaryManifest,
  validateFoodAliasEntry,
} from "dietitian-ai-assistant-architecture";
import foodAliasDictionaryEntries from "./food-alias-dictionary-v3.json";

export const FOOD_ALIAS_DICTIONARY_V3_VERSION = "food-alias-dictionary-v3-v0.1.0";

export const FOOD_ALIAS_DICTIONARY_V3_CHECKSUM =
  "815b61f64d9b306aa523d3c11a798acf13af976919c4b26b7d30bfe05a969401";

export type FoodAliasDictionaryV3Entry = {
  id: string;
  tenantId: string;
  alias: string;
  foodId: string;
  foodName?: string;
  path?: string;
  matchType: "exact";
  qaApproved?: boolean;
  autopilotEligible?: boolean;
};

export type FoodAliasDictionaryV3Manifest = {
  version: string;
  dictionaryVersion: string;
  checksum: string;
  entryCount: number;
  entries: FoodAliasDictionaryV3Entry[];
};

export type FoodUnderstandingV3Context = {
  version: string;
  dictionaryVersion: string;
  dictionaryChecksum: string;
  globalAliases: FoodAliasDictionaryV3Entry[];
  tenantApprovedAliases: FoodAliasDictionaryV3Entry[];
};

const validatedEntries = (foodAliasDictionaryEntries as FoodAliasDictionaryV3Entry[]).filter(validateFoodAliasEntry);

let cachedDictionary: FoodAliasDictionaryV3Manifest | null = null;

export function loadFoodAliasDictionaryV3(): FoodAliasDictionaryV3Manifest {
  if (cachedDictionary) return cachedDictionary;

  const manifest = buildFoodAliasDictionaryManifest({
    version: FOOD_UNDERSTANDING_V3_VERSION,
    checksum: FOOD_ALIAS_DICTIONARY_V3_CHECKSUM,
    entries: validatedEntries,
  });

  cachedDictionary = {
    version: manifest.version,
    dictionaryVersion: FOOD_ALIAS_DICTIONARY_V3_VERSION,
    checksum: FOOD_ALIAS_DICTIONARY_V3_CHECKSUM,
    entryCount: manifest.entryCount,
    entries: manifest.entries as FoodAliasDictionaryV3Entry[],
  };
  return cachedDictionary;
}

export function buildFoodUnderstandingV3Context(tenantId: string): FoodUnderstandingV3Context {
  const dictionary = loadFoodAliasDictionaryV3();
  return {
    version: FOOD_UNDERSTANDING_V3_VERSION,
    dictionaryVersion: dictionary.dictionaryVersion,
    dictionaryChecksum: dictionary.checksum,
    globalAliases: dictionary.entries.filter((entry) => entry.tenantId === "global"),
    tenantApprovedAliases: dictionary.entries.filter(
      (entry) => entry.tenantId !== "global" && entry.tenantId === tenantId,
    ),
  };
}
