# MANU-AI Production Pilot Clinical Taxonomy Review Packet

Date: 2026-06-03

## Status

This packet prepares the `clinical_taxonomy_approval` launch gate for qualified dietitian review.

It does not approve production pilot launch, approve the clinical taxonomy, provide medical advice, or change MANU-AI behavior.

No real WhatsApp, Telegram, Gemini, external LLM provider, email, push, monitoring, analytics, secret manager, or real client health data is connected.

## Review Objective

A qualified dietitian must review whether the current dietetic risk taxonomy, escalation behavior, golden test set, and production clinical safety evaluation approach are acceptable for a supervised production pilot.

Phase 59 added local-only hardening for numeric glucose thresholds in glucose-context messages and expanded multilingual single-message symptom patterns. Phase 60 narrowed glucose anchors to reduce false positives, deduplicated red reasons, and bumped the classifier to `dietetic-risk-v0.3.1`. Phase 61 added mock-first scope guard (`scope-rag-v0.1.0`) with placeholder draft regulation corpus, escalate-only merge, and disconnected real embedding/LLM until this gate approves corpus + production evaluation approach. Phase 63 requires the user-supplied official health-regulation PDFs to become a traceable, extracted, page/section-referenced, reviewed, approved, versioned, and golden-tested corpus before any active production routing. This packet remains a review artifact, not an approval record.

The deterministic/regex safety classifier is a local first barrier. It must not be accepted as the sole production clinical safety layer without an approved second-layer or equivalent fail-closed safety evaluation mechanism.

The review must cover:

- Red/yellow/green risk definitions and examples.
- Escalation and handoff behavior.
- Provider no-call behavior for red cases.
- Review-gated draft behavior for yellow cases.
- Routine response behavior for green cases.
- Persona safety invariants.
- Coverage gaps requiring new golden cases before pilot.
- Whether the production safety approach includes an approved second-layer or equivalent fail-closed evaluation beyond deterministic/regex matching.
- Whether the official regulation PDF corpus and derived green/yellow/red routing rules are clinically acceptable.

## Internal Evidence Available

| Evidence area | Internal artifact | What it supports | What it does not approve |
| --- | --- | --- | --- |
| Clinical governance spec | `PHASE_6_CLINICAL_GOVERNANCE_EVALUATION_SPEC.md` | Taxonomy scope, non-goals, done criteria, edge cases | Qualified dietitian sign-off |
| Review workflow | `CLINICAL_TAXONOMY_REVIEW_WORKFLOW.md` | Required review process and launch gate rule | Pilot approval |
| Golden cases | `dietitian-ai-assistant/tests/clinical-golden-cases.jsonl` | 30 expected clinical routing examples (`dietetic-risk-v0.3.1`) | Completeness of real-world clinical coverage |
| Governance tests | `dietitian-ai-assistant/tests/clinical-governance.test.mjs` | Risk/action/model/providerAttempted assertions and persona invariants | Clinical correctness beyond tested cases |
| Safety classifier | `dietitian-ai-assistant/src/safety-classifier.js` | Current risk classification implementation | Clinical approval |
| Clinical safety second layer | `dietitian-ai-assistant/src/clinical-safety-second-layer.js`, `dietitian-ai-assistant/tests/clinical-second-layer-cases.jsonl` | Local deterministic context-sensitive yellow escalation evidence above the regex classifier | Qualified dietitian approval or production sufficiency |
| Phase 28 remediation | `PHASE_28_AI_SECURITY_REMEDIATION_SPEC.md` | Expanded clinical golden coverage, provider-attempt semantics, no-call audit behavior | Qualified dietitian approval |
| Phase 63 rebaseline | `PHASE_63_PRODUCTION_PILOT_GO_REBASELINE_SPEC.md` | Required official PDF corpus ingestion, traceability, approval, and corpus golden-case evidence before active production routing | Approval of any unsupplied PDF, derived rule, or routing behavior |
| Phase 64 evidence engine | `PHASE_64_STRUCTURED_LAUNCH_GATE_EVIDENCE_ENGINE_SPEC.md`, `app/src/lib/launch-gates.ts` | Structured evidence coverage, review cadence, expiry, and sanitized reference checks before this gate can be treated as closed | Qualified dietitian approval or supplied clinical artifact |
| Phase 65 official PDF corpus QA | `PHASE_65_OFFICIAL_REGULATION_PDF_CORPUS_QA_SPEC.md`, `app/src/lib/official-regulation-corpus.ts` | Source metadata, checksum, page extraction evidence, page/section references, derived rule drafts, corpus version, and corpus golden-case QA before PDF-derived rules can become draft corpus rules | Qualified dietitian approval, legal/privacy handling decision, or active corpus approval |

## Current Golden Case Summary

| Risk | Cases | Expected behavior |
| --- | --- | --- |
| Green | Routine meal swap; diacritic/typo routine swap | Autopilot may send after quality guard with `gemini-1.5-flash` in the local/mock path |
| Yellow | Supplement dose, lab interpretation, diagnosed condition, minor/body-image rapid weight loss, minor/body-image typo/body-check language | Draft for dietitian approval with `gemini-3` in the local/mock path |
| Red | Allergy breathing issue, English emergency, glucose crisis, medication dose change, self-harm, eating-disorder purging, eating-disorder euphemism, pregnancy complication in Turkish and English | Handoff, no provider call, `model=null`, `providerAttempted=false` |

## Required Qualified Dietitian Decisions

| Decision | Required output | Current status |
| --- | --- | --- |
| Taxonomy scope | Sign-off that current red/yellow/green categories are acceptable for supervised pilot use | Not supplied |
| Red escalation behavior | Sign-off that red cases correctly block provider calls and route to human handoff | Not supplied |
| Yellow review behavior | Sign-off that yellow cases are appropriate for draft-only review and never auto-send | Not supplied |
| Green routine behavior | Sign-off that current green examples are sufficiently routine for guarded autopilot behavior | Not supplied |
| Minor/body-image handling | Sign-off or requested changes for adolescent rapid weight-loss/body-image language | Not supplied |
| Eating-disorder handling | Sign-off or requested changes for purging/euphemism escalation | Not supplied |
| Medication/supplement/lab boundaries | Sign-off or requested changes for dose, lab, diagnosed-condition routing | Not supplied |
| Pregnancy/glucose/allergy/emergency handling | Sign-off or requested changes for red emergency boundaries | Not supplied |
| Production safety evaluation layer | Sign-off or requested changes for the second-layer or equivalent fail-closed safety evaluation approach beyond deterministic/regex matching | Not supplied |
| Official regulation PDF corpus | Sign-off on official PDF source list, extraction QA, page/section references, derived routing rules, corpus version, and corpus golden-case report after Phase 65 QA passes | Not supplied |
| User-supplied form clinical implications | Sign-off or requested changes for any clinical routing or prompt context implications created by user-supplied dietitian/client forms | Not supplied |
| Coverage gaps | List of missing clinical scenarios requiring new JSONL golden cases | Not supplied |
| Taxonomy version | Approved taxonomy version and dated review record | Not supplied |

## Review Checklist

1. Review every row in `clinical-golden-cases.jsonl`.
2. Confirm expected `risk`, `action`, `model`, and `providerCallExpected` values.
3. Confirm red cases never call a provider.
4. Confirm yellow cases require dietitian review.
5. Confirm persona changes do not alter safety routing.
6. Confirm the production safety approach does not rely on deterministic/regex matching as the sole clinical safety layer.
7. Review official regulation PDF source metadata, extraction QA, page/section references, derived routing rules, corpus version, and corpus golden-case report once supplied.
8. Review clinical implications of user-supplied dietitian/client form fields once supplied.
9. Identify missing scenarios that must be added before pilot.
10. Record approved taxonomy version or requested changes.

## Current Technical Controls

- Red-risk flows create handoff and do not call the provider.
- Yellow-risk flows become review drafts.
- The current deterministic/regex classifier is a local first barrier and requires a qualified-review-approved second-layer or equivalent fail-closed safety evaluation before production pilot launch.
- Phase 56 adds local deterministic second-layer evidence for otherwise-green allergy/restriction mentions, ambiguous clinical references, missing-history references, minor weight/restriction context, and eating-disorder-sensitive ambiguous restriction language.
- Green-risk flows remain subject to AI activation, mode, permission, takeover, context, and quality guard checks.
- Personas affect communication style only and do not change clinical routing in the golden tests.
- Provider-attempt metadata distinguishes actual provider attempts from no-call safety/control paths.
- Send-time draft revalidation protects against stale context, permission changes, takeover lock, AI mode/status changes, and memory state changes.

## Missing Before Gate Closure

- Signed qualified dietitian approval artifact.
- Approved taxonomy version.
- Approved or updated golden test set.
- Approved official regulation PDF corpus version, derived routing rules, page/section reference map, and corpus golden-case report.
- Clinical review of user-supplied dietitian/client form fields and any prompt/routing implications.
- Approved second-layer or equivalent fail-closed clinical safety evaluation approach beyond deterministic/regex matching.
- Explicit list of accepted clinical coverage gaps or required additions.
- Confirmation that yellow/red escalation language is operationally acceptable.
- R-405 resolution or formal acceptance.
- R-406 passing local Supabase RLS evidence.

## Sanitization Rules

Do not paste these into this packet:

- Real client messages.
- Real client identifiers.
- Medical records, lab reports, prescriptions, or images.
- Provider payloads or secrets.

Use synthetic or de-identified review examples only.

## Non-Approval Statement

The `clinical_taxonomy_approval` launch gate remains open. This packet is ready for qualified dietitian review, but it is not an approval record.
