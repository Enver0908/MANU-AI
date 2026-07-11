# P85-IF-R1 Persistence Tenant Integrity Evidence

Date: 2026-07-11
Track: P85-IF-R1 post-closure remediation
Status: complete
Production pilot: `NO-GO`

## Finding

The R1 persistence remediation was not complete for message provenance. The earlier tenant-integrity migration covered several interstage tables, but `messages` could still reference cross-tenant conversation, dietitian, AI decision, source message, provider account binding, or actor binding rows unless application code behaved perfectly.

## Fix

Append-only migration `app/supabase/migrations/20260711200000_phase_85_if_postclosure_r1_message_tenant_integrity.sql` now:

- preflights existing rows and fails migration if cross-tenant message provenance exists;
- preflights actor bindings for account and dietitian tenant mismatch;
- adds tenant-composite foreign keys from `messages` to conversations, dietitians, AI decisions, source messages, channel account bindings, and channel actor bindings;
- adds tenant-composite foreign keys from actor bindings to account bindings and dietitians.

## Verification

- Local Supabase reset applied the migration successfully.
- RLS/integration suite passed 30/30, including a cross-tenant message provenance rejection.
- The migration is append-only and does not enable any real provider or channel path.

## Closure

R1 tenant persistence is closed for the audited message-provenance surface. Production pilot remains `NO-GO`; R-405 remains open.
