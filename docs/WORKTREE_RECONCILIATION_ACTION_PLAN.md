# MANU-AI Worktree Reconciliation Action Plan

## Active authority

This document governs the recovery and reconciliation of the current working
tree. It does not alter historical performance measurements, finding
dispositions, production decisions, or previously recorded run identities.

The active execution source is:

```text
C:\Users\Dell\OneDrive\Masaüstü\MANU-AI
branch: codex/production-readiness-stage-1
HEAD: a2b1e0908b29ece40c797aa9c0a5dda0bbb6513a
```

The recovered source is snapshot commit
`e52d7b48a234dbf5e83f6ff836cc7c7640b97e3d`, whose parent is the active HEAD.
The former `38c0` directory is not a working source. The recovery preserves
the pre-existing dirty state in the external recovery manifest identified by
the companion evidence record.

## Reconciliation rules

- Existing user changes remain recoverable and are not discarded.
- Snapshot content is used to restore missing diagnostic, runner, test,
  checkpoint, runtime, and evidence files.
- Historical evidence remains immutable in meaning. A recovered file is not a
  newly measured result.
- The manifest must point to real evidence files and real run identities.
- Production remains `NO-GO`; no live provider, channel, billing, worker,
  production migration, secret, or real clinical data path is opened.
- Diagnostic and experiment controls remain disabled by default.
- The repository may remain dirty after reconciliation; cleanliness is not a
  completion condition.

## Completed recovery work

1. Recorded the initial Git status and working-tree diff outside the
   repository.
2. Compared the current tree with snapshot commit
   `e52d7b48a234dbf5e83f6ff836cc7c7640b97e3d` using the common parent.
3. Recovered 123 changed source, runtime, test, document, migration, and
   evidence paths from the snapshot.
4. Excluded two unrelated temporary PDF-render images from recovery.
5. Updated active source references from the unavailable historical worktree
   to the current main checkout.
6. Added the current reconciliation pointer to the finding manifest.

## Required verification

- Validate every recovered runner, test, evidence reference, import, package
  script, and checkpoint dependency.
- Reconcile active handoff, next-phase, risk, umbrella-plan, Plan 1, manifest,
  production, system-audit, hosted, PWA, and clinical-AI authority records.
- Preserve historical wording in historical sections while removing stale
  active-source instructions.
- Run focused recovery and checkpoint tests, affected application tests,
  clinical-AI tests, typecheck, lint, build, redaction checks, and
  `git diff --check`.
- Write final evidence with every passed, skipped, failed, and blocked check.

## Completion rule

The reconciliation may close only when the current source, recovered files,
manifest pointers, active documents, test surface, and risk posture agree. A
missing source file, unresolved active reference, invalid hash, failed required
check, or unexplained sensitive-data match keeps the evidence status partial or
blocked. Completion does not claim that the application performance problem is
solved.

## Reconciliation result - 2026-09-18

The content recovery and active-authority reconciliation completed successfully.
All 123 recovered paths are present, 33 relevant JSON files parse
successfully, the Plan 1 closure pointer resolves to the recorded Phase 5.7
evidence, and the active-source scan has no stale execution instruction. The
recovery evidence records the preserved dirty state and the two intentionally
excluded temporary images.

Validation passed for the checkpoint suite, recovered Phase 4 and Phase 5
runner contracts, application tests, clinical-AI tests, typecheck, build, and
redaction-sensitive test coverage. Lint completed with zero errors and 79
existing warnings. `git diff --check` completed without whitespace errors and
reported only line-ending normalization warnings. The application performance
issue remains undiagnosed and production remains `NO-GO`.

## Supplemental audit - 2026-09-18

The supplemental audit is recorded in
`docs/WORKTREE_RECONCILIATION_20260918T163307Z_SUPPLEMENTAL_AUDIT.json` as
`COMPLETE / SUPPLEMENTAL_AUDIT_RECORDED_WITH_EVIDENCE_GAPS`. It adds
path-level recovery decisions and confirms 123/123 recovered paths are
present, 117 match the snapshot hash, and the six non-matching paths are the
expected active authority documents.

This supplement narrows the reconciliation claim in two ways. First, the
pre-reconciliation dirty state is preserved in the external recovery backup
and manifest, but the active tree is not byte-identical to that backup: 2/44
backed-up paths still match and 42/44 differ after recovery and authority
document updates. Second, the reference and sensitive-pattern scans are scoped
metadata checks with expected false positives; they do not prove that every
historical document is clean. These limitations do not reopen recovered source
integrity, but they remain explicit evidence boundaries before any performance
or production decision.
