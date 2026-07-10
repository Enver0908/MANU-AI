# P85-IF-C Secure Ingress And Routing Remediation Evidence

Date: 2026-07-10
Status: Complete
Deployment: None
Next track: P85-IF-D

## Scope

This evidence records the post-commit audit and remediation of P85-IF-C against the canonical plan and specification. It does not add P85-IF-D transcript/human-control behavior, wire the engine into the live webhook route, or enable any real provider, channel, billing, monitoring, backup, secret-manager, or health-data path.

## Findings Closed

- The committed routing test ended in a truncated string and missing closing braces. The recovered worktree completion was validated and retained.
- Business App echoes and business-human history used the business-side `from` identity as the counterparty. They now resolve the client from provider `to` evidence.
- Account resolution accepted partial identifier matches and did not fully fail closed on conflicting WABA/business-phone evidence, inactive/unverified/non-mock bindings, or tenant mismatch.
- Client, conversation, and exact-dietitian assignment checks were incomplete; actor/client identity overlap and cross-tenant duplicate phone cases were not fully test-locked.
- Quarantine records discarded a successfully resolved account binding for downstream client failures.
- Successful replay changed only the event status. It now requires explicit authorization, validates event identity, respects expiry, transitions the same event idempotently, records replay audit evidence, and executes the existing client inbound path exactly once when applicable.
- Newly stored client inbound messages lacked canonical provider-account/message and actor provenance. The C ingress path now enriches the created client message without changing the existing orchestrator.
- Invalid provider timestamps fell back to observed time but were not explicitly flagged. The normalizer now emits an invalid-time flag that is preserved in audit metadata.
- Reused provider event IDs were treated as ordinary duplicates even when payload digests differed. Digest conflicts now create dedicated audit evidence, and replay requires both event identity and digest continuity.

## Verification

- Targeted P85-IF-C Vitest: 40/40 passed across normalizer, routing, and ledger suites.
- Full app Vitest: 780 passed, 4 skipped, 0 failed across 125 files.
- Core package tests: 225/225 passed.
- App lint: 0 errors; 3 pre-existing warnings unchanged.
- Production build: passed, including TypeScript and 49 static-page generation steps.
- Full mock channel replay rehearsal: passed.
- `git diff --check`: clean apart from repository-wide CRLF conversion warnings.
- No migration or RLS contract changed, so a new RLS run was not required; R-406 current environment re-run remains pending.
- No UI changed, so visual verification was not required.

## Remaining Boundaries

- Business-human echoes remain ledger-only in P85-IF-C. Persisting them as verified `dietitian_manual`, auto-pausing AI, invalidating stale work, and opening/joining human-control sessions remain P85-IF-D.
- The additive ingress engine remains disconnected from the live `/api/whatsapp/webhook` route.
- Production pilot remains `NO-GO`; R-405 remains open; R-406 current RLS re-run remains pending.
