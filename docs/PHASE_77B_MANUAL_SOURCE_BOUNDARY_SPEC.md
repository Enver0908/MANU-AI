# Phase 77B: Manual Source Boundary And Chat Mutation Removal

Date: 2026-06-10
Status: Implemented locally on 2026-06-10; production pilot remains NO-GO.

## Product Requirements

- Dietitians can still ask the internal copilot read-only questions about a client.
- Dietitians cannot update personal form, food rules, or future menu source authority by typing chat instructions.
- Critical Context remains panel-only for WhatsApp-external events.
- Historical chat-to-update proposal records remain readable, exportable, and redactable.
- Deprecated proposal artifacts show explicit UI copy; no destructive deletion.

## Technical Requirements

- Block `createClientUpdateProposalInState` and `applyClientUpdateProposalInState` with error `chat_source_mutation_disabled`.
- Keep `rejectClientUpdateProposalInState` for dismissing historical pending proposals.
- Block `/api/clients/[id]/update-proposals` POST and `/apply` POST through the same domain error.
- Remove dashboard "Propose update" and proposal apply/edit controls.
- Show deprecated read-only cards for historical proposals.
- Preserve patch-extraction internals for audit interpretation of legacy records only.
- Add tests for blocked API mutation, blocked state mutation, read-only copilot regression, and historical reject path.
- Use manual dashboard form/food-rule panels as the only editable source-authority paths.

## Edge Cases

- Historical `pending` proposals cannot be applied after Phase 77B; dietitian may reject them.
- Historical `applied`/`rejected` proposals remain visible with deprecated copy.
- Empty `sourceText` still returns `client_update_proposal_source_required` before boundary check.
- Removed/anonymized clients keep existing proposal guards.
- Internal copilot must not gain write tools for form, food rules, or menu.

## Verification

- `npm run release:verify`
- `git diff --check`

## Out Of Scope

- Food Decision Engine V2 (Phase 77G).
- Menu source authority UI (Phase 77H+).
- Real WhatsApp/Gemini/provider connections.
- R-405 dependency remediation.
