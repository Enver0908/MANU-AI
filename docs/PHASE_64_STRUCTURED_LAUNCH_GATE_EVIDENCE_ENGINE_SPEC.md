# Phase 64 Structured Launch Gate Evidence Engine Spec

Date: 2026-06-04

## Goal

Implement a structured launch-gate evidence engine so production-pilot gates cannot be treated as closed by a bare gate id alone.

This phase converts Phase 63's approval plan into testable local logic. It does not approve production pilot launch, connect WhatsApp, connect Gemini, process real client health data, accept R-405, or close any launch gate.

## Scope

- Add a typed `LaunchGateEvidenceRecord` model for sanitized approval references.
- Evaluate every production-pilot launch gate against required evidence coverage.
- Require owner, artifact title, sanitized reference, explicit approval status, approval date, and review cadence before a gate can close.
- Treat expired, stale, conditional, rejected, malformed, unknown, or incomplete evidence as blocking.
- Preserve the old raw `approvedLaunchGateIds` evaluator as a legacy compatibility helper, but keep structured evidence as the production-shaped path.
- Extend operational health so it can report open gates from structured evidence.
- Harden real scope-guard provider allowance so raw gate ids alone cannot enable real retrieval/evaluator use.

## Evidence Record Contract

Each evidence record must provide:

- `gateId`: known production-pilot launch gate id.
- `artifactTitle`: sanitized title.
- `artifactRef`: sanitized external storage/reference id, not raw file contents.
- `owner`: approving owner/reviewer.
- `approvalStatus`: `approved`, `conditional`, `rejected`, or `draft`.
- `approvedAt`: ISO timestamp for explicit approval.
- `reviewDueAt`: ISO timestamp for the next required review.
- `expiresAt`: optional ISO timestamp; if present, it must be in the future.
- `coveredEvidence`: exact required evidence item names covered by this artifact.
- `sanitizedReference`: must be `true`.

Multiple records may cover one gate. The gate closes only when the union of approved, valid, non-expired, sanitized records covers every required evidence item.

## Phase 63 Evidence Additions

The legal/privacy gate now requires:

- User-supplied dietitian/client form privacy and prompt-allowlist approval.
- Official PDF corpus handling decision.

The clinical taxonomy gate now requires:

- Approved official regulation PDF corpus version.
- Corpus golden-case report.
- User-supplied form clinical implication review.

## Edge Cases

- Unknown gate ids are ignored and reported.
- Unknown evidence item names do not satisfy required evidence.
- Duplicate records do not create extra coverage.
- `conditional`, `rejected`, and `draft` records do not close evidence items.
- Missing approval date, owner, title, artifact reference, review date, or sanitized-reference flag blocks the record.
- Future approval dates block the record.
- Past `reviewDueAt` or `expiresAt` blocks the record.
- A record for one gate cannot satisfy another gate.
- Raw client data, secrets, prompts, provider credentials, and full PDF content must not be stored in evidence records.

## Non-Goals

- No persistence table for gate evidence.
- No admin UI for approval entry.
- No official PDF ingestion implementation.
- No user form schema implementation.
- No real provider, channel, monitoring, secret manager, backup provider, or real-data processing.
- No production pilot `GO` decision.

## Done Criteria

- Structured launch-gate evidence evaluator is implemented and unit-tested.
- Operational health can consume structured evidence without exposing raw content.
- Real scope-guard provider allowance requires structured clinical/provider evidence plus explicit environment gating.
- Continuity docs record Phase 64 status and keep production pilot `NO-GO`.
- `npm run release:verify` passes with only documented R-405 findings.
