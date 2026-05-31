# Phase 40 / Completion Roadmap Phase 11 - Secret Rotation Review Packet Spec

Date: 2026-05-31

## Goal

Prepare the `secret_rotation_plan` launch gate for external security and operations review.

This phase creates a review packet only. It does not approve production secret management, create or rotate any production secret, configure a secret manager, or connect production infrastructure.

## Scope

In scope:

- Map the current draft secret rotation runbook to required production secret inventory, owner, cadence, emergency revocation, verification, and evidence decisions.
- Document missing secret manager and rotation ownership decisions.
- Separate internal draft runbook evidence from external signed secret-rotation approval artifacts.
- Update the production pilot dossier, evidence pack, approval intake, risk register, plans, app README, and handoff notes.

Out of scope:

- Creating, printing, rotating, revoking, or storing real secrets.
- Secret manager setup.
- CI/CD, provider, channel, Supabase, email, push, monitoring, or deployment credential changes.
- Runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-client-data changes.

## Current Technical Baseline

- `SECRET_ROTATION_RUNBOOK.md` exists as a draft.
- The draft lists Supabase, WhatsApp/Telegram, LLM provider, email/push/monitoring, and CI/CD secret classes.
- The draft rotation checklist requires inventory, replacement secret creation in an approved secret manager, deploy without printing secret values, revocation after health checks, smoke tests, and owner/time/result evidence.
- The draft emergency revocation flow requires immediate disablement, affected path freeze, dependent credential rotation, audit log review, and incident response escalation.
- No production secret manager or production credential inventory is approved.

## Required External Decisions

External review must decide:

- Approved production secret manager.
- Secret inventory owner and backup owner.
- Per-secret rotation cadence.
- Emergency revocation owner and escalation path.
- Secret storage, access-control, break-glass, and audit-log expectations.
- Health checks required before old secret revocation.
- Smoke tests required after rotation.
- Evidence format for rotation records.
- Whether any pilot secrets can be manually managed temporarily, and under what controls.

## Edge Cases

- A draft runbook is not secret-rotation approval.
- Repository docs must never contain secret values, token prefixes, connection strings, private URLs, or emergency contact details that should stay private.
- Rotation evidence must prove verification without exposing secret material.
- Secret rotation approval cannot close R-405 or R-406.
- Real provider/channel/monitoring credentials must remain absent until their own launch gates are approved.

## Done Criteria

- `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` exists.
- The external approval intake references the secret rotation review packet while keeping `secret_rotation_plan` open.
- The production pilot dossier and evidence pack include the packet as internal evidence, not approval.
- Plans, risk register, app README, and handoff notes reflect Phase 40.
- `npm run release:verify` passes with only documented R-405 findings.

## Verification

`npm run release:verify` passed on 2026-05-31 after the Phase 40 documentation update:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit: passed with only documented R-405 findings.
