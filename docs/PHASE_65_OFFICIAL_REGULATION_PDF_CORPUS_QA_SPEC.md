# Phase 65 Official Regulation PDF Corpus QA Spec

Date: 2026-06-04

## Goal

Add the local foundation for ingesting user-supplied official health-regulation PDFs into a traceable regulation corpus QA workflow.

This phase does not parse real PDFs, store real PDF contents, approve the corpus, activate production routing, connect Gemini, connect WhatsApp, or close any launch gate. It defines the evidence contract that must be satisfied when the user supplies the official PDFs.

## Scope

- Add a typed official-regulation corpus QA module.
- Require source metadata for every PDF: title, jurisdiction, publisher, source URL/reference, file name, SHA-256 checksum, byte size, page count, and received timestamp.
- Require page-level extraction evidence without storing raw PDF text in repo fixtures.
- Require page/section references for every derived rule draft.
- Require corpus golden cases that map to derived rule ids and source references.
- Allow QA-passing derived rules to become draft `ScopeRuleRecord` entries only; they are not approved or active.
- Build a clinical launch-gate evidence candidate only when corpus QA passes and an external clinical approval record is supplied.

## Evidence Contract

Each PDF source must provide:

- Sanitized source id.
- Official title, jurisdiction, and publisher.
- Sanitized URL/reference or external source locator.
- File name.
- SHA-256 checksum.
- Byte size.
- Page count.
- Received timestamp.

Each page extraction record must provide:

- Source id.
- Page number.
- Extraction status.
- Text hash and character count when extraction succeeds.
- Extraction timestamp.

Each derived corpus rule must provide:

- Rule id, title, body, language, escalation level, version, and creation timestamp.
- At least one mapped source section reference.
- Page start/end references that fit inside the source page count.

Each corpus golden case must provide:

- Synthetic test input only.
- Expected risk level.
- Expected matched derived rule ids.
- Source references.

## Edge Cases

- Missing source metadata blocks QA.
- Invalid checksum blocks QA.
- Missing page extraction evidence blocks QA.
- Failed extraction blocks QA.
- Missing or out-of-range section references block QA.
- Derived rules without mapped page/section references block QA.
- Golden cases that reference unknown derived rules block QA.
- QA failure prevents derived scope-rule draft construction.
- QA success still creates draft rules only; clinical approval remains external.
- Launch-gate evidence remains draft if QA fails, even if an approval-shaped object is supplied.

## Non-Goals

- No real PDF parser.
- No raw PDF storage in git.
- No Supabase persistence table or admin UI for corpus intake.
- No active production corpus load.
- No clinical taxonomy launch-gate approval.
- No legal/privacy launch-gate approval.
- No real provider, channel, monitoring, secret manager, or real client data path.

## Done Criteria

- Official-regulation corpus QA module is implemented and unit-tested.
- QA-passing derived rules can be converted to draft scope rules with page/section source references.
- QA-failing corpora fail closed.
- Clinical launch-gate evidence for the PDF corpus cannot become approved without both QA pass and external approval metadata.
- Continuity docs record Phase 65 and keep production pilot `NO-GO`.
- `npm run release:verify` passes with only documented R-405 findings.
