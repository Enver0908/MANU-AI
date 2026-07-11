# P85-IF-R3 Atomic AI Activation And Race Evidence

Date: 2026-07-11
Track: P85-IF-R3 post-closure remediation
Status: complete
Production pilot: `NO-GO`

## Finding

The earlier R3 implementation made activation atomic, but a post-closure audit found a lock-order inversion: activation locked client rows before conversation rows, while inbound expected-revision checks could lock conversation rows first and later touch client state. That left deadlock risk under activation versus inbound, red-risk, or verified human-echo races.

## Fix

Append-only migration `app/supabase/migrations/20260711202000_phase_85_if_postclosure_r3_lock_order.sql` replaces `p85_if_r3_assert_expected_conversation_revisions` so it locks affected client rows first in deterministic order and then locks conversation rows in deterministic order. This aligns the expected-revision guard with atomic activation.

## Verification

- Local Supabase reset applied the lock-order migration successfully.
- RLS/integration suite passed 30/30.
- New race tests cover activation versus inbound commit, activation versus red-risk commit, and activation versus verified human-echo commit. Each scenario completes without deadlock and exactly one state-changing path wins.
- Unified production-scale rehearsal passed after the change.

## Closure

R3 is closed for the audited activation/inbound/red-risk/human-echo race surface. Production pilot remains `NO-GO`; real channels and providers remain disabled.
