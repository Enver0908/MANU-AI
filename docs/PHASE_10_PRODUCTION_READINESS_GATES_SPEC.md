# MANU-AI Phase 10 Production Readiness Gates Spec

## Goal

Make production pilot launch gates explicit, machine-readable, and testable before connecting real WhatsApp, Telegram, Gemini, push/email, or real client health data.

## Scope

- Define the minimum launch gates that must be approved before production pilot use.
- Keep the default state blocked.
- Add a small app-level evaluator that reports approved, open, and blocked gates.
- Keep R-405 visible as a blocking production gate until a safe stable Next.js/PostCSS path exists.
- Keep all approvals as external review inputs, not app-generated claims.

## Non-Goals

- No real WhatsApp, Telegram, Gemini, push/email, or email provider integration.
- No legal, privacy, medical-device, or platform-policy approval content.
- No client-facing legal copy.
- No admin UI for approving gates.
- No persistence table for gate approvals.

## Gate Set

- `legal_privacy_review`: legal basis, privacy notice, KVKK/GDPR-style obligations, and client-facing documents reviewed.
- `clinical_taxonomy_approval`: qualified dietitian approval for red/yellow/green taxonomy and golden tests.
- `provider_vendor_review`: LLM provider health-data eligibility, retention, logging, and subprocessor review completed.
- `channel_policy_review`: WhatsApp and Telegram healthcare, opt-in/out, template, and service-window rules reviewed.
- `incident_response_runbook`: incident, breach, escalation, and deletion workflows defined.
- `backup_restore_test`: backup expiry and restore-test policy completed.
- `secret_rotation_plan`: production secret handling and rotation procedure defined.
- `dependency_audit_clearance`: R-405 or any equivalent production dependency audit finding resolved or formally accepted.

## Edge Cases

- Unknown approval keys must not create synthetic approved gates.
- Duplicate approval entries must not change the result.
- Missing approval input must be treated as all gates open.
- Real provider/channel launch remains blocked if even one gate is open.
- Gate descriptions must not include raw client health data, secrets, prompts, or provider credentials.

## Verification

- Unit tests prove the default state blocks launch.
- Unit tests prove unknown approval keys are ignored.
- Unit tests prove launch is allowed only when every known gate is approved.
- Existing app tests continue to pass.
