# P85-IF-G Controlled Off-Channel AI Chat Intake Evidence

Date: 2026-07-10
Track: P85-IF-G
Status: complete
Next track: P85-IF-I
Remediation: P85-IF-R4 complete; see `docs/PHASE_85_IF_R4_CONTEXT_INTAKE_REMEDIATION_EVIDENCE.md`.

## Scope delivered

- Dedicated off-channel context-intake workflow in `phase-85-if-g-context-intake.ts` with client resolution, structured-impact detection, proposal state machine, double confirmation for structured paths, duplicate replay protection, TTL expiry, export/redaction hooks, and draft invalidation on apply.
- API routes:
  - `POST /api/context-intake/proposals` (global name+phone resolution)
  - `POST /api/clients/[id]/context-intake/proposals`
  - `POST /api/clients/[id]/context-intake/proposals/[proposalId]/confirm`
  - `POST /api/clients/[id]/context-intake/proposals/[proposalId]/recheck`
  - `POST /api/clients/[id]/context-intake/proposals/[proposalId]/apply`
  - `POST /api/clients/[id]/context-intake/proposals/[proposalId]/reject`
- Supabase migration `20260710170000_phase_85_if_g_context_intake.sql` adds `intake_source`, `raw_source_reference`, and `expired` status.
- R4 remediation migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql` moves Supabase confirm/recheck/apply/reject mutations to service-role-only atomic RPCs with proposal/client row locks.
- Copilot panel UI exposes client-confirmed intake preview, structured panel deep links, confirm/recheck/apply/reject controls. General internal copilot remains read-only.
- Client export and anonymization include `contextIntakeProposals`.

## Behavioral contracts

- Global intake resolves exactly one visible client by normalized full name + E.164 phone; ambiguous/mismatch/removed clients fail closed.
- Client-scoped intake requires name/phone confirmation.
- Context-only proposals apply after explicit confirmation and create only `ClientContextUpdate` records.
- Structured-impact proposals block until dashboard revision evidence via recheck; apply requires second confirmation.
- Supabase mutations return `404` for missing or other-client proposals, `409` for stale/expired/non-mutable states, and apply only creates a context update while preserving form/menu/food-rule records.
- Deprecated chat-to-update proposals (`client-update-proposals`) remain disabled; intake uses the dedicated workflow only.

## Verification

- Targeted `phase-85-if-g-context-intake.test.ts`: 11/11 passed after R4 remediation.
- Local Supabase `npm run test:rls`: 25/25 passed after R4 remediation.
- Full app `npm test`: 807 passed / 4 skipped.
- App `npm run lint`: 0 errors, 3 pre-existing warnings.
- App `npm run build`: passed.
- `npm run test:visual`: 36/36 passed.

## Out of scope (unchanged)

- Production pilot remains `NO-GO`; R-405 remains open.
- Live provider/webhook wiring unchanged.
- Stage 4B alert/notification product UX (P85-IF-H minimal visibility only next).
- Full P85-IF-I lifecycle/RLS closure.
