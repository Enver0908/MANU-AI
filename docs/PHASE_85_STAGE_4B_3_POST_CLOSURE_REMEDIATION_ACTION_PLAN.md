# Phase 85 Stage 4B-3 Post-Closure Remediation Action Plan

Date opened: 2026-07-14
Status: **R4 complete; R5 next; Stage 4B-3 closure reopened; Stage 4C blocked**

This document is the active authority after the post-closure audit of the local Stage 4B-3 implementation. The original Stage 4B-3 plan, specification, and Phase 12 closure evidence remain historical records. They are not Stage 4C authorization.

## Decision

The Phase 12 closure is reopened because the audit found gaps between in-memory simulator behavior, Supabase persistence, worker execution, media source authority, role boundaries, lifecycle enforcement, and closure measurement. Stage 4C implementation, migrations, provider work, and read-gate work are prohibited until remediation R0-R9 produces a fresh complete PASS.

Production remains `NO-GO`. Real WhatsApp, Telegram, Gemini, external LLM, production webhook, monitoring, secret-manager, billing, and real client health-data paths remain disabled.

## Remediation Phase Order

1. **R0 - Kapanisi Geri Acma ve Remediation Kilidi:** reopen closure, reconcile canonical documents, reopen visual risks, and block Stage 4C.
2. **R1 - V2 Domain, Source Authority, and Runtime Validation Contracts:** preserve V1 history while defining fail-closed V2 records, source provenance, correction limits, and runtime validators.
3. **R2 - Durable Queue, Transaction Boundary, and RLS Foundation:** persist every media/bundle/analysis transition, remove direct sensitive reads, and establish service-only queue claims.
4. **R3 - Canonical Ingress, Sanitization, and Real Worker Runtime:** route all mock media through one durable path, sanitize bytes, and run actual workers instead of test subprocesses.
5. **R4 - Bundle Correlation, Dietitian Reset, and Worker Result Semantics:** append human messages, enforce CAS/revision behavior, and prevent failed decisions from becoming completed.
6. **R5 - Multimodal Source Authority and Safety Chain:** separate OCR provenance, require candidate/context agreement, and enforce fail-closed visual green eligibility.
7. **R6 - Atomic Decision, Correction, and Notification Orchestration:** transactionally commit decisions and corrections with drafts, handoffs, revisions, notifications, and audit records.
8. **R7 - Bounded Media APIs, Authentication, and UI Verification:** close direct-read/fallback-auth leaks and verify review, preview, correction, expiry, and unauthorized states.
9. **R8 - Retention, DSAR, Orphan Deletion, and Operational Lifecycle:** enforce retrieval ineligibility, deletion sagas, legal-hold behavior, and real storage orphan scans.
10. **R9 - Measured Closure and Stage 4C Handoff:** run zero-skip verification, reconcile risks, and issue a new Stage 4C authorization only on a complete PASS.

## Locked Remediation Decisions

- Existing V1 records remain readable for historical evidence; all new writes use V2 contracts.
- New bundle statuses are `open`, `ready`, `processing`, `decided`, `review_required`, `superseded`, `failed`, and `cancelled`. A legacy `completed` row without a decision maps to `failed` with `legacy_completed_without_decision`.
- A dietitian message is appended to the active bundle and resets the 120-second timer. A bundle containing a human dietitian reply resolves as `human_handled` and cannot produce an AI send or draft.
- Retry limit is three attempts. Queue claims require a lease owner, lease token, and lease expiry.
- OCR is represented only as `visual_label_ocr` or another explicit visual source type. It is never relabeled as `user_label_text`.
- Raw OCR is excluded from generic provider context. Only a source-gated transformed summary may enter downstream clinical evaluation.
- Visual green meal handling requires one high-confidence candidate, candidate-caption agreement, exact active-menu agreement, and no mixed, hidden-ingredient, portion, or contradiction signal.
- Sensitive visual classes, ambiguous multi-image bundles, screenshots without an approved source id, and unresolved contradictions route to review with no client-facing AI send.
- Sensitive media tables and object storage are service-role/server mediated. Browser DTOs never expose raw observation, OCR, provider data, object keys, or signed URLs.
- Auth failure never creates an owner context. Media routes require an authenticated tenant context and explicit conversation permission.
- Notifications use the existing notification architecture with dedupe keys; no parallel alerts table is introduced.
- A correction before send supersedes and reruns analysis; a correction against a sent response pauses AI and creates manual follow-up without an automatic corrective message.
- A zero-valued closure metric is invalid unless it has a measured flag, scenario count, source command/test, and timestamp.
- Missing Docker/Supabase, skipped RLS/storage cases, blocked browser launch, or timed-out release verification is `BLOCKED`, never `PASS`.

## R0 Completion Gate

R0 is complete only when active handoff documents name this remediation track as current, the original closure artifacts are explicitly historical, R-442 through R-450 are reopened, R-4B3-01 through R-4B3-13 are open, Stage 4C authorization is false, production `NO-GO` and R-405 open remain explicit, and `git diff --check` passes.

R4 is complete. Evidence: `docs/PHASE_85_STAGE_4B_3_POST_CLOSURE_REMEDIATION_R4_EVIDENCE.md`. R5 is the next authorized phase. Media lifecycle worker subprocess replacement remains for R8.
