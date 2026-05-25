# MANU-AI Phase 5 Data Governance Spec

## Goal

Create a testable technical skeleton for retention, client export, client deletion/anonymization, and memory invalidation before any pilot data is used.

## Scope

- Define retention policy placeholders by table/data category.
- Add a tenant/client-scoped export helper for the local app state.
- Add a client anonymization helper that removes promptable client context.
- Make memory invalidation testable.
- Document that final retention durations remain legal-review dependent.

## Non-Goals

- No real DSAR automation.
- No production deletion job.
- No Supabase destructive deletion workflow yet.
- No real health data, WhatsApp, Telegram, Gemini, or provider integration.
- No final legal retention durations.

## Implementation Plan

1. Add `app/src/lib/data-governance.ts`.
2. Expose:
   - `RETENTION_POLICY_PLACEHOLDERS`
   - `buildClientScopedExport(state, clientId)`
   - `anonymizeClientInState(state, clientId)`
3. Keep export bounded to the current tenant and requested client.
4. Remove promptable context during anonymization:
   - health profile values
   - diet plan
   - allergies/restricted foods
   - clinical and pinned notes
   - channel identifier
   - rolling conversation memory
   - message bodies and AI decision references for that client's conversations
5. Keep minimized audit evidence with `client_data_anonymized`.
6. Add focused unit tests.

## Edge Cases

- Unknown client returns `client_not_found`.
- Export cannot include other clients' messages, decisions, handoffs, notifications, or risk assessments.
- Anonymized clients are passive/manual/blocked and cannot be used by the simulator as promptable context.
- Existing audit events can remain, but a new minimized anonymization audit event must be added.

## Done Criteria

- Deleted/anonymized clients cannot remain in promptable context.
- Memory invalidation is testable.
- Export scope is tenant/client bounded.
- Final retention durations are explicitly marked `legal_review_required`.
