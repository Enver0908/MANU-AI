# Phase 45 Client Removal Data Lifecycle Spec

Date: 2026-06-01

## Goal

Make "remove client" a clear soft-delete/anonymization lifecycle operation. Removed clients must disappear from normal operations, lose promptable health/channel/message/form/memory data, and retain only minimized legal/audit metadata while final hard-delete retention remains legal-review gated.

This phase does not approve production pilot launch, real WhatsApp/Telegram messaging, real provider use, R-405 acceptance, R-406 mitigation, hard-delete automation, or real client health-data processing.

## Assumptions

- In this product, "remove client" means `removed_anonymized`, not hard delete.
- Hard delete remains blocked until legal/privacy review approves final retention and deletion windows.
- Audit and DSAR ledgers remain minimized because explainability and legal operations may require a record that removal occurred.

## Behavior

- Add client lifecycle status:
  - `active`
  - `removed_anonymized`
- Client removal:
  - sets lifecycle to `removed_anonymized`;
  - records `removedAt`;
  - blocks AI and channel use;
  - clears phone/channel identity from app state;
  - resets red-risk lock and takeover state;
  - clears health profile, diet plan, notes, allergies, restricted foods, safety checklist, and communication language back to a neutral default;
  - clears conversation rolling memory;
  - redacts message bodies and removes message provenance links that could revive promptable data;
  - redacts client context updates;
  - redacts form response answers and submitted phone metadata;
  - redacts handoff text and notification text;
  - minimizes AI decision, risk assessment, and audit metadata;
  - records a completed `deletion` data request and a `client_removed_anonymized` audit event.
- Removed clients are hidden from normal dashboard client lists and cannot be selected through normal operations.
- Inbound simulation and other client-facing AI paths reject removed clients with `client_removed_anonymized`.
- Export still returns the minimized legal/audit bundle for the removed client.

## Supabase Behavior

- Add `clients.lifecycle_status text not null default 'active'`.
- Add `clients.removed_at timestamptz null`.
- Add an index on `(tenant_id, lifecycle_status)`.
- The Supabase remove path updates:
  - `clients`
  - `client_channels`
  - `conversation_memories`
  - `messages`
  - `risk_assessments`
  - `ai_decisions`
  - `handoff_cases`
  - `notifications`
  - `client_context_updates`
  - `client_form_responses`
  - `audit_events`
  - `data_requests`

## Tests

- Removed client is lifecycle-marked, AI-blocked, channel-blocked, and hidden from default dashboard filtering.
- Removed client promptable data is redacted across messages, memory, form responses, and context updates.
- Removed client cannot run inbound simulation.
- Export after removal contains minimized/redacted data only.
- Supabase and fallback routes expose controlled remove behavior.
