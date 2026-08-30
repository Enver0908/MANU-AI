# Production Readiness Stage 1 Phase 2 Evidence

Date: 2026-08-30

Status: `PHASE_2_LOCAL_COMPLETE`

## Scope

This evidence records Phase 2 of **Birinci Asama: Canli Hesaplari Beklemeden
Teknik Hazirlik**: manual bank-transfer entitlement, access expiry, and
Stripe-less onboarding.

Implemented scope:

- Manual bank-transfer entitlement path for Turkey-first sales operations.
- Stripe remains supported and unchanged; no fake Stripe customer, subscription, session, or event id is generated for manual payments.
- Physical iPhone Safari/PWA validation remains `WAIVED_NOT_EXECUTED` under the permanent owner waiver.
- Production remains `NO-GO`.
- No real payment processor, real bank integration, deploy, remote migration, production schema rollout, or real client health-data path was executed.

## Code Changes

- Extended `TenantEntitlement` with `billingMethod`, `paidThrough`, and `revision`.
- Added `manual_transfer` as a first-class billing method while preserving the existing Stripe fields and Stripe transition model.
- Added fail-closed expiry evaluation: active manual entitlements require a valid future `paidThrough`; `now >= paidThrough` blocks dashboard/API/PWA access.
- Added `/api/commercial/admin/manual-entitlements` for allowlist-session-only manual activation and renewal.
- Added `manual_entitlement_operations` as a service-role-only idempotency ledger with unique `request_id` and unique `payment_reference`.
- Added `apply_manual_entitlement_operation` database RPC so invite provisioning, entitlement update, invite consumption, idempotency write, and admin audit write run in one database transaction.
- Added Stripe-less onboarding claim support via `{ inviteId }`; existing `{ sessionId }` checkout claim remains supported.
- Added ambiguous-claim rejection when both `sessionId` and `inviteId` are supplied.
- Added a minimal admin UI form for manual bank-transfer activation/renewal.
- Added manual entitlement audit event types: `manual_entitlement_activated` and `manual_entitlement_renewed`.

## Verification

Executed from `app/`:

```text
npm run typecheck
```

Result: passed.

```text
npx vitest run src/lib/phase-83b-commercial-entitlement-model.test.ts src/lib/phase-83f-commercial-admin.test.ts src/lib/phase-83g-entitlement-hardening.test.ts src/lib/phase-84e-customer-onboarding.test.ts src/lib/manual-entitlements-migration-contract.test.ts --no-file-parallelism --maxWorkers=1
```

Result: passed, 5 test files, 38 tests.

```text
npm run lint
```

Result: passed with 0 errors and the pre-existing 77 warnings.

## Current Decision

`PHASE_2_LOCAL_COMPLETE` is a local technical preparation result only. It does not close external production launch gates and does not authorize live bank integration, real provider/channel egress, production deploy, remote schema rollout, or real client health-data processing.
