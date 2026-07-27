# Phase 85 Stage 4C Remediation Evidence

Date: 2026-07-25
Status: **Stage 4C closure committed locally at `cd3d781`; Faz 4 handoff complete in worktree**

Production remains `NO-GO`. R-405 remains open.

Authority plan: `docs/PHASE_85_STAGE_4C_REMEDIATION_ACTION_PLAN.md` (from user remediation plan 2026-07-25).

Historical `PASS_LOCAL_STAGE_4C` claims are superseded by this remediation closure authority.

## Stage 4D Continuity Handoff: 2026-07-28

The measured Stage 4C remediation closure was committed locally as `cd3d781 Complete Stage 4C hard-zero remediation closure`. Faz 4 repo-wide continuity reconciliation is recorded in `docs/PHASE_85_STAGE_4C_TO_STAGE_4D_CONTINUITY_HANDOFF_EVIDENCE.md`.

Stage 4D Ayarlar / Hesap is the next Phase 85 unit but has not started. Its first unit must be a separately user-approved planning/read gate. No Stage 4D code, migration, route, UI, test, spec, provider activation, or production authorization is part of this evidence.

## Current Remediation Closure: 2026-07-27

Status: **PASS_LOCAL_STAGE_4C_REMEDIATED** (repo-local only; not production GO).

The approved worker-only access model is implemented by append-only migration `20260725163000_phase_85_stage_4c_operational_tables_rls_reclosure.sql` for:

- `public.ai_chat_jobs`
- `public.ai_chat_deletion_jobs`
- `public.ai_chat_deletion_ledger`
- `public.ai_chat_legal_holds`

Each table now has RLS enabled, one explicit deny-all direct-user policy, no DML privilege for `anon` or `authenticated`, and preserved service-role access. Clean reset applied every migration through `20260725163000`; the absent `app/supabase/seed.sql` was reported and was not created.

| Gate | Measured result |
| --- | --- |
| Migration contract | 1 file, 2/2 passed |
| Clean local migration reset | pass through `20260725163000_phase_85_stage_4c_operational_tables_rls_reclosure.sql` |
| Catalog/advisory posture | all four tables RLS enabled; 1 policy each; no anon/authenticated DML; service-role DML preserved; prior `rls_disabled` advisory absent |
| RLS integration suite | 1 file, 49/49 passed, 0 skipped |
| DB lint | pass at error level |
| Real PostgreSQL scale | pass: 100 dietitians / 5,000 clients / 10,000 chats / 200,000 message versions; eight EXPLAIN profiles |
| AI Chat visual/accessibility | 80 passed / 5 viewport-conditional skipped |
| App suite | 230 files; 1,401 passed / 9 skipped |
| Core suite | 295/295 passed |
| Full rehearsal | 3/3 passed with `STAGE_4C_FULL_REHEARSAL=1` |
| Build and release | pass; only documented R-405 audit findings |
| Canonical `npm run rehearse:stage-4c` | pass; verdict `PASS_LOCAL_STAGE_4C_REMEDIATED`; RLS skipped count 0 |

R-481 is mitigated locally. The Stage 4C closure is committed locally at `cd3d781`. The next single action is user approval to commit Faz 4; Stage 4D planning and push require separate explicit commands. Production remains `NO-GO`; R-405 remains open; external providers/channels and real health-data egress remain closed.

## Historical Remediation Update: 2026-07-27 Faz 3

Status: **historical first measurement; superseded by the current remediation closure above**.

| Gate | Measured result |
| --- | --- |
| Real PostgreSQL scale | pass: 100 dietitians / 5,000 clients / 10,000 chats / 200,000 message versions; eight EXPLAIN profiles |
| Isolated app suite | 229 files; 1,399 passed / 9 skipped |
| Clean local migration reset | pass through `20260725162000_phase_85_stage_4c_remediation_scale_explain_reclosure.sql`; absent `supabase/seed.sql` reported only |
| Existing RLS integration suite | 47/47 passed, 0 skipped |
| DB lint | no error-level findings |
| AI Chat visual/accessibility | 80 passed / 5 viewport-conditional skipped |
| `npm run release:verify` | pass: core 295/295; app 1,399 passed / 9 skipped; build pass; only documented R-405 findings |

Append-only scale reclosure migrations `20260725161000_phase_85_stage_4c_remediation_scale_fixture_reclosure.sql` and `20260725162000_phase_85_stage_4c_remediation_scale_explain_reclosure.sql` provide deterministic bulk fixtures, corrected live-schema EXPLAIN profiles, and bounded indexes. Normal unit/release tests now explicitly isolate local Supabase credentials so the full rehearsal does not accidentally route fixture tests through persistence.

Critical blocker discovered after the passing RLS suite:

- `public.ai_chat_deletion_jobs`: RLS disabled, 0 policies
- `public.ai_chat_deletion_ledger`: RLS disabled, 0 policies
- `public.ai_chat_jobs`: RLS disabled, 0 policies
- `public.ai_chat_legal_holds`: RLS disabled, 0 policies

The database advisory classifies these tables as exposed to Supabase `anon`/`authenticated` roles. Bare RLS enablement was not applied because doing so without the intended policy model can block required worker/lifecycle access. The 47-test suite therefore has a coverage gap and cannot authorize `PASS_LOCAL_STAGE_4C_REMEDIATED`.

This blocker was subsequently closed by the operational-table RLS reclosure documented above. Production remains `NO-GO`; R-405 remains open; external providers/channels and real health-data egress remain closed.

## Historical Remediation Update: 2026-07-27 Faz 2

Status: **historical Faz 2 checkpoint; superseded by the current remediation closure above**.

Measured verification:

| Command | Result |
| --- | --- |
| `npx vitest run src/lib/phase-85-stage-4c-db-lint-reclosure-migration.test.ts src/lib/phase-85-stage-4c-rls-helper-grants-migration.test.ts src/lib/phase-85-stage-4c-lifecycle-migration.test.ts src/lib/phase-85-stage-4c-core-rpc-migration.test.ts src/lib/phase-85-stage-4b4-migration-contract.test.ts --no-file-parallelism --maxWorkers=1` | 5 files passed, 30/30 tests |
| `npx supabase db reset` | pass; all migrations through `20260725160000_phase_85_stage_4c_remediation_db_lint_reclosure.sql` applied; `supabase/seed.sql` absent and reported as warning only |
| `npx supabase db lint` | pass with no error-level findings; warning-level PL/pgSQL hygiene findings remain |
| `npm run test:rls` | pass, 1 file, 47/47 tests, 0 skipped |
| `npm run typecheck` | pass |
| `npm run lint` | pass, 0 errors / 69 existing warnings |
| `git diff --check` | pass; Windows LF/CRLF warnings only |

Implemented local closure remediation:

- `20260714195000_phase_85_stage_4b4_audio_lifecycle_signature_transition.sql` drops the old Stage 4B-3 media redaction function signature before the Stage 4B-4 audio-aware replacement.
- `20260725085000_phase_85_stage_4c_pgcrypto_search_path_compatibility.sql` adds locked, service-role-only `public.digest`/`public.hmac` wrappers for local pgcrypto-in-`extensions` compatibility.
- `20260725155000_phase_85_stage_4c_remediation_rls_helper_grants.sql` grants authenticated execute only for Stage 4C RLS policy evaluation helpers.
- `20260725160000_phase_85_stage_4c_remediation_db_lint_reclosure.sql` closes error-level local Postgres lint findings without enabling production gates or user mutation authority.
- `supabase-rls.integration.test.ts` now distinguishes the no-membership outsider from the other-tenant owner fixture and gives heavy local media/audio deny-read tests explicit integration timeouts.

This historical Faz 2 update did **not** claim `PASS_LOCAL_STAGE_4C_REMEDIATED`. Its former "Faz 3 next" instruction is superseded by the current remediation closure above. Production remains `NO-GO`; R-405 remains open; real provider/channel/health-data egress remains closed.

## Historical Remediation Update: 2026-07-25

Status: **historical pre-measurement checkpoint; superseded by the current remediation closure above**.

This update supersedes any older local-complete wording in this evidence file when it conflicts with the current closure gate.

- Faz 1 hardening fixed actor-context derivation, lifecycle enqueue behavior, actual attachment-byte hashing, and terminal risk classification.
- Faz 2 hardening fixed SSE subscriber catch-up semantics, client reconnect after premature EOF, render-loop risk in the virtualized message list, and SSE polling pressure.
- Faz 3 hardening fixed PostgreSQL scale rehearsal correctness by using a real sample run id for event catch-up, finalizing each send-run during write measurement, and preventing sample rehearsals from returning false zero-latency pass results.
- Production dependency remediation upgraded direct `mammoth` and `yauzl` findings; remaining production audit findings are accepted only as documented R-405 nested Next.js/PostCSS/Sharp findings.
- `runStage4CPostgresScaleRehearsalSample()` must remain `blocked` until a real full Postgres rehearsal is executed.

Full closure requires `STAGE_4C_FULL_REHEARSAL=1`, passing scale thresholds, and zero unknown production audit findings. The local Supabase/Postgres reset and zero-skipped RLS gate passed on 2026-07-27 but do not by themselves authorize `PASS_LOCAL_STAGE_4C_REMEDIATED`.

## Current Remediation Update: 2026-07-27

Status: **Faz 1 pre-Stage-4D closure-infrastructure hardening applied; measured closure still pending**.

- `npm run rehearse:stage-4c` now writes successful measured closure output only to `docs/PHASE_85_STAGE_4C_LOCAL_CLOSURE_REHEARSAL_EVIDENCE.md`.
- Historical remediation evidence in this file is no longer an automated write target and must remain preserved.
- The local closure writer is bounded by generated markers, idempotent, and fail-closed for failed reports, skipped RLS, non-remediated verdicts, production GO flags, or broken generated markers.
- This update does not claim `PASS_LOCAL_STAGE_4C_REMEDIATED`; the later 2026-07-27 Faz 2 update supplies the zero-skipped RLS gate, while full closure still requires the full rehearsal/scale gate.

## Faz 8: Gerçek PostgreSQL Ölçek Rehearsal’ı, Hard-Zero Kapısı ve Nihai Kapanış

Status: **complete locally (code + targeted tests); full zero-skip rehearsal blocked pending local Supabase**

### Delivered

- `phase-85-stage-4c-corpus-chain.ts`: corpus schema validation plus store -> worker -> context -> finalizer chain (full-rehearsal gated)
- `phase-85-stage-4c-postgres-scale.ts` + migration `20260725150000_phase_85_stage_4c_remediation_scale_indexes.sql`
- `phase-85-stage-4c-concurrency-rehearsal.ts`: concurrency and SSE subscriber scenarios
- `phase-85-stage-4c-closure.ts` remediation authority with `PASS_LOCAL_STAGE_4C_REMEDIATED`, Faz 8 p95 thresholds, repo-wide secret scan
- fail-fast `scripts/rehearse-stage-4c-ai-chat.mjs` and timeout-hardened `scripts/release-verify.mjs`
- Red-team corpus trimmed to exactly 100 JSONL cases

### Verification

| Command | Result |
| --- | --- |
| targeted Stage 4C Faz 8 tests | pending local run |
| `npm run test:rls` | **blocked** — Docker/local Supabase unavailable |
| `npm run rehearse:stage-4c` | **blocked** — requires zero-skip local Supabase + Chromium |

### Closure Verdict

- Repo-local implementation authority: **Stage 4C remediation complete**
- `PASS_LOCAL_STAGE_4C_REMEDIATED` only when full rehearsal chain passes with zero skipped RLS

## Faz 7: Ölçeklenebilir SSE, UI Dayanıklılığı ve Eski Copilot İzolasyonu

Status: **complete locally (code + targeted tests); local Supabase fixture tests blocked**

### Delivered

- Migration `20260725140000_phase_85_stage_4c_remediation_event_stream.sql`:
  - idempotent `ai_chat_run_events` Realtime publication
  - bounded `p85_stage_4c_catch_up_run_events_v1` RPC (service-role only)
- `phase-85-stage-4c-run-event-multiplexer.ts`: process-local ref-count fan-out, realtime + adaptive 1s→4s polling fallback, abort cleanup
- `phase-85-stage-4c-run-event-stream.ts` + SSE route rewrite:
  - comment heartbeats (`: heartbeat`) with zero DB writes
  - 25s window + `afterSequence` reconnect
  - terminal event closes stream
- `ai-chat-message-list.tsx`: `ResizeObserver` height cache, measured virtual range, scroll anchor on prepend
- `use-ai-chat.ts`: ignores SSE comment heartbeats
- Legacy copilot render paths removed from `dashboard-app.tsx` and `clients-panel.tsx`; navigation remains `/dashboard/ai-chat` only
- `phase-85-stage-4c-isolation.ts` + tests block internal-copilot imports and legacy endpoint usage in Stage 4C surfaces

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-run-event-multiplexer.test.ts src/lib/phase-85-stage-4c-event-stream-migration.test.ts src/lib/phase-85-stage-4c-isolation.test.ts src/components/ai-chat/ai-chat-message-list.test.ts` | 17/17 pass |
| `npx playwright test tests/visual/ai-chat.visual.spec.ts tests/visual/ai-chat.accessibility.spec.ts` | 80 passed, 5 skipped (desktop-only drawer tests) |
| `npm run test:rls` | **blocked** — Docker/local Supabase unavailable |

### Open Blockers After Faz 7

- Apply event-stream migration to local Supabase and verify Realtime catch-up + multiplexer fan-out under RLS
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 8: Gerçek PostgreSQL Ölçek Rehearsal’ı, Hard-Zero Kapısı ve Nihai Kapanış

## Faz 6: Güvenli Silme, Attachment Sahipliği, Retention ve Tenant-Bağlı DSAR

Status: **complete locally (code + targeted tests); local Supabase fixture tests blocked**

### Delivered

- Migration `20260725130000_phase_85_stage_4c_remediation_lifecycle_export.sql`:
  - delete conversation/message RPCs with legal hold, revision, idempotent ledger
  - deletion job claim/step/complete/fail with storage (100) and DB (500) batches
  - client/account scoped purge enqueue, 24h retention sweep
  - tenant+client DSAR export RPC; copied `client_record_assets` excluded from chat purge keys
  - list/load conversation patches hide `deleting`/`deleted`
  - `ai_chat_deletion_failed` notification kind
- `phase-85-stage-4c-supabase-lifecycle.ts`: Supabase adapter (no lifecycle stubs)
- `phase-85-stage-4c-lifecycle-worker-cli.ts` + `worker:ai-chat:lifecycle:stage4c` scripts
- `AI_CHAT_DELETION_HMAC_SECRET` required in production via `resolveAiChatDeletionHmacSecret`
- `supabase-store.ts` DSAR export + client removal enqueue wired to Supabase RPCs
- Delete APIs already return `202` queued; UI optimistic-deleting states retained

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-lifecycle.test.ts src/lib/phase-85-stage-4c-lifecycle-migration.test.ts src/lib/phase-85-stage-4c-core-rpc-migration.test.ts src/lib/phase-85-stage-4c-store-conformance.test.ts` | 15/15 pass |
| `npm run test:rls` | **blocked** — Docker/local Supabase unavailable |

### Open Blockers After Faz 6

- Apply migration to local Supabase and run selective/full purge + DSAR + legal hold with zero-skip RLS
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 7: Ölçeklenebilir SSE, UI Dayanıklılığı ve Eski Copilot İzolasyonu

## Faz 5: Kalıcı Risk, Bildirim, Handoff ve Güvenli Taslak Akışı

Status: **complete locally (code + targeted tests); local Supabase fixture tests blocked**

### Delivered

- Migration `20260725120000_phase_85_stage_4c_remediation_risk_workflow.sql`:
  - `assessment_fingerprint` idempotency on active risk assessments
  - `ai_chat_red_review_required` notification kind
  - RPCs: apply risk pipeline, risk summary, draft destinations, draft transfer, handoff create, pending/consume composer transfer
- `phase-85-stage-4c-supabase-risk.ts`: Supabase adapter wiring (no 503/no-op stubs)
- `finalizeRunOutcome` persists client-scoped risk for stopped partial and incomplete assistant outputs
- Risk API route uses store-backed `clientContextRevision` (fallback state removed)
- Red: no safe draft, handoff confirmation token + notification projection
- Green/yellow: `composer_pending` / `yellow_review` draft transfer modes with revision recheck

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-risk-bridge.test.ts src/lib/phase-85-stage-4c-risk-workflow-migration.test.ts src/lib/phase-85-stage-4c-run-service.test.ts src/lib/phase-85-stage-4c-store-conformance.test.ts` | 22/22 pass |
| `npm run test:rls` | **blocked** — Docker/local Supabase unavailable |

### Open Blockers After Faz 5

- Apply migration to local Supabase and run green/yellow/red persistence + handoff lineage with zero-skip RLS
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 6: Güvenli Silme, Attachment Sahipliği, Retention ve Tenant-Bağlı DSAR

## Faz 4: Private Storage Tabanlı Multimodal Runtime ve Mesaj Bağlantısı

Status: **complete locally (code + targeted tests); local Supabase fixture tests blocked**

### Delivered

- Migration `20260725110000_phase_85_stage_4c_remediation_multimodal_runtime.sql`:
  - `ai_chat_message_attachments` join table with composite FK guards
  - attachment session/complete/get/list/delete/status/derivative/correction/transfer/job RPCs
  - `p85_stage_4c_send_message_v1` extended with `p_attachment_ids uuid[]`
  - object key layout `tenant/user/conversation/attachment`
- `phase-85-stage-4c-supabase-attachments.ts`: signed private upload, metadata-only completion, storage size verify, worker job enqueue
- Upload completion no longer accepts base64 bytes; browser PUTs to signed storage URL (in-memory PUT route for deterministic tests)
- Composer ready-gating, review-required hint, DELETE on remove, attachment-only send
- Run context merges accepted message-bound derivatives via `mergeMessageAttachmentDerivativesIntoEvidencePackage`
- Client-record transfer performs physical object copy to separate bucket lineage

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-attachments.test.ts src/lib/phase-85-stage-4c-multimodal-migration.test.ts src/lib/phase-85-stage-4c-context-gateway.test.ts src/lib/phase-85-stage-4c-run-service.test.ts` | 34/34 pass |
| `npm run test:rls` | **blocked** — Docker/local Supabase unavailable |

### Open Blockers After Faz 4

- Apply migrations to local Supabase and run direct-upload + attachment-only send integration with zero-skip RLS
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 5: Kalıcı Risk, Bildirim, Handoff ve Güvenli Taslak Akışı

## Faz 3: Eksiksiz Context Gateway, Genel Kaynak Araması ve Birleşik Klinik Finalizasyon

Status: **complete locally (code + targeted tests); local Supabase fixture tests blocked**

### Delivered

- Migration `20260725100000_phase_85_stage_4c_remediation_context_safety.sql`:
  - `p85_stage_4c_wrap_context_tool_result` helper with `ok`/`empty`/`failed` envelopes
  - explicit SQL branches for all 13 context tools; catch-all empty rows removed
- `ContextToolExecutionResult.status` contract (`ok` | `empty` | `failed`) in gateway, fixtures, Supabase adapter
- General clinical planner: `isGeneralClinicalQuery` + `search_approved_sources` only in general scope
- General scope PHI leak guard (`general_scope_phi_leak` -> superseded)
- Unified `finalizeRunOutcome` for completed/stopped/failed/gateway-blocked terminal paths
- Partial stop/error risk classifier integration; no default green downgrade on red/yellow
- Empty partial stop: no assistant message; trigger-body risk still evaluated
- Revision recheck before commit in `finalizeRunOutcome`
- Tests: context gateway, context safety migration, run-service finalizer, core context policy

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-context-gateway.test.ts src/lib/phase-85-stage-4c-context-safety-migration.test.ts src/lib/phase-85-stage-4c-run-service.test.ts src/lib/phase-85-stage-4c-core-rpc-migration.test.ts` | 26/26 pass |
| `npm run test:rls` | **blocked** — Docker/local Supabase unavailable |
| `npx supabase db reset --local` | **not run** |

### Open Blockers After Faz 3

- Apply migrations to local Supabase and run per-tool fixture tests with zero-skip RLS
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 4: Private Storage Tabanlı Multimodal Runtime ve Mesaj Bağlantısı

## Faz 2: Modüler Store, Atomik Chat RPC'leri ve Çalıştırılmış RLS Temeli

Status: **complete locally (code + targeted tests); RLS verification blocked**

### Starting State

- Branch: `codex/stage-4c-remediation`
- Base commit: `39107f5`
- Prior uncommitted R1 draft absorbed into remediation migration `20260725090000_phase_85_stage_4c_remediation_core_run_rpcs.sql`

### Delivered

- Split `phase-85-stage-4c-store.ts` into interface/factory plus:
  - `phase-85-stage-4c-in-memory-store.ts`
  - `phase-85-stage-4c-supabase-store.ts`
- Contract version bumped to `p85-stage-4c-contracts-v2` (scope/status/route values unchanged)
- Append-only migration `20260725090000_phase_85_stage_4c_remediation_core_run_rpcs.sql`:
  - active-run partial unique index on `(tenant_id, conversation_id)`
  - active-run user/status index on `(tenant_id, created_by_user_id, status)`
  - core RPCs: send/edit/regenerate/branch-chain/commit/finalize/title
  - terminal-state compare-and-set on `finalize_run_v1`
  - branch-chain depth column + auto-title first-user ordering fix
- `mapRpcError`: `ai_chat_user_run_limit` -> HTTP 429
- `assertSupabaseAiChatCoreContractReady()` startup guard for core send RPC wiring
- Tests: `phase-85-stage-4c-core-rpc-migration.test.ts`, `phase-85-stage-4c-store-conformance.test.ts`
- RLS preflight fail-closed retained in `supabase-rls.integration.test.ts`

### Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npx vitest run src/lib/phase-85-stage-4c-core-rpc-migration.test.ts src/lib/phase-85-stage-4c-store-conformance.test.ts src/lib/phase-85-stage-4c-run-service.test.ts src/lib/phase-85-stage-4c-service.test.ts` | 22/22 pass |
| `npm run test:rls` | **blocked** — Docker Desktop Linux engine unavailable; remote target requires `MANU_ALLOW_REMOTE_RLS_TESTS=true` |
| `npx supabase db reset --local` | **not run** — local Supabase unavailable |
| `npx supabase db lint --local` | **not run** — local Postgres unavailable |

### Open Blockers After Faz 2

- Apply migration to local Supabase and rerun `npm run test:rls` with **zero skipped** before Faz 3
- Supabase adapter conformance suite on real Postgres (currently in-memory only in this environment)
- Production remains `NO-GO`; R-405 remains open

### Next

Faz 3: Eksiksiz Context Gateway, Genel Kaynak Araması ve Birleşik Klinik Finalizasyon
