# Phase 74: Data Lifecycle, Export, Anonymization and DSAR Spec

Date: 2026-06-07

## Goal

Convert the user-supplied Phase 74 retention, export, anonymization, hard delete, and DSAR preference pack into canonical local policy artifacts, a testable export contract, and a transactional redaction contract that excludes removed clients from prompt, provider, simulator, internal copilot, and channel paths.

This phase does not approve legal/privacy counsel review, connect production Supabase, connect Gemini/WhatsApp/monitoring, close launch gates, close R-405, or process real health data.

## User Input Source

External package: `faz_74_istenilenler` (project-external working file, 2026-06-07).

## Scope

- Add canonical Phase 74 retention policy table and summary constants.
- Add export format contract with manifest, included/excluded categories, and checksum metadata.
- Add DSAR/deletion SLA policy records.
- Add transactional redaction field contract and minimized evidence schema.
- Add immediate operational removal requirements.
- Add `applyPhase74TransactionalRedactionInState` with draft invalidation and invariant evaluation.
- Standardize redaction marker to `REDACTED_BY_PHASE74_POLICY`.
- Keep policy artifacts at `approvalStatus: draft` until external legal/privacy approval.

## Non-Goals

- No production Supabase transactional RPC migration.
- No real backup restore replay automation.
- No legal opinion replacement.
- No production pilot GO.

## Edge Cases

- Partial redaction states fail closed.
- Removed/anonymized clients cannot enter simulator, internal copilot, prompt context, or outbound automation paths.
- Pending drafts are invalidated during transactional redaction.
- Export excludes secrets, raw provider prompts/completions, other tenants/clients, and internal system prompts.
- Raw webhook payloads are not retained in production policy defaults.
- Production pilot remains `NO-GO` after Phase 74.

## Done Criteria

- Retention, export, DSAR SLA, and redaction artifacts are represented in code and test-covered.
- Export manifest contract is testable with checksum metadata.
- Transactional redaction enforces operational exclusion invariants.
- Continuity and evidence docs record Phase 74 status.
- `npm run release:verify` passes with only documented R-405 findings.
