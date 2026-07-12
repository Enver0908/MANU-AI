# Phase 85 Stage 4B Phase 5 — Red Alert to Atomic AI Activation Evidence

Date: 2026-07-12  
Branch: `codex/phase-85-interstage-clinical-memory`  
Scope: Stage 4B Faz 5 only (UI + fallback simulator alignment; no RPC/migration changes)

## Goal

Make successful atomic AI activation the single sufficient operation that closes a red clinical alert. Red lock must not disable activation controls; it only locks configuration fields.

## Implemented changes

### Control gate split

- Added `resolveAiControlDisabledState()` with:
  - `activationDisabled`: removed client, global disabled, pending activation request
  - `configurationDisabled`: removed client, global disabled, red risk lock
- Red lock preflight item downgraded from `block` to `warn` in `collectAiPreflightBlockers()`.

### UI surfaces

- `ai-assistant-control-panel.tsx`
  - Red-lock CTA: **AI'yi etkinlestir ve kirmizi uyariyi kapat**
  - Configuration fieldset (mode/persona/schedule/takeover/safety checklist) stays disabled under red lock
  - Activation CTA remains enabled under red lock
- `conversation-panel.tsx`
  - Red-lock remediation copy updated; atomic activation CTA added
  - Manual reply no longer described as a red-lock resolver
- `operational-visibility.tsx` / `phase-85-if-h-operational-visibility.ts`
  - Replaced `requiresHandoffResolution` with `requiresAtomicRedActivation`
  - Human-control banner now shows activation CTA for red lock with dedicated i18n label

### API / state contract alignment

- Fallback simulator `updateClientInState()` now rejects direct `aiStatus=active` patch with `direct_ai_activation_requires_activate_ai_endpoint` (matching existing API route + Supabase patch guard).
- Existing `POST /api/clients/[id]/activate-ai` path unchanged; still uses expected client/conversation revision CAS and `activateClientAiWithControlledRiskResolutionInState`.
- `use-manu-state.ts` adds `refreshStage4BInboxSources()`; dashboard calls it after successful activation (no optimistic mutation on failure).

### i18n

Added 7-language keys:

- `humanControlActivateAiAndCloseRedAlert`
- `humanControlActivatingAi`
- `humanControlRedLockAtomicActivationHint`

## Atomic activation guarantees (existing backend, now surfaced in UI)

On successful `/activate-ai` under red lock:

1. `aiStatus=active`
2. `redRiskLock.status=reactivated` with `direct_dietitian_reactivation_v1`
3. linked handoff resolved
4. human-control session closed
5. pending unsafe drafts invalidated (via existing controlled activation path)
6. clinical alert projection clears red row (`projectClinicalAlertsFromState`)

On `409` revision conflict: no domain mutation (CAS fail-closed).

## Verification

```powershell
cd app
npm run lint
npm test
npm run build
```

Targeted new coverage:

- `app/src/lib/phase-85-stage-4b-phase-5-red-atomic-activation.test.ts`
- updated helper / app-state-store / risk-reactivation tests

## Out of scope (Faz 6+)

- URL-based alerts/notifications dashboard sections
- `use-stage-4b-inbox.ts` polling shell
- Navigation badges and header bell wiring

Production pilot remains **NO-GO**.

## Post-closure remediation reconciliation - 2026-07-12

The atomic activation contract remains the only red closure action. The remediation separated red-lock activation controls from red-lock configuration disablement and kept activation available under the lock for authorized actors, while assistant/auditor controls remain read-only. Full app and Stage 4B rehearsal verification passed; production pilot remains `NO-GO`.
