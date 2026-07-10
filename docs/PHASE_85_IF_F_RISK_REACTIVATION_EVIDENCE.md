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
- `app/src/app/api/clients/[id]/activate-ai/route.ts` exposes authenticated controlled AI activation with optional CAS inputs.
- `app/supabase/migrations/20260710160000_phase_85_if_f_conversation_revision.sql` adds `conversations.revision` and `ai_decisions.conversation_revision_at_generation`.
- Existing `/api/handoffs/[id]/resolve-and-reactivate` remains backward-compatible with free-text reactivation reason.

## Locked Behaviors

- Manual pause resumes through controlled activation without `risk_resolved` clinical evidence.
- Yellow hold resolves through controlled activation, invalidates unused drafts, and restores previous allowed mode.
- Red lock resolves linked handoff through controlled activation with fixed `direct_dietitian_reactivation_v1` reason code unless legacy handoff API supplies free text.
- Unsafe autopilot restoration falls back to copilot.
- Conversation revision and client context revision are captured on AI decisions and revalidated before draft send/commit.
- Direct `aiStatus: "active"` client patch cannot bypass canonical risk-resolution activation.
- Notification read/ack remains notification-only state.

## Verification

- Targeted app `phase-85-if-f-risk-reactivation.test.ts`: 6/6 passed.
- Full app Vitest: 798 passed / 4 skipped.
- App lint: 0 errors, 3 unchanged warnings.
- Production build: passed.
- Full mock channel replay: passed.
- `npm run test:rls`: not re-run; R-406 current re-run remains pending.

## Non-Goals Preserved

- No real WhatsApp/Telegram/Gemini/provider path activation.
- No Stage 4B alert/notification product UX.
- No off-channel AI chat intake (P85-IF-G).
- No lifecycle export/redaction closure (P85-IF-I).
