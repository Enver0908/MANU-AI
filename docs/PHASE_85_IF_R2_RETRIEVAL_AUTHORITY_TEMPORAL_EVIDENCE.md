# P85-IF-R2 Retrieval Authority And Temporal Evidence

Date: 2026-07-11
Track: P85-IF-R2 post-closure remediation
Status: complete
Production pilot: `NO-GO`

## Findings

Two R2 gaps were found:

- structured baseline metadata was expected by core retrieval logic but not derived from real app state before context compilation;
- notification resolution used generic client context revision instead of the revision of the structured panel that actually needed to change.

## Fix

- `simulator.ts` now builds structured revision context from active app state: menu plan revision, food-rule profile revision, client-form timestamp revision, and diet-plan context revision.
- Core context capsule/compiler/retrieval modules carry structured baseline revisions into `structured_record_update_required` signals.
- `phase-85-if-e-historical-retrieval.ts` stores the signal baseline on the notification and resolves only when the target panel revision advances.
- Supabase resolution uses service-role-only RPC `p85_if_postclosure_resolve_structured_update_notification`, locking the notification and the target record before comparing revisions.
- Client-form revision uses the latest response `updatedAt` epoch seconds because there is no separate explicit form response revision column.
- Diet-plan revision uses `client.contextRevision`; `dietPlanUpdatedAt` is conservative app-state metadata and does not open a new health-data path.

## Verification

- Targeted app historical retrieval/lifecycle tests passed 16/16.
- Targeted core historical retrieval/orchestrator tests passed 36/36.
- Local Supabase reset applied the structured resolution migration.
- RLS/integration suite passed 30/30, including pending-then-successful atomic structured resolution.
- Full app suite passed 828 / 4 skipped; core suite passed 234/234.

## Closure

R2 is closed for structured retrieval authority, temporal precedence, and panel-specific resolution. Production pilot remains `NO-GO`; R-405 remains open.
