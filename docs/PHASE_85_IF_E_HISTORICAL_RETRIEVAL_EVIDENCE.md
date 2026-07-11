# Phase 85 Interstage Foundation P85-IF-E Evidence

Date: 2026-07-10
Track: P85-IF-E - Full-History Retrieval And Prompt Authority V2
Status: complete
Next track: P85-IF-F
Production pilot: `NO-GO`

## Scope Delivered

- `dietitian-ai-assistant/src/historical-retrieval.js` implements deterministic lexical retrieval, temporal expiry, generic-greeting exclusion, structured-record override signals, and ambiguous competing-source detection.
- `dietitian-ai-assistant/src/context-compiler.js` adds `CONTEXT_POLICY_V2`, historical `historical_message` segments, overflow fail-closed blocking, and manifest signals for structured updates and ambiguity.
- `dietitian-ai-assistant/src/intent-specific-answerability.js` and `approved-source-answerability.js` require retrieval-evidenced `relevant_dietitian_manual_message` instead of generic dietitian manual presence.
- `dietitian-ai-assistant/src/orchestrator.js` passes full conversation corpus, dietitian timezone, and policy V2 into context compilation.
- `app/src/lib/phase-85-if-e-historical-retrieval.ts` maps `MessageRecord` rows to retrieval candidates and appends structured-update / ambiguity review notifications in simulation.
- `app/src/lib/phase-85-if-e-supabase-search.ts` defines Supabase FTS RPC row mapping and RPC parameter contract.
- `app/supabase/migrations/20260710150000_phase_85_if_e_conversation_message_search.sql` adds `search_vector`, trigger maintenance, GIN index, and `search_conversation_messages` RPC.
- `app/src/lib/simulator.ts` passes tenant-scoped conversation corpus to core and records P85-IF-E notification side effects.

## Locked Behaviors

- Recent promptable window remains capped at eight messages; historical retrieval adds at most six sources and 600 estimated tokens.
- Retrieval excludes `imported_unknown`, revoked, unavailable, blocked, draft, and unverified-actor messages.
- Generic greetings such as `Merhaba` do not count as retrieval-evidenced dietitian manual evidence.
- Relevant dietitian evidence is never silently dropped for budget; overflow blocks with `historical_context_overflow`.
- Newer relevant WhatsApp dietitian instructions can signal `structured_record_update_required` system notifications.
- Ambiguous competing authoritative dietitian sources block affected intents and create review notifications.
- Live `/api/whatsapp/webhook` and real embedding retrieval remain unchanged/disconnected.

## Verification

- Targeted core `historical-retrieval.test.mjs`: 5/5 passed.
- Targeted app `phase-85-if-e-historical-retrieval.test.ts`: 4/4 passed.
- Full app Vitest: 791 passed / 4 skipped.
- Core package tests: 230/230 passed.
- App lint: 0 errors, 3 unchanged warnings.
- Production build: passed.
- Full mock channel replay: passed.
- `npm run test:rls`: not re-run; R-406 current re-run remains pending.

## Non-Goals Preserved

- No real WhatsApp/Telegram/Gemini/provider path activation.
- No Stage 4B alert/notification product UX.
- No risk-resolution / direct AI reactivation semantics (P85-IF-F).
- No controlled off-channel AI chat intake (P85-IF-G).

## Post-Closure Audit Update - 2026-07-11

R2 remediation reopened the structured-update portion of P85-IF-E and found that the original baseline was not fully connected to real app state. The fix now derives menu, food-rule, client-form, and diet-plan revisions before prompt compilation, carries the target baseline through core `structured_record_update_required` signals, and resolves notifications only when the affected target panel advances. Supabase uses service-role-only RPC `p85_if_postclosure_resolve_structured_update_notification` with notification and target-row locks.

Evidence: `docs/PHASE_85_IF_R2_RETRIEVAL_AUTHORITY_TEMPORAL_EVIDENCE.md` and `docs/PHASE_85_IF_REMEDIATION_POST_CLOSURE_AUDIT_EVIDENCE.md`. Verification passed targeted app/core tests, local Supabase reset, local RLS 30/30, full app 828 passed / 4 skipped, full core 234/234, build, channel replay, and production-scale rehearsal.
