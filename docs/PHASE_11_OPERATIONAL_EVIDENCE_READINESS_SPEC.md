# MANU-AI Phase 11 Operational Evidence Readiness Spec

## Goal

Attach concrete evidence expectations and operating runbook drafts to the production-pilot launch gates without approving the gates or connecting real providers, real channels, or real client health data.

## Scope

- Add required evidence labels to each production-pilot launch gate.
- Create draft incident response, backup/restore, and secret rotation runbooks.
- Keep all gate approvals external and blocked by default.
- Keep R-405 as a dependency audit gate until a safe stable Next.js/PostCSS path exists.

## Non-Goals

- No real incident response approval.
- No real backup provider, secret manager, WhatsApp, Telegram, Gemini, push/email, or monitoring vendor integration.
- No production credentials or secrets.
- No client-facing legal copy.
- No operational ownership claim beyond draft placeholders.

## Edge Cases

- Evidence labels must not include raw health data, secrets, prompts, phone numbers, provider credentials, or real client identifiers.
- Runbooks must stay procedural and draft-only until reviewed.
- A complete evidence list must not make a gate approved.
- Unknown approval keys must still be ignored by the launch gate evaluator.

## Verification

- Unit tests prove every launch gate has external approval source and at least one required evidence item.
- Existing launch gate tests continue to prove default blocked behavior.
- App lint, app tests, and production build pass.
