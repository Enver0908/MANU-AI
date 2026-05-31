# Phase 30 Completion Roadmap Phase 1 - Checkpoint And Baseline Spec

Date: 2026-05-31

## Scope

This phase implements Phase 1 of the 13-phase MANU-AI completion roadmap: checkpoint and baseline stabilization.

It does not add runtime behavior, change schemas, change dependencies, approve launch gates, connect real providers or channels, or process real client health data.

## Baseline

- Branch: `codex/phase-29-baseline-checkpoint`.
- Starting checkpoint: `c75564e Add Phase 27-29 pilot readiness checkpoint`.
- Working tree at phase start: clean.
- Current local verification baseline before this phase: `npm run release:verify` passed after Phase 29.
- R-405 remains open.
- R-406 remains open until `npm run test:rls` is rerun against local Supabase.

## Success Criteria

- The Phase 27-29 checkpoint is explicitly documented as the current implementation baseline.
- The next phase starts from a named branch and checkpoint rather than an ambiguous working tree.
- Documentation states that no real WhatsApp, Telegram, Gemini/external LLM, email, push, monitoring, secret manager, or real client health data is connected.
- `npm run release:verify` passes after the documentation update.

## Verification

Run from `app`:

```text
npm run release:verify
```

Expected result:

- Core tests: 49/49 passing.
- App tests: 103/103 passing.
- Lint passing.
- Production build passing.
- Production dependency audit passing with only known R-405 findings.

Latest result on 2026-05-31:

- `npm run release:verify` passed.
- Core tests: 49/49 passed.
- App tests: 103/103 passed.
- Lint passed.
- Production build passed.
- Production dependency audit passed with only known R-405 findings.

## Next Phase

Phase 2 of the 13-phase roadmap is Local Supabase RLS Evidence Completion. It should rerun `npm run test:rls` against local Supabase and update R-406/evidence docs based on the result.
