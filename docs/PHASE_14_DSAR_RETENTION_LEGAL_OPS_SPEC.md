# MANU-AI Phase 14 DSAR, Retention, And Legal Ops Ledger Spec

## Goal

Record client data export and anonymization operations in a tenant/client-scoped legal operations ledger before real pilot data is processed.

## Scope

- Add data request records to local app state and Supabase.
- Record completed export and anonymization requests.
- Include client-scoped data request history in export bundles.
- Keep final retention durations marked `legal_review_required`.
- Keep deletion as a future review-required workflow, not an automatic destructive job.

## Non-Goals

- No automatic deletion scheduler.
- No final retention durations.
- No client-facing DSAR portal.
- No legal approval claim.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real client health data.

## Edge Cases

- Exporting an unknown client must remain a controlled `client_not_found` error.
- Anonymizing an unknown client must remain a controlled `client_not_found` error.
- Export ledger records must not include raw audit internals, provider secrets, prompts, or unrelated tenant data.
- Anonymization must still clear promptable client context.
- Auditor raw app-state remains empty from Phase 13.

## Verification

- Unit tests prove export and anonymization create data request records.
- Unit tests prove export bundles include only the target client's data request history.
- RLS integration covers `data_requests` tenant isolation.
- Existing app tests, lint, local RLS, and production build pass.
