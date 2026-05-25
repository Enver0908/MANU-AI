# MANU-AI Pilot Readiness Evidence Pack

Date: 2026-05-25

## Status

MANU-AI has a local pilot-foundation prototype with safety, privacy, operational, and verification controls in place.

Production pilot is still blocked. This evidence pack does not approve legal/privacy, clinical, provider/vendor, WhatsApp/Telegram policy, backup/restore, secret rotation, or dependency audit gates.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

## Latest Verification

Run from `app`:

```text
npm run release:verify
```

Latest result:

- Core package tests: 35/35 passed.
- App tests: 78/78 passed.
- App lint: passed.
- Production build: passed.
- Production dependency audit gate: passed with only documented R-405 findings.
- R-405 remains open: Next.js 16.2.6 nested PostCSS advisory, no safe stable patch path applied.

Separate optional evidence commands:

- `npm run test:rls` when local Supabase is available.
- `npm run test:visual` when browser visual smoke evidence is needed.

## Launch Gate Matrix

| Launch gate | Internal evidence available | Remaining blocker | Gate status |
| --- | --- | --- | --- |
| Legal and privacy review | `DATA_INVENTORY.md`, `PHASE_5_DATA_GOVERNANCE_SPEC.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, tenant/client-scoped export/anonymization tests | Legal basis matrix, privacy notice, permission documents, medical-device/CDS classification memo require external review | Open |
| Qualified dietitian clinical taxonomy approval | `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical JSONL golden cases, 35 core tests, persona-invariant safety tests | Qualified dietitian sign-off and taxonomy change approval | Open |
| Provider vendor and retention review | `AI_PROVIDER_REQUIREMENTS.md`, local mock provider, provider failure no-send behavior, provider input allowlist guard | Gemini/provider terms, health-data retention configuration, prompt/completion logging decision | Open |
| WhatsApp and Telegram policy review | `PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`, `PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`, mock adapter idempotency, identity quarantine, opt-out simulation | WhatsApp healthcare feasibility, Telegram bot/privacy policy, real opt-in/out/template/service-window procedure | Open |
| Incident response and deletion workflow runbook | `INCIDENT_RESPONSE_RUNBOOK.md`, `PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`, legal ops ledger, safe operational health snapshot | Breach escalation owner list, approved DSAR/deletion operating procedure | Open |
| Backup expiry and restore test | `BACKUP_RESTORE_RUNBOOK.md` | Backup expiry policy, restore drill result, owner and cadence | Open |
| Production secret rotation plan | `SECRET_ROTATION_RUNBOOK.md` | Production secret inventory, rotation owner/cadence, secret manager decision | Open |
| Production dependency audit clearance | `PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`, `npm run release:verify`, R-405 tracked in `RISK_REGISTER.md` | R-405 safe stable Next.js/PostCSS patch path or formal risk acceptance | Open |

## Technical Evidence Summary

Safety and clinical control:

- Red-risk flows do not call the provider and create handoff cases.
- Yellow-risk flows become approval drafts.
- Persona changes do not alter safety decisions.
- Provider policy guard rejects red-risk provider calls as defense in depth.

Privacy and data minimization:

- Tenant/client-scoped export and anonymization exist.
- Anonymization removes promptable client context and rolling memory.
- Operational health and notification SLA snapshots expose aggregate counts only.
- Provider input is allowlisted to `risk` and `client.dietPlan.summary`.
- Channel and provider metadata helpers avoid raw prompt/message/profile leakage.

Access and tenant isolation:

- Supabase-backed routes enforce fail-closed role capabilities.
- Owner/admin are tenant-wide.
- Dietitian access is owned plus assigned clients.
- Assistant access is assigned clients only.
- Auditor app-state currently receives no raw client/message state.

Messaging and channel readiness:

- Mock WhatsApp/Telegram adapters use normalized inbound contracts.
- Unknown and ambiguous channel identities are quarantined before AI processing.
- Duplicate provider events are idempotent.
- Empty payloads and missing provider event ids fail closed.
- Exact opt-out commands set matched client permission to `opted_out` without entering the AI path.

Operations:

- In-app safe-text notifications exist for red handoffs.
- Notification read/acknowledge paths exist and persist in Supabase-backed mode.
- SLA breach and internal escalation due counts are available as safe aggregate health signals.
- Incident response, backup/restore, and secret rotation runbook drafts exist.

Release verification:

- `npm run release:verify` is the current local release gate.
- The command includes core tests, app lint, app tests, build, and production dependency audit.
- Unknown production audit findings fail closed.
- High or critical production audit findings fail closed.

## Explicit Non-Approvals

- This package does not approve production pilot launch.
- This package does not approve processing real client health data.
- This package does not approve real WhatsApp or Telegram messaging.
- This package does not approve real Gemini or external LLM calls with health data.
- This package does not approve external notification or monitoring vendors.
- This package does not resolve R-405.

## Next Approval Path

1. Complete legal/privacy review and client-facing permission documents.
2. Obtain qualified dietitian approval for the current clinical taxonomy and golden test set.
3. Complete provider/vendor retention and prompt logging review.
4. Complete WhatsApp/Telegram policy, opt-in/out, template, and service-window review.
5. Finalize incident response, DSAR/deletion, backup/restore, and secret rotation ownership.
6. Resolve or formally accept R-405 before production pilot.
7. Re-run `npm run release:verify` after any approval-related code, dependency, prompt, or taxonomy change.
