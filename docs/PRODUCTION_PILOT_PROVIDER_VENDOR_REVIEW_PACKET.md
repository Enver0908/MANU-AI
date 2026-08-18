# MANU-AI Production Pilot Provider Vendor Review Packet

**Current status interpretation (2026-08-18):** R-405 is `technically_resolved` locally; any older R-405 prerequisite below is historical. This packet's provider/vendor approval gate remains open, and production remains `NO-GO`. Local dependency remediation does not authorize provider egress.

Date: 2026-05-31

## Status

This packet prepares the `provider_vendor_review` launch gate for external vendor, legal, and security review.

It does not approve real Gemini or external LLM use.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

The `provider_vendor_review` launch gate remains open until acceptable external approval evidence is supplied.

## Review Objective

External reviewers must decide whether an approved model provider may receive health-related client context during a supervised production pilot, and under which retention, logging, training-use, region, access-control, audit, and incident conditions.

The default answer remains no real provider egress.

## Internal Evidence

| Evidence | Relevance |
| --- | --- |
| `AI_PROVIDER_REQUIREMENTS.md` | Lists provider retention, training-use, logging, prompt boundary, and egress requirements. |
| `PHASE_8_AI_PROVIDER_READINESS_SPEC.md` | Documents the deterministic local/mock provider abstraction and safe failure behavior. |
| `PHASE_17_PROVIDER_POLICY_GUARD_PROMPT_BOUNDARY_SPEC.md` | Documents provider payload minimization and boundary enforcement. |
| `PHASE_23_AI_CONTEXT_MEMORY_ARCHITECTURE_SPEC.md` | Documents bounded PromptContext, raw-text-free manifests, and missing-history fail-closed behavior. |
| `PHASE_26_INTERNAL_COPILOT_SPEC.md` | Documents local/mock-only internal copilot behavior and separate provider-egress requirement. |
| `PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md` | Documents dietitian-entered Critical Context and its separate provider-egress approval requirement. |
| `PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md` | Documents provider-attempt semantics, source metadata, send-time draft revalidation, and provider segment allowlist enforcement. |
| `app/src/lib/ai-provider.ts` | Current implementation: deterministic local/mock provider only, guarded provider input, no real SDK or credentials. |

Internal evidence supports review, but it is not a vendor approval artifact.

## Future Provider Token Counting

Phase 59 records that production provider integration must not rely on the local `characters / 3` token estimate. Reviewers should require provider-native token counting and budget evidence before approving real provider egress.

## Required External Decisions

The approval artifact must explicitly cover:

- Provider terms permit the intended supervised nutrition-support use case.
- Health-data retention is disabled, contractually bounded, or otherwise approved.
- Prompts and completions are not used for provider training.
- Provider logging rules, including whether raw health messages are prohibited or conditionally allowed.
- Region, residency, cross-border transfer, and subprocessor posture.
- Provider support access, administrative access, and access review expectations.
- Incident, breach, and security notification obligations.
- Approved model ids and version change process.
- Red/yellow/green routing acceptance, including no provider calls for red-risk flows.
- Provider failure behavior: safe no-send or dietitian review.
- Internal copilot provider-egress decision.
- Dietitian context update provider-egress decision.
- Data processing addendum, BAA, DPA, or equivalent contract requirement as applicable.
- Evidence owner and review cadence.

## Current Technical Controls

- Real provider egress is absent.
- The current provider path is deterministic local/mock only.
- No provider API key, SDK, environment variable, or real model endpoint is required.
- No-call paths are auditable with `providerAttempted=false`, `providerStatus=not_called`, `providerId=null`, and `model=null`.
- Actual local/mock attempts are auditable with provider id, model, prompt version, provider status, and provider error metadata.
- Provider input is built from allowlisted PromptContext segments.
- Unknown segment types, overlong segments, extra keys, raw prompts, raw capsules, raw message collections, raw profile objects, and red-risk payloads fail closed.
- Red-risk flows do not call the provider and create human handoff behavior.
- Yellow-risk flows remain dietitian-review drafts.
- Draft send paths revalidate context, latest promptable message, channel permission, takeover lock, AI mode/status, and memory state before client-facing send.

## Missing Before Gate Closure

The gate cannot close until the user supplies an acceptable external approval record covering:

- Signed or dated vendor-risk approval.
- Legal review of provider terms and data processing obligations.
- Health-data retention configuration or contract evidence.
- Prompt/completion training-use exclusion evidence.
- Prompt/completion logging decision.
- Approved real provider configuration and model list.
- Secret management and key rotation ownership for provider credentials.
- Incident and breach notification obligations.
- Internal copilot egress approval or explicit prohibition.
- Dietitian context update egress approval or explicit prohibition.
- R-405 dependency blocker resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste any of the following into repository documentation:

- Provider API keys or credentials.
- Real client identifiers.
- Raw client health messages.
- Real prompt or completion payloads from a production provider.
- Contract text that cannot be stored in the repository.
- Security contact details that should remain private.

Record only sanitized artifact references in `PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.

## Non-Approval Statement

This packet does not approve production pilot launch, real health-data processing, real provider calls, real channel messaging, external monitoring, or secret manager use.
