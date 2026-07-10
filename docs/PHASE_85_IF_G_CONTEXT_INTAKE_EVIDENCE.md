# P85-IF-G Controlled Off-Channel AI Chat Intake Evidence

Date: 2026-07-10
Track: P85-IF-G
Status: complete
Next track: P85-IF-I

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
- Copilot panel UI exposes client-confirmed intake preview, structured panel deep links, confirm/recheck/apply/reject controls. General internal copilot remains read-only.
- Client export and anonymization include `contextIntakeProposals`.

## Behavioral contracts

- Global intake resolves exactly one visible client by normalized full name + E.164 phone; ambiguous/mismatch/removed clients fail closed.
- Client-scoped intake requires name/phone confirmation.
- Context-only proposals apply after explicit confirmation and create only `ClientContextUpdate` records.
- Structured-impact proposals block until dashboard revision evidence via recheck; apply requires second confirmation.
- Deprecated chat-to-update proposals (`client-update-proposals`) remain disabled; intake uses the dedicated workflow only.

## Verification

- Targeted `phase-85-if-g-context-intake.test.ts`: 9/9 passed.
- Full app `npm test`: 807 passed / 4 skipped.
- App `npm run lint`: 0 errors, 3 pre-existing warnings.
- App `npm run build`: passed.
- `npm run test:visual`: 36/36 passed.
- `npm run test:rls`: not re-run; R-406 current re-run remains pending.

## Out of scope (unchanged)

- Production pilot remains `NO-GO`; R-405 remains open.
- Live provider/webhook wiring unchanged.
- Stage 4B alert/notification product UX (P85-IF-H minimal visibility only next).
- Full P85-IF-I lifecycle/RLS closure.
