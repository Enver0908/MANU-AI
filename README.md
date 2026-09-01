# MANU-AI

MANU-AI is a supervised AI SaaS platform for dietitians. It combines a multi-tenant clinical workspace, source-bound AI assistance, mobile-first PWA workflows, and guarded messaging operations for professional nutrition care teams.

The product is designed around a strict principle: AI may assist the dietitian, but it does not replace clinical judgment, approve high-risk guidance autonomously, or bypass tenant, consent, billing, or production-readiness controls.

## Current Status

As of 2026-08-30:

- Production Readiness Stage 1 Phase 1-6 are locally complete for their recorded scopes.
- Domain cutover implementation is prepared for `aiyaworkspace.com`: public/customer app `https://aiyaworkspace.com`, admin app `https://admin.aiyaworkspace.com`, and business contact inbox `contact@aiyaworkspace.com`. The old `siriusai.store` domain is not planned for long-term redirect retention because there is no real customer traffic on it.
- Stage 1 owner handoff is ready locally; owner-side account, approval, secret, production-environment, and release-approval actions remain open.
- Stage 5, Stage 6, and Stage 7 are closed locally for their recorded scopes.
- Hosted Sandbox technical debt is closed by evidence under `docs/hosted-sandbox/evidence/`.
- Production remains `NO-GO`.
- Physical iPhone Safari/PWA validation is permanently owner-waived for the current roadmap and future phases. It remains `WAIVED_NOT_EXECUTED`, not `PASS`; future readiness or pilot language must disclose the waiver and accepted residual iOS risk.
- Android Chrome, installed Android PWA, and Android TalkBack evidence are recorded for Stage 7 closure.
- R-405 is technically resolved locally; external dependency and operational launch gates remain independent production constraints.
- Active LLM provider decision: all previous Gemini LLM usage is rebaselined to direct Z.ai `GLM-5.3-Flash` (`glm-5.3-flash`). The product architecture, green/yellow/red safety model, RAG/context injection, WhatsApp-first scope, and fail-closed production gates remain unchanged.

Canonical current authorities:

- `docs/OWNER_IOS_VALIDATION_WAIVER_DECISION.md`
- `docs/AIYAWORKSPACE_DOMAIN_CUTOVER_RUNBOOK.md`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_6_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_STAGE_1_OWNER_HANDOFF.md`
- `docs/PRODUCTION_READINESS_STAGE_1_FINAL_DECISION.json`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_5_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_5_OPERATIONS_RUNBOOK.md`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_4_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_3_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_2_EVIDENCE.md`
- `docs/PRODUCTION_READINESS_STAGE_1_PHASE_1_EVIDENCE.md`
- `docs/hosted-sandbox/evidence/HOSTED_SANDBOX_TECHNICAL_DEBT_CLOSURE_EVIDENCE.md`
- `docs/PHASE_85_STAGE_7_CLOSURE_DECISION.json`
- `docs/PHASE_85_STAGE_7_FINAL_CLOSURE_EVIDENCE.md`
- `docs/PHASE_85_STAGE_6_CLOSURE_DECISION.json`
- `docs/RISK_REGISTER.md`
- `HANDOFF_FOR_NEXT_CODEX.md`

## Product Scope

MANU-AI supports dietitian-led operations across:

- Tenant-scoped onboarding, authentication, authorization, and role boundaries.
- Client workspaces for nutrition tasks, forms, menu planning, messaging, alerts, and dashboard operations.
- AI-assisted clinical drafting with explicit answerability, source grounding, risk classification, and dietitian review.
- Mobile PWA workflows with offline privacy-lock behavior and device evidence records.
- Evidence-driven production gates for security, RLS, dependency health, release identity, backups, rollback, and operational readiness.

## Architecture

The repository is organized as a product application plus a reusable clinical AI architecture package.

```text
.
|-- app/                       Next.js application, Supabase integration, PWA, UI, tests
|-- dietitian-ai-assistant/    Clinical AI orchestration and risk-boundary package
|-- docs/                      Product plans, evidence packs, risk register, runbooks
|-- tools/                     Hosted sandbox, backup, release, and operational utilities
|-- PLAN.md                    Current execution plan
|-- PROJECT_PLAN.md            Broader project continuity plan
|-- HANDOFF_FOR_NEXT_CODEX.md  Current authority and handoff summary
```

Core application stack:

- Next.js 16, React 19, TypeScript, Tailwind CSS.
- Supabase for authentication, Postgres, RLS, migrations, and tenant isolation.
- Vitest, Playwright, axe, TypeScript production checking, ESLint, and release verification scripts.
- Stripe integration boundaries for billing readiness.
- Clinical AI orchestration package exported from `dietitian-ai-assistant/`.

## Safety Model

The clinical safety model is intentionally conservative:

- Every AI response path is bounded by risk classification and answerability rules.
- High-risk or uncertain outputs are held for dietitian review instead of being released as autonomous advice.
- Source-bound reasoning and context injection are treated as safety controls, not cosmetic prompt features.
- Persona behavior is governed as a full interaction contract: tone, uncertainty, empathy, boundaries, escalation, and language behavior must stay consistent with clinical safety.
- Production use with real health data is not authorized until independent production gates are closed.

## Multi-Tenant Boundary

Tenant isolation is a first-class architecture constraint. Application behavior, Supabase policies, helper functions, client workspaces, messaging records, and evidence gates are designed so one tenant cannot read, mutate, infer, or reuse another tenant's data.

Relevant evidence and runbooks live in:

- `docs/RISK_REGISTER.md`
- `docs/DATA_INVENTORY.md`
- `docs/BACKUP_RESTORE_RUNBOOK.md`
- `docs/hosted-sandbox/evidence/`
- `app/supabase/migrations/`

## Local Development

Install and run the app from the `app/` workspace:

```bash
cd app
npm install
npm run dev
```

Common verification commands:

```bash
cd app
npm run lint
npm run typecheck
npm test
npm run test:rls
npm run verify:stage-7
npm run release:verify
```

Run the clinical AI package tests:

```bash
cd dietitian-ai-assistant
npm test
```

The root of the repository does not define the primary npm workspace. Use `app/` for the product application and `dietitian-ai-assistant/` for the AI architecture package.

## Production Readiness

Production is currently blocked by independent launch gates. Local closure evidence must not be interpreted as authorization for:

- Production launch or production pilot.
- Provider/channel egress.
- WhatsApp, Telegram, or other live channel delivery.
- Live billing.
- Production schema rollout.
- Real health-data processing.
- Removing accepted-risk qualifications from iOS coverage.

Production readiness requires explicit owner approval and current evidence for the relevant operational gates. The active Stage 1 owner blockers are Meta/WhatsApp Business approval, Z.ai GLM-5.3-Flash provider approval, production secrets, production Supabase and remote migration approval, manual bank-transfer operations approval, incident/monitoring/rollback ownership, and exact release approval.

The domain cutover does not by itself approve production launch. It only moves the hosted commercial entry surfaces and related operational URLs from the old sandbox domain to `aiyaworkspace.com`.

## Evidence Discipline

MANU-AI uses evidence-first delivery. Closure claims are only valid when backed by dated artifacts, verification commands, and explicit scope guards. Historical plans remain in the repository for traceability, but current authority is controlled by the latest handoff, risk register, closure decisions, and owner waiver records.

When updating the project:

- Preserve production `NO-GO` unless the owner explicitly authorizes a production gate change.
- Preserve iPhone as `WAIVED_NOT_EXECUTED`, not `PASS`.
- Do not introduce provider egress, live billing, production schema changes, or real-data paths without a dedicated approved scope.
- Keep documentation and evidence language aligned with the current authority files.

## Maintainer Notes

This repository is operated as a gated product workspace. Each implementation phase should leave behind:

- A focused code change.
- Matching evidence or decision records.
- Targeted verification output.
- A clean git status before handoff whenever practical.

For the latest handoff context, start with `HANDOFF_FOR_NEXT_CODEX.md`.
