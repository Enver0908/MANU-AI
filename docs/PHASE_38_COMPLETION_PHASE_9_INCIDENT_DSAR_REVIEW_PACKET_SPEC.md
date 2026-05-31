# Phase 38 / Completion Roadmap Phase 9 - Incident And DSAR Review Packet Spec

Date: 2026-05-31

## Goal

Prepare the `incident_response_runbook` launch gate for external operations, legal, privacy, and clinical review.

This phase creates a review packet only. It does not approve production incident response, assign real production owners, connect monitoring vendors, or enable real client health-data processing.

## Scope

In scope:

- Map the current draft incident response runbook, DSAR/export/anonymization skeleton, legal ops ledger, and safe operational health evidence to required approval decisions.
- Document missing owner, escalation, notification, DSAR/deletion, breach, and re-enable decisions.
- Separate internal implementation evidence from external signed operating procedure approval.
- Update the production pilot dossier, evidence pack, approval intake, risk register, plans, app README, and handoff notes.

Out of scope:

- Real incident response approval.
- Named production owner assignment.
- External monitoring, paging, email, push, WhatsApp, Telegram, analytics, or ticketing integration.
- Client-facing legal notices or breach-notification templates.
- Automatic destructive deletion jobs.
- Runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-client-data changes.

## Current Technical Baseline

- `INCIDENT_RESPONSE_RUNBOOK.md` exists as a draft.
- Tenant/client-scoped export and anonymization helpers exist.
- Legal operations ledger records completed export and anonymization operations in local/fallback and Supabase-backed state.
- Safe operational health snapshots expose aggregate counts without raw messages, prompts, channel identifiers, secrets, or health profiles.
- Final retention durations, deletion automation, breach notification owners, and client/regulator notification procedures remain externally gated.

## Required External Decisions

External review must decide:

- Named incident commander, backup owner, legal/privacy owner, security owner, and clinical reviewer.
- Severity taxonomy and escalation thresholds.
- First-30-minute and first-24-hour operating procedure.
- Client, regulator, provider, channel, and platform notification triggers.
- Evidence preservation rules that avoid adding raw health data to new logs.
- DSAR/export/anonymization/deletion operating procedure, owner, SLA, and approval chain.
- Re-enable criteria after containment.
- Production communication templates and storage location for sensitive incident artifacts.
- Review cadence and training/drill requirements.

## Edge Cases

- A draft runbook is not operational approval.
- Safe local export/anonymization tests are not legal approval for production DSAR handling.
- Repo docs must not store raw client health messages, client identifiers, secrets, incident payloads, or sensitive legal communications.
- Incident response cannot close R-405 or R-406.
- Production incident tooling must not be connected before legal/security review.

## Done Criteria

- `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` exists.
- The external approval intake references the incident/DSAR review packet while keeping `incident_response_runbook` open.
- The production pilot dossier and evidence pack include the packet as internal evidence, not approval.
- Plans, risk register, app README, and handoff notes reflect Phase 38.
- `npm run release:verify` passes with only documented R-405 findings.

## Verification

`npm run release:verify` passed on 2026-05-31 after the Phase 38 documentation update:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit: passed with only documented R-405 findings.
