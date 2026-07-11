# Phase 85 Interstage Foundation P85-IF-F Evidence

Date: 2026-07-10
Track: P85-IF-F - Risk Resolution, AI Reactivation, And Concurrency
Status: complete
Next track: P85-IF-G
Production pilot: `NO-GO`

## Scope Delivered

- `app/src/lib/phase-85-if-f-risk-reactivation.ts` implements human-control session helpers, controlled activation audit codes, and session opening for risk-linked states.
- `app/src/lib/phase-85-if-f-conversation-revision.ts` implements monotonic conversation revision increments.
- `app/src/lib/simulator.ts` adds `activateClientAiWithControlledRiskResolutionInState`, routes `aiStatus: "active"` client patches through canonical activation, extends send-time CAS with conversation revision, and opens yellow/red/manual human-control sessions.
- `app/src/app/api/clients/[id]/activate-ai/route.ts` exposes authenticated controlled AI activation with required conversation and client-context CAS inputs.
- `app/supabase/migrations/20260710160000_phase_85_if_f_conversation_revision.sql` adds `conversations.revision` and `ai_decisions.conversation_revision_at_generation`.
- `app/supabase/migrations/20260710200000_phase_85_if_remediation_atomic_activation.sql` adds the service-role-only atomic activation RPC, expected-conversation revision guards for inbound/draft commits, and canonical transaction handling for client, conversation, handoff, human-control session, risk-activity, status-event, and audit writes.
- Existing `/api/handoffs/[id]/resolve-and-reactivate` remains backward-compatible with free-text reactivation reason.

## Locked Behaviors

- Manual pause resumes through controlled activation without `risk_resolved` clinical evidence.
- Yellow hold resolves through controlled activation, invalidates unused drafts, and restores previous allowed mode.
- Red lock resolves linked handoff through controlled activation with fixed `direct_dietitian_reactivation_v1` reason code unless legacy handoff API supplies free text.
- Unsafe autopilot restoration falls back to copilot.
- Conversation revision and client context revision are captured on AI decisions and revalidated before draft send/commit.
- Direct `PATCH /api/clients/[id]` with `aiStatus: "active"` is rejected; activation must use the canonical `activate-ai` endpoint/RPC.
- Supabase activation is atomic and fail-closed on stale `expectedConversationRevision` or `expectedClientContextRevision`.
- Notification read/ack remains notification-only state.

## Verification

- R3 remediation targeted app `phase-85-if-f-risk-reactivation.test.ts` plus historical retrieval regression: 12/12 passed.
- Local Supabase migration reset: passed through `20260710200000_phase_85_if_remediation_atomic_activation.sql`.
- Local Supabase RLS/integration: 24/24 passed, including atomic activation RPC revision guards.
- Full app Vitest: 798 passed / 4 skipped.
- App lint: 0 errors, 2 unchanged warnings.
- Production build: passed after R3 remediation.
- Full mock channel replay: passed.

## Non-Goals Preserved

- No real WhatsApp/Telegram/Gemini/provider path activation.
- No Stage 4B alert/notification product UX.
- No off-channel AI chat intake (P85-IF-G).
- No lifecycle export/redaction closure (P85-IF-I).

## Post-Closure Audit Update - 2026-07-11

R3 remediation was re-audited for activation/inbound concurrency. Atomic activation already required expected conversation and client-context revisions, but the audit found a lock-order inversion between activation and inbound expected-conversation checks. Append-only migration `20260711202000_phase_85_if_postclosure_r3_lock_order.sql` now locks affected clients before conversations in deterministic order, matching activation.

Evidence: `docs/PHASE_85_IF_R3_ATOMIC_AI_ACTIVATION_RACE_EVIDENCE.md` and `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`. Local RLS/integration passed 30/30 with activation versus inbound, red-risk, and verified human-echo race coverage.
