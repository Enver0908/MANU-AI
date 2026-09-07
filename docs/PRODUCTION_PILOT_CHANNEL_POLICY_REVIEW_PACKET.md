# MANU-AI Production Pilot Channel Policy Review Packet

**Current status interpretation (2026-08-18):** R-405 is `technically_resolved` locally; any older R-405 prerequisite below is historical. This packet's channel-policy approval gate remains open, and production remains `NO-GO`. Local dependency remediation does not approve provider/channel egress.

Date: 2026-05-31

## Status

This packet prepares the `channel_policy_review` launch gate for external WhatsApp and Telegram platform-policy review.

It does not approve real WhatsApp or Telegram messaging.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

The `channel_policy_review` launch gate remains open until acceptable external approval evidence is supplied.

## Review Objective

External reviewers must decide whether MANU-AI may use WhatsApp Business Platform and Telegram Bot API for the supervised production pilot, and under which healthcare-use, opt-in/out, service-window, template, privacy, webhook, account-quality, and operational conditions.

The default answer remains no real channel traffic.

## Internal Evidence

| Evidence | Relevance |
| --- | --- |
| `PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md` | Documents normalized mock WhatsApp/Telegram events, identity quarantine, duplicate idempotency, and redacted metadata. |
| `PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md` | Documents missing provider-event-id blocking, empty-body blocking, opt-out handling, and minimized channel audit metadata. |
| `app/src/lib/channel-adapters.ts` | Current implementation: mock channel adapter only, no real credentials, no production webhook, no outbound send adapter. |
| `PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` | Identifies legal/privacy and permission decisions that must align with channel policy. |
| `PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` | Documents clinical routing expectations that real channel flows must preserve. |
| `PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` | Documents provider egress boundaries that real channel flows must not bypass. |

Internal evidence supports review, but it is not a platform-policy approval artifact.

## Required External Decisions

The approval artifact must explicitly cover:

- WhatsApp Business Platform feasibility for supervised nutrition-support messaging.
- WhatsApp healthcare, regulated vertical, commerce, age, geography, account-quality, and suspension-risk posture.
- Telegram Bot API feasibility, privacy-policy link requirements, command behavior, and user-consent expectations.
- Client opt-in, opt-out, reconsent, and withdrawal procedure.
- Identity mapping and phone-number/user-id reconfirmation procedure for changed or reused identifiers.
- WhatsApp template categories, approved template workflow, and 24-hour customer-service window handling.
- Outbound send rules for autopilot, copilot-approved drafts, manual dietitian messages, and red/yellow handoff cases.
- Webhook verification, signature validation, retry, idempotency, duplicate suppression, and dead-letter expectations.
- Delivery-status webhook handling and failure taxonomy.
- Manual fallback procedure if a channel account is suspended, rate-limited, or degraded.
- Logging and monitoring limits for channel payloads.
- Whether dietitian notifications over WhatsApp/Telegram are prohibited, separately gated, or allowed with minimized content.
- Evidence owner and review cadence.

## Current Technical Controls

- Real channel egress is absent.
- The current channel path is mock-only.
- No WhatsApp phone number, Telegram bot token, production webhook URL, provider credential, or template registry is required.
- Known mock identities use the same simulator/orchestrator path as local testing.
- Unknown and ambiguous identities are quarantined before message persistence or AI decisions.
- Duplicate provider event ids do not duplicate-send.
- Missing provider event ids and empty bodies fail closed.
- Exact opt-out commands set matched clients to `channelPermission=opted_out` without entering the AI path.
- Permission-blocked and opted-out clients do not generate AI replies.
- Provider/channel metadata redaction avoids raw body, prompt, profile, diet plan, allergy, memory, and clinical note fields.

## Missing Before Gate Closure

The gate cannot close until the user supplies an acceptable external approval record covering:

- WhatsApp healthcare-use feasibility memo.
- Telegram bot/privacy policy review.
- Approved opt-in, opt-out, reconsent, and identity-reconfirmation procedure.
- Approved WhatsApp template and service-window operating procedure.
- Webhook verification and signature-validation requirements.
- Delivery-status, retry, duplicate, and manual fallback procedure.
- Account-quality, suspension, rate-limit, and provider-error operating procedure.
- External notification/channel-to-dietitian decision.
- Legal/privacy alignment for channel permission documents.
- R-405 dependency blocker resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste any of the following into repository documentation:

- WhatsApp access tokens, app secrets, phone-number ids, verification tokens, or webhook secrets.
- Telegram bot tokens or webhook secrets.
- Real client phone numbers, Telegram user ids, or identifiers.
- Raw client health messages.
- Production webhook payloads containing personal or health data.
- Platform contract or policy-review text that cannot be stored in the repository.

Record only sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approval Statement

This packet does not approve production pilot launch, real health-data processing, real WhatsApp messaging, real Telegram messaging, real provider calls, external monitoring, or secret manager use.
