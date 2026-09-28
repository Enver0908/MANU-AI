# codex.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For ordinary multi-step coding tasks, state a brief execution plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

For Phase 85-style implementation work, keep planning explicit but lightweight: a clear Markdown action plan or spec, scoped phases, acceptance checks, evidence notes, and user approval before major execution or closure.

---

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

##  5.

-Code should always be clean, readable, well-commented, and testable.
-Keep the file structure minimal. Avoid creating unnecessary folders/subfolders.
-Write a PRD/tech spec before implementing any new feature or change.
-Map edge cases in detail and add them either to this file or to separate spec files.
-Prefer JSONL format for datasets (especially for fine-tuning).
-After every successful implementation phase, reconcile only the documentation whose authority, next-action guidance, risk posture, production gate status, or handoff instructions actually changed. For ordinary product phases this usually includes the phase spec/evidence and, when affected, `HANDOFF_FOR_NEXT_CODEX.md`, `PLAN.md`, `docs/NEXT_PHASE_EXECUTION_PLAN.md`, `README.md`, `PROJECT_PLAN.md`, `app/README.md`, and `docs/RISK_REGISTER.md`. Update pilot evidence/gate docs (`docs/PILOT_READINESS_EVIDENCE_PACK.md`, `docs/PRODUCTION_PILOT_GATE_CLOSURE_DOSSIER.md`, `docs/PRODUCTION_PILOT_FINAL_READINESS_CLOSURE_SUMMARY.md`, relevant review packets) only when production readiness, launch gates, external approvals, or pilot evidence actually changed.

##  6.

-Don’t fight errors! Whenever you encounter the same error twice, research the web and find 3-5 possible ways to fix it. Then choose the most efficient solution and implement it

## 7. Resumable phase execution

- Long-running phases must use `tools/phase-execution/checkpoint-store.mjs` and an ordered phase descriptor. Commit one durable event at every verified work-unit boundary; do not keep recoverable progress only in process memory or a final evidence file.
- A checkpoint may reuse work only when the phase schema, source, fixture, migration, dependency, artifact, and harness identities match. Changed identity blocks silent merge; never reset, delete, or overwrite the previous run.
- A measurement round is atomic only when every required scenario in that round is complete and valid. Interrupted attempts remain in the configured attempt budget. Preparation, stale, skipped, simulated, and blocked results are never official PASS samples.
- Pause requests must be safe-boundary requests. External side effects require a receipt or explicit reconciliation before retry. Credentials, cookies, tokens, raw bodies, clinical data, and device serials must not enter checkpoint or evidence files.
- Historical phases are not retrofitted automatically. New phases must adopt the shared descriptor/template and add focused interruption, identity-mismatch, lock, redaction, and recovery tests.



