import { AppDomainError } from "./app-errors";

export const PHASE_77B_CHAT_MUTATION_DISABLED_ERROR = "chat_source_mutation_disabled";

export const PHASE_77B_DEPRECATED_PROPOSAL_HEADLINE =
  "Deprecated chat-to-update flow (Phase 77B). Edit personal form and food rules in dashboard panels.";

export const PHASE_77B_MANUAL_SOURCE_AUTHORITY_COPY =
  "Personal form, food rules, and menu source authority are manual-only. Use Forms and Food Rules panels.";

export function assertChatSourceMutationAllowed() {
  throw new AppDomainError(409, PHASE_77B_CHAT_MUTATION_DISABLED_ERROR);
}
