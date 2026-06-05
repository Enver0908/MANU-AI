# Phase 69 Direct 5,000 Client Scale Foundation Spec

Date: 2026-06-05

## Goal

Make the direct production pilot target of 100 dietitians with 50 clients each a local, test-covered prerequisite before user-supplied form hardening, provider/channel integration, external gate closure, or production GO.

This phase is synthetic and local only. It does not connect real WhatsApp, Telegram, Gemini, monitoring, secret manager, production Supabase, or real client health data.

## Scope

- Add a synthetic direct-pilot scale fixture for 100 dietitians and 5,000 clients.
- Add cursor pagination helpers and page-window evidence for dense client lists, timelines, handoff queues, notifications, audit/event views, and internal copilot source reads.
- Upgrade broad-read contract evidence so production-relevant tenant-wide reloads have explicit Phase 69 pagination/scoped-read contracts.
- Add scale readiness evaluation that records counts, page targets, scoped mutation readiness, and load/backpressure/idempotency rehearsal requirements without raw client content.
- Add operational-health aggregate scale fields.
- Update continuity and launch-gate documentation.

## Non-Goals

- No real production pagination UI rewrite.
- No production Supabase migration.
- No external load-testing service.
- No real channel webhook replay.
- No real provider calls.
- No production GO, launch-gate closure, R-405 acceptance, or real-data path.

## Scale Target

- Dietitians: 100.
- Clients per dietitian: 50.
- Total clients: 5,000.
- Default page size: 50.
- Maximum page size: 100.
- Timeline window: 25 messages.
- Synthetic active-client percentage: configurable, default 20%.

## Required Read Contracts

The following domains must have explicit bounded contracts before production pilot:

- Client lists.
- Client detail/timeline windows.
- Handoff queues.
- Notifications.
- Audit/event views.
- Internal copilot source reads.
- Client create and client profile/AI-control patch scoped reloads.

Legal/admin workflows such as DSAR export, anonymization, removal, form schema admin, and voice sample admin may remain intentionally broad only when documented as low-frequency or awaiting external approval.

## Edge Cases

- Fixture must reject non-positive dietitian or client counts.
- Pagination must reject invalid cursors and non-positive limits.
- Pagination must cap limits at the configured maximum.
- Readiness must fail if the fixture count is below 100x50.
- Readiness must fail if any required pagination/scoped contract is missing.
- Readiness must fail if load/backpressure/idempotency rehearsal evidence is missing.
- Operational health output must remain aggregate-only and must not contain raw messages, phone numbers, diet plans, prompts, secrets, or client names.

## Done Criteria

- Synthetic 100x50 scale fixture tests pass.
- Pagination helper tests cover first page, next cursor, limit capping, and invalid input.
- Read contract tests prove Phase 69 required domains are no longer just undocumented future work.
- Operational-health tests prove scale fields are aggregate-only.
- `npm run release:verify` passes with only documented R-405 findings.
- Production pilot remains `NO-GO`.
