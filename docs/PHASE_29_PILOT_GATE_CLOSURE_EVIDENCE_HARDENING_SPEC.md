# Phase 29 Pilot Gate Closure And Evidence Hardening Spec

Date: 2026-05-31

## Scope

Phase 29 turns the Phase 28-secured local prototype into a cleaner external-review package. It does not add product behavior, connect real providers or channels, approve launch gates, process real client health data, or remediate R-405.

## Goals

- Keep the production-pilot path focused on evidence collection instead of new feature work.
- Align the gate closure dossier, evidence pack, risk register, planning docs, and handoff notes with the Phase 27-28 baseline.
- Keep all eight production-pilot launch gates open until the user supplies external approval evidence.
- Make RLS execution status explicit: the expanded suite exists, but the latest run skipped because local Supabase was not configured for this session.
- Make R-405 status explicit with the latest npm metadata check.

## Evidence Packets

Each production-pilot gate must be handled as an evidence packet with four fields:

- Internal evidence available.
- External artifact still missing.
- Acceptable approval artifact.
- Current status.

The required packets are:

1. Legal and privacy review.
2. Qualified dietitian clinical taxonomy approval.
3. Provider vendor and retention review.
4. WhatsApp and Telegram policy review.
5. Incident response and DSAR/deletion operating procedure.
6. Backup expiry and restore drill.
7. Production secret rotation plan.
8. Production dependency audit clearance.

## R-405 Status

The Phase 22 procedure remains the only approved technical remediation path.

Latest metadata check on 2026-05-31:

- `next@latest` is `16.2.6`.
- `next@latest` still depends on `postcss@8.4.31`.
- `eslint-config-next@latest` is `16.2.6`.

Because stable Next.js still bundles vulnerable PostCSS, dependency files must not change. Canary Next.js, `npm audit fix --force`, invalid overrides, and major downgrade paths remain rejected. R-405 remains a production launch blocker unless a safe stable patch becomes available or formal external risk acceptance is supplied.

## RLS Evidence Status

The expanded RLS suite covers scoped assistant/viewer/care-team/auditor access, internal copilot scoping, tenant-aware channel/idempotency uniqueness, auxiliary table policies, Telegram idempotency channel persistence, and Supabase-backed AI control audit events.

The latest recorded `npm run test:rls` result in this workspace skipped because local Supabase was not configured for the session. This is an environment evidence gap, not a permission-model approval. Before production pilot evidence can be considered complete, rerun `npm run test:rls` against local Supabase or record the skip as unresolved evidence.

## Non-Approvals

Phase 29 does not approve:

- Production pilot launch.
- Real client health-data processing.
- Real WhatsApp or Telegram messaging.
- Real Gemini or external LLM calls.
- Internal copilot provider egress.
- Dietitian context update provider egress.
- External notification, monitoring, analytics, or secret-manager vendors.
- R-405 acceptance or remediation.

## Verification

After Phase 29 documentation updates:

```text
cd app
npm run release:verify
```

When local Supabase is available:

```text
cd app
npm run test:rls
```

`npm run test:visual` remains optional for UI/layout evidence and is required only after UI changes.
