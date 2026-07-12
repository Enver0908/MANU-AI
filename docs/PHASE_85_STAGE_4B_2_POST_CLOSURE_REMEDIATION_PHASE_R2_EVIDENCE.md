# Phase 85 Stage 4B-2 Post-Closure Remediation - Phase R2 Evidence

Status: **Implementation complete; environment RLS gate open (2026-07-12)**

Branch: `codex/phase-85-interstage-clinical-memory`

R2 baseline: `88781e0 Implement Stage 4B-2 remediation R1 contracts`

## Scope

R2 corrects the Supabase read and receipt persistence boundary. It is append-only and does not add an alerts table, real provider/channel path, live billing, monitoring, backup, secret-manager, or real health-data path.

## Implemented corrections

- Added `20260712170000_phase_85_stage_4b2_r2_bounded_reads_rls.sql` with v2 list/detail projection RPCs and a v2 mark-read RPC.
- List SQL limits the page to 100 rows, limits assignment projection to 500 rows, returns only one latest message per listed conversation, and scopes clients, conversations, receipts, and unread-count rows to that page.
- Detail SQL limits transcript payload to 100 messages, scopes all related projection branches to the authorized conversation and actor, and returns the actor-scoped unread count separately from that window.
- Unread totals are calculated from actor-scoped receipt state and returned independently from the page, so pagination no longer changes the inbox aggregate values.
- Receipt mutation is RPC-only and fails closed for invalid actor context, auditor actors, hidden conversations, invalid sequences, and cross-tenant identifiers.
- `supabase-store.ts` now sends list/detail/mark-read requests to v2 RPCs, passes list filters/cursor state to SQL, maps per-conversation unread aggregates, and preserves API cursor metadata.
- The projection source carries optional unread-count metadata while fallback/in-memory behavior remains unchanged.
- Detail and mark-read response builders consume the SQL-authoritative per-conversation unread count, so a 100-message transcript window cannot undercount older unread inbound messages.

## Data flow

The list route parses the public query, decodes the cursor, and passes status, name query, cursor boundary, and bounded limit to the v2 RPC. SQL authorizes the actor, derives the visible base set, calculates unread aggregates, selects the page, and only then builds bounded JSON branches. The store maps the page into the existing projection builder and replaces only aggregate/cursor fields with the SQL-authoritative values.

The detail route passes the authorized conversation and bounded detail parameters to the v2 RPC. SQL authorizes the resource before selecting the bounded transcript and related rows, while unread counting remains authoritative over the complete conversation. The mark-read route calls the v2 receipt RPC, which delegates to the monotonic receipt implementation only after repeating actor and conversation guards; the resulting unread count is preserved in the mutation DTO instead of being recomputed from the bounded transcript window.

## Verification

- Targeted app Vitest: 4 files, 27 tests passed, 0 failed, including the bounded-detail authoritative-unread regression.
- Core suite: 234 passed, 0 failed.
- `npm run lint`: passed with 0 errors and 4 existing warnings.
- `npm run build`: passed; TypeScript and route generation completed.
- `git diff --check`: passed.
- RLS suite: **not passed**. Docker/local Supabase is unavailable; 35 required tests were skipped. No RLS claim is closed by this evidence.
- SQL verification: migration is append-only and static checks confirm v2 functions, bounded limits, unread aggregates, revocation, and grants. SQL-backed reset/EXPLAIN evidence remains required when local Supabase is available.

## Completion decision

R2 is complete for implementation scope, but the environment-level RLS gate remains open. R2 closes the application-side unbounded JSON projection finding only provisionally until SQL reset, role matrix, cross-tenant, receipt monotonicity, and EXPLAIN/scale evidence run. R3 is next. Stage 4C remains blocked, production pilot remains `NO-GO`, R-405 remains open, and real integrations remain disabled.
