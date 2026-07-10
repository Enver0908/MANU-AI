# P85-IF-R4 Context Intake Remediation Evidence

Date: 2026-07-10
Track: P85-IF-R4
Status: complete

## Scope delivered

- Added append-only migration `20260710210000_phase_85_if_remediation_client_safe_context_intake.sql`.
- Moved Supabase `confirm`, `recheck`, `apply`, and `reject` context-intake proposal mutations to service-role-only RPC `p85_if_r4_mutate_context_intake_proposal`.
- Preserved client-safe API behavior: missing client-scoped `confirmFullName` / `confirmPhoneE164` remains rejected; global intake still requires exact full-name + normalized E.164 single visible client match.
- The RPC locks the proposal and client rows, returns `404` for not-found or other-client proposal access, and returns `409` for stale, expired, non-mutable, non-confirmable, non-recheckable, or insufficient-confirmation states.
- Structured-impact proposals still require target panel revision evidence before recheck and two explicit confirmations before apply.
- Apply creates only a `client_context_updates` row, increments `clients.context_revision`, marks the proposal applied, writes audit events, and invalidates pending AI drafts in the same database transaction. It does not directly mutate form, menu, or food-rule records.
- Scoped Supabase state loading already included `contextIntakeProposals` filtered to visible clients; this was verified during the R4 review and left intact.

## Verification

- `npx supabase db reset --local`: passed with the R4 migration applied.
- Targeted `phase-85-if-g-context-intake.test.ts`: 11/11 passed.
- Local Supabase `npm run test:rls`: 25/25 passed with local CLI env overrides.
- Production pilot remains `NO-GO`; R-405 remains open.
- Real provider/channel/health-data paths remain disconnected.
