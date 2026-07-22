# Phase 85 Stage 4C - Diyetisyen Icin AI Chat Action Plan

Date: 2026-07-22
Status: **Faz 5 complete locally; Faz 6 is next**

## Current Authority

Stage 4C builds a safe, sourced, context-bound AI working companion for the dietitian. It does not expand automatic client-reply authority. It sits on top of existing messaging, risk, retrieval, media, audio, notification, handoff, and RLS contracts.

Production remains `NO-GO`. R-405 remains open. Real WhatsApp, Telegram, external LLM, external embedding, external OCR, external STT, production monitoring, secret-manager, live billing, and real client health-data provider egress remain disabled unless a later explicitly approved production gate closes them.

## Fixed Decisions

- Dashboard has a clear **AI Chat** entry and a dedicated route: `/dashboard/ai-chat` and `/dashboard/ai-chat/[chatId]`.
- The AI Chat history is unified: general chats and client-bound chats appear in one history list, with filters for `Genel` and `Danisan`.
- A conversation has exactly one immutable scope after creation: `general` or `client_bound`.
- A client-bound conversation has exactly one immutable `clientId`. The same conversation cannot switch clients and cannot retrieve data for a second client.
- Client selection uses search by name/surname plus a reversible display reference generated from the client UUID. The database does not need a new display-code column in Faz 1.
- Dietitian-owned content is creator-private. Owner/admin capability is allowed for the AI Chat feature only for their own chats unless a future compliance workflow explicitly adds tenant-wide inspection.
- Assistant and auditor roles cannot use AI Chat.
- The old internal read-only Copilot remains historical implementation and may keep its old data, but Stage 4C does not reuse its storage, APIs, or UI as the new product surface.
- AI responses are text-only in Stage 4C. Inputs can include text, images, audio, and documents after the multimodal phases are implemented.
- No daily/monthly/message/token quota is introduced. No capacity telemetry, token counts, cost counters, or per-user AI capacity collection is added in Stage 4C. Safety limits, attachment limits, and concurrency limits remain required.
- Local implementation uses deterministic/mock adapters only. Provider egress gates remain fail-closed.

## Global Contracts

### Domain Types

Stage 4C introduces a separate domain under `app/src/lib/phase-85-stage-4c-*`:

- `AiChatScopeType`: `general | client_bound`
- `AiChatConversationStatus`: `active | archived | deleted | locked`
- `AiChatMessageRole`: `user | assistant | system | tool`
- `AiChatRunStatus`: `queued | running | stopping | stopped | completed | failed | superseded`
- `AiChatAttachmentKind`: `image | document | audio`
- `AiChatAttachmentStatus`: `uploaded | scanning | rejected | parsed | review_required | accepted | deleted`
- `AiChatAnswerability`: `answerable | partially_answerable | not_answerable`
- `AiChatRiskLevel`: `green | yellow | red`
- `AiChatSourceKind`: `client_record | approved_source | chat_attachment | accepted_transcript | accepted_ocr | dietitian_message | system_policy`

### API Surface

All mutation endpoints require `requestId`. Revision-sensitive operations also require the expected current revision.

- `GET /api/ai-chat/conversations`
- `POST /api/ai-chat/conversations`
- `PATCH /api/ai-chat/conversations/[chatId]`
- `DELETE /api/ai-chat/conversations/[chatId]`
- `GET /api/ai-chat/conversations/[chatId]/messages`
- `POST /api/ai-chat/conversations/[chatId]/messages`
- `PATCH /api/ai-chat/conversations/[chatId]/messages/[messageId]`
- `DELETE /api/ai-chat/conversations/[chatId]/messages/[messageId]`
- `POST /api/ai-chat/conversations/[chatId]/runs/[runId]/stop`
- `POST /api/ai-chat/conversations/[chatId]/regenerate`
- `GET /api/ai-chat/conversations/[chatId]/runs/[runId]/events`
- `GET /api/ai-chat/conversations/[chatId]/messages/[messageId]/sources`
- `GET /api/ai-chat/client-search`
- `POST /api/ai-chat/attachments`
- `PATCH /api/ai-chat/attachments/[attachmentId]`
- `POST /api/ai-chat/attachments/[attachmentId]/copy-to-client-record`
- `POST /api/ai-chat/conversations/[chatId]/safe-draft-transfer`
- `POST /api/ai-chat/conversations/[chatId]/handoff-link`

### Provider Ports

The orchestrator consumes ports, not concrete providers:

- `AiChatGenerationProvider`
- `AiChatEmbeddingProvider`
- `AiChatOcrProvider`
- `AiChatSttProvider`
- `AiChatWebResearchProvider`
- `AiChatAttachmentScanner`

Every real provider adapter must pass DPA/no-training/retention/region/subprocessor/log-redaction/incident/secret-manager checks before production use. Faz 1 records the contract only.

## Faz 1: Kanonik Plan, Tehdit Modeli ve Uygulama Okuma Kapisi

### Amac

Create the canonical Stage 4C implementation plan, threat model, carry-forward constraints, risk register entries, and evidence trail before any runtime or schema change.

### Kapsam

- Create this file as the canonical Stage 4C plan.
- Create `docs/PHASE_85_STAGE_4C_PHASE_1_READ_GATE_EVIDENCE.md`.
- Update current authority references in `README.md`, `PLAN.md`, `PROJECT_PLAN.md`, `HANDOFF_FOR_NEXT_CODEX.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, and `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`.
- Add Stage 4C planning risks R-462 through R-480 to `docs/RISK_REGISTER.md`.
- Confirm no production GO, no R-405 change, no provider/channel activation, and no runtime behavior change.

### On Kosullar

- Branch is `codex/stage-4b4-voice-transcription`.
- Latest commit is `75e7ea9 Harden release verification and clean static analysis debt`.
- Worktree is clean before edits.
- Stage 4B-4 R9 evidence authorizes Stage 4C planning/read gate.

### Etkilenecek Bilesenler ve Dosyalar

- `docs/PHASE_85_STAGE_4C_DIYETISYEN_AI_CHAT_ACTION_PLAN.md`
- `docs/PHASE_85_STAGE_4C_PHASE_1_READ_GATE_EVIDENCE.md`
- `docs/RISK_REGISTER.md`
- `README.md`
- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- `app/README.md`
- `docs/NEXT_PHASE_EXECUTION_PLAN.md`
- `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`

### Mimari Kararlar

- Stage 4C is a separate AI Chat domain.
- Stage 4C does not mutate client records except through future explicit safe-draft transfer and attachment copy flows.
- Stage 4C does not reuse internal Copilot APIs or storage.
- The first implementation phase after this read gate is data model, RLS, and capability foundation.

### Uygulama Adimlari

1. Verify branch, latest commit, and clean worktree.
2. Read canonical continuity documents and Stage 4B-4 R9 evidence.
3. Create the Stage 4C plan file with fixed decisions and phase sequence.
4. Create read-gate evidence with the files read, risks opened, verification run, and unchanged production constraints.
5. Update current authority references to point to Stage 4C Faz 1 and this plan.
6. Append Stage 4C risk rows R-462 through R-480.
7. Run documentation-only verification commands.

### Teknik Yontemler

- Documentation edits only.
- Append-only risk register update.
- No migrations, route files, provider code, UI components, dependency files, or package scripts are changed.

### Veri Akisi

Faz 1 has no runtime data flow. It records the future intended control flow:

`dashboard route -> ai-chat API -> ai-chat store -> RLS/capability guard -> orchestrator -> context gateway -> deterministic provider port -> sourced response -> persisted run/message/source refs`

### Bagimliliklar

- Stage 4B-4 R9 evidence.
- P85-IF retrieval, source authority, risk, lifecycle, and RLS contracts.
- Stage 4B-2 messaging and handoff contracts.
- Stage 4B-3 media and Stage 4B-4 audio contracts.

### Hata ve Sinir Durumlari

- If worktree is dirty before implementation, stop and report changed files.
- If Stage 4C plan naming drifts to hyphen-number labels instead of `Faz` labels, fail verification.
- If a doc claims production GO, provider activation, or R-405 closure, fail verification.
- If risk IDs collide with existing risk IDs, fail verification.

### Testler

- `git diff --check`
- `rg -n "Phase\s+86|4C-\d" README.md PLAN.md PROJECT_PLAN.md HANDOFF_FOR_NEXT_CODEX.md app/README.md docs -g "!docs/PHASE_85_STAGE_4C_*"`
- `rg -n "PHASE_85_STAGE_4C_DIYETISYEN_AI_CHAT_ACTION_PLAN|PHASE_85_STAGE_4C_PHASE_1_READ_GATE_EVIDENCE" README.md PLAN.md PROJECT_PLAN.md HANDOFF_FOR_NEXT_CODEX.md app/README.md docs/NEXT_PHASE_EXECUTION_PLAN.md docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`
- `git status --short`

### Dogrulama Olcutleri

- New Stage 4C plan exists and uses `Faz 1`, `Faz 2`, etc.
- Evidence exists and states Stage 4C Faz 1 is documentation-only.
- Risk register contains R-462 through R-480.
- Current authority docs reference Stage 4C Faz 1 and the new plan.
- Production remains `NO-GO`; R-405 remains open.

### Tamamlanma Kriterleri

- Documentation diff is clean.
- No runtime files changed.
- No package, migration, provider, API, UI, or storage changes exist in this phase.
- Verification commands are recorded in the evidence file.

## Faz 2: Veri Modeli, RLS ve Yetki Temeli

### Amac

Create the isolated AI Chat persistence model, RLS policies, capability checks, and migration contracts.

### Kapsam

- Add append-only migrations for AI Chat conversations, branches, messages, message versions, runs, run events, tool calls, context snapshots, source refs, memory summaries, provider egress manifests, mutation ledger, and events.
- Add `dietitian_ai_chat` capability and route-level authorization mapping.
- Add TypeScript contracts and SQL migration tests.

### On Kosullar

- Faz 1 complete.
- No runtime UI/API endpoints depend on missing tables.
- Local Supabase is available for RLS execution before closure.

### Etkilenecek Bilesenler ve Dosyalar

- `app/supabase/migrations/20260722100000_phase_85_stage_4c_ai_chat_domain.sql`
- `app/supabase/migrations/20260722110000_phase_85_stage_4c_ai_chat_rls.sql`
- `app/supabase/tests/stage_4c_ai_chat_rls.sql`
- `app/src/lib/phase-85-stage-4c-contracts.ts`
- `app/src/lib/phase-85-stage-4c-auth.ts`
- `app/src/lib/types.ts`
- `app/src/lib/app-state-store.ts`
- `app/src/lib/supabase-store.ts`

### Mimari Kararlar

- `tenant_id`, `creator_user_id`, and immutable `scope_type` are mandatory on conversations.
- `client_id` is nullable only for `general` conversations and required for `client_bound`.
- Message edits create new versions and branches instead of mutating historical assistant outputs.
- Direct table access for ordinary authenticated users is denied except through RLS-safe views/RPCs required by the app.

### Uygulama Adimlari

1. Define domain tables with tenant-composite foreign keys.
2. Add check constraints for immutable scope, one-client conversations, run status, and message role.
3. Add service-role RPCs for atomic create/update/delete primitives used by later APIs.
4. Add RLS policies for creator-private AI Chat reads and writes.
5. Add role capability projection that allows owner/admin/dietitian, blocks assistant/auditor, and always validates creator ownership.
6. Add migration-contract and RLS tests.

### Veri Akisi

`API actor context -> capability guard -> service-role RPC -> RLS/tenant constraints -> AI Chat tables -> safe DTO projection`

### Hata ve Sinir Durumlari

- Missing tenant, missing creator, stale expected revision, wrong client, revoked client access, or unsupported role returns fail-closed errors.
- Attempted scope/client mutation returns `409 immutable_scope`.
- Cross-tenant reads return `404`.

### Testler ve Tamamlanma

Targeted migration/RLS tests must pass with zero skipped RLS tests once local Supabase applies the new migration chain. No UI or orchestrator behavior is required in Faz 2.

## Faz 3: Bounded CRUD Servisi, API Iskeleti ve Danisan Arama

### Amac

Expose bounded CRUD APIs and client search without generation, retrieval, or attachments.

### Kapsam

- Implement `AiChatStore`.
- Add API handlers for conversation list/create/read/rename/archive/delete shell and message list shell.
- Add client search by name/surname/reference code.
- Add in-memory deterministic store only for tests/dev fallback; production Supabase path fail-closes if not configured.

### Etkilenecek Dosyalar

- `app/src/lib/phase-85-stage-4c-store.ts`
- `app/src/lib/phase-85-stage-4c-supabase-store.ts`
- `app/src/lib/phase-85-stage-4c-client-reference.ts`
- `app/src/app/api/ai-chat/**`
- `app/src/lib/phase-85-stage-4c-api.test.ts`

### Veri Akisi

`client UI/API caller -> route context -> auth/capability -> AiChatStore -> safe DTO`

### Hata ve Sinir Durumlari

- Empty search returns no clients, not broad tenant list.
- Duplicate names return disambiguated safe rows.
- Client access revoked after search but before create returns `403`.

### Tamamlanma

CRUD and search API tests pass; no LLM call exists.

## Faz 4: Dashboard AI Chat Arayuzu

### Amac

Add the ChatGPT-like AI Chat dashboard surface.

### Kapsam

- Add dashboard nav item `AI Chat`.
- Add routes `/dashboard/ai-chat` and `/dashboard/ai-chat/[chatId]`.
- Build three-pane desktop layout, mobile drawer history, focus/fullscreen mode, search/filter history, rename, delete, and client-bound creation flow.
- Add client profile action `AI ile degerlendir`.
- Retire visible old internal Copilot entry points without deleting historical code/data.

### Etkilenecek Dosyalar

- `app/src/components/dashboard-app.tsx`
- `app/src/components/dashboard/ai-chat-panel.tsx`
- `app/src/components/dashboard/ai-chat-history.tsx`
- `app/src/components/dashboard/ai-chat-composer.tsx`
- `app/src/components/dashboard/ai-chat-message-list.tsx`
- `app/src/lib/phase-85-stage-4b-dashboard-routing.ts`
- `app/src/lib/phase-85-stage-4c-i18n.ts`
- visual tests under `app/tests/visual/`

### Tamamlanma

UI can create/open/rename/delete conversations and render empty/message states without generation.

## Faz 5: Metin Mesaji, Run Lifecycle, Streaming, Stop/Edit/Regenerate

### Amac

Implement text message sending and deterministic assistant run lifecycle.

### Kapsam

- Add orchestrator shell.
- Persist user message, run, deltas, source/risk status, completion.
- Add SSE streaming with heartbeat.
- Implement stop generation.
- Implement edit only for the latest user-authored message in the active branch.
- Implement regenerate for the latest assistant response.
- Implement copy action in the client only.

### Sinirlar

- One active run per chat.
- Three active runs per user.
- No quota/capacity counters.
- Single-message delete waits until Faz 10.

### Tamamlanma

Text chat works end to end with deterministic provider and branch-safe edit/regenerate behavior.

## Faz 6: Danisan Context Gateway ve Buyuk Kayitlar Icin Bounded Retrieval

### Amac

Allow a client-bound chat to answer from that one client's data without dumping the whole record into the prompt.

### Kapsam

- Intent classifier with fixed internal intents.
- Allowlisted read-only client tools.
- Structured SQL plus PostgreSQL FTS; semantic retrieval port remains disabled locally.
- Context snapshot with source IDs, excerpts, and budget metadata excluding token/cost telemetry.

### Limits

- Max 8 tool calls per run.
- Max 4 parallel tool calls.
- Max 2 seconds per tool.
- Max 30 source refs.
- Max 20 unstructured excerpts.
- Max 1200 chars per excerpt.
- Max 32k evidence chars.
- Max 12 recent chat messages or 18k chars.
- Max 4k memory summary chars.
- Max 60k total prompt chars.

### Tamamlanma

Client-bound answers cite exact client facts and approved source refs; second-client access fails hard.

## Faz 7: Kaynakli Cevap, Answerability ve Klinik Guvenlik Politikasi

### Amac

Make every clinical or personalized answer source-bound and answerability-aware.

### Kapsam

- Approved source table/chunk import.
- Claim/source mapping.
- Unsupported claim blocker.
- Prompt-injection defense.
- Explicit web research placeholder with real adapter disabled.

### Tamamlanma

Personalized recommendations require both client fact evidence and clinical source evidence. Unsupported answers produce safe limitation text for the dietitian, not fabricated certainty.

## Faz 8: Multimodal Girdi: Gorsel, Dokuman ve Ses

### Amac

Allow dietitians to upload images, documents, and voice notes into AI Chat with reviewable derived text.

### Kapsam

- Private chat attachment bucket.
- Scanner, parser, OCR, and STT job states.
- Browser WAV recording.
- Accepted derivative workflow before retrieval.
- Optional `Danisan kaydina ekle` flow that creates an independent sanitized client-record copy.

### Dosya Turleri

- Images: JPEG, PNG, WebP.
- Documents: PDF, DOCX, TXT, CSV.
- Audio: WAV, OGG.

### Tamamlanma

Raw files are never directly prompted. Only accepted, bounded derivatives can become retrieval evidence.

## Faz 9: Risk, Bildirim, Handoff ve Guvenli Taslak Aktarimi

### Amac

Connect AI Chat to existing risk, notification, handoff, and messaging draft workflows without automatic client send.

### Kapsam

- Green/yellow/red risk adapter.
- Red creates deduplicated internal notification only.
- Safe draft transfer requires explicit dietitian action.
- Green can open pending composer draft; yellow routes through review UI; red is blocked.
- Explicit handoff link creation with confirmation.

### Tamamlanma

AI Chat can help draft and explain, but cannot send to client and cannot reactivate client automation.

## Faz 10: Yasam Dongusu, Silme, Export ve Legal Hold

### Amac

Implement chat lifecycle controls, full delete, latest-user-message delete, export, retention cleanup, and legal hold.

### Kapsam

- Full conversation delete.
- Delete only latest user-authored message in the active branch.
- Purge descendant assistant outputs, runs, events, tool calls, context snapshots, source refs, and chat-only attachments.
- Keep copied client-record assets independent from chat deletion.
- Legal hold returns `423`.
- Run deltas and orphan/rejected uploads cleaned after 24 hours.

### Tamamlanma

Deleted or superseded data cannot be retrieved, streamed, or cited.

## Faz 11: Sertlestirme, Klinik Degerlendirme, Olcek ve Kapanis

### Amac

Close Stage 4C locally with clinical, privacy, RLS, visual, accessibility, scale, and release evidence.

### Kapsam

- 240 synthetic golden cases.
- 100 adversarial cases.
- Synthetic scale: 100 dietitians, 5000 clients, 10000 chats, 200000 message versions.
- Four viewport visual QA.
- Accessibility checks.
- Release verification chain.

### Hard-Zero Kriterleri

- Cross-client or cross-tenant scope leak.
- Automatic client send or client-record mutation outside explicit transfer/copy flows.
- Missed red risk.
- Invalid citation.
- Deleted data retrieved.
- Unsupported clinical claim.
- Stopped or superseded run completes as current.
- General chat uses client PHI tools.
- Client-bound chat accesses a second client.
- Unaccepted OCR/STT derivative used.
- Production provider flag enabled.
- RLS skipped.

### Tamamlanma

Stage 4C closes locally only when all required evidence passes. Production remains `NO-GO` until external gates, provider approvals, R-405 disposition, and production operations evidence close separately.
