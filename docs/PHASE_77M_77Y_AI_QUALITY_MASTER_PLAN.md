# Phase 77M-77Y AI Quality Master Plan

Date: 2026-06-13

## Purpose

This document records the next canonical implementation track before any WhatsApp production adapter work. The goal is to make MANU-AI a stronger dietitian assistant for client replies by improving answer planning, grounding, style fidelity, food understanding, and deterministic evaluation while preserving the existing green/yellow/red risk model.

This plan does not approve production pilot launch, connect WhatsApp, connect Telegram, connect Gemini or any real external LLM provider, process real client health data, close any launch gate, accept R-405, or resolve R-405.

## Locked Product Boundaries

- Client-visible risk classes remain only `green`, `yellow`, and `red`.
- Internal workflow states such as `unknown_intent`, `needs_label`, `needs_review`, `clarify`, `handoff`, and `block` are not new client-visible warning classes.
- Unknown intent must not be treated as safe green clarification; later phases must route it fail-closed to copilot, clarify, draft, or handoff rather than autopilot send.
- The product goal remains safe green maximization: expand the number of genuinely green, source-backed questions MANU-AI can answer well, without forcing ambiguous, unsupported, label-missing, or clinically risky messages into green.
- Personas and dietitian voice affect wording, tone, length, emoji policy, and response timing style only. They never change clinical safety, source authority, Food Decision V2, or green/yellow/red routing.
- Production pilot status remains `NO-GO`.
- R-405 remains open.
- Real provider, channel, WhatsApp, Telegram, Gemini, monitoring, secret-manager, and real-data paths remain disconnected.

## Phase Numbering Decision

The AI quality program is numbered Phase 77M-77Y because `docs/DIRECT_100_DIETITIAN_COMPLETION_PLAN.md` already reserves later roadmap phases:

- Phase 77: Production Observability And Operations.
- Phase 78: Dependency And R-405 Closure.
- Phase 79: Full 100x50 Synthetic Rehearsal.
- Phase 80: External Launch Gate Closure.
- Phase 81: Direct Production Pilot GO.

Using Phase 77M-77Y avoids collision while keeping this track immediately after Phase 77L and before the deferred WhatsApp production adapter.

Superseded planning note: an alternate Phase 78A-M AI-quality numbering is not used. Phase 78 through Phase 81 remain reserved for dependency/R-405 closure, full rehearsal, external launch-gate closure, and direct production GO.

## Canonical Architecture Decisions

- `responsePlan` is produced in the core runtime after answerability and before provider/generation.
- App simulator, future WhatsApp adapter, and future provider gates must consume the same `responsePlan` path; client-facing rendering must not bypass it.
- `claimManifest` is generated from `responsePlan`, deterministic templates, source references, and dietitian-authored/manual source authority. It is not extracted from free LLM output.
- Output guards verify that rendered text did not add claims outside the manifest.
- Deterministic templates are implemented before or alongside claim grounding.
- A single canonical intent resolver feeds green taxonomy, answerability, Food Decision V2 alignment, and response planning.
- Shared text normalization must build on the existing `normalize-safety-text.js`; do not add another independent normalizer.
- Any new persisted model or data category must include fallback store support, Supabase migration/RLS, export/redaction/DSAR coverage, and compatibility handling in the same phase.
- New datasets must use JSONL.
- Every new module must expose a version constant and that version must be reflected in merged decision/reporting evidence where relevant.

## Phase 77M: Master Rebaseline And Spec

Status: Completed 2026-06-13.

Goal: create this master plan, update continuity documents, and lock the AI quality track before runtime work.

Phase spec: `docs/PHASE_77M_MASTER_REBASELINE_AND_SPEC.md`.

Implementation intent:

- Record Phase 77M-77Y as the next implementation track before WhatsApp adapter.
- Record that green/yellow/red remain the only external risk classes.
- Record core-owned `responsePlan`, deterministic templates, and manifest-first grounding.
- Record that internal workflow states are operational states, not new warning categories.
- Record fail-closed unknown-intent handling for later runtime phases.
- Record `normalize-safety-text.js` as the single shared normalization source to extend.

Done criteria:

- This master plan and the Phase 77M spec exist.
- Continuity and roadmap docs reference Phase 77N as next and defer WhatsApp adapter until Phase 77M-77Y is complete.
- Production pilot remains `NO-GO`.
- R-405 remains open.

## Phase 77N: Canonical Intent Understanding V2

Status: Completed 2026-06-13.

Goal: reduce fragmented intent handling and improve green question coverage safely.

Phase spec: `docs/PHASE_77N_CANONICAL_INTENT_UNDERSTANDING_V2_SPEC.md`.

Implementation intent:

- Add one canonical intent resolver consumed by green taxonomy, answerability, Food Decision V2 alignment, and response planning.
- Intent precedence: sensitive/clinical signals, Food Decision V2 query type, explicit green family, then `unknown_intent`.
- Unknown intent must not silently become allowed green.
- Add negation and portion fixtures, including "I cannot have X, can I have Y?" and "one slice or two slices?" style cases.

Done criteria:

- Unknown intent golden cases route to internal clarify, draft, or handoff, not autopilot send.
- Intent family is consistent across all layers for the same input.
- Sensitive signals override green-looking intent.

## Phase 77O: Response Plan Contract V1

Status: Completed 2026-06-13.

Goal: make every client-facing draft pass through a structured response plan.

Phase spec: `docs/PHASE_77O_RESPONSE_PLAN_CONTRACT_V1_SPEC.md`.

Implementation intent:

- Produce `responsePlan` in core after answerability and before provider/generation.
- Include version, risk class, intent family, reply mode, template id, source references, Food Decision V2 summary, client message plan, and internal reason.
- Map internal reply modes explicitly to current send/draft/handoff/block behavior.
- Update provider boundary allowlists for bounded `response_plan`, `claim_manifest`, and `style_dna` segments.
- Keep raw labels, raw client data, and internal metadata out of provider prompts.

Done criteria:

- App simulator cannot produce client-facing text without responsePlan.
- Provider boundary tests accept new bounded segments and reject raw leakage.

## Phase 77P: Deterministic Template Library V1

Goal: create safe, predictable client-message structures before LLM styling.

Implementation intent:

- Add templates for allowed food answer, portion clarification, label/ingredient request, forbidden/discouraged food response, source-unsupported answer, yellow/red internal routing, and unknown-intent clarification.
- Ensure `needs_label` creates a written ingredient request instead of echoing the diet plan.
- Ensure `clarify` does not leak clinical claims or internal metadata.

Done criteria:

- Template id is required for client-facing draft generation.
- Golden cases prove label requests, clarify replies, and forbidden-food replies are deterministic and source-bound.

## Phase 77Q: Claim Manifest And Output Grounding V1

Goal: prevent LLM or styling from adding unsupported nutrition claims.

Implementation intent:

- Generate `claimManifest` from responsePlan, template, sourceRefs, and manual source authorities.
- Output guard blocks any rendered text that adds a clinical/nutrition claim outside the manifest.
- Track hard-zero metric `claim_outside_manifest_count`.

Done criteria:

- Every client-facing draft includes a complete claim manifest.
- Manifest-outside-claim tests block deterministically.
- Claim authority is never derived from free LLM text.

## Phase 77R: Food Understanding V3

Goal: expand safe green food coverage without guessing ingredients or brands.

Implementation intent:

- Make alias dictionaries versioned, checksum-backed, tenant-safe, and QA-gated.
- Autopilot can use only exact or dietitian-approved aliases.
- Packaged/brand products remain `needs_label` unless trusted ingredient evidence is supplied.
- Mixed dish decomposition is allowed only when Menu Plan V1 has dietitian-authored recipe ingredients.
- Recipe-less mixed dishes route to internal review.

Done criteria:

- Alias false-match golden tests pass.
- Brand products without ingredient evidence route to label request.
- Recipe-less mixed dishes do not get ingredient guesses.

## Phase 77S: Dietitian Voice Engine V2

Goal: improve personalized style without allowing style to affect clinical decisions.

Implementation intent:

- Add scoped `styleDna` for dietitian/tenant voice behavior.
- Include sentence length, greeting style, warmth, formality, emoji policy, boundary phrasing, and response timing style.
- Add edit-history learning lifecycle for AI draft, dietitian final, and diff metadata.
- Do not learn client-identifying text.
- Run candidate style phrases through product communication covenant checks.
- If persisted, add fallback store, Supabase migration/RLS, export/redaction/DSAR in the same phase.

Done criteria:

- Style poisoning tests prove style cannot alter clinical/source/food decisions.
- Hard style guard violations remain zero.
- Soft style mismatch is measured, not a hard safety zero.

## Phase 77T: AI Quality Evaluation Harness V1

Goal: make AI quality measurable before channel work.

Implementation intent:

- Store AI quality datasets as JSONL.
- Add a deterministic release subset of about 100 cases to `release:verify`.
- Add full rehearsal command `npm run rehearse:ai` for at least 1000 synthetic cases.
- Assert responsePlan, intent family, reply mode, template id, claim manifest, sourceRefs, and decision reason rather than fuzzy rendered wording.
- Include multi-turn `pendingClarification` and `awaitingLabel` cases.
- Include prompt-injection and metadata-leak adversarial cases.

Done criteria:

- Release subset is fast and deterministic.
- Full rehearsal runs separately with mock provider only.
- Internal metadata never appears in client text.

## Phase 77U: Clinical Red-Team And RD Review Packet

Goal: prepare dietitian-reviewable evidence for AI quality without closing production gates.

Implementation intent:

- Build a review packet covering safe green, unknown intent, forbidden food, brand/label, mixed dish, yellow/red, and style examples.
- Include red-team cases for eating-disorder signals, pregnancy, diabetes, renal/cardiac hints, supplements/medications, symptoms, and client pressure.

Done criteria:

- `unsafe_client_send_count = 0`.
- `yellow_red_client_send_count = 0`.
- RD review packet is evidence only and does not close the clinical gate.

## Phase 77V: Copilot Quality Workflow V1

Goal: make dietitian review more useful while keeping internal metadata internal.

Implementation intent:

- Show responsePlan summary, sourceRefs, claimManifest, block/handoff reason, and suggested edit focus only in internal dietitian surfaces.
- Client export and client-facing text must exclude raw responsePlan, raw claimManifest, block reason, and style metadata.
- Dietitian edits can inform style learning but cannot mutate source authority or clinical decisions.

Done criteria:

- Client export leak tests pass.
- Copilot metadata appears only on internal surfaces.

## Phase 77W: Narrow Autopilot Eligibility V2

Status: Implemented locally; production pilot remains NO-GO. Verified 2026-06-14.

Implementation intent:

- Autopilot eligibility is deterministic and not score/confidence based.
- Eligible cases require explicit supported green intent, low risk, source-backed answerability, exact/approved food alias or source match, complete manifest, no output-guard violation, and no pending clarification or label request.
- Ineligible cases include unknown intent, brand without label, mixed dish without recipe, sensitive hints, source conflict, missing template, or claim outside manifest.

Done criteria:

- Narrow autopilot works only on supported golden paths.
- Ambiguous cases route to draft, clarify, or handoff.

## Phase 77X: Expanded 100x50 AI Rehearsal And Risk Register

Status: Implemented locally; production pilot remains NO-GO. Verified 2026-06-14.

Implementation intent:

- Run expanded 100 synthetic dietitians x 50 client-message quality rehearsal.
- Add operational health fields for AI quality status, responsePlan version, claim grounding version, styleDna version, narrow autopilot readiness, unsafe send count, responsePlan pass rate, claim grounding pass rate, and narrow autopilot eligible count.
- Update risk register for responsePlan-output contradiction, template drift, styleDna poisoning, alias false-match blast radius, and version/reporting drift.

Hard-zero gates:

- `unsafe_client_send_count = 0`
- `source_unsupported_green_count = 0`
- `forbidden_food_approval_count = 0`
- `yellow_red_client_send_count = 0`
- `claim_outside_manifest_count = 0`

Measured threshold:

- `style_soft_mismatch_rate` remains under the documented threshold.

## Phase 77Y: Continuity, Evidence, And Launch Gate Update

Status: Implemented locally; production pilot remains NO-GO. Verified 2026-06-14.

Done criteria:

- Continuity docs agree on next action order (WhatsApp production adapter next).
- Production pilot remains `NO-GO`.
- R-405 remains open.

## Required Verification Per Implementation Phase

Each implementation phase must:

- Start with a PRD/tech spec or update this master spec if the phase is documentation-only.
- Avoid unnecessary refactor.
- Preserve user changes.
- Use `apply_patch` for manual edits.
- Run `git diff --check`.
- Run app tests.
- Run `npm run release:verify`.
- Stage and commit only that phase when verification passes.

