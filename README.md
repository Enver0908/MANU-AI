# MANU-AI

MANU-AI is a supervised AI messaging assistant for dietitians. It is designed to help dietitians manage client conversations, draft safe replies, and route clinically sensitive nutrition or health messages to human review.

## Current Status

This repository is a local SaaS/PWA pilot prototype and architecture workspace. It is not a production-connected system yet.

**Latest phase:** Phase 76E food rule engine (2026-06-08). **Production pilot:** `NO-GO` (all eight launch gates open; R-405 open).

**Latest verification:** Phase 76E re-verified on 2026-06-08: core tests 132/132, app tests 238/238, `npm run release:verify` passed with only documented R-405 findings.

The current implementation includes:

- A Next.js app prototype in `app/`
- A testable core AI orchestration package in `dietitian-ai-assistant/`
- Supabase schema, RLS, and local persistence work
- Clinical safety routing for green, yellow, and red messages
- Yellow-risk draft approval and hold behavior
- Red-risk manual handoff and reactivation lock behavior
- Dietitian-controlled client conversation language
- Documentation and evidence plans in `docs/`
- Phase 59–61 safety layers plus Phase 62 remediation (provider-failure dietitian handoff, shared safety text normalization, overlap scope retrieval, glucose cost-unit filter)
- Phase 63 production-pilot rebaseline for WhatsApp-first, Gemini-only scale planning up to 100 dietitians and 5,000+ clients, with user-supplied forms and official regulation-PDF corpus ingestion as future gated phases

- Phase 64 structured launch-gate evidence evaluation requiring sanitized artifact references, owner, approval date, review cadence, explicit approval status, and complete required-evidence coverage before a gate can be treated as closed
- Phase 65 official regulation PDF corpus QA foundation requiring source metadata, checksum, page extraction evidence, page/section references, derived-rule drafts, and corpus golden cases before any PDF-derived scope rules can become draft corpus rules
- Phase 66 product communication covenant lock: forbidden client-facing AI self-disclosure, AI limitation disclaimers, doctor/dietitian/professional referral language, green provider covenant violations, and yellow/red client-facing AI sends are blocked locally
- Phase 67 approved source answerability engine: green provider calls/sends require approved source support from active diet plan, prompt-allowed forms, dietitian context updates, dietitian manual messages, pinned notes, allergies, or restricted foods; AI-generated messages are not source authority
- Phase 68 green maximization intent taxonomy: green source-backed intents are audited by family, while green-looking sensitive intents block before provider generation without downgrading yellow/red decisions
- Phase 69 direct 5,000 client scale foundation: synthetic 100 dietitian x 50 client fixture, cursor pagination helper, Phase 69 read contracts, and aggregate operational-health scale evidence
- Phase 70 user-supplied form hardening: registry-backed dietitian/client schemas, prompt visibility and answerability metadata, autopilot qualification gates, and sanitized prompt summaries
- Phase 71 Turkiye official health source ingestion: canonical 14-source Turkiye official source manifest, fail-closed PDF artifact intake, and draft-only derived rule path
- Phase 72 regulation permission graph: draft forbidden/draft-only/answerability maps, privacy and clinical escalation routing, mixed-intent fail-closed evaluation, and blocked active production routing until external approval
- Phase 73 health regulation calibration: 14-source decision matrix, golden-case labeling suite, copilot/autopilot calibration evaluation, and acceptance metrics with zero unsafe-green violations on bundled cases
- Phase 75 Gemini provider gate: forbidden/unpaid consumer surfaces, paid Vertex/Gemini Enterprise target surface, green/yellow model routing, training/logging/retention policy, health-data eligibility checklist, PromptContext allowlist enforcement, and `MANU_ALLOW_REAL_GEMINI` egress gate
- Phase 74 data lifecycle policy: retention/export/DSAR SLA artifacts, transactional redaction contract with invariant checks, ZIP-style export manifest with checksums, and operational exclusion for removed clients
- Phase 76A dietitian chat form update proposals: internal copilot proposal-only mutation path, deterministic allowlisted extraction, explicit dietitian apply/reject, stale revision checks, audit/context revision evidence, draft invalidation, Supabase table/API support, and DSAR redaction coverage
- Phase 76B expanded chat form safety updates: the same proposal card can now update Phase 70 clinical/safety form flags and supported client health-profile mirrors, while AI active/passive, mode, channel permission, and red/yellow lock controls remain manual
- Phase 76C structured food rule green capacity spec: canonical PRD/tech spec for source-backed forbidden-food reminders, allowed-food confirmations, approved equivalent substitutions, diet-type compatibility, optional skip tolerance, and trusted product-ingredient verification before WhatsApp production adapter work
- Phase 76D structured food rule data model: registry-backed structured food-rule fields, parsing/validation helpers, autopilot food-rule completeness gates, client allergy/restriction sync on form save, and demo seed coverage
- Phase 76E food rule engine: deterministic forbidden/allowed/substitution/skip/product food decisions from structured rules with audit-only orchestrator manifest attachment
- Post-Phase 65 direct 100-dietitian completion plan in `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`, locking the no-small-ring 5,000-client production pilot target, product communication covenant, approved-source answerability path, and user-document timing

## Safety Model

MANU-AI is built around supervised clinical safety boundaries:

- Green messages may be handled automatically only when AI is active and the client is in autopilot mode.
- Yellow messages create dietitian approval drafts and pause AI for that client until reviewed.
- Red messages do not call an LLM and require human handoff.
- Three escalate-only evaluation axes merge before orchestration: regex classifier (`dietetic-risk-v0.3.1`), clinical safety second layer (`clinical-safety-second-layer-v0.1.0`), and scope guard over an approved dietetic-regulation corpus (`scope-rag-v0.1.0`; mock-first, no-op until corpus is approved).
- Phase 66 enforces the product communication covenant locally: no AI self-disclosure, no AI limitation disclaimer, no doctor/dietitian/professional referral language in client-facing AI output, and no client-facing AI send for yellow/red situations.
- Phase 67 enforces approved source answerability locally before green provider calls or sends.
- Phase 68 records green intent taxonomy evidence after answerability and blocks sensitive green-looking requests before provider calls.
- Personas affect communication style only, not clinical safety rules.
- Production launch gates remain open until external approval artifacts are supplied and accepted by the structured evidence engine.

## Repository Structure

```text
app/                       Next.js SaaS/PWA prototype
dietitian-ai-assistant/    Core orchestration and safety package
docs/                      Specs, risk register, launch-gate evidence
PLAN.md                    Canonical project plan
PROJECT_PLAN.md            Long-form roadmap
HANDOFF_FOR_NEXT_CODEX.md  Continuation notes for future Codex sessions
```

## Local Verification

Common checks:

```powershell
cd app
npm test
npm run lint
npm run release:verify
```

Core package tests:

```powershell
cd dietitian-ai-assistant
npm test
```

Local Supabase/RLS evidence requires Docker Desktop and local Supabase.

## Important Boundaries

By default, work in this repository uses local/mock flows. Real WhatsApp, Telegram, Gemini/external LLM, monitoring, secret manager, and real health-data integrations should only be started as explicit integration phases with scope, rollback, test, and approval plans.

R-405 dependency remediation must follow the documented Phase 22 procedure.

Official health-regulation PDFs, legal/privacy artifacts, clinical approvals, and final dietitian/client form definitions must be supplied by the user and recorded only through sanitized references when they are sensitive.
