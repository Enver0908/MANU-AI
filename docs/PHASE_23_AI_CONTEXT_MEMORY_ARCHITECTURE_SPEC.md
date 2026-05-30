# Phase 23 AI Context, Memory, Token Budget, And Send Safety Spec

## Goal

Make MANU-AI provider context deterministic, bounded, auditable, and fail-closed before any real LLM provider or real health data is connected.

Primary invariant:

- AI never receives the full chat history.
- AI receives only a bounded `PromptContext` compiled from promptable segments.
- `ContextManifest` is audit metadata only and never contains raw message, prompt, health profile, channel identity, or provider output text.
- If the client refers to historical context outside the provided `PromptContext`, the model must output only `[ERROR: missing_historical_context]`.

## Scope

- Add a core `ContextCompiler` without removing `context-capsule.js`.
- Move mock provider input from raw client/capsule-like data to `PromptContext`.
- Add provider output safety mapping for missing historical context.
- Add app-level send safety fields for `contextManifest`, `sendStatus`, `providerOutputSafety`, and `tokenBudget`.
- Add draft invalidation and missing-history handoff behavior in fallback/local state.
- Add Supabase schema columns for future persisted context safety.

## Out Of Scope

- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, analytics, secret manager, or real client health data.
- No pgvector/RAG.
- No automatic destructive deletion job.
- No production regenerate endpoint for legacy drafts.
- No launch gate approval.

## Core Context Policy

`CONTEXT_POLICY_V1` is the single source for deterministic limits:

- total prompt: `3500`
- system/safety/output reserve: `900`
- current message: `500`
- recent messages: `900`
- rolling summary: `700`
- profile/diet/allergy/pinned: `700`
- persona/voice: `300`
- output: `350`
- estimator: `ceil(chars / 3)`
- max recent messages: `8`
- candidate multiplier: `3`

Shrink order:

1. Drop oldest recent message segments.
2. Truncate rolling summary.
3. Truncate pinned notes.
4. If still over budget, return `context_token_budget_exceeded`.

Current inbound message is never silently truncated. If it exceeds budget, return `current_message_token_budget_exceeded`.

## PromptContext And Manifest

Allowed provider segment types:

- `current_message`
- `diet_plan_summary`
- `allergies`
- `restricted_foods`
- `pinned_note`
- `rolling_summary`
- `recent_message`
- `persona`
- `voice_profile`
- `system_instruction`

Recent message eligibility:

- Include `client_inbound`.
- Include `dietitian_manual`.
- Include `ai_generated` only when message status is `sent`.
- Exclude `system_event`, `imported_unknown`, `draft`, `blocked`, and `handoff`.

`ContextManifest` segment metadata may contain only:

- `segmentId`
- `type`
- `sourceId`
- `included`
- `truncated`
- `tokenEstimate`
- `excludeReason`

V1 `hashMode` is `none_v1`; do not store raw text hashes while no production secret manager/HMAC policy exists.

## Missing Historical Context Safety

Every provider-facing system instruction must include this invariant:

```text
Eğer danışan, senin elindeki PromptContext (son 8 mesaj ve özet) içinde yer almayan geçmiş bir konuşmaya, yemeğe veya detaya atıf yapıyorsa; danışana hitaben herhangi bir cevap üretme. Bunun yerine sadece [ERROR: missing_historical_context] çıktısını üret.
```

If provider output contains `[ERROR: missing_historical_context]`, `missing_historical_context`, or an equivalent missing-history token:

- `guardProviderOutput()` returns a `block` issue with category `context`.
- No automatic message or draft is created.
- AI decision `sendStatus` becomes `send_blocked`.
- `blockedReason` becomes `missing_historical_context`.
- The client is moved to human takeover.
- A handoff/review case and safe-text notification are created.

## Draft And Send Safety

Draft invalidation triggers:

- Prompt-affecting client update.
- New inbound message.
- Dietitian manual reply.
- Handoff/takeover lock.
- Anonymization.
- Hard-stale memory.

Invalidation is idempotent:

- Pending draft message `status` becomes `blocked`.
- Linked decision `sendStatus` becomes `draft_invalidated`.
- Repeated invalidation is a no-op and does not duplicate audit.

Legacy drafts:

- `legacy_draft_unverified` cannot approve or edit-send.
- API returns `409 draft_recompile_required`.
- Invalidated drafts return `409 draft_context_invalidated`.
- Dismiss remains allowed.

Send-time revalidation:

- Re-read client revision/gates, memory version/revision, latest promptable message id, channel permission, takeover lock, and AI mode before send.
- Query failure returns `send_blocked` with `revalidation_query_failed`.
- Mismatch returns `send_blocked` with `context_changed_before_send`.

## Supabase And Type Changes

Schema additions:

- `clients.context_revision integer not null default 1`
- `conversation_memories.memory_version text not null default 'memory-v1'`
- `conversation_memories.memory_revision integer not null default 1`
- `conversation_memories.stale boolean not null default false`
- `conversation_memories.stale_reasons text[] not null default '{}'`
- `conversation_memories.compacted_through_message_id uuid null`
- `conversation_memories.compacted_through_created_at timestamptz null`
- `conversation_memories.source_message_count integer not null default 0`
- `ai_decisions.context_manifest jsonb`
- `ai_decisions.send_status text not null default 'not_called'`
- `ai_decisions.provider_output_safety jsonb`
- `ai_decisions.token_budget jsonb`

Backfill `ai_decisions.send_status` by action:

- `sent` -> `legacy_sent_unverified`
- `draft_for_approval` -> `legacy_draft_unverified`
- `handoff` -> `not_applicable`
- `no_ai` with blocked reason -> `send_blocked`
- other `no_ai` -> `not_called`

Do not add legacy values to `messages.status`.

## Edge Cases

- Manifest raw text leakage fails tests.
- Raw provider payload keys fail closed.
- Missing context token can never be converted into a user-facing message.
- Provider output `review` severity can create drafts; `block` severity cannot.
- Memory revision mismatch blocks only when `memoryIncluded=true`.
- `memoryIncluded=false` does not block solely on memory revision mismatch.
- Current message over budget blocks before provider call.
- Existing sent messages remain visible but become `legacy_sent_unverified` at decision level.

## Verification

- Core tests for context compiler, manifest metadata, deterministic shrink, missing-history instruction, and provider output guard.
- App tests for provider boundary, missing-history fail-closed behavior, draft invalidation, and legacy draft blocking.
- Supabase migration coverage in RLS tests when local Supabase is available.
- Run `npm run release:verify`.
- Run `npm run test:rls` if local Supabase is available.
- Run `npm run test:visual` if dashboard UI changes.
