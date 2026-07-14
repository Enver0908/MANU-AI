# Phase 85 Stage 4B-3 - Phase 10 Canonical Mock Webhook, Local Worker, and Visual Simulator Evidence

Date: 2026-07-14

## Scope

Phase 10 unifies `/api/whatsapp/webhook` on the P85-IF batch normalizer/ledger, enforces the mock webhook secret gate, adds `runSupabaseSecureWhatsAppIngress`, introduces the local media worker command, and wires the dashboard visual simulator (multipart image, caption, burst messages, injected 120s silence flush). Production pilot remains `NO-GO`; R-405 remains open; no real Meta/Gemini egress.

## Files Added

- `app/src/lib/phase-85-stage-4b3-fallback-media-registry.ts` — singleton in-memory mock media registry
- `app/src/lib/phase-85-stage-4b3-canonical-ingress.ts` — secret extraction, demo bindings, canonical batch wrapper, worker tick, payload builders, webhook result mapping
- `app/src/lib/phase-85-stage-4b3-visual-simulator.ts` — fixture/upload visual simulation with burst + silence flush
- `app/src/app/api/simulator/visual/route.ts` — multipart visual simulator endpoint
- `app/scripts/worker-media-stage4b3.mjs` — local worker poll script
- `app/src/lib/phase-85-stage-4b3-local-worker-runner.test.ts` — one-shot worker tick runner for the CLI
- `app/src/lib/phase-85-stage-4b3-canonical-ingress.test.ts` — canonical ingress, webhook route, visual simulator, worker tick tests

## Files Updated

- `app/src/app/api/whatsapp/webhook/route.ts` — secret header/body gate, canonical fallback + Supabase secure ingress
- `app/src/lib/whatsapp-mock-webhook.ts` — delegates to canonical ingress (legacy normalizer path removed from active webhook)
- `app/src/lib/supabase-store.ts` — `runSupabaseSecureWhatsAppIngress`, `runSupabaseStage4B3VisualSimulation`
- `app/src/lib/phase-85-if-c-channel-event-normalizer.ts` — group messages quarantined as `whatsapp_group_unsupported`
- `app/src/lib/app-state-store.ts` — `runFallbackStage4B3VisualSimulation`, `runFallbackStage4B3WorkerTick`
- `app/src/components/dashboard/simulator-panel.tsx` — visual simulator UI (fixture, caption, burst, upload, flush)
- `app/src/components/dashboard-app.tsx` — visual simulation state + handlers
- `app/src/lib/use-manu-state.ts` — `runVisualSimulation` multipart client
- `app/package.json` — `worker:media:stage4b3`, `worker:media:stage4b3:once`
- Tests: `phase-77ac-whatsapp-mock-webhook.test.ts`, `phase-77ad-whatsapp-channel-policy-mock.test.ts`

## Locked Behavior

- Single canonical ingress path: `processInboundWhatsAppChannelBatch` via `processCanonicalWhatsAppIngressInState`.
- Mock secret required via `x-manu-mock-webhook-secret` header or `webhook_secret` body field (stripped before normalize).
- Gate: `MANU_ALLOW_MOCK_WHATSAPP_WEBHOOK=true`, `MANU_MOCK_WHATSAPP_WEBHOOK_SECRET`, refuses production/hosted sandbox.
- Image ingress opens bundles without immediate client send; worker tick processes pending media, vision, and due bundles.
- Visual simulator uses injected clock for 120s silence; no real wait in tests.
- Text simulator and visual simulator both return refreshed `ManuAppState` on fallback store.
- No public internal worker HTTP endpoint; worker is CLI-only (`npm run worker:media:stage4b3`).

## Verification

Executed on 2026-07-14:

- `npx vitest run src/lib/phase-85-stage-4b3-canonical-ingress.test.ts src/lib/phase-77ac-whatsapp-mock-webhook.test.ts src/lib/phase-77ad-whatsapp-channel-policy-mock.test.ts src/lib/phase-85-stage-4b3-local-worker-runner.test.ts` — 29/29 passed
- `npm run lint` — clean (pre-existing warnings only)

## Next

- Phase 11 retention/DSAR/lifecycle closure
- Phase 12 golden corpus, red team, and Stage 4B-3 closure evidence before Stage 4C handoff
