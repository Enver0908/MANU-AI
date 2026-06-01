# Phase 49 Safety, Orchestration, And Concurrency Hardening Spec

## Goal

Lock in the next implementation wave for the architecture findings verified on 2026-06-02 before any code changes are made.

This phase is a planning and documentation checkpoint. It records the risks and the implementation order for the safety, orchestration, concurrency, and operational hardening work that should happen next.

## Background

An external architecture analysis was reviewed against the current repository. The review confirmed that the local prototype has a strong safety and governance foundation, but several gaps should be closed before any production pilot or real provider/channel connection:

- Quality guard output checks are much narrower than the supported language set.
- Clinical risk classification is single-message first and misses cumulative patterns.
- Preflight safety gates live in the app simulator layer, not in the reusable core boundary.
- Supabase-backed operations load broad state and do not use a general optimistic concurrency write guard.
- Health-profile risk flags are not fully connected to classifier escalation.
- API/channel entrypoints do not have tenant/client scoped rate limiting.
- Persona behavior is prompt-only and not verified in generated output.
- Expired activation windows return `expired` but are not cleaned up or surfaced operationally.
- `simulator.ts` concentrates too many domain responsibilities and should be split once the safety boundary is stable.

## In Scope

### 1. Documentation And Risk Register Lock

- Keep this spec as the canonical Phase 49 target.
- Record open risks in `docs/RISK_REGISTER.md`.
- Record Phase 49 as the next execution wave in `docs/NEXT_PHASE_EXECUTION_PLAN.md`.
- Record the same handoff guidance in `HANDOFF_FOR_NEXT_CODEX.md`.

### 2. Clinical Output Safety

- Expand `response-quality-guard` forbidden output coverage across `tr`, `en`, `de`, `fr`, `es`, `pt`, and `cs`.
- Cover diagnosis language, medication/insulin/dose instructions, emergency minimization, unsupported plan changes, and AI identity phrases.
- Add persona output checks for `emojiPolicy` and short-message constraints without weakening clinical guards.

### 3. Risk Escalation

- Extend classifier profile input to include the health-profile flags already present in `ClientRecord`.
- Add a cumulative risk layer over recent promptable messages and the current inbound message.
- Use cumulative risk to escalate to `yellow` by default; do not broaden automatic `red` routing without explicit clinical taxonomy approval.

### 4. Core Preflight Boundary

- Move the common inbound preflight evaluator into the core package and export it.
- Reuse that evaluator from the app simulator and channel adapter path.
- Preserve the existing preflight behavior: removed clients, red-risk lock, permission state, missing channel identity, unknown adult status, human takeover, and incomplete autopilot safety checklist remain blocked before provider calls.

### 5. Concurrency And Abuse Protection

- Add optimistic concurrency guards for client-context and draft/handoff write paths.
- Return controlled `409 concurrent_state_update` failures when expected state revisions do not match.
- Add tenant/client scoped rate limiting for simulator, channel inbound, manual reply, draft review, and internal copilot chat paths.
- Return controlled `429 rate_limit_exceeded` failures without logging raw message body text.
- Phase 4 local implementation note: optimistic concurrency is enforced on Supabase client-row mutations through `context_revision`; draft send-time/status checks remain in place, but full multi-table transactional coverage is still a production hardening item. Rate limiting is app-instance scoped and must be replaced or backed by distributed infrastructure before production.

### 6. Activation And Maintainability Cleanup

- Add lazy expired-activation handling so expired windows do not silently repeat forever.
- Record an audit event and/or safe notification once per expired activation transition.
- Mark `buildReplyPrompt` as deprecated or remove it after compatibility review.
- Split `simulator.ts` into domain modules after core preflight and concurrency behavior are stable.

## Out Of Scope

- Real WhatsApp or Telegram connection.
- Real Gemini or external LLM provider connection.
- Production secret manager, push/email adapter, monitoring provider, or backup provider connection.
- Client-facing legal/permission copy.
- Approval of any production-pilot launch gate.
- Dynamic provider tokenizer or model-specific prompt budget policy; this remains a provider-readiness item.

## Implementation Order

1. Documentation/risk register lock.
2. Multilingual quality guard and persona output checks.
3. Health-profile risk flags and cumulative yellow escalation.
4. Core preflight evaluator extraction and app reuse.
5. Optimistic concurrency and rate limiting.
6. Expired activation cleanup.
7. `simulator.ts` modularization and `buildReplyPrompt` cleanup.

## Acceptance Criteria

- Risk register contains open risks for all Phase 49 gaps.
- Existing core and app tests still pass after each implementation step.
- Red-risk messages still never reach provider generation.
- Preflight-blocked messages still use `providerAttempted=false`, `model=null`, and `providerStatus=not_called`.
- Multilingual unsafe outputs are blocked by tests for all supported languages.
- Cumulative risk examples that are individually green but collectively concerning escalate to yellow.
- Client-row concurrent write conflicts fail closed with controlled 409 responses.
- App-instance rate-limit violations fail closed with controlled 429 responses and no raw health-message logging.
- Production pilot remains `NO-GO` after Phase 49 unless all external launch gates are separately approved.

## Required Test Coverage

- Core quality guard multilingual block cases.
- Persona output-contract block cases.
- Health-profile flag escalation cases.
- Cumulative risk escalation cases.
- Core preflight evaluator parity with existing simulator behavior.
- App simulator/channel paths reuse core preflight and do not call providers on blocked flows.
- Supabase concurrency conflict behavior.
- Rate limiter success and blocked paths.
- Expired activation cleanup/audit behavior.

## Documentation Status

Phase 49 is documented as an open implementation wave. No real provider, real channel, production secret, or real client health-data path has been connected by this spec.

## Implementation Progress

- 2026-06-02: Documentation and risk-register lock completed.
- 2026-06-02: Clinical output safety completed locally. The quality guard now covers multilingual unsafe provider output patterns, and persona output-contract checks block disallowed emojis and overlong `very short` persona replies.
- 2026-06-02: Core preflight extraction and cumulative yellow-risk escalation completed locally. Direct core orchestrator calls now use the reusable preflight evaluator, simulator preflight reuses the same evaluator, and repeated meal-restriction patterns escalate to yellow across the recent-message window.
- 2026-06-02: Concurrency and abuse protection completed for the local prototype. Supabase client-row writes now use expected `context_revision` checks and return `409 concurrent_state_update` on stale state; simulator, mock channel inbound, manual reply, draft review, and internal copilot paths now use scoped app-instance rate limits that return `429 rate_limit_exceeded`.
- 2026-06-02: Final Phase 49 local cleanup completed. Health-profile flags now lower classifier thresholds for context-sensitive messages, expired activation windows lazily passivate clients with a safe audit/notification signal, simulator risk/model routing was extracted into a small module, and the unused legacy `buildReplyPrompt` export was removed.
- Remaining: distributed production rate limiting, broader multi-table transaction/revision hardening, narrowed Supabase reads for scale, and external production-pilot launch-gate approvals.
