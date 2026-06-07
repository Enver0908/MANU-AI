# Handoff For Next Codex

## Read This First

You are continuing the MANU-AI project.

Workspace:

```text
C:\Users\Dell\OneDrive\Masaüstü\MANU-AI
```

Use this folder for all new files.

Start by reading:

1. `PLAN.md`
2. `PROJECT_PLAN.md`
3. `docs/NEXT_PHASE_EXECUTION_PLAN.md`
4. `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` (current strategic roadmap)
5. `docs/PHASE_75_GEMINI_PROVIDER_GATE_SPEC.md` (latest completed implementation phase)
6. `docs/PHASE_74_DATA_LIFECYCLE_DSAR_SPEC.md`
7. `docs/PHASE_73_HEALTH_REGULATION_CALIBRATION_SPEC.md`
8. `docs/PHASE_72_REGULATION_PERMISSION_GRAPH_SPEC.md`
9. `docs/PHASE_71_TURKIYE_OFFICIAL_HEALTH_SOURCE_INGESTION_SPEC.md`
10. `docs/PHASE_70_USER_SUPPLIED_FORM_HARDENING_SPEC.md`
11. `docs/PHASE_69_DIRECT_5000_CLIENT_SCALE_FOUNDATION_SPEC.md`
12. `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`
13. `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`
14. `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`
15. `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`
16. `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`
17. `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`
18. `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`
19. `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`
20. `docs/RISK_REGISTER.md`
21. `docs/DATA_INVENTORY.md`
22. `docs/DATASET_STRATEGY.md`
23. `docs/MOBILE_APP_STRATEGY.md`
24. `dietitian-ai-assistant/README.md`
25. `dietitian-ai-assistant/docs/architecture.md`
26. `dietitian-ai-assistant/docs/data-model.sql`

## User's Product Goal

Build MANU-AI: an AI assistant for dietitians that replies to their clients over WhatsApp/Telegram, while the dietitian controls activation, mode, persona, handoff, and manual takeover from a MANU-AI dashboard and mobile app.

The product must be both:

- Web dashboard
- Phone-installable app experience, starting with PWA, later native React Native/Expo

## Important User Decisions

- The product is for dietitians and their clients.
- Clients communicate mostly through WhatsApp or Telegram.
- Dietitian controls everything from MANU-AI, not WhatsApp.
- AI can be active or passive per client.
- Dietitian can activate/passivate AI for any client at any time.
- Optional activation time windows are supported.
- There is no fixed two-week copilot period.
- There is no confidence score or trust score gate.
- The user will prepare client-facing legal/permission documents separately.
- Do not add product copy saying "AI-supported tracking" to the client.
- Keep neutral legal/permission integration points only.
- Model routing:
  - green -> `gemini-1.5-flash`
  - yellow -> `gemini-3`
  - red -> no LLM call
- Personas affect communication style only, never clinical safety.
- The system must know which WhatsApp/Telegram messages were written by AI and which were written manually by the dietitian.

## Current Next Phase

Post-Phase 69 baseline: the direct 100-dietitian strategic completion plan in `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` remains canonical. It locks the production pilot target to direct 100 dietitians x 50 clients (minimum 5,000 clients), with no small production ring. It also locks the product communication covenant: client-facing output must never disclose AI identity or tell the client to ask a doctor/dietitian/professional, yellow/red paths send no client-facing AI boundary reply, and green maximization must come from approved source-backed answerability plus deterministic green intent taxonomy rather than answering risky messages.

Next implementation phase is remaining production hardening gates (WhatsApp, ops, R-405 closure, full 100x50 rehearsal, external launch-gate closure). Real Gemini egress must not be enabled without Phase 75 approved provider artifacts plus `MANU_ALLOW_REAL_GEMINI=true` and closed legal/privacy plus provider/vendor gates. Production data lifecycle must not be enabled without Phase 74 transactional redaction plus external legal/privacy approval.

Phase 75 Gemini provider gate is the latest completed implementation wave (2026-06-07): app `phase-75-gemini-provider-gate.ts` now holds forbidden/unpaid consumer surfaces, paid Vertex/Gemini Enterprise target surface, green/yellow model routing, training/logging/retention policy artifacts, health-data eligibility checklist, PromptContext allowlist enforcement, required gate evidence, `evaluatePhase75GeminiProviderRouting`, and `isPhase75RealGeminiEgressAllowed` behind `MANU_ALLOW_REAL_GEMINI`. Provider artifacts remain draft; real Gemini egress stays blocked without approved legal/privacy and provider/vendor gate evidence. Verification passed with core tests 122/122, app tests 216/216, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 74 data lifecycle, export, anonymization and DSAR policy completed (2026-06-07): app `phase-74-data-lifecycle-policy.ts` now holds retention policy, export manifest/checksum contract, DSAR SLA records, transactional redaction field contract, `applyPhase74TransactionalRedactionInState`, and redaction invariant evaluation. Redaction marker standardized to `REDACTED_BY_PHASE74_POLICY`; removed clients are excluded from simulator/provider paths. Policy artifacts remain draft; `MANU_ALLOW_PHASE_74_PRODUCTION_LIFECYCLE` stays off by default. Verification passed with core tests 122/122, app tests 209/209, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 73 health regulation calibration completed on 2026-06-07: app `phase-73-health-regulation-calibration.ts` now holds the user-supplied 14-source health regulation decision matrix, decision priority order, 15 golden calibration cases, copilot vs autopilot evaluation, and acceptance metrics. Calibration artifacts remain draft; active production calibration stays blocked without approved clinical taxonomy evidence. Verification passed with core tests 122/122, app tests 204/204, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 72 regulation permission graph completed on 2026-06-07: app `phase-72-permission-graph.ts` now holds the user-supplied legal/privacy, clinical interpretation, and permission graph pack as draft artifacts (`forbiddenActionMap`, `draftOnlyActionMap`, plan/general answerability maps, never-prompt and prompt-allowed field maps, covenant phrase map, legal privacy routing map, clinical escalation routing map, and mixed-intent fail-closed policy). `evaluatePhase72PermissionRouting` enforces fail-closed mixed intent and privacy-gate precedence; `isPhase72ActiveProductionRoutingAllowed` remains false without approved launch-gate evidence plus `MANU_ALLOW_PHASE_72_ACTIVE_ROUTING=true`. Verification passed with core tests 122/122, app tests 197/197, app lint, production build, and `npm run release:verify`; only documented R-405 findings remain. Production pilot remains `NO-GO`.

Phase 71 Turkiye official health source ingestion completed on 2026-06-07: app `phase-71-turkiye-official-sources.ts` holds the user-supplied 14-source Turkiye official source manifest with P0/P1/P2 priorities, critical sections, and green/yellow/red impact notes. It adds fail-closed artifact intake into the Phase 65 QA contract; metadata-only sources do not pass QA, unknown artifacts fail, and QA-passing derived rules remain draft-only until external approval. Production pilot remains `NO-GO`.

Phase 70 user-supplied form hardening completed on 2026-06-07: app `phase-70-form-registry.ts` now holds the user-supplied dietitian/client field registry with prompt-access, answerability-role, and privacy metadata; published local client/dietitian schemas and seed responses back demo autopilot qualification; `phase-70-form-hardening.ts` enforces minimum autopilot client field completeness and sanitized prompt summaries; simulator preflight blocks incomplete/not-qualified autopilot clients before provider calls. Production pilot remains `NO-GO`.

Phase 69 direct 5,000 client scale foundation completed on 2026-06-05: app `direct-pilot-scale-readiness.ts` now provides a synthetic 100 dietitian x 50 client fixture, cursor pagination helper, readiness evaluator, and scale target constants. Scale-critical read contracts are marked with `phase69_paginated_contract`, and operational health carries aggregate direct-pilot scale readiness fields. Production pilot remains `NO-GO`.

Phase 68 green maximization intent taxonomy is the latest completed implementation wave (2026-06-05): core `evaluateGreenIntentTaxonomy` now records green intent family metadata after approved-source answerability and before provider generation. Green-looking sensitive intents such as calorie/macro/portion target changes, medication/supplement decisions, lab/symptom interpretation, active-plan conflict, and emergency/sensitive contexts block with internal handoff/no-send and `providerAttempted=false`. Yellow/red decisions receive `not_applicable_non_green` taxonomy metadata and are not downgraded. Production pilot remains `NO-GO`.

Phase 67 approved source answerability engine is the previous completed implementation wave (2026-06-05): core `evaluateApprovedSourceAnswerability` now gates green provider calls/sends on approved source support after PromptContext compilation and before provider generation. Active diet plan, prompt-allowed form summaries, dietitian context updates, dietitian manual messages, pinned notes, allergies, and restricted foods can support answerability. AI-generated messages are excluded from source authority. Missing approved source support creates internal handoff/no-send with `providerAttempted=false`. Production pilot remains `NO-GO`.

Phase 66 product communication covenant lock completed on 2026-06-05: core/provider output safety blocks client-facing AI self-disclosure, AI limitation disclaimers, doctor/dietitian/professional referral language, and covenant-violating green provider output; PromptContext carries the covenant instruction; mock-provider output self-checks the covenant; handoff acknowledgements are internal-only; and send-time draft approval blocks non-green AI drafts plus covenant-violating green draft edits. Production pilot remains `NO-GO`.

Phase 65 official regulation PDF corpus QA foundation completed on 2026-06-04: `app/src/lib/official-regulation-corpus.ts` requires user-supplied official PDF corpus packages to include source metadata, SHA-256 checksums, page extraction evidence, page/section references, derived rule drafts, corpus version, and synthetic golden cases before PDF-derived scope rules can become draft `ScopeRuleRecord` entries with source references. QA failure blocks draft rule construction and keeps launch-gate evidence draft. QA success does not approve the corpus or activate production routing. Production pilot remains `NO-GO`.

Phase 64 structured launch-gate evidence engine completed on 2026-06-04: `LaunchGateEvidenceRecord` and `evaluateProductionPilotLaunchGateEvidence` now require sanitized artifact references, owner, explicit approval, approval date, review cadence, non-expired timing, and full required-evidence coverage before a gate can be treated as closed. Legal/privacy and clinical gate definitions include Phase 63 form/PDF corpus evidence. Operational health can consume structured evidence. Real scope-guard egress cannot be enabled by legacy approved id arrays alone; it requires structured clinical taxonomy and provider/vendor evidence plus `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Production pilot remains `NO-GO`.

Phase 63 production pilot GO rebaseline is the latest completed planning wave (2026-06-04): production-pilot planning is now WhatsApp-first, Gemini-only, up to 100 dietitians, and 50+ clients per dietitian. Dietitian/client forms are user-supplied and must pass schema, privacy, prompt-allowlist, clinical, versioning, and migration review before production use. Official health-regulation PDFs are user-supplied and must become a traceable approved corpus with extraction QA, page/section references, approved derived rules, corpus golden tests, and clinical/legal approval before active green/yellow/red routing. This did not approve production pilot launch, close any gate, connect real services, process real data, or resolve R-405.

Before selecting the next engineering phase, read `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md` and `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`; together they are the current planning source for production-pilot exit work.

Post-Phase 69 remaining production hardening is ordered by `DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`: user-supplied form hardening, official PDF ingestion, regulation permission graph, green/yellow/red calibration, client removal/anonymization transactional redaction contract, Gemini provider gate, WhatsApp production adapter, production operations, R-405 closure, full 100x50 rehearsal, external launch-gate closure, and direct production pilot GO.

Phase 62 architecture review remediation wave 2 is the latest completed implementation wave (2026-06-04): provider failures on active clients now open dietitian handoff without client-facing AI send; shared `normalizeSafetyText`; overlap-based scope retrieval (`DEFAULT_MATCH_THRESHOLD` 0.4); glucose numeric cost-unit filtering; dead `modelForRisk` removed. Bulgu 1 unchanged (accepted). Bulgu 3/9/10 documented as constraint-accepted. Production pilot remains `NO-GO`.

Phase 61 scope guard (RAG + LLM) second layer mock-first completed (2026-06-04): deterministic lexical retrieval + mock evaluator over an approved dietetic-regulation corpus, escalate-only merge with the existing classifier (`dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.1.0+scope-rag-v0.1.0`), raw-text-free scope guard audit records, Supabase `scope_*` tables with RLS, operational-health corpus signals, and disconnected real embedding/LLM seams behind `clinical_taxonomy_approval` + `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Default seed corpus is draft-only so scope guard no-ops until qualified approval. Production pilot remains `NO-GO`.

Start from `docs/NEXT_PHASE_EXECUTION_PLAN.md`, especially `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`, `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`, and the Phase 56–60 specs listed there. Phase 49 context remains in `docs/PHASE_49_SAFETY_ORCHESTRATION_CONCURRENCY_HARDENING_SPEC.md`.

**R-406 canonical status:** mitigated in the local prototype for the Phase 50–52 baseline (`npm run test:rls` passed 19/19 on 2026-06-02). Re-run `npm run test:rls` when Docker Desktop/local Supabase is available after Phase 57 `yellow_risk_hold` or Phase 61 `scope_rules` / `scope_rule_chunks` / `scope_guard_evaluations` migrations if new RLS evidence is needed.

Remaining production hardening (not a new phase yet): client removal/anonymization transactional redaction contract, dashboard/internal-copilot pagination after Phase 53 contracts, external launch-gate approval artifacts, and R-405 resolution only through Phase 22.

Phase 49 priorities:

1. Expand multilingual quality guard coverage for all supported response languages. Completed locally on 2026-06-02.
2. Add persona output-contract checks for emoji and short-response constraints. Completed locally on 2026-06-02.
3. Connect health-profile risk flags to classifier yellow escalation. Completed locally on 2026-06-02.
4. Add cumulative risk analysis over recent promptable messages plus the current inbound message. Completed locally on 2026-06-02.
5. Move shared preflight evaluation into the core package and reuse it from app paths. Completed locally on 2026-06-02.
6. Add optimistic concurrency controls for Supabase-backed write paths. Completed for local prototype client-row mutations on 2026-06-02; broader multi-table transaction/revision hardening remains before production.
7. Add tenant/client scoped rate limiting for inbound, simulator, manual reply, draft review, and internal copilot paths. Completed as app-instance scoped local limiter on 2026-06-02; distributed production limiter remains before production.
8. Add expired activation lazy cleanup/audit or safe notification behavior. Completed locally on 2026-06-02.
9. Later split `simulator.ts` into domain modules and clean up legacy `buildReplyPrompt`. Initial cleanup completed locally on 2026-06-02: simulator risk/model routing was extracted and the unused legacy prompt export was removed.

Do not connect real WhatsApp, Telegram, Gemini/external LLM, push/email, monitoring, secret manager, or real client health data as part of Phase 49 or Phase 50.

Phase 50 status as of 2026-06-02:

- Phase 1 foundation added `app/supabase/migrations/20260602030000_phase_50_production_hardening_foundation.sql` with `rate_limit_buckets`, `consume_rate_limit`, and transactional commit RPC wrappers. On 2026-06-02, Docker Desktop/local Supabase was started and `npx supabase db reset --local` applied the migration locally.
- Phase 2/51 app integration is complete for the targeted local mutation paths: async scoped rate-limit calls are wired, Supabase-backed limiter RPC support exists, and manual reply, client-scoped inbound simulation, draft review, form response save, client context update, handoff status update, and red-risk reactivation use commit RPCs.
- Phase 3 narrowed reads is partial but locally verified: manual reply, client-scoped inbound simulation, draft approval/dismissal, human takeover release, handoff status update, red-risk reactivation, form response save, and client context update use scoped operation loaders before mutation.
- Phase 3 validation passed: app tests 126/126, app lint, and core tests 57/57.
- Phase 4 launch-gate evidence/docs completed locally: added `docs/PHASE_50_PRODUCTION_SUPABASE_HARDENING_EVIDENCE_SPEC.md`, updated pilot evidence/gate/final readiness docs, and re-ran evidence commands.
- Phase 4 validation passed: `npm run release:verify` from `app` completed with core tests 57/57, app tests 126/126, lint, production build, and only known R-405 findings.
- Local Supabase/RLS validation passed on 2026-06-02: after applying migrations through Phase 50 and Phase 51/52 coverage, `npm run test:rls` passed against local Supabase with 1 file and 19/19 tests. R-406 is mitigated in the local prototype.
- Phase 53 scale/broad read contracts completed locally on 2026-06-02: `app/src/lib/supabase-read-contracts.ts` classifies intentional broad reads, future paginated reads, and already scoped mutation reads; `npm run release:verify` passed with app tests 130/130.
- Remaining production hardening work: design a dedicated transactional payload for client removal/anonymization bulk redaction, implement pagination only after accepting the Phase 53 contracts, resolve R-405 only through the Phase 22 procedure, and keep external launch gates open until approval artifacts arrive.
- Phase 54 R-405/launch-gate recheck completed locally on 2026-06-02: stable `next@latest` remains 16.2.7 with nested `postcss@8.4.31`, production audit still reports only known R-405 findings, no dependency files changed, no external approval artifacts were supplied, all eight launch gates remain open, and production pilot remains `NO-GO`. `npm run release:verify` passed with core tests 57/57, app tests 130/130, lint, production build, and only documented R-405 findings.
- Phase 55 audit remediation safety boundary completed locally on 2026-06-03: real Turkish Unicode classifier normalization, multilingual pregnancy/lactation yellow routing, prompt-injection yellow review routing, client-authored PromptContext data boundaries, safety-critical pinned-note no-truncation, and red-risk preflight regression coverage were added. `npm run release:verify` passed with core tests 72/72, app tests 132/132, lint, production build, and only documented R-405 findings. No schema, RLS, dependency, provider, channel, monitoring, secret manager, backup provider, launch-gate, R-405, or real-data change was made.
- Phase 56 clinical safety second-layer local evidence completed locally on 2026-06-03: deterministic second-layer evaluation now sits above the regex classifier and can escalate otherwise-green allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, and eating-disorder-sensitive ambiguous restriction language to yellow review. `npm run release:verify` passed with core tests 75/75, app tests 134/134, lint, production build, and only documented R-405 findings. No real LLM safety evaluator, provider, channel, schema/RLS/RPC, launch-gate approval, or real-data change was made. R-310 is partially mitigated in the local prototype only; qualified dietitian approval remains required before production.
- Phase 57 yellow-risk hold/draft refresh completed locally in code on 2026-06-03: local simulator now passivates AI on yellow, stores `yellowRiskHold`, refreshes the same pending draft for later green/yellow messages, preserves the yellow draft when a later red message arrives, and keeps red manual lock stronger than yellow approval. Verification passed: app simulator tests 34/34, app tests 135/135, core tests 75/75, app lint, and `npm run release:verify`. Phase 57 migration RLS evidence is pending when Docker Desktop/local Supabase is unavailable; this does not reopen the Phase 52 baseline R-406 mitigation.
- Phase 58 dietitian client language control completed locally on 2026-06-03: client creation and profile patch now keep `communicationLanguage` and `healthProfile.preferredLanguage` synchronized, language changes are prompt-affecting context changes, and app simulator evidence proves subsequent AI replies use the dietitian-selected language. Targeted verification passed with 54/54 tests. See `docs/PHASE_58_DIETITIAN_CLIENT_LANGUAGE_CONTROL_SPEC.md`.
- Phase 59 architecture review remediation completed locally on 2026-06-03: fail-closed `decideModeAction` for unknown modes, core `generateReply` try/catch with safe `no_ai` provider failure metadata, numeric glucose-context escalation and expanded multilingual `symptom_question` patterns with new golden cases, `appendCoreSimulationResult` helper refactor without behavior change, multilingual formal/informal voice-profile term lists, and provider-native token counting documented for future Gemini/external LLM integration. Verification passed: core tests 85/85, app tests 137/137, app lint, and `npm run release:verify`. No schema/RLS, dependency, real provider, channel, launch-gate, or R-405 changes. See `docs/PHASE_59_ARCHITECTURE_REVIEW_REMEDIATION_SPEC.md`.
- Phase 60 audit remediation completed locally on 2026-06-03: narrowed glucose anchor patterns and deduplicated red reasons (`dietetic-risk-v0.3.1`), core `providerOutputSafety` on provider failures, architecture `.d.ts` alignment, expanded golden/unit/simulator tests, and documentation continuity updates. Verification passed: core tests 104/104, app tests 138/138, app lint, and `npm run release:verify`. See `docs/PHASE_60_AUDIT_REMEDIATION_SPEC.md`.
- Phase 62 architecture review remediation wave 2 completed locally on 2026-06-04: provider failure handoff (no client send), `normalize-safety-text.js`, overlap retrieval, glucose TL skip, orchestrator override comment, `modelForRisk` removed. Verification: core 114/114, app 150/150. See `docs/PHASE_62_ARCHITECTURE_REVIEW_REMEDIATION_WAVE2_SPEC.md`.
- Phase 61 scope guard (RAG + LLM) second layer mock-first completed locally on 2026-06-04: core `scope-guard.js` (`scope-rag-v0.1.0`) with escalate-only `mergeScopeDecision`; app mock lexical retrieval (`scope-retrieval.ts`), deterministic evaluator (`scope-evaluator.ts`), runtime wiring (`scope-guard-runtime.ts`, `simulator-risk.ts`); system-level regulation corpus governance (`scope-corpus.ts`); Supabase migration `20260604000000_phase_61_scope_corpus.sql`; raw-text-free `scope_guard_evaluations` audit; operational-health corpus signals; launch-gate scope corpus evidence on `clinical_taxonomy_approval`; disconnected real embedding/LLM behind `MANU_ALLOW_REAL_SCOPE_GUARD=true`. Default seed corpus is draft-only (scope guard no-op until approved). Verification passed: core tests 112/112, app tests 150/150, app lint, and `npm run release:verify`. See `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md`.

## Current Implementation

The repository has two code packages:

```text
dietitian-ai-assistant   # pure core: orchestration + deterministic safety merge
app                      # SaaS prototype: persistence, simulator, scope retrieval/evaluator I/O
```

Inbound clinical safety uses three independent evaluation layers (escalate-only merge; never downgrade red/yellow to green):

1. **Regex/deterministic classifier** (`safety-classifier.js`) — unchanged first axis.
2. **Clinical safety second layer** (`clinical-safety-second-layer.js`) — context-sensitive yellow evidence (`clinical-safety-second-layer-v0.1.0`).
3. **Scope guard** (`scope-guard.js` in core; retrieval/evaluator in app) — dietetic-regulation corpus match (`scope-rag-v0.1.0`); inactive when corpus is empty or unapproved.

Combined classifier version when scope guard participates: `dietetic-risk-v0.3.1+clinical-safety-second-layer-v0.1.0+scope-rag-v0.1.0`.

`dietitian-ai-assistant` is the testable core architecture package.

`app` is the first local SaaS/PWA prototype. It is not production-connected yet; it uses API-backed dashboard state, live local Supabase persistence when local env vars are configured, and a dev fallback store when Supabase env vars are missing.

Core key files:

- `src/orchestrator.js`
- `src/ai-activation.js`
- `src/model-routing.js`
- `src/message-provenance.js`
- `src/safety-classifier.js`
- `src/clinical-safety-second-layer.js`
- `src/scope-guard.js`
- `src/normalize-safety-text.js`
- `src/response-quality-guard.js`
- `src/context-capsule.js`
- `src/personas.js`
- `src/voice-profile.js`
- `docs/data-model.sql`

App key files:

- `app/src/components/dashboard-app.tsx`
- `app/src/components/auth-states.tsx`
- `app/src/lib/app-state-store.ts`
- `app/src/lib/supabase-store.ts`
- `app/src/lib/auth-context.ts`
- `app/src/lib/simulator.ts`
- `app/src/lib/simulator-risk.ts`
- `app/src/lib/scope-corpus.ts`
- `app/src/lib/scope-retrieval.ts`
- `app/src/lib/scope-evaluator.ts`
- `app/src/lib/scope-guard-runtime.ts`
- `app/src/lib/scope-guard-provider.ts`
- `app/src/lib/simulator.test.ts`
- `app/src/lib/auth-context.test.ts`
- `app/src/lib/seed-data.ts`
- `app/src/lib/use-manu-state.ts`
- `app/src/proxy.ts`
- `app/src/app/dashboard/page.tsx`
- `app/src/app/api/auth-state/route.ts`
- `app/public/manifest.webmanifest`
- `app/public/sw.js`
- `app/supabase/migrations/20260522000000_initial_manu_ai_schema.sql`
- `app/supabase/migrations/20260523000000_app_state_schema_fixes.sql`
- `app/supabase/migrations/20260604000000_phase_61_scope_corpus.sql`
- `docs/NEXT_SUPABASE_FOUNDATION_SPEC.md`
- `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md`

## Current Behavior

Local app state:

- Dashboard loads state through `/api/app-state`, not browser `localStorage`.
- API routes use `app/src/lib/supabase-store.ts` when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist.
- API routes fall back to `app/src/lib/app-state-store.ts` when Supabase env vars are missing.
- Supabase store auto-seeds demo tenant, dietitian, clients, conversations, messages, AI decision, and processed seed event.
- Supabase-backed operations currently include app state load/reset, client create/update, manual replies, simulator persistence, and handoff resolve/dismiss.
- Supabase Auth-backed demo sign-in creates or reuses `demo@manu.local`, links it to the demo tenant membership, and issues Supabase Auth cookies.
- Supabase-backed API routes resolve tenant/dietitian context from the verified auth user and return `401` without a session or `403` without membership.
- `/dashboard` requires a verified Supabase Auth user when Supabase is configured; fallback mode still uses the local demo cookie.

Inbound flow (simulator and core orchestrator):

1. Build client context capsule.
2. Classify risk (regex classifier + clinical safety second layer in app/core).
3. Apply scope guard when approved corpus is active (mock lexical retrieval + deterministic evaluator; escalate-only merge; else no-op).
4. Pass merged `riskDecisionOverride` into core orchestration.
5. Check AI activation state.
6. If passive, return `no_ai` (red handoff still applies per product decision when AI is passive/manual).
7. If active, decide mode action.
8. Select model by risk.
9. Generate only if allowed.
10. Quality guard validates output.
11. Return/send/draft/handoff/no_ai; append raw-text-free `scope_guard_evaluations` audit when scope guard ran.

AI activation:

- `active`: AI may operate according to mode.
- `passive`: AI does not generate reply or draft.
- `aiActiveFrom` and `aiActiveUntil` can schedule activation.

Message provenance:

- `client_inbound`
- `ai_generated`
- `dietitian_manual`
- `system_event`
- `imported_unknown`

## Tests

Run core tests:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\dietitian-ai-assistant"
npm test
```

Current expected result:

```text
120/120 tests passing
```

Covered:

- scope guard escalate-only merge, no-downgrade invariants, and rule-threshold behavior (`tests/scope-guard.test.mjs`)
- green autopilot uses `gemini-1.5-flash`
- red handoff makes no model call
- passive client blocks AI generation
- scheduled activation blocks generation before start
- copilot drafts green messages
- yellow uses `gemini-3`
- quality guard blocks unsafe plan changes
- tenant isolation rejects mismatched context
- voice profile extraction
- message provenance for AI vs dietitian messages
- providerAttempted/no-call audit metadata
- PromptContext source metadata and newest dietitian-authored source precedence
- expanded clinical golden cases for English emergencies, medication dose requests, minor/body-image, eating-disorder euphemisms, pregnancy complications, and typo/diacritic handling

Run app checks:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run lint
npm test
npm run test:rls
npm run build
npm run release:verify
```

Current expected app result:

- ESLint passes.
- 176/176 app tests pass (includes direct pilot scale readiness, approved source answerability, product communication covenant lock, structured launch-gate evidence, operational-health, official regulation corpus QA, scope-corpus, scope-retrieval, scope-guard-runtime, scope-guard-provider tests).
- RLS integration tests pass against local Supabase; when pointed at non-local Supabase they skip unless `MANU_ALLOW_REMOTE_RLS_TESTS=true`. Re-run after Phase 61 `scope_*` migration when recording new RLS evidence.
- `next build --webpack` passes.
- `npm run release:verify` passes with core tests 122/122, app tests 176/176, lint, production build, and only known R-405 production audit findings.
- `npm run test:visual` passes across desktop, tablet, and mobile Chromium viewports.

Note: app scripts intentionally use `--webpack` because Turbopack did not resolve the local symlinked `dietitian-ai-assistant-architecture` package. The core package now has `"exports": "./src/index.js"`.

## Local Supabase Runtime Status

Verified on 2026-05-23:

- Local Supabase project `manu-ai-local` starts successfully.
- Migrations apply successfully to local Supabase Postgres.
- `app/.env.local` exists with local Supabase URL, publishable key, and service secret.
- Supabase CLI is installed as an app dev dependency: run it from `app` with `$env:SUPABASE_TELEMETRY_DISABLED='1'; npx supabase ...`.
- `app/.env.local` is currently pointed at the user's cloud Supabase MANU-AI project `nafcfexwveutnvirhwej`; the file is gitignored and must not be committed or echoed.
- Cloud seed verification returned 1 tenant, 1 dietitian, 3 clients, 3 conversations, 2 messages, 1 AI decision, and 1 processed inbound event.
- Local Supabase API: `http://127.0.0.1:54321`
- Local Supabase Studio: `http://127.0.0.1:54323`
- Local database URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `http://127.0.0.1:3000/api/app-state` returns seeded demo data from Supabase.
- `http://127.0.0.1:3000/dashboard` returns HTTP 200.
- `/api/simulator` writes inbound message, AI reply, AI decision, idempotency key, and audit event to Supabase.
- `/api/messages/manual` writes dietitian manual replies to Supabase.
- `/api/messages/drafts/[id]` approves, edit-sends, or dismisses AI drafts and persists the outcome to Supabase.
- `/api/clients/[id]/release-takeover` releases human takeover locks and records `human_takeover_released`.
- Autopilot readiness uses detailed `safetyChecklist` fields and reports missing checklist keys in simulator decision reasons.
- Unauthenticated `/api/app-state` returns HTTP 401 when Supabase is configured.
- Unauthenticated `/dashboard` redirects to `/` when Supabase is configured.
- Demo sign-in creates a Supabase Auth session and `/api/app-state` then returns seeded demo data.
- `npm run test:rls` verifies tenant-member reads, membership-less reads, cross-tenant write blocking, scoped assistant/viewer/care-team/auditor behavior, internal copilot scope, tenant-aware channel/idempotency uniqueness, auxiliary table RLS, Telegram idempotency channel persistence, and Supabase-backed AI control audit events.
- Draft approve, edit-send, and dismiss were verified against local Supabase; demo state was reset afterward.
- Human takeover release was verified against local Supabase; demo state was reset afterward.
- Safety checklist blocking and completion were verified against local Supabase; demo state was reset afterward.
- Added `docs/PILOT_FOUNDATION_HARDENING_SPEC.md`.
- Added migration `app/supabase/migrations/20260524000000_restore_auxiliary_rls_policies.sql` for `client_ai_status_events`, `conversation_memories`, and `risk_assessments`.
- The `20260524000000` local migration was marked as applied with `npx supabase migration repair --local --status applied 20260524000000`.
- `/api/simulator` Supabase persistence now stores processed idempotency events with the simulated client's channel.
- Supabase-backed client AI control updates now write `client_ai_status_events` and `client_ai_control_updated` audit events.
- Demo state was reset back to seed after write verification.
- Codex in-app browser could not open localhost because of its URL policy; use Windows/default browser at `http://localhost:3000/dashboard`.
- Pilot foundation execution continued on 2026-05-25:
  - Added `docs/PILOT_FOUNDATION_EXECUTION_SPEC.md`.
  - Added migration `app/supabase/migrations/20260525000000_risk_assessment_message_uniqueness.sql`.
  - Simulator inbound messages now persist `risk_assessments` in fallback and Supabase-backed state.
  - Duplicate simulator idempotency keys do not create duplicate risk assessments.
  - `MANU_DEV_FALLBACK_STORE=true` now forces fallback mode at Supabase config/proxy resolution.
  - `npm run test:rls` skips unless Supabase URL is local or `MANU_ALLOW_REMOTE_RLS_TESTS=true`.
  - Core safety golden tests now cover green/yellow/red dietetic risk categories and quality guard blocks.
- Playwright visual smoke coverage was added for desktop, tablet, and mobile Chromium.
- Phase 1 visual coverage now includes dashboard navigation, clients, conversation, simulator, draft controls, manual long reply rendering, red handoff, safety-checklist blocking, handoff queue visibility, and horizontal overflow checks.
- Controlled JSON API errors were added for known simulator, manual reply, draft, handoff, and takeover failures.
- Handoff creation now records `handoff_notification_queued` audit events as the first in-app notification stub.
- Phase 2-5 later added production-style auth states, consent/permission governance, backed in-app notifications, data-governance export/anonymization helpers, and the `opted_out` Supabase enum migration.
- Added `docs/NEXT_PHASE_EXECUTION_PLAN.md` as the canonical next phased execution plan.
- Updated risk/data/mobile/Supabase foundation docs to track VCS/checkpoint, dependency audit, consent, notification, data governance, and provider/channel launch gates.
- Local Git repository and root ignore rules now exist. Latest verified baseline before Phase 21 is commit `66a8b94 Add pilot readiness evidence pack`; R-005 is mitigated in the local prototype.
- Phase 23 AI context/send safety was completed on 2026-05-30:
  - Added `docs/PHASE_23_AI_CONTEXT_MEMORY_ARCHITECTURE_SPEC.md`.
  - Added bounded `PromptContext` compilation in `dietitian-ai-assistant/src/context-compiler.js`.
  - Core prompt context includes the missing historical context invariant and only allowlisted segments.
  - `ContextManifest` records source/type/token metadata without raw message text.
  - Provider output containing `[ERROR: missing_historical_context]` is blocked with `severity="block"`.
  - Missing historical context routes to handoff/human takeover with `send_status="send_blocked"` and no AI message to the client.
  - Pending AI drafts are invalidated when new inbound/manual/profile context changes the prompt basis.
  - Legacy and invalidated drafts fail approval with controlled 409 errors.
  - Added Supabase migration `20260530000000_phase_23_context_send_safety.sql`.
  - Phase 23 verification on 2026-05-30: core tests 39/39, app tests 82/82, app lint passed, production build passed.
- Phase 24-25 voice sample and dynamic form infrastructure was completed on 2026-05-30:
  - Added `docs/PHASE_24_DIETITIAN_VOICE_SAMPLE_INFRASTRUCTURE_SPEC.md`.
  - Added `docs/PHASE_25_DYNAMIC_CLIENT_FORM_INFRASTRUCTURE_SPEC.md`.
  - Added dietitian voice sample records, generated voice profile records, and dashboard Voice panel.
  - Added versioned client form schemas, response snapshots, and dashboard Forms panel.
  - Added APIs for voice samples/profile generation, form schema creation/publishing, and client form response saves.
  - Added migration `app/supabase/migrations/20260530010000_phase_24_25_voice_forms.sql`.
  - PromptContext includes only `prompt_allowed` form answers via `client_form_summary`.
  - Form response saves increment client context revision and invalidate pending AI drafts.
  - Phase 24-25 app tests reached 86 passing tests before the later Phase 26 additions.

## Next Recommended Work

Continue from the local SaaS prototype:

1. Preserve the Phase 23 context/send-safety baseline in any future provider or channel work.
2. Continue external approval evidence collection and R-405 remediation only through the documented procedures.
3. Keep real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, and real client health data disconnected until the user explicitly approves the relevant integration.

Local dev server:

```powershell
cd "C:\Users\Dell\OneDrive\Masaüstü\MANU-AI\app"
npm run dev
```

Open:

```text
http://localhost:3000/dashboard
```

If starting from the root page, use the demo sign-in button to enter `/dashboard`.

Do not connect real WhatsApp or Telegram yet.

## Coding Boundaries

- Keep all new files inside `C:\Users\Dell\OneDrive\Masaüstü\MANU-AI`.
- Do not delete existing files.
- Preserve current core package tests.
- Prefer extending the existing `dietitian-ai-assistant` logic instead of rewriting it.
- Do not add real health-data processing before legal/provider gates are complete.
- Do not fine-tune on raw client messages.
- Do not mix tenants in datasets.

## Key Docs To Maintain

When you make changes, update:

- `PLAN.md`
- `PROJECT_PLAN.md`
- `HANDOFF_FOR_NEXT_CODEX.md`
- relevant `docs/*.md`
- relevant `dietitian-ai-assistant/docs/*.md`

## Final Context For New Chat

The user's last request was to close the current chat and continue in a new chat without losing context. This handoff file exists for that purpose.

## Phase 2 Handoff Notes — 2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Confirmed** `proxy.ts` is native Next.js 16 middleware. `middleware.ts` is not needed and Next.js 16 errors if both exist. Build output confirms `ƒ Proxy (Middleware)`.
- **Created** `/api/auth-state` endpoint (`app/src/app/api/auth-state/route.ts`) — returns JSON describing user auth/membership/profile state: `authenticated`, `no_membership`, `no_dietitian_profile`, `unauthenticated`, or `fallback_demo`.
- **Created** `app/src/components/auth-states.tsx` — `NoMembershipState`, `NoDietitianProfileState`, and `MembershipBadge` UI components.
- **Replaced** `app/src/app/dashboard/page.tsx` — now has server-side auth resolution. Renders controlled error states for missing membership or missing dietitian profile. Redirects to `/` if unauthenticated. Falls back to `DashboardApp` directly in fallback mode.
- **Updated** `app/src/lib/use-manu-state.ts` — captures 401/403 auth errors from API calls into `authError` state. Exposes `authError` to consumers.
- **Updated** `app/src/components/dashboard-app.tsx` — accepts `authInfo` prop, shows `MembershipBadge` in header, handles `authError` with session error UI and sign-in redirect link.
- **Created** `app/src/lib/auth-context.test.ts` — 6 unit tests for AppAuthError and authErrorResponse.
- **Created** `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` — full spec for Phase 2.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `app/src/app/api/auth-state/route.ts` |
| NEW | `app/src/components/auth-states.tsx` |
| NEW | `app/src/lib/auth-context.test.ts` |
| NEW | `docs/PHASE_2_AUTH_ONBOARDING_SHELL_SPEC.md` |
| MODIFIED | `app/src/app/dashboard/page.tsx` |
| MODIFIED | `app/src/lib/use-manu-state.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands — All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 24/24 ✓ (6 new auth-context tests)
app: npm run test:rls → 5 skipped (expected, non-local Supabase)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓ (desktop/tablet/mobile)
```

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, or real health data was connected.
- No destructive git/file commands were run.
- No `npm audit fix --force` was run.
- No `.env.local` contents were printed.
- No breaking refactors were made.
- `proxy.ts` was not modified.

### Remaining Risks

- R-005 (no VCS) remains open.
- R-405 (dependency audit) remains open.
- No real OAuth/SSO — only demo auth exists.
- No multi-tenant switching UI.
- No production signup/registration flow.

### Next Correct Step For Codex

Phase 4: Handoff Notification Architecture — see `docs/NEXT_PHASE_EXECUTION_PLAN.md`. Focus on making urgent handoffs operationally visible without sending external notifications yet.

## Phase 3 Handoff Notes — 2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Extended** `PermissionState` type with `opted_out` value in `types.ts`.
- **Strengthened** `getPreflightBlock()` in `simulator.ts`: only `channelPermission === "ready"` allows AI. Pending, blocked, and opted_out all block generation.
- **Added** identity quarantine: empty `channelUserId` blocks AI with `identity_quarantine_no_channel_id`.
- **Added** identity quarantine: `adultStatus === "unknown"` blocks AI with `identity_quarantine_adult_status_unknown`.
- **Added** permission change auditing in `updateClientInState()`: emits `channel_permission_changed` or `channel_permission_opted_out` audit events with previous/new values.
- **Updated** dashboard UI with `opted_out` permission option.
- **Added** 6 new simulator tests for pending/opted_out blocking, identity quarantine, and permission audit.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `docs/PHASE_3_CONSENT_PERMISSION_CHANNEL_GOVERNANCE_SPEC.md` |
| MODIFIED | `app/src/lib/types.ts` |
| MODIFIED | `app/src/lib/simulator.ts` |
| MODIFIED | `app/src/lib/simulator.test.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands — All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 30/30 ✓ (14 simulator + 6 auth-context + 7 store + 1 supabase-config + 2 api-errors)
app: npm run test:rls → 5 skipped (expected)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓
```

### What Was NOT Done

- No client-facing consent/legal copy or KVKK/GDPR text added.
- No real channel opt-in/opt-out webhook handling.
- No real WhatsApp, Telegram, Gemini, or real health data connected.
- No `.env.local` contents printed.
- No breaking refactors.

### Next Correct Step For Codex

Phase 6: Clinical Governance And Evaluation — see `docs/NEXT_PHASE_EXECUTION_PLAN.md`.

## Phase 5 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_5_DATA_GOVERNANCE_SPEC.md`.
- Added `app/src/lib/data-governance.ts` with retention placeholders, client-scoped export, and client anonymization/memory invalidation helpers.
- Added `/api/clients/[id]/export` and `/api/clients/[id]/anonymize`.
- Added fallback and Supabase-backed skeleton support for client export/anonymization.
- Added migration `app/supabase/migrations/20260525010000_add_opted_out_permission_state.sql` to close the Phase 3 Supabase enum gap for `opted_out`.
- Added tests for export scoping, promptable-context invalidation, retention placeholders, and fallback API routes.

### Verification Commands

```text
app: npm test -> 37/37 passed
app: npm run lint -> passed
app: npm run build -> passed
app: npm run release:verify -> passed
release verification: core tests 41/41, app tests 99/99, lint passed, production build passed, production dependency audit known R-405 findings only
```

### What Was NOT Done

- No final legal retention durations were set.
- No production DSAR workflow or scheduled deletion job was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.

### Next Correct Step For Codex

Phase 7: Channel Adapter Readiness. Define normalized WhatsApp/Telegram adapter contracts and mock adapter tests without connecting real channel credentials.

## Phase 7 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_7_CHANNEL_ADAPTER_READINESS_SPEC.md`.
- Added `app/src/lib/channel-adapters.ts` with normalized mock inbound event handling.
- Added `app/src/lib/channel-adapters.test.ts` with mock WhatsApp/Telegram coverage.
- Known mock channel events now resolve clients and use the existing simulator/orchestrator path.
- Unknown and ambiguous channel identities are quarantined before message persistence or AI decisions.
- Duplicate provider events return `duplicate_ignored` without duplicate sends.
- Permission-blocked and opted-out clients stay blocked by the existing safety gate.
- Provider metadata redaction removes raw body, prompt, health profile, diet plan, allergy, memory, and clinical note fields.

### Verification Commands

```text
app: npm test -> 45/45 passed
app: npm run lint -> passed
```

### What Was NOT Done

- No real WhatsApp Business Cloud API connection was added.
- No real Telegram Bot API connection was added.
- No webhook signing, provider credentials, template sending, or outbound delivery state machine was added.

### Next Correct Step For Codex

Phase 8: AI Provider Readiness. Add a mock provider abstraction without sending real health data to Gemini or any external LLM provider.

## Phase 8 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_8_AI_PROVIDER_READINESS_SPEC.md`.
- Created `docs/AI_PROVIDER_REQUIREMENTS.md`.
- Added `app/src/lib/ai-provider.ts` with a deterministic local mock provider.
- Added `app/src/lib/ai-provider.test.ts`.
- Added `app/supabase/migrations/20260525020000_ai_provider_decision_metadata.sql`.
- Simulator generation now uses the mock provider abstraction.
- AI decisions now include prompt version, provider id, provider status, and provider error code metadata.
- Provider timeout/error failures produce safe `no_ai` decisions without outbound AI-generated messages.

### Verification Commands

```text
app: npm test -> 49/49 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### What Was NOT Done

- No real Gemini or external LLM provider was connected.
- No provider SDK, credentials, prompt logging service, fine-tuning, or raw health-data export was added.
- Vendor/legal/provider retention review remains required before real provider use.

### Next Correct Step For Codex

Do not connect production providers or channels yet. The next work should address launch gates: qualified dietitian clinical approval, provider/legal review, real WhatsApp/Telegram policy review, operational ownership, and R-405 clearance.

## Phase 4 Handoff Notes — 2026-05-25

Completed by: Antigravity (temporary session while Codex was offline)

### What Was Done

- **Added** `NotificationRecord` type and `notifications` array to `ManuAppState` in `types.ts`.
- **Updated** `simulator.ts` to create a safe-text `NotificationRecord` when an urgent handoff is triggered, converting the previous `handoff_notification_queued` audit event into a backed notification.
- **Added** `markNotificationRead` and `acknowledgeNotification` functionality to `app-state-store.ts` and `use-manu-state.ts`.
- **Created** `/api/notifications/[id]/read` and `/api/notifications/[id]/acknowledge` endpoints.
- **Updated** `supabase-store.ts` to support the new `notifications` array (currently initialized as empty since Supabase push/email adapters are not yet built).
- **Added** Notification Center UI to `dashboard-app.tsx` header: a Bell icon with an unread badge that opens a dropdown panel listing recent notifications.
- **Added** safe-text rules: notification body never contains raw client message content.
- **Added** 2 new simulator tests to verify notification creation and safe-text rules.

### Files Changed

| Action | File |
| --- | --- |
| NEW | `docs/PHASE_4_HANDOFF_NOTIFICATION_ARCHITECTURE_SPEC.md` |
| NEW | `app/src/app/api/notifications/[id]/read/route.ts` |
| NEW | `app/src/app/api/notifications/[id]/acknowledge/route.ts` |
| MODIFIED | `app/src/lib/types.ts` |
| MODIFIED | `app/src/lib/simulator.ts` |
| MODIFIED | `app/src/lib/simulator.test.ts` |
| MODIFIED | `app/src/lib/app-state-store.ts` |
| MODIFIED | `app/src/lib/use-manu-state.ts` |
| MODIFIED | `app/src/lib/supabase-store.ts` |
| MODIFIED | `app/src/components/dashboard-app.tsx` |
| MODIFIED | `docs/NEXT_PHASE_EXECUTION_PLAN.md` |
| MODIFIED | `PLAN.md` |
| MODIFIED | `HANDOFF_FOR_NEXT_CODEX.md` |
| MODIFIED | `app/README.md` |

### Verification Commands — All Passed

```
dietitian-ai-assistant: npm test → 23/23 ✓
app: npm run lint → passed ✓
app: npm test → 32/32 ✓ (2 new tests)
app: npm run test:rls → 5 skipped (expected)
app: npm run build → passed ✓
app: npm run test:visual → 3/3 ✓
```

### What Was NOT Done

- No external push/email provider connected.
- No Supabase table created for `notifications` yet, as this will happen in a future integration milestone.
- No raw client health messages were included in notifications.

### Next Correct Step For Codex

Phase 6: Clinical Governance And Evaluation — see `docs/NEXT_PHASE_EXECUTION_PLAN.md`.
 
## Phase 6 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`.
- Created `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`.
- Added `dietitian-ai-assistant/tests/clinical-golden-cases.jsonl`.
- Added `dietitian-ai-assistant/tests/clinical-governance.test.mjs`.
- Expanded the safety classifier to `dietetic-risk-v0.2.0` with normalized Turkish/ASCII matching.
- Added golden assertions for expected risk, action, model, and provider-call behavior.
- Added expanded persona invariant tests proving persona changes do not alter risk/action/model decisions.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 35/35 passed
```

### What Was NOT Done

- No real LLM provider was connected.
- No client-facing legal or medical copy was added.
- Qualified dietitian approval is still required before pilot use.

### Next Correct Step For Codex

Phase 7: Channel Adapter Readiness. Define normalized WhatsApp/Telegram adapter contracts and mock adapter tests without connecting real channel credentials.

## Phase 9 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_9_PILOT_READINESS_CLOSURE_SPEC.md`.
- Initialized a local Git repository and added a root `.gitignore`.
- Updated app seed classifier metadata and RLS expectation to `dietetic-risk-v0.2.0`.
- Added migration `app/supabase/migrations/20260525030000_notifications.sql`.
- Supabase store now loads and persists notification records.
- Supabase notification read and acknowledge endpoints now persist state instead of returning `501 not_implemented`.
- Fallback notification actions now return `notification_not_found` for unknown IDs.
- Added fallback API tests for notification read/acknowledge and missing notification errors.
- Added RLS integration coverage for notification tenant isolation.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.
- No `npm audit fix --force` was run.
- No final clinical, legal, provider, or channel launch-gate approval was claimed.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 35/35 passed
app: npm run lint -> passed
app: npm test -> 51/51 passed
app: npm run test:rls -> 5 skipped when default .env.local points at remote Supabase without MANU_ALLOW_REMOTE_RLS_TESTS=true
app: npm run test:rls -> 5/5 passed against local Supabase after npx supabase db push --local, with fallback disabled through temporary local env vars
app: npm run build -> passed
app: npm run test:visual -> 3/3 passed
app: npm audit --omit=dev -> R-405 still open; stable Next.js 16.2.6 pins nested PostCSS 8.4.31, canary Next.js is not a safe pilot baseline, npm override invalidates the tree, and only breaking npm audit fix --force is offered
```

### Next Correct Step For Codex

Continue with the next remaining production-readiness step. Keep production provider/channel work blocked until external launch gates are approved.

## Phase 10 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_10_PRODUCTION_READINESS_GATES_SPEC.md`.
- Added `app/src/lib/launch-gates.ts` with the production-pilot launch gate definitions and evaluator.
- Added `app/src/lib/launch-gates.test.ts`.
- Production pilot launch is blocked by default until every known gate is externally approved.
- Unknown approval keys are ignored and reported.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini, push/email provider, or real health data was connected.
- No legal, clinical, provider, channel, incident, backup, secret, or dependency approval was claimed.
- No admin UI or persistence table for approvals was added.

### Verification Commands

```text
app: npm test -- launch-gates -> 54/54 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Continue with the next remaining production-readiness step while keeping the production-pilot gate evaluator blocked by default.

## Phase 11 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_11_OPERATIONAL_EVIDENCE_READINESS_SPEC.md`.
- Created `docs/INCIDENT_RESPONSE_RUNBOOK.md`.
- Created `docs/BACKUP_RESTORE_RUNBOOK.md`.
- Created `docs/SECRET_ROTATION_RUNBOOK.md`.
- Extended `app/src/lib/launch-gates.ts` so every production-pilot gate lists required external evidence.
- Added a unit test proving every gate remains externally approved and has evidence requirements.

### What Was NOT Done

- No launch gate was approved.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.
- No production secrets, real client identifiers, or raw health data were added to runbooks.

### Verification Commands

```text
app: npm test -- launch-gates -> 55/55 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Move to the next production-readiness layer only after preserving this checkpoint. Keep launch blocked until external gate evidence is reviewed and approved.

## Phase 12 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_12_RBAC_AUTHORIZATION_SPEC.md`.
- Added `TenantRole` to app types.
- Extended `resolveAppTenantContext()` so authenticated Supabase requests carry membership role.
- Added `AppCapability`, `hasCapability()`, and `requireCapability()` in `auth-context.ts`.
- Added capability checks to Supabase-backed API routes before existing production actions.
- Owner/admin/dietitian keep current workflow access.
- Assistant/auditor are limited to `read_app_state` until client assignments and minimized auditor views are implemented.

### What Was NOT Done

- No client assignment model was added.
- No auditor minimized dashboard was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- auth-context -> 58/58 passed
app: npm run lint -> passed
```

### Next Correct Step For Codex

Proceed to client assignment and scoped access. Keep assistant/auditor mutation access blocked until that model exists.

## Phase 13 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_13_CLIENT_ASSIGNMENT_SCOPED_ACCESS_SPEC.md`.
- Added migration `app/supabase/migrations/20260525040000_client_assignments.sql`.
- Added `client_assignments` RLS coverage to `supabase-rls.integration.test.ts`.
- Added `scopeSupabaseState()` in `supabase-store.ts`.
- Added `supabase-store.test.ts` coverage for owner/admin, dietitian, assistant, and auditor scoping.
- Owner/admin see all tenant app-state records.
- Dietitians see owned plus assigned clients.
- Assistants see assigned clients only.
- Auditors receive no raw client/message/decision/handoff/notification records in app-state.

### What Was NOT Done

- No team-management or assignment UI was added.
- No minimized auditor dashboard was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 62/62 passed
app: npm run lint -> passed
app: npx supabase db push --local -> applied 20260525040000_client_assignments.sql
app: npm run test:rls -> 5/5 passed against local Supabase
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to DSAR, retention, and legal operations ledger. Keep assignment UI and minimized auditor dashboard as future work unless explicitly requested.

## Phase 14 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_14_DSAR_RETENTION_LEGAL_OPS_SPEC.md`.
- Added migration `app/supabase/migrations/20260525050000_data_requests.sql`.
- Added `DataRequestRecord` and `dataRequests` to `ManuAppState`.
- Fallback export now records a completed `export` data request and minimized `client_data_exported` audit event.
- Fallback anonymization now records a completed `anonymization` data request.
- Supabase export/anonymization paths persist `data_requests`.
- Client export bundles include target-client data request history.
- RLS integration covers `data_requests` tenant isolation.

### What Was NOT Done

- No automatic deletion scheduler was added.
- No final retention durations were set.
- No client-facing DSAR portal was added.
- No real WhatsApp, Telegram, Gemini, push/email provider, monitoring vendor, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 63/63 passed
app: npm run lint -> passed
app: npx supabase db push --local -> applied 20260525050000_data_requests.sql
app: npm run test:rls -> 5/5 passed against local Supabase
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Safe Observability and Operational Health. Keep deletion automation and final retention durations blocked until legal review.

## Phase 15 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_15_SAFE_OBSERVABILITY_OPERATIONAL_HEALTH_SPEC.md`.
- Created `docs/ERROR_MONITORING_POLICY.md`.
- Added `app/src/lib/operational-health.ts`.
- Added `app/src/lib/operational-health.test.ts`.
- Operational health snapshots now report aggregate counts for open/urgent handoffs, failed provider decisions, unread notifications, pending/stale drafts, passive clients, and launch-gate blocked state.
- Snapshot tests prove raw message, prompt, channel identifier, diet plan fragment, and secret-like values are not emitted.

### What Was NOT Done

- No dashboard UI was changed.
- No external monitoring, analytics, logging, email, push, WhatsApp, Telegram, Gemini, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -> 66/66 passed
app: npm run lint -> passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Channel Policy Simulation Hardening. Keep real WhatsApp/Telegram production webhooks blocked until policy review is approved.

## Phase 16 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_16_CHANNEL_POLICY_SIMULATION_HARDENING_SPEC.md`.
- Hardened `processMockChannelInbound()` in `app/src/lib/channel-adapters.ts`.
- Missing provider event ids now fail closed before client lookup, message creation, risk assessment, or AI decision creation.
- Empty channel bodies now fail closed and are marked idempotently processed by provider event id.
- Exact opt-out commands (`STOP`, `DUR`, `IPTAL`, `IPTAL ET`, `CANCEL`) update matched clients to `channelPermission = opted_out` without entering the AI path.
- Channel policy audit metadata records only safe booleans/reasons and excludes raw body text and raw channel identifiers.
- Added channel adapter tests for missing provider ids, empty bodies, opt-out handling, duplicate blocked events, and minimized audit metadata.

### What Was NOT Done

- No real WhatsApp or Telegram webhook was connected.
- No webhook signature verification was added.
- No outbound template registry or 24-hour service-window enforcement was added.
- No external monitoring, analytics, logging, email, push, Gemini, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- channel-adapters -> 70/70 passed
app: npm run lint -> passed
app: npm test -> 70/70 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Provider Policy Guard and Prompt Boundary. Keep real provider calls and real channel integrations blocked until external launch gates are approved.

## Phase 17 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_17_PROVIDER_POLICY_GUARD_PROMPT_BOUNDARY_SPEC.md`.
- Added `buildMockProviderInput()` in `app/src/lib/ai-provider.ts`.
- Added `assertMockProviderInputPolicy()` runtime guard in `app/src/lib/ai-provider.ts`.
- Mock provider input now allows only `risk` and `client.dietPlan.summary`.
- Runtime guard rejects prompt/capsule-style payloads, extra client fields, extra diet-plan fields, invalid summary types, and red-risk provider calls.
- Simulator provider calls now use the allowlisted input builder instead of passing the full client object.
- Provider policy violations are normalized as `provider_policy_violation` and become safe no-send simulator decisions.
- Added provider and simulator tests for allowlist construction, boundary rejection, red-risk defense, and controlled safe no-send behavior.

### What Was NOT Done

- No real Gemini or external LLM provider was connected.
- No core architecture prompt rewrite was done.
- No provider logging, analytics, monitoring, or prompt storage service was added.
- No real WhatsApp, Telegram, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm test -- ai-provider -> 74/74 passed
app: npm test -- simulator -> 75/75 passed
app: npm run lint -> passed
app: npm test -> 75/75 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Notification SLA and Internal Escalation. Keep external email/push/WhatsApp/Telegram notifications blocked until notification payload policy and launch gates are approved.

## Phase 18 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_18_NOTIFICATION_SLA_INTERNAL_ESCALATION_SPEC.md`.
- Added `app/src/lib/notification-sla.ts`.
- Added `app/src/lib/notification-sla.test.ts`.
- Defined local in-app acknowledgement SLA thresholds: 15 minutes for urgent handoff notifications and 4 hours for standard handoff notifications.
- SLA helper counts only unacknowledged notifications tied to open handoff cases.
- Notifications tied to resolved/missing handoffs are ignored.
- Urgent breached notifications are counted as internal escalation due.
- Operational health snapshots now include `breachedNotificationSlaCount` and `urgentEscalationDueCount`.
- Tests prove SLA output stays aggregate-only and does not expose raw message, channel, prompt, or secret-like content.

### What Was NOT Done

- No external email, push, WhatsApp, Telegram, SMS, APNs, FCM, monitoring, or analytics provider was connected.
- No on-call schedule, rota, or real escalation workflow was added.
- No dashboard UI was changed.
- No real health data was connected.

### Verification Commands

```text
app: npm test -- notification-sla -> 78/78 passed
app: npm test -- operational-health -> 78/78 passed
app: npm run lint -> passed
app: npm test -> 78/78 passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Proceed to Release Verification, CI Script, and Dependency Gate. Keep dependency remediation conservative and do not run breaking `npm audit fix --force`.

## Phase 19 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_19_RELEASE_VERIFICATION_DEPENDENCY_GATE_SPEC.md`.
- Added `app/scripts/release-verify.mjs`.
- Added `npm run release:verify` to `app/package.json`.
- Release verification runs core package tests, app lint, app unit/API tests, production build, and `npm audit --omit=dev --json`.
- Dependency gate allows only the documented R-405 production findings:
  - `next:postcss`
  - `postcss:GHSA-qx2v-qp2m-jg93`
- Unknown production audit findings fail closed.
- High or critical production audit findings fail closed.
- RLS and visual tests remain separate explicit commands because they depend on local Supabase/browser setup.
- Updated app README checks.

### What Was NOT Done

- No GitHub Actions or remote CI service was added.
- No dependency upgrade was applied.
- No `npm audit fix --force` was run.
- No canary Next.js version or npm override was added.
- No real providers, real channels, monitoring, analytics, or real health data was connected.

### Verification Commands

```text
app: npm run release:verify -> passed
core: npm test -> 35/35 passed inside release verification
app: npm test -> 78/78 passed inside release verification
app: npm audit --omit=dev --json -> known R-405 findings only
```

### Next Correct Step For Codex

Proceed to Pilot Readiness Evidence Pack. Keep R-405 open and production launch blocked until a safe stable Next.js/PostCSS patch path exists.

## Phase 20 Handoff Notes - 2026-05-25

Completed by: Codex

### What Was Done

- Created `docs/PHASE_20_PILOT_READINESS_EVIDENCE_PACK_SPEC.md`.
- Created `docs/PILOT_READINESS_EVIDENCE_PACK.md`.
- Mapped all eight production-pilot launch gates to internal evidence, remaining blockers, and open status.
- Recorded the latest release verification result:
  - Core package tests: 35/35 passed.
  - App tests: 78/78 passed.
  - App lint: passed.
  - Production build: passed.
  - Production dependency audit gate: known R-405 findings only.
- Evidence pack explicitly separates internal readiness evidence from external legal, clinical, provider, platform, security, and dependency approval.

### What Was NOT Done

- No launch gate was approved.
- No production pilot was declared ready.
- No real client health data was connected.
- No real WhatsApp, Telegram, Gemini, external LLM, email, push, monitoring, analytics, or secret manager was connected.
- R-405 was not resolved or accepted.

### Verification Commands

```text
app: npm run release:verify -> already passed in Phase 19 and recorded in the evidence pack
```

### Next Correct Step For Codex

Move from local pilot-foundation engineering to external approval work: legal/privacy, qualified dietitian taxonomy sign-off, provider/vendor review, WhatsApp/Telegram policy review, operational ownership, and R-405 resolution or formal acceptance.

## Phase 21 Handoff Notes - 2026-05-28

Completed by: Codex

### What Was Done

- Created `docs/PHASE_21_EXTERNAL_APPROVAL_DOSSIER_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`.
- Re-verified the local release baseline with `npm run release:verify`.
- Updated the pilot readiness evidence pack with the 2026-05-28 verification result.
- Updated planning and handoff docs so the next step is external approval evidence collection.
- Corrected the stale no-Git warning: the local Git repository exists and latest baseline is `66a8b94`.

### What Was NOT Done

- No launch gate was approved.
- No production pilot was declared ready.
- No real client health data was connected.
- No real WhatsApp, Telegram, Gemini, external LLM, email, push, monitoring, analytics, secret manager, or production secret was connected.
- No dependency upgrade, canary Next.js move, invalid npm override, or `npm audit fix --force` was applied.
- R-405 was not resolved or accepted.

### Verification Commands

```text
app: npm run release:verify -> passed
core: npm test -> 35/35 passed inside release verification
app: npm test -> 78/78 passed inside release verification
app: lint -> passed inside release verification
app: production build -> passed inside release verification
app: production dependency audit -> known R-405 findings only
```

### Next Correct Step For Codex

Collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Keep all gates open until the user supplies approval evidence, and keep real providers/channels/monitoring/secret manager/health data disconnected.

## Phase 22 Handoff Notes - 2026-05-28

Completed by: Codex

### What Was Done

- Created `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Re-checked current production audit output: only `next:postcss` and `postcss:GHSA-qx2v-qp2m-jg93` remain.
- Re-checked npm metadata:
  - `next@latest` is `16.2.6` and still depends on `postcss@8.4.31`.
  - `next@canary` is `16.3.0-canary.32` and depends on `postcss@8.5.10`, but canary remains rejected as pilot baseline.
- Documented the accepted stable patch procedure for updating `next` and `eslint-config-next` together once stable Next bundles `postcss >= 8.5.10`.
- Updated the risk register, evidence pack, production gate dossier, and planning docs to point to the Phase 22 procedure.

### What Was NOT Done

- No dependency files were changed because no safe stable patch path exists yet.
- No `npm audit fix --force` was run.
- No canary Next.js version, invalid npm override, or major downgrade was applied.
- R-405 was not resolved or accepted.
- No real provider, channel, monitoring, secret manager, email, push, or real health data was connected.

### Verification Commands

```text
app: npm audit --omit=dev --json -> known R-405 findings only
app: npm view next@latest version dependencies --json -> 16.2.6 with postcss 8.4.31
app: npm view next@canary version dependencies --json -> 16.3.0-canary.32 with postcss 8.5.10
```

### Next Correct Step For Codex

Do not edit dependency files until `next@latest` is a stable release that bundles `postcss >= 8.5.10`, or until the user supplies formal R-405 risk acceptance. When a stable patch exists, follow `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md` exactly and run `npm run release:verify`.

## Phase 26 Handoff Notes - 2026-05-30

Completed by: Codex

### What Was Done

- Read and implemented the user-supplied `new plan 2.pdf` as Phase 26.
- Created `docs/PHASE_26_INTERNAL_COPILOT_SPEC.md`.
- Added read-only internal copilot app-state records: `internalCopilotMessages`, `internalCopilotToolCalls`, and source refs.
- Added migration `app/supabase/migrations/20260530020000_phase_26_internal_copilot.sql` for `internal_copilot_messages` and `internal_copilot_tool_calls` with tenant-scoped RLS.
- Added deterministic local/mock internal copilot tools over scoped `ManuAppState`.
- Added `/api/internal-copilot/messages` and `internal_copilot_chat` capability.
- Owner/admin/dietitian can use the internal copilot; assistant/auditor are blocked in v1.
- Added Dashboard `Copilot` tab with quick prompts, source chips, and no send-to-client action.
- Added tests for intent mapping, ambiguous/hidden clients, grounded source refs, prompt-injection-as-data behavior, fallback API persistence, RBAC, and Supabase app-state scoping.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/DATA_INVENTORY.md`, `docs/AI_PROVIDER_REQUIREMENTS.md`, `docs/DATASET_STRATEGY.md`, and `docs/RISK_REGISTER.md`.

### What Was NOT Done

- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- No raw SQL or mutation tools were added.
- No production launch gate was approved.
- No dependency remediation or `npm audit fix --force` was attempted.

### Verification Commands

```text
core: npm test -> 39/39 passed
app: npm test -> 96/96 passed during implementation
app: npm run lint -> passed
app: npm run build -> passed
app: npm run release:verify -> passed
release verification: core tests 39/39, app tests 96/96, lint passed, production build passed, production dependency audit known R-405 findings only
```

### Next Correct Step For Codex

Collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Keep Phase 26 local/mock and read-only until a separate provider-egress, legal/vendor, security, and data-minimization review exists.

## Phase 27 Handoff Notes - 2026-05-30

Completed by: Codex

### What Was Done

- Created `docs/PHASE_27_DIETITIAN_CONTEXT_UPDATE_SPEC.md`.
- Added dietitian-entered client context update records for phone, Zoom, in-person, or other non-chat conversations.
- Added migration `app/supabase/migrations/20260530030000_phase_27_client_context_updates.sql`.
- Added `/api/clients/[id]/context-updates` using existing `update_client` capability.
- Added Dashboard Critical Context panel on the selected client detail surface.
- Active context updates increment `client.contextRevision`, invalidate pending AI drafts, and enter PromptContext as bounded `dietitian_context_update` segments.
- Newer `dietitian_manual` WhatsApp/Telegram/manual messages are authoritative over older Critical Context records through the latest dietitian-authored source rule.
- `ContextManifest` remains raw-text-free and current inbound message id is now preserved.
- Client export includes context updates; anonymization redacts them and marks affected records superseded.
- Updated `PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/DATA_INVENTORY.md`, `docs/DATASET_STRATEGY.md`, and `docs/RISK_REGISTER.md`.

### What Was NOT Done

- Old WhatsApp messages were not rewritten.
- No automatic diet plan or health-profile mutation was added.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- No production launch gate was approved.

### Verification Commands

```text
core: npm test -> 41/41 passed
app: npm test -> 99/99 passed during implementation
app: npm run lint -> passed
app: npm run build -> passed
```

### Next Correct Step For Codex

Run full `npm run release:verify` after any follow-up edits. Preserve Phase 23-27 context/send-safety, dynamic form, internal copilot, and dietitian context update boundaries before any real provider or channel integration.

## Phase 28 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Implemented the AI security remediation plan.
- Added `docs/PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md`.
- Added migration `app/supabase/migrations/20260530040000_ai_security_remediation.sql` with `ai_decisions.provider_attempted`, provider-status invariants, tenant-aware `client_channels` and `processed_inbound_events` uniqueness, RLS helper functions, and scoped RLS/RBAC policies.
- Core and app no-provider paths now use `providerAttempted=false`, `model=null`, `providerId=null`, and `providerStatus=not_called`.
- Actual mock-provider attempts now carry provider id/status/prompt metadata; only `MockProviderError` is normalized as provider failure.
- PromptContext now carries source id, origin, timestamp, and authority metadata, and marks the newest dietitian-authored source across manual messages and Critical Context updates as authoritative.
- Draft approve/edit-send now revalidates draft/decision state, context revision, channel permission, takeover lock, AI mode/status, latest promptable message id, and memory version/revision/staleness before sending.
- Provider input now uses a segment allowlist and rejects red risk, unknown/overlong segments, extra keys, raw prompt/capsule/message/profile payloads, and unsafe boundary shapes.
- Clinical golden cases now include typo/diacritic handling, English emergencies, medication dose requests, minor/body-image language, eating-disorder euphemisms, and pregnancy complications.
- App/core TypeScript declarations now expose concrete CoreResult, PromptContext, ContextManifest, provider-attempt, activation, and mode-decision types.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/DATA_INVENTORY.md`, `docs/AI_PROVIDER_REQUIREMENTS.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- No production launch gate was approved.
- R-405 was not remediated; it remains the documented dependency launch blocker.

### Verification Commands

```text
core: npm test -> 49/49 passed
app: npm test -> 103/103 passed
app: npm run lint -> passed
app: npm run build -> passed
app: npm run release:verify -> passed
app: npm run test:rls -> skipped unless local Supabase env is configured, or runs the expanded RLS suite when local Supabase is available
```

### Next Correct Step For Codex

Collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Preserve Phase 23-28 context/send-safety, provider boundary, draft revalidation, RLS/RBAC, dynamic form, internal copilot, and dietitian context update boundaries before any real provider or channel integration.

## Phase 29 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Created `docs/PHASE_29_PILOT_GATE_CLOSURE_EVIDENCE_HARDENING_SPEC.md`.
- Updated the production pilot gate closure dossier to use the Phase 27-29 baseline instead of stale Phase 21-26 wording.
- Updated the pilot readiness evidence pack with Phase 29 evidence hardening notes.
- Updated `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, and `docs/RISK_REGISTER.md`.
- Rechecked R-405 metadata: `next@latest` is still `16.2.6` with `postcss@8.4.31`; `eslint-config-next@latest` is still `16.2.6`.
- Recorded that the expanded RLS suite exists but the latest local evidence remains pending/skipped when local Supabase is unavailable.

### What Was NOT Done

- No runtime behavior was changed.
- No dependency files were changed.
- No R-405 remediation or acceptance was performed.
- No production launch gate was approved.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm run release:verify -> passed after clearing a stale .next build artifact lock
release verification: core tests 49/49, app tests 103/103, lint passed, production build passed, production dependency audit known R-405 findings only
app: npm run test:rls -> pending local Supabase availability; skip is environment evidence, not approval
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits, then collect external approval artifacts against `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`. Rerun `npm run test:rls` against local Supabase when available. Preserve Phase 23-29 context/send-safety, provider boundary, draft revalidation, evidence, RLS/RBAC, dynamic form, internal copilot, and dietitian context update boundaries before any real provider or channel integration.

## Completion Roadmap Phase 1 / Phase 30 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: surgical documentation-only change, spec before implementation, no speculative feature work.
- Created `docs/PHASE_30_COMPLETION_PHASE_1_CHECKPOINT_BASELINE_SPEC.md`.
- Confirmed the active branch is `codex/phase-29-baseline-checkpoint`.
- Confirmed the starting checkpoint is `c75564e Add Phase 27-29 pilot readiness checkpoint`.
- Updated `docs/NEXT_PHASE_EXECUTION_PLAN.md` and `PLAN.md` so the next active work is Completion Roadmap Phase 2: local Supabase RLS evidence completion.

### What Was NOT Done

- No runtime behavior was changed.
- No schema, dependency, provider, channel, launch-gate, or real-data changes were made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 and R-406 remain open.

### Verification Commands

```text
app: npm run release:verify -> passed
release verification: core tests 49/49, app tests 103/103, lint passed, production build passed, production dependency audit known R-405 findings only
```

### Next Correct Step For Codex

Run Completion Roadmap Phase 2 only: local Supabase RLS evidence completion. Do not start R-405 remediation, external gate collection, provider integration, channel integration, or production infrastructure work in the same command.

## Completion Roadmap Phase 2 / Phase 31 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: spec first, surgical evidence/docs-only change, no runtime behavior changes.
- Created `docs/PHASE_31_COMPLETION_PHASE_2_RLS_EVIDENCE_SPEC.md`.
- Confirmed the RLS integration guard skips non-local Supabase URLs unless `MANU_ALLOW_REMOTE_RLS_TESTS=true` is explicitly set.
- Confirmed `app/.env.local` is currently pointed at a cloud Supabase URL and must not be used as default RLS evidence input.
- Checked Supabase CLI availability: version `2.101.0`.
- Attempted to start local Supabase while redirecting output to avoid printing secrets.
- Ran `npm run test:rls`.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, `app/README.md`, and this handoff.

### What Was NOT Done

- No passing RLS evidence was produced.
- R-406 was not mitigated.
- No remote Supabase RLS tests were run.
- No runtime behavior, schema, dependency, provider, channel, launch-gate, or real-data changes were made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 was not remediated or accepted.

### Verification Commands

```text
app: npx supabase start -> failed because Docker Desktop Linux engine pipe was unavailable
app: npm run test:rls -> skipped 1 file and 10 tests
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Unblock Completion Roadmap Phase 2 only: start Docker Desktop with the Linux engine available, start local Supabase, point RLS test env to local Supabase without printing secrets, and rerun `npm run test:rls`. Update R-406 only after the expanded 10-test RLS suite passes locally.

## Completion Roadmap Phase 3 / Phase 32 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: re-read the governing spec before dependency work, kept the change surgical, and avoided speculative fixes.
- Created `docs/PHASE_32_COMPLETION_PHASE_3_R405_RECHECK_SPEC.md`.
- Re-read `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Ran `npm view next@latest version dependencies --json`.
- Ran `npm view eslint-config-next@latest version --json`.
- Ran `npm audit --omit=dev --json`.
- Confirmed `next@latest` is still `16.2.6`.
- Confirmed stable Next still depends on nested `postcss@8.4.31`.
- Confirmed `eslint-config-next@latest` is still `16.2.6`.
- Confirmed production audit still reports only the known R-405 moderate `next`/`postcss` findings and a rejected semver-major downgrade to `next@9.3.3`.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/RISK_REGISTER.md`, `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`, and this handoff.

### What Was NOT Done

- No dependency files were changed.
- No `npm audit fix --force` was run.
- No canary, beta, release-candidate, major downgrade, or npm override was applied.
- R-405 was not remediated or accepted.
- R-406 was not remediated.
- No runtime behavior, schema, provider, channel, launch-gate, or real-data changes were made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.

### Verification Commands

```text
app: npm view next@latest version dependencies --json -> 16.2.6 with postcss 8.4.31
app: npm view eslint-config-next@latest version --json -> 16.2.6
app: npm audit --omit=dev --json -> known R-405 findings only
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Do not edit dependency files until stable `next@latest` bundles `postcss >= 8.5.10`, or until the user supplies formal R-405 risk acceptance. Keep R-406 blocked until local Docker/Supabase is available and `npm run test:rls` passes locally.

## Completion Roadmap Phase 4 / Phase 33 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_33_COMPLETION_PHASE_4_EXTERNAL_APPROVAL_INTAKE_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`.
- Mapped all eight canonical production-pilot launch gate ids to required evidence, approval owner, acceptable artifact, status, evidence reference, and notes.
- Added explicit rules not to paste secrets, raw client health data, or real client identifiers into repository docs.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No launch gate was approved.
- No external approval artifact was supplied or recorded as accepted.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md` and `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md` when the user supplies external approval artifacts. Do not mark a gate approved unless every required evidence item for that gate is covered by an acceptable artifact.

## Completion Roadmap Phase 5 / Phase 34 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_34_COMPLETION_PHASE_5_LEGAL_PRIVACY_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md`.
- Mapped legal/privacy review questions to current internal evidence in data inventory, data governance, legal ops ledger, internal copilot, dietitian context updates, and AI security remediation.
- Listed missing counsel decisions for lawful basis, privacy notice, permission flow, medical-device/CDS classification, retention, DSAR/deletion, internal copilot records, dietitian context updates, provider dependency, and channel dependency.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, `docs/DATA_INVENTORY.md`, and this handoff.

### What Was NOT Done

- No legal/privacy approval artifact was supplied or accepted.
- No medical-device/CDS classification approval was supplied.
- No final client-facing legal copy was created.
- No final retention durations or DSAR/deletion SLA were approved.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> first build attempt hit transient Windows/OneDrive .next EPERM; after deleting app/.next, passed with core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_LEGAL_PRIVACY_REVIEW_PACKET.md` when the user supplies counsel feedback or legal/privacy approval artifacts. Do not mark `legal_privacy_review` approved unless all required legal/privacy evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 6 / Phase 35 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_35_COMPLETION_PHASE_6_CLINICAL_TAXONOMY_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md`.
- Summarized the current 16 JSONL clinical golden cases and their expected green/yellow/red behavior.
- Mapped internal evidence from `PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md`, `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, clinical golden cases, governance tests, safety classifier, and Phase 28 remediation.
- Listed missing qualified dietitian decisions for taxonomy scope, red escalation, yellow review, green routine behavior, minor/body-image handling, eating-disorder handling, medication/supplement/lab boundaries, pregnancy/glucose/allergy/emergency handling, coverage gaps, and approved taxonomy version.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, `docs/CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md`, and this handoff.

### What Was NOT Done

- No qualified dietitian approval artifact was supplied or accepted.
- No classifier behavior was changed.
- No clinical golden case was added or edited.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- No real Gemini/external LLM provider was connected.
- No real WhatsApp, Telegram, email, push, monitoring, analytics, secret manager, or real health data was connected.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_CLINICAL_TAXONOMY_REVIEW_PACKET.md` when the user supplies qualified dietitian feedback or clinical approval artifacts. Do not mark `clinical_taxonomy_approval` approved unless all required clinical evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 7 / Phase 36 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_36_COMPLETION_PHASE_7_PROVIDER_VENDOR_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md`.
- Mapped current local/mock provider controls to required vendor, retention, logging, training-use, region, access-control, incident-obligation, internal copilot egress, and dietitian context update egress decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/AI_PROVIDER_REQUIREMENTS.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No provider/vendor approval artifact was supplied or accepted.
- No real Gemini/external LLM provider was connected.
- No provider SDK, credential, environment variable, prompt/completion logging vendor, or secret manager was added.
- No internal copilot or dietitian context update provider egress was enabled.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_PROVIDER_VENDOR_REVIEW_PACKET.md` when the user supplies vendor/legal/security feedback or provider approval artifacts. Do not mark `provider_vendor_review` approved unless all required provider/vendor evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 8 / Phase 37 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_37_COMPLETION_PHASE_8_CHANNEL_POLICY_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md`.
- Mapped current mock WhatsApp/Telegram controls to required WhatsApp healthcare-use, Telegram bot/privacy, opt-in/out, template, service-window, webhook, delivery-status, account-quality, and fallback decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No channel policy approval artifact was supplied or accepted.
- No real WhatsApp Business Cloud API or Telegram Bot API integration was added.
- No webhook, channel credential, template registry, outbound send adapter, delivery-status adapter, or secret manager was added.
- No runtime behavior, schema, dependency, provider, channel integration, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_CHANNEL_POLICY_REVIEW_PACKET.md` when the user supplies WhatsApp/Telegram platform-policy feedback or approval artifacts. Do not mark `channel_policy_review` approved unless all required channel-policy evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 9 / Phase 38 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_38_COMPLETION_PHASE_9_INCIDENT_DSAR_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md`.
- Mapped the draft incident response runbook, DSAR/export/anonymization skeleton, legal ops ledger, and safe operational health evidence to required owner, escalation, notification, breach, DSAR/deletion, and re-enable decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No incident/DSAR approval artifact was supplied or accepted.
- No named production owner or backup owner was assigned.
- No monitoring, notification, ticketing, paging, email, push, WhatsApp, Telegram, analytics, or secret manager integration was added.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_INCIDENT_DSAR_REVIEW_PACKET.md` when the user supplies operations/legal/privacy/clinical feedback or approval artifacts. Do not mark `incident_response_runbook` approved unless all required incident and DSAR evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 10 / Phase 39 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_39_COMPLETION_PHASE_10_BACKUP_RESTORE_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md`.
- Mapped the draft backup/restore runbook to required provider, region, retention, restore-drill, encryption, legal-hold, tenant-isolation, RLS, data-governance, and drill evidence decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No backup/restore approval artifact or restore-drill evidence was supplied or accepted.
- No production backup provider, storage, secret manager, infrastructure, or restore environment was configured.
- No backup snapshot was created, restored, exported, imported, or destroyed.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_BACKUP_RESTORE_REVIEW_PACKET.md` when the user supplies operations/security/legal feedback, backup policy approval, or restore-drill evidence. Do not mark `backup_restore_test` approved unless all required backup/restore evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 11 / Phase 40 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to documentation/review readiness.
- Created `docs/PHASE_40_COMPLETION_PHASE_11_SECRET_ROTATION_REVIEW_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md`.
- Mapped the draft secret rotation runbook to required secret manager, inventory, owner, cadence, emergency revocation, break-glass, access-review, health-check, smoke-test, and evidence decisions.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No secret-rotation approval artifact, production secret manager, or rotation evidence was supplied or accepted.
- No real secret was created, printed, rotated, revoked, or stored.
- No CI/CD, provider, channel, Supabase, email, push, monitoring, backup/storage, deployment, or infrastructure credential was changed.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_SECRET_ROTATION_REVIEW_PACKET.md` when the user supplies security/operations feedback, secret manager approval, secret inventory, or rotation evidence. Do not mark `secret_rotation_plan` approved unless all required secret-rotation evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 12 / Phase 41 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: re-read the Phase 22 dependency remediation spec, wrote the Phase 41 spec before documentation updates, and avoided speculative dependency changes.
- Created `docs/PHASE_41_COMPLETION_PHASE_12_DEPENDENCY_AUDIT_CLEARANCE_PACKET_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md`.
- Ran `npm view next@latest version dependencies --json`: `next@latest` is `16.2.6` with nested `postcss@8.4.31`.
- Ran `npm view eslint-config-next@latest version --json`: `eslint-config-next@latest` is `16.2.6`.
- Ran `npm audit --omit=dev --json`: only known moderate R-405 `next`/`postcss` findings remain.
- Updated `PLAN.md`, `PROJECT_PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_EXTERNAL_APPROVAL_INTAKE.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/RISK_REGISTER.md`, and this handoff.

### What Was NOT Done

- No dependency files were changed.
- No `npm audit fix --force`, canary, beta, release-candidate, semver-major downgrade, or npm override was applied.
- No formal R-405 risk acceptance or dependency audit clearance artifact was supplied or accepted.
- No runtime behavior, schema, dependency, provider, channel, launch-gate approval, or real-data change was made.
- R-405 remains open.
- R-406 remains blocked.

### Verification Commands

```text
app: npm view next@latest version dependencies --json -> 16.2.6 with postcss 8.4.31
app: npm view eslint-config-next@latest version --json -> 16.2.6
app: npm audit --omit=dev --json -> known R-405 findings only
app: npm run release:verify -> passed; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Use `docs/PRODUCTION_PILOT_DEPENDENCY_AUDIT_CLEARANCE_PACKET.md` when the user supplies engineering/security dependency clearance, safe stable upgrade evidence, or formal R-405 risk acceptance. Do not mark `dependency_audit_clearance` approved unless all required dependency evidence items are covered by an acceptable artifact.

## Completion Roadmap Phase 13 / Phase 42 Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote the spec before the change and kept the work to final evidence consolidation.
- Created `docs/PHASE_42_COMPLETION_PHASE_13_FINAL_READINESS_CLOSURE_SPEC.md`.
- Created `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`.
- Recorded the current production-pilot decision as `NO-GO`.
- Confirmed all eight launch gates remain open.
- Confirmed R-405 remains open.
- Confirmed R-406 remains blocked.
- Confirmed no external approval artifacts were supplied during the completion roadmap.
- Updated `PLAN.md`, `app/README.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PILOT_READINESS_EVIDENCE_PACK.md`, and this handoff.

### What Was NOT Done

- No launch gate was approved.
- No external approval artifact was supplied or accepted.
- No dependency files were changed.
- No local Supabase RLS passing evidence was produced.
- No runtime behavior, schema, dependency, provider, channel, monitoring, secret manager, backup provider, R-405 acceptance, R-406 mitigation, or real-data change was made.

### Verification Commands

```text
app: npm run release:verify -> passed after clearing a transient .next EPERM build artifact; core tests 49/49, app tests 103/103, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Use `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md` as the current go/no-go source. Do not move toward production pilot until R-406 has passing local Supabase evidence, R-405 is resolved or formally accepted, and all eight launch gates have acceptable external approval artifacts.

## Phase 43 Multilingual Language Support Handoff Notes - 2026-05-31

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_43_MULTILINGUAL_LANGUAGE_SUPPORT_SPEC.md` before implementation.
- Added supported language codes `tr`, `en`, `de`, `fr`, `es`, `pt`, and `cs`.
- Added strict canonical E.164 phone identity handling for clients.
- Stored dietitian dashboard language, client communication language, form schema language, form response language, and submitted phone metadata in local state and Supabase schema.
- Updated fallback and Supabase stores plus API routes for client create/update, dietitian preferences, form schema create, and form response save.
- Added dashboard controls for dietitian UI language, client phone/language, and form language.
- Added a bounded `conversation_language` PromptContext segment and ContextManifest language metadata.
- Localized local/mock provider replies and safe handoff acknowledgements for all seven supported languages.
- Expanded multilingual safety patterns and clinical golden cases.

### What Was NOT Done

- No automatic translation was added.
- No public client-facing form link was added.
- No real WhatsApp, Telegram, Gemini/external LLM, translation API, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 107 tests
dietitian-ai-assistant: npm test -> passed; 52 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 107/107, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Keep the Phase 43 language model deterministic and internal until legal/privacy, clinical, provider/vendor, and channel policy gates are externally approved. Do not connect real translation/provider/channel services or mark production pilot approved from this work.

## Phase 44 Red-Risk Reactivation Lock Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_44_RED_RISK_REACTIVATION_LOCK_SPEC.md` before implementation.
- Added `ClientRecord.redRiskLock` and a Supabase `clients.red_risk_lock` JSONB migration.
- Red-risk handoffs now create a client-level lock, force `aiStatus=passive`, `aiMode=manual`, and `humanTakeoverLocked=true`, and audit `red_risk_lock_created`.
- While locked, direct AI reactivation, takeover release, normal handoff resolution, and red-locked handoff dismissal are rejected.
- Manual dietitian replies and notification read/acknowledge do not clear the red-risk lock.
- Added explicit resolve-and-reactivate state transition and `/api/handoffs/[id]/resolve-and-reactivate`.
- Added dashboard handoff controls for reactivation reason and target AI mode, defaulting to copilot.
- Added tests covering lock creation, non-unlocking paths, blocked direct reactivation/release/dismissal, explicit reactivation, and autopilot safety gating.

### What Was NOT Done

- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- No legal/privacy, clinical, provider/vendor, channel policy, dependency, or RLS approval artifact was supplied.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 112 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 112/112, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Continue with the user's remaining three-problem plan in order: Phase 45 should address client removal/anonymization lifecycle; Phase 46 should address WhatsApp group-message quarantine. Keep production pilot at `NO-GO` until all launch gates, R-405, and R-406 are closed with acceptable evidence.

## Phase 45 Client Removal Data Lifecycle Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_45_CLIENT_REMOVAL_DATA_LIFECYCLE_SPEC.md` before implementation.
- Added `ClientRecord.lifecycleStatus` and `removedAt`.
- Added Supabase migration `20260601010000_phase_45_client_removal_lifecycle.sql`.
- Added `/api/clients/[id]/remove` and dashboard `Remove client` action.
- Implemented removal as soft-delete/anonymization with `lifecycleStatus=removed_anonymized`.
- Removed clients are hidden from normal dashboard client lists and simulator selection.
- Removed clients are blocked from inbound simulation, manual replies, profile edits, form response save, and internal copilot tools.
- Removal redacts promptable health/profile data, phone/channel identity, rolling memory, message bodies/provenance, form response answers/submitted phone metadata, context updates, handoff text, notification text, AI decision details, risk assessment reasons, red-risk locks, and takeover state.
- Removal records a completed `deletion` data request and `client_removed_anonymized` audit event.
- Export remains available as a minimized legal/audit bundle.

### What Was NOT Done

- No hard-delete automation was added.
- No final retention duration was approved.
- No real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 114 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 114/114, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Continue with the user's remaining three-problem plan in order: Phase 46 should address WhatsApp group-message quarantine. Keep production pilot at `NO-GO` until all launch gates, R-405, and R-406 are closed with acceptable evidence.

## Phase 46 WhatsApp Group Quarantine Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_46_WHATSAPP_GROUP_QUARANTINE_SPEC.md` before completing the implementation.
- Added `InboundQuarantineRecord` and fallback state support for inbound quarantines.
- Added Supabase migration `20260601020000_phase_46_inbound_quarantine.sql`.
- Added simulator/API support for `sourceConversationType="group"` without requiring a client id.
- Group messages are quarantined before client lookup, risk classification, context assembly, provider calls, message storage, AI decisions, risk assessments, or handoffs.
- Quarantine records persist minimized metadata only and do not store raw group message text.
- Added `inbound_group_message_quarantined` audit events and scoped Supabase visibility for quarantine audit records.
- Duplicate group events remain idempotent through `processedSimulationKeys` / `processed_inbound_events`.

### What Was NOT Done

- No real WhatsApp group webhook, WhatsApp Business Cloud API, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, backup provider, or real client health data was connected.
- No production-pilot launch gate was approved.
- No WhatsApp/Telegram policy approval artifact was supplied.
- R-405 remains open.
- R-406 remains blocked pending passing local Supabase RLS evidence.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 117 tests
app: npm run release:verify -> passed; core tests 52/52, app tests 117/117, lint, production build, known R-405 only
app: npm run test:rls -> skipped; 1 file and 10 guarded tests because local Supabase evidence is still unavailable
```

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Keep production pilot at `NO-GO` until all launch gates, R-405, and R-406 are closed with acceptable evidence. Do not connect real WhatsApp/Telegram/provider traffic until the relevant external approvals are supplied.

## Phase 47 RLS Quarantine Evidence Coverage Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_47_RLS_QUARANTINE_EVIDENCE_SPEC.md` before implementation.
- Added explicit `inbound_quarantines` coverage to `app/src/lib/supabase-rls.integration.test.ts`.
- Added RLS fixtures for same-tenant and other-tenant quarantine rows.
- Added owner/member read, outsider block, assistant block, auditor block, and cross-tenant write assertions for quarantine rows.
- Added Supabase-backed group quarantine persistence coverage: group simulation writes quarantine + processed idempotency event and does not create messages, risk assessments, AI decisions, or handoffs.

### What Was NOT Done

- R-406 was not mitigated because the suite skipped without local Supabase.
- No real WhatsApp, Telegram, provider, monitoring, secret manager, backup provider, or real client health data was connected.

### Verification Commands

```text
app: npm run lint -> passed
app: npm run test -> passed; 16 files, 117 tests
app: npm run test:rls -> skipped; 1 file and 11 guarded tests because Docker Desktop's Linux engine is unavailable
```

## Phase 48 R-405 Stable Patch Recheck Handoff Notes - 2026-06-01

Completed by: Codex

### What Was Done

- Followed `docs/PHASE_22_R405_DEPENDENCY_REMEDIATION_SPEC.md`.
- Added `docs/PHASE_48_R405_STABLE_PATCH_RECHECK_SPEC.md`.
- Rechecked `next@latest`: `16.2.7` with nested `postcss@8.4.31`.
- Rechecked `eslint-config-next@latest`: `16.2.7`.
- Rechecked production audit: only known moderate `next`/`postcss` findings remain.
- Did not edit dependency files because stable Next still does not bundle `postcss >= 8.5.10`.

### What Was NOT Done

- R-405 was not resolved or accepted.
- No dependency files were changed.
- No `npm audit fix --force`, canary/beta/rc, invalid override, major downgrade, provider, channel, or real-data change was made.

### Next Correct Step For Codex

Run `npm run release:verify` after any follow-up edits. Keep R-406 blocked until Docker/local Supabase is available and the expanded 11-test RLS suite passes locally. Keep R-405 open until a safe stable Next.js/PostCSS patch path exists or formal external risk acceptance is supplied.

### Final Verification After Phase 47/48 Updates

```text
app: npm run release:verify -> passed; core tests 52/52, app tests 117/117, lint, production build, known R-405 only
```

## Phase 61 Scope Guard Second Layer Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Followed `codex.md`: wrote `docs/PHASE_61_SCOPE_GUARD_RAG_SECOND_LAYER_SPEC.md` before implementation.
- Added core `dietitian-ai-assistant/src/scope-guard.js` with `SCOPE_GUARD_VERSION=scope-rag-v0.1.0`, escalate-only `mergeScopeDecision`, and deterministic `applyScopeRules`.
- Added app modules: `scope-corpus.ts`, `scope-retrieval.ts`, `scope-evaluator.ts`, `scope-guard-runtime.ts`, `scope-guard-provider.ts`; wired `simulator-risk.ts` after clinical classification.
- Added Supabase migration `20260604000000_phase_61_scope_corpus.sql` for `scope_rules`, `scope_rule_chunks`, `scope_guard_evaluations` with tenant read / system write RLS.
- Added placeholder draft regulation rules (inactive until approved); operational-health corpus signals; launch-gate scope corpus evidence on `clinical_taxonomy_approval`.
- Updated continuity docs: `HANDOFF_FOR_NEXT_CODEX.md`, `PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `README.md`, `PROJECT_PLAN.md`, pilot evidence/gate docs, `docs/RISK_REGISTER.md` (R-310).

### What Was NOT Done

- Real Gemini/embedding or external LLM scope evaluator (disconnected; requires `clinical_taxonomy_approval` + `MANU_ALLOW_REAL_SCOPE_GUARD=true`).
- Approved production regulation corpus load (placeholder draft only).
- Phase 61 `scope_*` RLS re-run when local Supabase was unavailable.
- No launch gate approval; R-405 unchanged; production pilot remains `NO-GO`.

### Verification Commands

```text
dietitian-ai-assistant: npm test -> 112/112 passed
app: npm test -> 150/150 passed
app: npm run lint -> passed
app: npm run release:verify -> passed; only known R-405 findings
```

### Next Correct Step For Codex

Re-run `npm run test:rls` when Docker/local Supabase is available after applying Phase 61 migration. Load approved regulation corpus only after qualified dietitian clinical taxonomy sign-off. Keep real embedding/LLM disconnected until provider/vendor and clinical gates approve health-data egress.

## Phase 63 Production Pilot GO Rebaseline Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Added `docs/PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md`.
- Rebaselined production-pilot planning to WhatsApp-first, Gemini-only, up to 100 dietitians, and 50+ clients per dietitian.
- Recorded user-supplied dietitian/client forms as gated inputs requiring schema, privacy, prompt-allowlist, clinical, versioning, and migration review.
- Recorded user-supplied official health-regulation PDFs as gated inputs requiring source metadata, checksums, extraction QA, page/section references, approved derived rules, corpus versioning, and corpus golden-case tests before active routing.
- Updated continuity, pilot readiness, gate, final readiness, and risk documentation to keep production pilot `NO-GO` until the new evidence is supplied and accepted.

### What Was NOT Done

- No runtime code, schema, migration, dependency, provider, channel, monitoring, secret manager, approval, R-405 acceptance, or real-data change was made.
- No official PDF corpus, user form schema, legal/privacy artifact, clinical artifact, or launch-gate approval artifact was supplied.

### Verification Commands

```text
app: npm run release:verify -> passed; core tests 114/114, app tests 150/150, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 64 completed the structured launch-gate evidence engine. Implement the official PDF ingestion/corpus QA path next, then user-supplied form hardening after the user provides the required artifacts. Keep real WhatsApp/Gemini/client data disconnected until gates are approved.

## Phase 64 Structured Launch Gate Evidence Engine Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Added `docs/PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`.
- Added typed structured launch-gate evidence records and `evaluateProductionPilotLaunchGateEvidence`.
- Expanded legal/privacy and clinical required evidence with Phase 63 form and official PDF corpus requirements.
- Wired operational health to consume structured evidence.
- Hardened real scope-guard provider allowance: legacy approved id arrays alone cannot enable real scope-guard egress.
- Added tests for default blocked gates, partial evidence, unknown gate ids, stale/conditional/unsanitized evidence, full structured evidence, operational health structured evidence, and scope-guard provider gating.

### What Was NOT Done

- No persistence table or admin UI for evidence entry.
- No external approval artifact was supplied.
- No gate was closed.
- No official PDF ingestion, user form schema implementation, real provider, real channel, monitoring, secret manager, approval, R-405 acceptance, or real-data change was made.

### Verification Commands

```text
app: npm test -- launch-gates operational-health scope-guard-provider scope-guard-runtime -> passed; app tests 158/158
app: npm run release:verify -> passed; core tests 114/114, app tests 158/158, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 65 completed the official regulation PDF corpus QA foundation. Keep corpus activation blocked until the user supplies official PDFs and structured legal/clinical approval evidence.

## Phase 65 Official Regulation PDF Corpus QA Foundation Handoff Notes - 2026-06-04

Completed by: Codex

### What Was Done

- Added `docs/PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`.
- Added `app/src/lib/official-regulation-corpus.ts`.
- Added typed official PDF source metadata, page extraction, page/section reference, derived rule draft, and corpus golden-case contracts.
- Added fail-closed QA evaluation for missing metadata, invalid checksums, missing/failed page extraction, invalid section refs, unmapped derived-rule refs, and golden cases that reference unknown rules.
- Added draft scope-rule conversion only after QA passes; PDF-derived rules remain `draft` and inactive.
- Added clinical launch-gate evidence candidate construction that stays `draft` if QA fails.
- Extended `ScopeRuleRecord` with optional source refs for PDF-derived draft rules.

### What Was NOT Done

- No real PDF parser or OCR pipeline was connected.
- No raw PDF text or real official PDF file was stored in the repo.
- No Supabase persistence table or admin UI was added for corpus intake.
- No PDF corpus was approved.
- No launch gate was closed.
- No real provider, channel, monitoring, secret manager, approval, R-405 acceptance, or real-data path was connected.

### Verification Commands

```text
app: npm test -- official-regulation-corpus scope-corpus launch-gates -> passed; app tests 166/166
app: npm run release:verify -> passed; core tests 114/114, app tests 166/166, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 66 completed the product communication covenant lock, Phase 67 completed approved source answerability, and Phase 68 completed green intent taxonomy. Next correct step is Phase 69 Direct 5,000 Client Scale Foundation. Keep official corpus activation blocked until the user supplies official PDFs and structured legal/clinical launch-gate evidence approves the corpus.

## Phase 66 Product Communication Covenant Lock Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_66_PRODUCT_COMMUNICATION_COVENANT_LOCK_SPEC.md`.
- Added core `PRODUCT_COMMUNICATION_COVENANT_VERSION` and multilingual `detectProductCommunicationCovenantIssues`.
- Added a PromptContext covenant system instruction.
- Guarded provider output, mock provider output, and send-time draft approval against client-facing AI self-disclosure, AI limitation disclaimers, and doctor/dietitian/professional referral language.
- Changed yellow/red acknowledgement text to internal-only handling and blocked yellow/red AI drafts from becoming client-facing AI sends.
- Added tests proving covenant-violating green output is blocked and yellow/red paths do not create client-facing AI replies.

### What Was NOT Done

- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.
- No approved-source answerability, green-max taxonomy, 5,000-client scale rehearsal, user-supplied form hardening, official PDF ingestion, or external gate closure was implemented.

### Verification Commands

```text
core: npm test -> passed; core tests 116/116
app: npm test -- ai-provider simulator app-state-store -> passed; app tests 170/170
app: npm run release:verify -> passed; core tests 116/116, app tests 170/170, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 67 completed the approved source answerability engine, and Phase 68 completed green intent taxonomy. Next correct step is Phase 69 Direct 5,000 Client Scale Foundation. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## Phase 67 Approved Source Answerability Engine Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_67_APPROVED_SOURCE_ANSWERABILITY_ENGINE_SPEC.md`.
- Added core `APPROVED_SOURCE_ANSWERABILITY_VERSION` and `evaluateApprovedSourceAnswerability`.
- Added pre-provider green answerability gating in `handleInboundMessage`.
- Recorded answerability evidence in `contextManifest.answerability`.
- Treated active diet plan, prompt-allowed form summary, dietitian context updates, dietitian manual messages, pinned notes, allergies, and restricted foods as approved source categories.
- Excluded AI-generated messages from source authority.
- Added active diet plan field fallback when `dietPlan.summary` is empty.
- Added core and app simulator tests for source-backed green, missing source, AI-only source rejection, and dietitian manual source support.

### What Was NOT Done

- No Phase 69 direct 5,000-client scale rehearsal was implemented.
- No real Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.

### Verification Commands

```text
core: npm test -> passed; core tests 120/120
app: npm test -- simulator -> passed; app tests 171/171
app: npm run release:verify -> passed; core tests 120/120, app tests 171/171, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 68 was implemented after this handoff note. Next correct step is Phase 69 Direct 5,000 Client Scale Foundation from `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md`. Preserve Phase 66 covenant, Phase 67 approved-source answerability, and Phase 68 green intent taxonomy as hard gates. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## Phase 68 Green Maximization Intent Taxonomy Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_68_GREEN_MAXIMIZATION_INTENT_TAXONOMY_SPEC.md`.
- Added core `GREEN_INTENT_TAXONOMY_VERSION` and `evaluateGreenIntentTaxonomy`.
- Added pre-provider green intent taxonomy evaluation after approved-source answerability in `handleInboundMessage`.
- Recorded green intent evidence in `contextManifest.greenIntent`.
- Classified allowed green families such as plan lookup, allowed substitution, logistics, reminders, behavior support, progress logging, general education, context recap, and low-risk clarification.
- Blocked green-looking sensitive families such as calorie/macro/portion target changes, medication/supplement decisions, lab/symptom interpretation, active-plan conflicts, and emergency/sensitive contexts.
- Preserved monotonic safety: yellow/red decisions receive `not_applicable_non_green` metadata and are not downgraded.

### What Was NOT Done

- No Phase 69 direct 5,000-client scale rehearsal was implemented.
- No user-supplied form hardening, official PDF ingestion, Gemini, WhatsApp, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.

### Verification Commands

```text
core: npm test -> passed; core tests 122/122
app: npm test -- simulator -> passed; app tests 171/171
app: npm run release:verify -> passed; core tests 122/122, app tests 171/171, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Phase 69 was implemented after this handoff note. Next correct step is Phase 70 User-Supplied Form Hardening after the user supplies final dietitian/client forms. Preserve Phase 66 covenant, Phase 67 approved-source answerability, Phase 68 green intent taxonomy, and Phase 69 scale readiness evidence as hard gates. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.

## Phase 69 Direct 5,000 Client Scale Foundation Handoff Notes - 2026-06-05

Completed by: Codex

### What Was Done

- Added `docs/PHASE_69_DIRECT_5000_CLIENT_SCALE_FOUNDATION_SPEC.md`.
- Added `app/src/lib/direct-pilot-scale-readiness.ts`.
- Added synthetic direct-pilot fixture generation for 100 dietitians x 50 clients (5,000 clients).
- Added cursor pagination helper with limit caps and invalid cursor checks.
- Added direct-pilot scale readiness evaluation for fixture count, Phase 69 read contracts, and load/backpressure/idempotency evidence.
- Marked dashboard state, internal copilot tools, client create scaffold, and client AI/profile patch read contracts as `phase69_paginated_contract`.
- Added aggregate direct-pilot scale readiness fields to operational health without raw client/message/channel/provider content.
- Added app tests for fixture counts, active-client percentage, pagination windows, invalid inputs, read-contract status, readiness pass/fail, and aggregate-only operational health.

### What Was NOT Done

- No production UI pagination rewrite was implemented.
- No production Supabase migration was added.
- No real load-testing service, webhook replay, Gemini, WhatsApp, Telegram, monitoring, secret manager, launch-gate approval, R-405 acceptance, or real-data path was connected.
- No production pilot GO decision was made; production pilot remains `NO-GO`.

### Verification Commands

```text
core: npm test -> passed; core tests 122/122
app: npm test -> passed; app tests 176/176
app: npm run release:verify -> passed; core tests 122/122, app tests 176/176, lint, production build, known R-405 only
```

### Next Correct Step For Codex

Implement Phase 70 User-Supplied Form Hardening only after the user supplies final dietitian/client forms. If forms are not supplied, stop and ask for them instead of inventing production form schemas. Keep all real providers/channels, monitoring, secret manager, and real client health data disconnected.
