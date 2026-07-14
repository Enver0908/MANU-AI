# Phase 85 Stage 4B-3 — Multimodal Görsel Güvenlik Runtime Specification

Date: 2026-07-14  

> **Historical local implementation; closure reopened and reclosed on 2026-07-14.** Current Stage 4C authorization comes from R9 evidence: `docs/PHASE_85_STAGE_4B_3_POST_CLOSURE_REMEDIATION_R9_EVIDENCE.md`.
Status: **implemented; Phases 0–12 complete locally**  
Canonical plan: `docs/PHASE_85_STAGE_4B_3_MULTIMODAL_GORSEL_GUVENLIGI_VE_YANIT_ORK_PLAN.md`  
Closure evidence: `docs/PHASE_85_STAGE_4B_3_PHASE_12_GOLDEN_CORPUS_RED_TEAM_CLOSURE_EVIDENCE.md`
Authorization: **R9 COMPLETE; Stage 4C read gate authorized**

## 1. Boundary

Stage 4B-3 owns inbound JPEG/PNG visual safety for mock WhatsApp and the dietitian dashboard:

- secure mock ingress on canonical P85-IF batch normalizer/ledger;
- private sanitized object storage with 30-day retention;
- 120-second inbound message bundles;
- deterministic local vision observations;
- multimodal meaning, risk overlay, narrow autopilot, and atomic bundle decisions;
- bounded media/review APIs and conversation UI;
- lifecycle redaction, DSAR/remove, revoke, and operational health aggregates.

Stage 4B-3 does not open real Meta media download, Gemini/Vertex multimodal egress, production schedulers, or production pilot approval. Stage 4C is authorized only after this specification and Phase 12 closure evidence are complete.

## 2. Ingress and worker contract

- `/api/whatsapp/webhook` remains the canonical mock path and requires `MANU_MOCK_WHATSAPP_WEBHOOK_SECRET`.
- Production, hosted sandbox, and missing-secret requests fail closed.
- Visual simulator (`POST /api/simulator/visual`) and mock webhook share the same ingress, bundle, worker, and orchestrator path.
- Local workers:
  - `npm run worker:media:stage4b3` — due asset analysis and bundle processing;
  - `npm run worker:media:lifecycle` — expiry and lifecycle finalize ticks.
- Tests and simulator may inject clock to complete 120-second silence instantly; production timing behavior is not opened.

## 3. Storage and DTO contract

- Bucket: `p85-stage-4b3-media` (private; no anon/authenticated direct object access).
- Original inbound bytes are never persisted.
- Sanitized full + thumbnail objects expire after 30 days.
- Public DTOs (`ConversationMediaDto`, `VisualReviewDto`) exclude object keys, provider media IDs, hashes, raw OCR, and signed URLs.
- Full/thumbnail bytes stream only from `GET /api/conversations/[id]/media/[assetId]?variant=thumbnail|full` after conversation permission checks with `Cache-Control: private, no-store`.

## 4. Bundle and decision contract

- One open bundle per conversation; each client text/image resets `readyAt = observedAt + 120s`.
- No client-facing AI response before bundle silence completes.
- Overflow limits: 20 messages, 4 images, 16,000 Unicode code points → review required, no auto evaluation continuation.
- One AI decision per bundle revision; stale commits return `409` and requeue safely.
- Visual correction invalidates pending drafts; already-sent responses pause AI and require manual follow-up.

## 5. Safety and autopilot contract

Visual observation is evidence only. Automatic client send is allowlisted only for:

- exact active-menu meal acknowledgement;
- high-integrity label conflict with structured forbidden-ingredient evidence;
- approved-source-backed screenshot confirmation when all existing gates pass.

Supplement, body/symptom, lab/medical, unknown/low-confidence, prompt injection, sensitive identity, mixed/ambiguous meal, and incomplete label scenes block autopilot and client send unless existing yellow/red/manual rules already blocked the path.

Hard-zero closure metrics (must remain 0):

- yellow/red client send;
- unknown/low-confidence client send;
- supplement/body/lab autonomous client send;
- response before bundle silence;
- duplicate response;
- stale commit side effects;
- external vision/text egress for blocked visual classes;
- raw-byte/log/prompt/audit leak;
- cross-tenant media read;
- public object exposure;
- expired/revoked/DSAR orphan access;
- client-facing AI/OCR/confidence wording;
- absence-of-label-evidence allowed result.

## 6. Verification and rehearsal contract

- Golden corpus: `app/src/lib/phase-85-stage-4b3-golden-corpus.jsonl` (synthetic fixtures only).
- Closure evaluator: `app/src/lib/phase-85-stage-4b3-closure.ts`.
- Targeted rehearsal: `npm run rehearse:stage-4b3:media`.
- Full cached-decision and admission round-trip rehearsal: `STAGE_4B3_FULL_SCALE=1 npm run rehearse:stage-4b3:media`.
- Visual acceptance: four Playwright viewports via `npm run test:visual` including `tests/visual/stage-4b3-media.visual.spec.ts`.
- Skipped RLS/storage/integration results cannot count as pass for Stage 4B-3 closure.

## 7. Production posture

Production pilot: **NO-GO**  
R-405: **open**  
R-442–R-450: **mitigated in local Stage 4B-3 closure evidence; production paths remain closed**  
Stage 4C: **authorized for plan/read gate after Phase 12 closure; implementation remains user-gated**
