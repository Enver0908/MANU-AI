import { describe, expect, it } from "vitest";
import {
  assertChatSourceMutationAllowed,
  PHASE_77B_CHAT_MUTATION_DISABLED_ERROR,
} from "./phase-77b-chat-mutation-boundary";

describe("phase 77b chat mutation boundary", () => {
  it("throws the canonical disabled error", () => {
    expect(() => assertChatSourceMutationAllowed()).toThrow(PHASE_77B_CHAT_MUTATION_DISABLED_ERROR);
  });
});
