# Production Readiness Stage 1 Phase 3 Evidence

Date: 2026-08-30

Status: `PHASE_3_LOCAL_COMPLETE`

## Scope

This evidence records Phase 3 of **Birinci Asama: Canli Hesaplari Beklemeden
Teknik Hazirlik**: real WhatsApp account, ingress, and delivery code readiness.

Implemented scope:

- Real WhatsApp webhook verification is prepared behind `MANU_WHATSAPP_REAL_WEBHOOK_ENABLED`.
- Meta webhook challenge handling validates `hub.mode`, `hub.verify_token`, and `hub.challenge`.
- POST ingress verifies `X-Hub-Signature-256` against the raw request body before JSON parsing.
- Valid real webhook events are normalized and must be durably enqueued before a success response.
- Unknown account selectors are ignored without storing message content.
- Durable ingress jobs store only encrypted payload candidates with explicit AAD and key version.
- One active real WhatsApp number per tenant is enforced at the database index level.
- Real WhatsApp credentials have a separate service-role-only encrypted storage contract.
- Delivery records now separate `realProviderMessageId` from the existing mock provider id and add explicit execution, retry, and unknown-state fields.
- Ambiguous network outcomes move to `unknown` and are not auto-retried.
- Definite temporary provider failures are capped at three retries.

Out of scope:

- No Meta account was connected.
- No live webhook subscription was configured.
- No production deploy, remote migration, production schema rollout, or real client health-data processing was executed.
- Physical iPhone Safari/PWA validation remains `WAIVED_NOT_EXECUTED`, not `PASS`.
- Production remains `NO-GO`.

## Code Changes

- Added `app/src/lib/whatsapp-real-contracts.ts` for challenge verification, raw-body HMAC verification, normalized event admission, delivery-state monotonicity, and retry policy.
- Added `app/src/lib/whatsapp-real-crypto.ts` for AES-256-GCM server payload encryption using an environment-provided master key.
- Added `app/src/lib/whatsapp-real-store.ts` to resolve active real WhatsApp bindings and call the service-role ingress enqueue RPC.
- Updated `/api/whatsapp/webhook` so real mode and mock mode are isolated behind separate gates.
- Extended `ChannelDeliveryRecord` and Supabase mappers with real provider delivery identity and retry metadata while preserving existing mock behavior.
- Added migration `20260830190000_production_readiness_stage_1_phase_3_whatsapp_real_contracts.sql`.
- Added contract tests for real WhatsApp verification/retry behavior and migration safety properties.

## External Reference Check

Meta's WhatsApp webhook documentation confirms the GET challenge flow and `X-Hub-Signature-256` signature header requirement. The implementation follows those mechanics locally but does not configure a live webhook.

## Verification

Executed from `app/`:

```text
npx vitest run src/lib/whatsapp-real-contracts.test.ts src/lib/whatsapp-real-migration-contract.test.ts --no-file-parallelism --maxWorkers=1
```

Result: passed, 2 test files, 9 tests.

```text
npm run typecheck
```

Result: passed.

```text
npx vitest run src/lib/phase-77ac-whatsapp-mock-webhook.test.ts src/lib/phase-85-stage-4b3-canonical-ingress.test.ts src/lib/whatsapp-real-contracts.test.ts src/lib/whatsapp-real-migration-contract.test.ts --no-file-parallelism --maxWorkers=1
```

Result: passed, 4 test files, 28 tests.

```text
npx vitest run src/lib/phase-77ae-outbound-delivery-ledger.test.ts src/lib/phase-77af-adapter-operational-health-rollback.test.ts --no-file-parallelism --maxWorkers=1
```

Result: passed, 2 test files, 12 tests.

```text
npm run lint
```

Result: passed with 0 errors and the pre-existing 77 warnings.

## Current Decision

`PHASE_3_LOCAL_COMPLETE` is code and migration preparation only. It does not authorize real WhatsApp traffic, real client messaging, production deploy, production schema rollout, or production `GO`.
