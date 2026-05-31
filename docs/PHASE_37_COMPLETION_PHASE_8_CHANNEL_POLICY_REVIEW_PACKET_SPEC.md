# Phase 37 / Completion Roadmap Phase 8 - Channel Policy Review Packet Spec

Date: 2026-05-31

## Goal

Prepare the `channel_policy_review` launch gate for external WhatsApp and Telegram platform-policy review.

This phase creates a review packet only. It does not connect real WhatsApp Business Cloud API, Telegram Bot API, production webhooks, channel credentials, approved templates, or outbound messaging.

## Scope

In scope:

- Map current mock WhatsApp/Telegram adapter controls to required platform review decisions.
- Document missing WhatsApp healthcare-use feasibility, Telegram bot/privacy policy, opt-in/opt-out, template, service-window, webhook, delivery-status, and account-quality decisions.
- Separate internal mock-channel evidence from external policy approval artifacts.
- Update the production pilot dossier, evidence pack, approval intake, risk register, plans, app README, and handoff notes.

Out of scope:

- Real WhatsApp Business Cloud API integration.
- Real Telegram Bot API integration.
- Webhook signature verification implementation.
- Outbound delivery state machine implementation.
- Approved template registry implementation.
- Channel credentials, secrets, production phone numbers, bot tokens, or secret manager configuration.
- Runtime behavior, schema, dependency, provider, launch-gate approval, or real-client-data changes.

## Current Technical Baseline

- `app/src/lib/channel-adapters.ts` defines normalized mock WhatsApp/Telegram inbound events.
- Mock channel events resolve known identities to existing clients and quarantine unknown or ambiguous identities before AI processing.
- Duplicate provider event ids are ignored through idempotency.
- Missing provider event ids and empty bodies fail closed before client lookup or AI processing.
- Exact opt-out commands update matched-client `channelPermission` to `opted_out` without entering the AI/provider path.
- Channel policy audit metadata is minimized and excludes raw bodies, prompts, channel identifiers, health profiles, diet plans, allergies, clinical notes, and secrets.

## Required External Decisions

External review must decide:

- Whether WhatsApp Business Platform use is feasible for the intended supervised nutrition-support workflow.
- Whether WhatsApp healthcare, regulated vertical, commerce, age, geography, template, and service-window rules permit the pilot flow.
- Whether Telegram bot use is acceptable with the required privacy-policy, command, and user-consent posture.
- Which client opt-in, opt-out, reconsent, and identity-reconfirmation procedures are approved.
- Which outbound template categories and service-window handling are approved.
- Which webhook verification, signature validation, retry, duplicate, and delivery-status requirements must be implemented before launch.
- Which account-quality, rate-limit, suspension, provider-error, and manual fallback procedures are required.
- Which external notification or channel-to-dietitian messaging paths are prohibited or separately gated.

## Edge Cases

- Mock channel tests are not platform approval.
- A successful release verification result does not approve real channel traffic.
- Unknown or ambiguous identities must remain quarantined when real webhooks are added.
- Opt-out commands must not enter the AI path.
- Production webhooks must not log raw health content into external monitoring or repository docs.
- R-405 and R-406 remain independent launch blockers.

## Done Criteria

- `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` exists.
- The external approval intake references the channel policy review packet while keeping `channel_policy_review` open.
- The production pilot dossier and evidence pack include the packet as internal evidence, not approval.
- Plans, risk register, app README, and handoff notes reflect Phase 37.
- `npm run release:verify` passes with only documented R-405 findings.

## Verification

`npm run release:verify` passed on 2026-05-31 after the Phase 37 documentation update:

- Core package tests: 49/49 passed.
- App tests: 103/103 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit: passed with only documented R-405 findings.
