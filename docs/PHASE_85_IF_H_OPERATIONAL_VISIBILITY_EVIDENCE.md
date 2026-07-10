# P85-IF-H Minimal Operational Visibility And Stage 4B Handoff Evidence

Date: 2026-07-10
Track: P85-IF-H
Status: complete
Next track: Stage 4B (P85-IF closed)

Remediation update, 2026-07-10: P85-IF-R5 hardened this track's access boundaries. Owner/admin inspection details now come from `GET /api/operational-foundation` behind `read_operational_foundation`; common app-state redacts trust-binding, actor-binding, channel-event, event-only revision, and quarantine inspection details. Evidence: `docs/PHASE_85_IF_R5_OPERATIONAL_ACCESS_BOUNDARIES_EVIDENCE.md`.

## Scope delivered

- Core operational visibility module `phase-85-if-h-operational-visibility.ts` with provenance presentation, human-control banner model, channel trust aggregate snapshot, quarantine/trust-binding inspection rows, and structured-update source-message links (intake proposals + retrieval notifications).
- Conversation UI:
  - P85-IF-B provenance badges on message bubbles (client, AI, exact MANU dietitian, verified WhatsApp business human).
  - Compact human-control session banner with pause reason, latest response time, observed response count, and direct **Activate AI** control wired to `POST /api/clients/[id]/activate-ai`.
  - Structured update requirements panel with source-message scroll and client panel deep links.
- Overview UI: `OperationalFoundationPanel` with safe aggregate channel trust counters (healthy/degraded/blocked) and owner/admin-only trust-binding + quarantine inspection tables.
- Seven-language dashboard strings for all new controls (`tr`, `en`, `de`, `fr`, `es`, `pt`, `cs`).
- Targeted tests `phase-85-if-h-operational-visibility.test.ts`.

## Behavioral contracts

- Aggregate health surfaces expose counts and status labels only; no raw provider health text or PHI payloads.
- Full Stage 4B alert/notification center UX remains untouched.
- General internal copilot stays read-only; activation uses existing controlled reactivation path from P85-IF-F.
- Trust-binding and quarantine detail tables render only when dashboard `authInfo.role` is `owner` or `admin`, and the backing API/RLS boundary now enforces the same access contract.

## Verification

- Targeted `phase-85-if-h-operational-visibility.test.ts`: 5/5 passed.
- Full app `npm test`: 812 passed / 4 skipped.
- App `npm run lint`: 0 errors, 3 pre-existing warnings.
- App `npm run build`: passed.
- `npm run test:visual`: 36/36 passed.
- `npm run test:rls`: not re-run; R-406 current re-run remains pending.

## Out of scope (unchanged)

- Production pilot remains `NO-GO`; R-405 remains open.
- Live provider/webhook wiring unchanged.
- Stage 4B alert/notification product UX (filters, grouping, read/ack center, mobile polish).
- Full P85-IF-I lifecycle/RLS closure.
