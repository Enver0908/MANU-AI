# AIya Performance Phase 2 Execution Scope

Generated: 2026-09-10T08:05:36.077Z

Production decision remains `NO-GO`.

Phase 2 must use this file together with `docs/AIYA_PERFORMANCE_COMBINED_FINDING_MANIFEST.json`.

Allowed Phase 2 scope:

- Reproduce every `CONFIRMED_MEASUREMENT_GAP` and `CAUSE_CANDIDATE_MEASURED` item before editing runtime code.
- Fix only files named in a combined finding or test files that directly verify that finding.
- Preserve tenant/account/actor authorization, RLS assumptions, service-role boundaries, idempotency, no-store/fail-closed behavior, and network-only PWA behavior.
- Do not treat a faster unauthenticated, 401, fallback-only, skipped, simulated, or stale result as a PASS.

Findings:

- PERF-F2-001: Dashboard mount still performs broad /api/app-state hydration before measured task readiness is proven safe.
  Classification: SUPPORTED_UNDER_REVIEW
  Files: app/src/lib/use-aiya-state.ts, app/src/app/api/app-state/route.ts, app/src/lib/supabase-store.ts, app/src/components/dashboard-app.tsx
- PERF-F2-002: Timer-driven inbox, messaging, and AI chat refreshes can compete with initial navigation.
  Classification: SUPPORTED_UNDER_REVIEW
  Files: app/src/lib/use-stage-4b-inbox.ts, app/src/lib/use-stage-4b2-messaging.ts, app/src/lib/use-ai-chat.ts
- PERF-F2-003: Dashboard client entry statically imports a broad interaction surface.
  Classification: SUPPORTED_UNDER_REVIEW
  Files: app/src/components/dashboard-app.tsx, app/src/components/dashboard/**, app/src/app/dashboard/**
- PERF-F12-001: AI Chat must not be considered performance-ready when authenticated data requests fail.
  Classification: CONFIRMED_MEASUREMENT_GAP
  Files: app/scripts/measure-aiya-performance.mjs, app/scripts/measure-aiya-performance-phase-1-2.mjs, app/src/app/dashboard/ai-chat/page.tsx, app/src/lib/phase-85-stage-4c-route.ts
- PERF-F12-002: Warm authenticated journeys have failing or over-budget samples under the corrected harness.
  Classification: CAUSE_CANDIDATE_MEASURED
  Files: locked_by_phase_1_2_measurement

