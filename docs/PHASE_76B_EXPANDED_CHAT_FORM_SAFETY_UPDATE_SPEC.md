# Phase 76B Expanded Chat Form Safety Update Spec

Date: 2026-06-08

## Goal

Expand the dietitian chat update proposal flow so dietitians can quickly approve form and safety-profile updates from natural-language chat notes while keeping operational AI controls manual.

## Scope

- Chat proposals may update nutrition, plan, allergies/restrictions, and Phase 70 client safety-profile form fields.
- Safety-profile fields include pregnancy/breastfeeding, adult/minor status, diagnosed condition flag, medication/insulin flag, lab-result availability, recent symptom flag, and eating-disorder risk.
- Applied safety-profile patches update the active client form response and mirror supported `ClientRecord.healthProfile` fields.
- AI active/passive, AI mode, channel permission, opt-out, yellow hold resolution, red lock resolution, and autopilot/reactivation remain manual dashboard/handoff workflows.
- The flow is Gemini-ready but does not connect real Gemini or any external provider.

## UX Contract

- The dietitian sees one proposal card for the selected client.
- The card groups applicable patches and manual-only flags.
- `Apply` applies only supported form/safety patches.
- Unsupported operational requests remain visible as safety/manual flags and are never applied by this feature.
- A proposal with both supported form patches and unsupported operational requests remains pending so the useful form changes can still be approved.

## Safety Contract

- No chat text mutates form/context until explicit dietitian apply.
- Stale context revision apply fails closed.
- Removed/anonymized clients remain blocked.
- Sensitive detail fields marked `sensitive_never_prompt` may be written to form responses, but they must not become direct prompt/answerability sources.
- Applying a proposal increments context revision once, creates audit and Critical Context evidence, and invalidates pending drafts.

## Non-Goals

- No real Gemini extraction.
- No AI active/passive or mode mutation from chat.
- No red lock or yellow hold resolution from chat.
- No channel permission, opt-in, or opt-out mutation from chat.
- No production pilot approval or launch-gate closure.
