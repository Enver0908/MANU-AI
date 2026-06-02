# Phase 53 Scale And Broad Read Contracts Spec

Date: 2026-06-02

## Goal

Classify the remaining broad Supabase read paths after Phase 50-52, separate intentional tenant-wide workflows from mutation paths that are already scoped, and define the next pagination/filter contracts without changing runtime behavior.

This phase does not connect real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, backup provider, production infrastructure, or real client health data.

## Contract Source

The machine-readable local contract lives in `app/src/lib/supabase-read-contracts.ts` and is covered by `app/src/lib/supabase-read-contracts.test.ts`.

Contract statuses:

- `intentional_broad_read`: broad by current product/legal/admin design; do not narrow until the external or domain contract is approved.
- `future_paginated_read`: acceptable for local prototype, but must become paginated/filtered before production growth.
- `scoped_mutation_read`: already narrowed to client/draft/handoff operation loaders; keep separate from broad read refactors.

## Classification

Intentional broad reads:

- Demo reset: local-only tenant reset/reload.
- Client export legal bundle: keep broad until DSAR/export scope and legal-hold behavior are externally approved.
- Client anonymization and removal lifecycle: keep broad until a dedicated transactional redaction contract is designed.
- Voice sample/profile workflows: dietitian-scoped admin workflows; add limits only when onboarding scale requires it.
- Form schema admin/publish workflows: tenant admin workflows; later add schema list filters by status, language, and version.

Future paginated reads:

- Dashboard state snapshot: replace with dashboard list filters, client detail panes, and bounded timeline windows.
- Internal copilot tools: replace broad visible-state tools with tool-specific bounded queries and source refs before any real provider egress.
- Client create scaffold and client AI/profile patch: replace broad local-state helper usage with direct insert/update plus scoped detail reloads.

Already scoped mutation reads:

- Manual reply.
- Client-scoped inbound simulation.
- Draft approve/dismiss.
- Handoff resolve/dismiss.
- Client context update.
- Form response save.

## Dashboard Pagination And Filter Contract

Future dashboard reads should be split into independent bounded resources:

- Client list: cursor by `created_at,id`; filters for lifecycle status, channel permission, AI status, AI mode, assigned dietitian, and search.
- Conversation timeline: client/conversation scoped; cursor by `created_at,id`; default last 50 messages.
- Handoff queue: status and urgency filters; cursor by `created_at,id`; open/assigned first.
- Notifications: unread/acknowledged filters; cursor by `created_at,id`.
- Audit events: entity-scoped by default; tenant-wide audit search only for owner/admin with explicit filters.
- Internal copilot source reads: per-tool limits for client search, recent messages, forms, handoffs, and AI decision history.

## R-115 Impact

R-115 remains partially mitigated, but Phase 53 reduces ambiguity:

- Mutation paths that were narrowed in Phase 50/51 are explicitly separated from broad read refactors.
- Remaining broad reads are classified as intentional legal/admin workflows or future paginated dashboard/copilot reads.
- Production growth still requires implementing the pagination/filter contracts and dedicated client removal/anonymization redaction RPC.

## Verification

Completed locally on 2026-06-02:

- `npm test` passed from `app`: 18 files, 130 tests.
- `npm run lint` passed from `app`.
- `npm run release:verify` passed from `app`: core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.

`npm run test:rls` was not required for this documentation/contract-only phase because no Supabase schema, RLS policy, or DB mutation code changed. The latest local RLS evidence remains Phase 52: 1 file, 19/19 tests.

## Remaining Boundaries

- Client removal/anonymization bulk redaction still needs a dedicated transactional contract before moving fully to RPC commits.
- Dashboard/copilot pagination is designed here but not implemented.
- R-405 remains open and must only be handled through `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Production pilot remains `NO-GO`; all external launch gates remain open.
