# Production Readiness Stage 1 Owner Handoff

Date: 2026-08-30

Status: `OWNER_HANDOFF_READY_LOCAL_ONLY`

Plan: **Birinci Asama: Canli Hesaplari Beklemeden Teknik Hazirlik**

Active brand update, 2026-09-01: the visible product brand is now `AIya`;
public/customer domain is `https://aiyaworkspace.com`; admin domain is
`https://admin.aiyaworkspace.com`; business contact and default admin allowlist
use `contact@aiyaworkspace.com`. This brand update does not change the
production `NO-GO` status or any owner-side launch blocker.

## Current Decision

The local technical preparation package is complete for Phase 1-6. Production
remains `NO-GO`.

This handoff is intentionally simple: Codex prepared the local contracts,
fail-closed boundaries, onboarding path, real-provider readiness code, worker
commands, release manifest, and operating documents. The owner must now close
the external account, approval, secret, and production-environment items before
Codex performs any production action.

Physical iPhone Safari/PWA validation remains `WAIVED_NOT_EXECUTED`, not `PASS`.
This accepted residual iOS risk must stay visible in future readiness language.

## 1. Completed By Codex

- Phase 1: Turkey-first production boundary is locked for 100 dietitians and
  5,000 clients, with manual bank transfer, WhatsApp in scope, Telegram out of
  scope, and real egress fail-closed.
- Phase 2: Manual bank-transfer onboarding and entitlement contracts are ready
  without Stripe dependency.
- Phase 3: Real WhatsApp webhook challenge, HMAC verification, durable ingress,
  encrypted credential/storage contracts, and real delivery metadata are ready
  behind production gates.
- Phase 4: Real AI adapter, Z.ai GLM-5.3-Flash readiness, vision/OCR/transcription gating,
  file admission, malware-scan/provider-egress eligibility, and provider audit
  contracts are ready behind production gates.
- Phase 5: Worker commands, one-shot validation commands, release manifest
  operations metadata, and the local operations runbook are ready.
- Phase 6: Integrated handoff contract, contradiction checks, final decision
  record, owner handoff, README authority, and current handoff authority are
  aligned.

## 2. Owner Actions Required

- Meta/WhatsApp: create or confirm Meta Business, WhatsApp Business Account,
  phone number, app secret, verify token, webhook URL target after deployment,
  template/policy approvals, opt-in language, and opt-out handling.
- Z.ai/AI provider: create or confirm Z.ai account, approved `glm-5.3-flash` model,
  production API key source, vendor-risk approval, privacy/legal approval,
  clinical safety approval, training-disabled posture, and retention-disabled or
  bounded-retention posture.
- Production secrets: provide Supabase URL, service-role key, anon key, provider
  keys, webhook tokens, app secrets, admin allowlist, and secret rotation owner
  through the chosen secret manager.
- Production Supabase and migrations: confirm the production project, backup
  posture, migration window, migration approval, and rollback expectation.
- Manual bank transfer operations: approve receipt evidence rules,
  paid-through duration policy, entitlement operator list, refund/extension
  handling, and daily reconciliation owner.
- Incident, monitoring, and rollback: approve incident channel, monitoring
  review path, rollback owner, provider/channel disable procedure, and customer
  communication owner.
- Release approval: explicitly approve the exact commit/artifact for production
  deploy, remote migrations, webhook activation, worker start, and final
  GO/no-go evaluation.

## 3. Codex Actions After Owner Completion

- Apply the approved remote migrations against production Supabase.
- Configure production environment variables and verify all demo/mock flags are
  disabled.
- Build, package, verify, and deploy the exact approved release artifact.
- Run production smoke checks for release identity, auth, entitlement,
  WhatsApp challenge, AI/file safety, worker one-shot commands, and health
  endpoints.
- Enable real WhatsApp ingress and required workers only after smoke checks and
  owner approval.
- Write the final dated production GO/no-go report with evidence and residual
  risks.

## Non-Negotiable Guards

- Do not claim production `GO` until the final owner gate is explicitly closed.
- Do not claim iPhone Safari/PWA `PASS`; it remains `WAIVED_NOT_EXECUTED`.
- Do not run live provider/channel egress before production approval.
- Do not apply remote migrations before explicit production migration approval.
- Do not process real client health data before production `GO`.
- Do not hide unresolved owner actions inside local technical completion
  language.
