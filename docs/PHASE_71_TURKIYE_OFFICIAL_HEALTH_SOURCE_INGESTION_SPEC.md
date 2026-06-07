# Phase 71: Turkiye Official Health Source Ingestion Spec

Date: 2026-06-07

## Goal

Convert the user-supplied Turkiye official health source pack into a canonical local source manifest and fail-closed QA intake layer for the existing official regulation corpus workflow.

This phase does not download real PDFs, store raw PDF contents, approve any corpus, activate routing, connect Gemini/WhatsApp/monitoring/production Supabase, close launch gates, or process real health data.

## User Input Source

External package: `faz_71_istenilenler` (project-external working file, 2026-06-07).

## Scope

- Add a canonical Phase 71 Turkiye source manifest with P0/P1/P2 priority, official authority, title, jurisdiction, publication/version metadata, official URLs, suggested file names, critical sections, and green/yellow/red impact notes.
- Add a source-pack readiness evaluator that checks minimum Phase 71 source coverage without treating metadata as an approved corpus.
- Add a QA input builder that can merge the canonical manifest with externally supplied PDF artifact evidence:
  - SHA-256 checksum
  - byte size
  - page count
  - received timestamp
  - page extraction evidence
  - section references
  - derived rule drafts
  - corpus golden cases
- Keep the existing Phase 65 corpus QA contract as the authority for pass/fail.
- Ensure official source-derived rules remain draft-only until Phase 72 permission graph and external legal/clinical approval.

## Non-Goals

- No web download or PDF parser.
- No raw PDF text in git.
- No official corpus approval.
- No active scope/routing rule activation.
- No production Supabase migration.
- No external legal/privacy or clinical launch-gate approval.
- No production pilot GO.

## Edge Cases

- Metadata-only Phase 71 manifest must not pass corpus QA.
- Missing P0 source metadata blocks source-pack readiness.
- Duplicate source ids block source-pack readiness.
- Unknown artifact evidence source ids block corpus intake readiness.
- Missing checksum/page count/page extraction evidence keeps Phase 65 QA failed.
- QA-passing derived rules can only become draft scope rules.
- P1/P2 sources can be present without changing production routing.
- Production pilot remains `NO-GO` after Phase 71.

## Done Criteria

- Phase 71 Turkiye official source manifest is represented in code and test-covered.
- Metadata-only source pack fails closed for corpus QA.
- Complete synthetic artifact evidence can flow into Phase 65 QA and produce draft-only scope rules.
- Continuity and evidence docs record Phase 71 status.
- `npm run release:verify` passes with only documented R-405 findings.
